import os
import sys
import base64
import math
import json
import importlib

# Configuration
DEVICE = "cpu"

# Bundled local model directory (inside app for self-contained deployment)
LOCAL_MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../models"))
# Fallback dev model directory
DEV_MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../Niral AI Model/Niral AI Model"))

IMG_SIZE = 224
PAD = 30
CONF_THRESH = 35.0

# 51 classes fallback
DEFAULT_CLASSES = sorted([
    "01_palm", "02_l", "03_fist", "04_fist_moved", "05_thumb", "06_index", "07_ok", "08_palm_moved", "09_c", "1", "10_down", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "del", "nothing", "paper", "rock", "scissors", "space"
], key=str.lower)


def get_model_paths():
    """Locate model files prioritizing bundled app models for production deployment."""
    pytorch_env = os.environ.get("SIGN_MODEL_PATH")
    landmark_env = os.environ.get("LANDMARK_MODEL_PATH")

    local_pytorch = os.path.join(LOCAL_MODELS_DIR, "best_sign_model.pth")
    local_landmark = os.path.join(LOCAL_MODELS_DIR, "hand_landmarker.task")

    dev_pytorch = os.path.join(DEV_MODELS_DIR, "best_sign_model.pth")
    dev_landmark = os.path.join(DEV_MODELS_DIR, "hand_landmarker.task")

    pytorch_path = pytorch_env if pytorch_env and os.path.exists(pytorch_env) else (
        local_pytorch if os.path.exists(local_pytorch) else dev_pytorch
    )
    landmark_path = landmark_env if landmark_env and os.path.exists(landmark_env) else (
        local_landmark if os.path.exists(local_landmark) else dev_landmark
    )
    return pytorch_path, landmark_path


def load_classes():
    classes_file = os.path.join(LOCAL_MODELS_DIR, "classes.json")
    if os.path.exists(classes_file):
        try:
            with open(classes_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return DEFAULT_CLASSES


def compute_finger_tracking(landmarks: list, handedness: str = "Right") -> dict:
    """Calculate 3D finger tracking states: joint extension, curl, pinch detection, and gestures."""
    if not landmarks or len(landmarks) < 21:
        return {}

    def d3(i1: int, i2: int) -> float:
        p1 = landmarks[i1]
        p2 = landmarks[i2]
        return math.sqrt((p1['x'] - p2['x'])**2 + (p1['y'] - p2['y'])**2 + (p1['z'] - p2['z'])**2)

    palm_size = max(d3(0, 9), 1e-5)  # Wrist (0) to Middle MCP (9)

    # Extension test using distance from wrist relative to PIP
    index_ext = d3(0, 8) > (d3(0, 6) * 1.15)
    middle_ext = d3(0, 12) > (d3(0, 10) * 1.15)
    ring_ext = d3(0, 16) > (d3(0, 14) * 1.15)
    pinky_ext = d3(0, 20) > (d3(0, 18) * 1.15)

    # Thumb extension: tip (4) distance from pinky MCP (17) vs IP (3), and wrist (0) vs MCP (2)
    thumb_ext = (d3(4, 17) > d3(3, 17) * 1.10) and (d3(0, 4) > d3(0, 2) * 1.15)

    # Pinch detection between thumb tip (4) and index tip (8)
    pinch_dist = d3(4, 8)
    pinch_ratio = pinch_dist / palm_size
    is_pinch = pinch_ratio < 0.38

    fingers = {
        "thumb": {
            "extended": bool(thumb_ext),
            "tip": {"x": round(landmarks[4]['x'], 4), "y": round(landmarks[4]['y'], 4), "z": round(landmarks[4]['z'], 4)}
        },
        "index": {
            "extended": bool(index_ext),
            "tip": {"x": round(landmarks[8]['x'], 4), "y": round(landmarks[8]['y'], 4), "z": round(landmarks[8]['z'], 4)}
        },
        "middle": {
            "extended": bool(middle_ext),
            "tip": {"x": round(landmarks[12]['x'], 4), "y": round(landmarks[12]['y'], 4), "z": round(landmarks[12]['z'], 4)}
        },
        "ring": {
            "extended": bool(ring_ext),
            "tip": {"x": round(landmarks[16]['x'], 4), "y": round(landmarks[16]['y'], 4), "z": round(landmarks[16]['z'], 4)}
        },
        "pinky": {
            "extended": bool(pinky_ext),
            "tip": {"x": round(landmarks[20]['x'], 4), "y": round(landmarks[20]['y'], 4), "z": round(landmarks[20]['z'], 4)}
        }
    }

    extended_count = sum(1 for f in fingers.values() if f["extended"])

    if is_pinch:
        gesture = "Pinch / OK Sign"
    elif extended_count == 5:
        gesture = "Open Palm"
    elif extended_count == 0:
        gesture = "Fist"
    elif index_ext and not middle_ext and not ring_ext and not pinky_ext and not thumb_ext:
        gesture = "Pointing"
    elif index_ext and middle_ext and not ring_ext and not pinky_ext and not thumb_ext:
        gesture = "Victory / Peace"
    elif thumb_ext and index_ext and not middle_ext and not ring_ext and not pinky_ext:
        gesture = "L-Sign"
    elif thumb_ext and not index_ext and not middle_ext and not ring_ext and not pinky_ext:
        gesture = "Thumbs Up"
    elif thumb_ext and pinky_ext and not index_ext and not middle_ext and not ring_ext:
        gesture = "Call / Shaka"
    elif not thumb_ext and index_ext and middle_ext and ring_ext and pinky_ext:
        gesture = "Four Fingers"
    elif index_ext and middle_ext and ring_ext and not pinky_ext:
        gesture = "Three Fingers"
    else:
        gesture = f"{extended_count} Fingers Extended"

    return {
        "handedness": handedness,
        "fingers": fingers,
        "extended_count": extended_count,
        "is_pinch": bool(is_pinch),
        "pinch_ratio": round(pinch_ratio, 3),
        "pinch_distance": round(pinch_dist, 4),
        "gesture_hint": gesture
    }


class SignDetector:
    def __init__(self):
        self.ready = False
        self.model = None
        self.landmarker = None
        self.tf = None
        self.classes = load_classes()

    def _ensure_loaded(self):
        if self.ready:
            return True
        try:
            cv2 = importlib.import_module('cv2')
            np = importlib.import_module('numpy')
            torch = importlib.import_module('torch')
            nn = importlib.import_module('torch.nn')
            models = importlib.import_module('torchvision.models')
            transforms = importlib.import_module('torchvision.transforms')
            PILImage = importlib.import_module('PIL.Image')
            mp_python = importlib.import_module('mediapipe.tasks.python')
            mp_vision = importlib.import_module('mediapipe.tasks.python.vision')

            pytorch_path, landmark_path = get_model_paths()

            if not os.path.exists(pytorch_path) or not os.path.exists(landmark_path):
                print(f"[SignDetector] Model paths not found: {pytorch_path}, {landmark_path}")
                return False

            self.classes = load_classes()
            print(f"[SignDetector] Loading model ({len(self.classes)} classes) from {pytorch_path} on {DEVICE}...")
            self.model = models.mobilenet_v3_small(weights=None)
            self.model.classifier[3] = nn.Linear(self.model.classifier[3].in_features, len(self.classes))
            self.model.load_state_dict(torch.load(pytorch_path, map_location=DEVICE))
            self.model.to(DEVICE).eval()

            self.tf = transforms.Compose([
                transforms.Resize((IMG_SIZE, IMG_SIZE)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ])

            base_opts = mp_python.BaseOptions(model_asset_path=landmark_path)
            lm_opts = mp_vision.HandLandmarkerOptions(
                base_options=base_opts,
                running_mode=mp_vision.RunningMode.IMAGE,
                num_hands=1,
                min_hand_detection_confidence=0.55,
                min_hand_presence_confidence=0.55
            )
            self.landmarker = mp_vision.HandLandmarker.create_from_options(lm_opts)
            self.ready = True
            print(f"[SignDetector] Ready with bundled models.")
            return True
        except Exception as e:
            print(f"[SignDetector] Load warning: {e}")
            return False

    def predict_base64(self, b64_str: str) -> dict:
        if not self._ensure_loaded():
            return {"error": "Models not loaded"}

        try:
            cv2 = importlib.import_module('cv2')
            np = importlib.import_module('numpy')
            torch = importlib.import_module('torch')
            mp_framework = importlib.import_module('mediapipe')
            PILImage = importlib.import_module('PIL.Image')

            # Decode base64
            if "," in b64_str:
                b64_str = b64_str.split(",")[1]
            img_bytes = base64.b64decode(b64_str)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if frame is None:
                return {"error": "Invalid image"}

            H, W = frame.shape[:2]

            # MediaPipe Hand Landmark Detection
            mp_img = mp_framework.Image(
                image_format=mp_framework.ImageFormat.SRGB,
                data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            )
            result = self.landmarker.detect(mp_img)

            if not result.hand_landmarks:
                return {"sign": None, "confidence": 0, "message": "No hand detected"}

            raw_landmarks = result.hand_landmarks[0]
            landmarks_list = [
                {"x": round(float(lm.x), 4), "y": round(float(lm.y), 4), "z": round(float(lm.z), 4)}
                for lm in raw_landmarks
            ]

            handedness = "Right"
            hand_conf = 1.0
            if result.handedness and len(result.handedness) > 0 and len(result.handedness[0]) > 0:
                handedness = result.handedness[0][0].category_name
                hand_conf = round(float(result.handedness[0][0].score), 3)

            # Compute 3D finger tracking analytics
            finger_tracking = compute_finger_tracking(landmarks_list, handedness)
            finger_tracking["handedness_score"] = hand_conf

            # Dynamic Bounding Box
            pts = [(lm.x, lm.y) for lm in raw_landmarks]
            xs = [p[0] * W for p in pts]
            ys = [p[1] * H for p in pts]
            x1 = max(0, int(min(xs)) - PAD)
            y1 = max(0, int(min(ys)) - PAD)
            x2 = min(W, int(max(xs)) + PAD)
            y2 = min(H, int(max(ys)) + PAD)

            bbox = {
                "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                "width": x2 - x1, "height": y2 - y1,
                "frame_width": W, "frame_height": H
            }
            finger_tracking["bbox"] = bbox
            finger_tracking["landmarks"] = landmarks_list

            roi = frame[y1:y2, x1:x2]
            if roi.size == 0 or roi.shape[0] < 10 or roi.shape[1] < 10:
                return {
                    "sign": None,
                    "confidence": 0,
                    "message": "Hand too close to edge",
                    "finger_tracking": finger_tracking
                }

            rgb = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
            x = self.tf(PILImage.fromarray(rgb)).unsqueeze(0).to(DEVICE)
            with torch.no_grad():
                probs = torch.softmax(self.model(x), dim=1)
            conf, idx = torch.max(probs, 1)

            conf_val = round(conf.item() * 100, 2)
            sign = self.classes[idx.item()]

            return {
                "sign": sign,
                "confidence": conf_val,
                "is_confident": conf_val >= CONF_THRESH,
                "finger_tracking": finger_tracking
            }

        except Exception as e:
            print(f"[SignDetector] Error: {e}")
            return {"error": str(e)}


# Singleton instance
detector = SignDetector()

