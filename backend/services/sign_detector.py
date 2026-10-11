import os
import sys
import base64
import math
import json
import importlib

# Configuration
DEVICE = "cpu"

# Candidate model locations
LOCAL_MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../models"))
CANDIDATE_DEV_DIRS = [
    r"g:\niral final\Niral_AI_Model\Niral AI Model",
    r"g:\niral final\Niral AI Model\Niral AI Model",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../Niral_AI_Model/Niral AI Model")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../Niral AI Model/Niral AI Model")),
    LOCAL_MODELS_DIR,
]

IMG_SIZE = 224
PAD = 40
CONF_THRESH = 22.0

# 51 classes fallback
DEFAULT_CLASSES = sorted([
    "01_palm", "02_l", "03_fist", "04_fist_moved", "05_thumb", "06_index", "07_ok", "08_palm_moved", "09_c", "1", "10_down", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "del", "nothing", "paper", "rock", "scissors", "space"
], key=str.lower)


def format_sign_label(raw: str) -> str:
    """Format technical class names into human-readable sign labels."""
    if not raw:
        return ""
    mapping = {
        "01_palm": "Palm", "02_l": "L-Sign", "03_fist": "Fist", "04_fist_moved": "Fist Move",
        "05_thumb": "Thumbs Up", "06_index": "Index Pointing", "07_ok": "OK Sign",
        "08_palm_moved": "Palm Move", "09_c": "C-Sign", "10_down": "Down Pointing",
        "del": "Delete", "space": "Space", "nothing": "No Sign"
    }
    if raw in mapping:
        return mapping[raw]
    clean = raw.replace("_", " ")
    return clean.capitalize() if len(clean) > 1 and clean.islower() else clean


def get_model_paths():
    """Locate model files prioritizing Niral AI Model folder for custom trained weights."""
    pytorch_env = os.environ.get("SIGN_MODEL_PATH")
    landmark_env = os.environ.get("LANDMARK_MODEL_PATH")

    if pytorch_env and os.path.exists(pytorch_env):
        pytorch_path = pytorch_env
    else:
        pytorch_path = None
        for dev_dir in CANDIDATE_DEV_DIRS:
            candidate = os.path.join(dev_dir, "best_sign_model.pth")
            if os.path.exists(candidate):
                pytorch_path = candidate
                break

    if landmark_env and os.path.exists(landmark_env):
        landmark_path = landmark_env
    else:
        landmark_path = None
        for dev_dir in CANDIDATE_DEV_DIRS:
            candidate = os.path.join(dev_dir, "hand_landmarker.task")
            if os.path.exists(candidate):
                landmark_path = candidate
                break

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
    index_ext = d3(0, 8) > (d3(0, 6) * 1.12)
    middle_ext = d3(0, 12) > (d3(0, 10) * 1.12)
    ring_ext = d3(0, 16) > (d3(0, 14) * 1.12)
    pinky_ext = d3(0, 20) > (d3(0, 18) * 1.12)

    # Thumb extension: tip (4) distance from pinky MCP (17) vs IP (3), and wrist (0) vs MCP (2)
    thumb_ext = (d3(4, 17) > d3(3, 17) * 1.08) and (d3(0, 4) > d3(0, 2) * 1.12)

    # Pinch detection between thumb tip (4) and index tip (8)
    pinch_dist = d3(4, 8)
    pinch_ratio = pinch_dist / palm_size
    is_pinch = pinch_ratio < 0.40

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
            self.last_error = None
            cv2 = importlib.import_module('cv2')
            np = importlib.import_module('numpy')
            torch = importlib.import_module('torch')
            nn = importlib.import_module('torch.nn')
            models = importlib.import_module('torchvision.models')
            transforms = importlib.import_module('torchvision.transforms')
            PILImage = importlib.import_module('PIL.Image')

            pytorch_path, landmark_path = get_model_paths()
            self.pytorch_path = pytorch_path
            self.landmark_path = landmark_path

            if not pytorch_path or not os.path.exists(pytorch_path):
                self.last_error = f"PyTorch model not found at {pytorch_path}"
                print(f"[SignDetector] {self.last_error}")
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

            # Attempt to initialize MediaPipe 3D Hand Landmarker (gracefully degrades to direct vision if missing EGL)
            self.landmarker = None
            if landmark_path and os.path.exists(landmark_path):
                try:
                    mp_python = importlib.import_module('mediapipe.tasks.python')
                    mp_vision = importlib.import_module('mediapipe.tasks.python.vision')
                    base_opts = mp_python.BaseOptions(model_asset_path=landmark_path)
                    lm_opts = mp_vision.HandLandmarkerOptions(
                        base_options=base_opts,
                        running_mode=mp_vision.RunningMode.IMAGE,
                        num_hands=1,
                        min_hand_detection_confidence=0.30,
                        min_hand_presence_confidence=0.30
                    )
                    self.landmarker = mp_vision.HandLandmarker.create_from_options(lm_opts)
                except Exception as mp_err:
                    print(f"[SignDetector] MediaPipe warning (running direct PyTorch vision): {mp_err}")

            self.ready = True
            print(f"[SignDetector] Ready with bundled models.")
            return True
        except Exception as e:
            self.last_error = f"{type(e).__name__}: {str(e)}"
            print(f"[SignDetector] Load warning: {self.last_error}")
            return False

    def _classify_roi(self, roi_bgr) -> tuple:
        """Classify a BGR image crop with MobileNetV3 and return top predictions."""
        if roi_bgr is None or roi_bgr.size == 0 or roi_bgr.shape[0] < 10 or roi_bgr.shape[1] < 10:
            return None, 0.0, []

        cv2 = importlib.import_module('cv2')
        torch = importlib.import_module('torch')
        PILImage = importlib.import_module('PIL.Image')

        rgb = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2RGB)
        x = self.tf(PILImage.fromarray(rgb)).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            probs = torch.softmax(self.model(x), dim=1)

        k = min(3, len(self.classes))
        top_probs, top_indices = torch.topk(probs, k, dim=1)

        top_preds = [
            {
                "sign": self.classes[top_indices[0][i].item()],
                "clean_sign": format_sign_label(self.classes[top_indices[0][i].item()]),
                "confidence": round(top_probs[0][i].item() * 100, 2)
            }
            for i in range(k)
        ]

        conf_val = round(top_probs[0][0].item() * 100, 2)
        sign = self.classes[top_indices[0][0].item()]
        return sign, conf_val, top_preds

    def predict_base64(self, b64_str: str) -> dict:
        if not self._ensure_loaded():
            return {"error": "Models not loaded"}

        try:
            cv2 = importlib.import_module('cv2')
            np = importlib.import_module('numpy')
            mp_framework = importlib.import_module('mediapipe')

            # Decode base64
            if "," in b64_str:
                b64_str = b64_str.split(",")[1]
            img_bytes = base64.b64decode(b64_str)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if frame is None:
                return {"error": "Invalid image"}

            H, W = frame.shape[:2]

            # Try MediaPipe Hand Landmarker first
            result = None
            if self.landmarker is not None:
                mp_img = mp_framework.Image(
                    image_format=mp_framework.ImageFormat.SRGB,
                    data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                )
                try:
                    result = self.landmarker.detect(mp_img)
                except Exception:
                    result = None

            # ── PATH A: MediaPipe found hand landmarks ──
            if result and result.hand_landmarks:
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

                finger_tracking = compute_finger_tracking(landmarks_list, handedness)
                finger_tracking["handedness_score"] = hand_conf

                # Centered square bounding box with 45% margin
                pts = [(lm.x, lm.y) for lm in raw_landmarks]
                xs = [p[0] * W for p in pts]
                ys = [p[1] * H for p in pts]
                cx = (min(xs) + max(xs)) / 2
                cy = (min(ys) + max(ys)) / 2
                box_size = max(max(xs) - min(xs), max(ys) - min(ys)) * 1.45
                x1 = max(0, int(cx - box_size / 2))
                y1 = max(0, int(cy - box_size / 2))
                x2 = min(W, int(cx + box_size / 2))
                y2 = min(H, int(cy + box_size / 2))

                finger_tracking["bbox"] = {
                    "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                    "width": x2 - x1, "height": y2 - y1,
                    "frame_width": W, "frame_height": H
                }
                finger_tracking["landmarks"] = landmarks_list

                # Classify the hand crop
                roi = frame[y1:y2, x1:x2]
                sign_lm, conf_lm, top_lm = self._classify_roi(roi)

                # If confidence is moderate, also evaluate center crop of the frame
                sign_center, conf_center, top_center = self._classify_roi(frame[int(H*0.1):int(H*0.9), int(W*0.1):int(W*0.9)])

                if conf_center > conf_lm and conf_center > 40.0:
                    best_sign, best_conf, best_top = sign_center, conf_center, top_center
                else:
                    best_sign, best_conf, best_top = sign_lm, conf_lm, top_lm

                return {
                    "sign": best_sign,
                    "clean_sign": format_sign_label(best_sign),
                    "confidence": best_conf,
                    "is_confident": best_conf >= CONF_THRESH,
                    "top_predictions": best_top,
                    "finger_tracking": finger_tracking,
                    "model_source": "Niral AI Model (MobileNetV3 + MediaPipe 3D Finger Tracking)"
                }

            # ── PATH B: MediaPipe did not find hand (Fists, A, S, E, pointing, angled) ──
            # Use Direct MobileNetV3 Multi-Scale Vision on Center Crop & Full Frame
            crop_size = int(min(H, W) * 0.75)
            cx, cy = W // 2, H // 2
            x1 = max(0, cx - crop_size // 2)
            y1 = max(0, cy - crop_size // 2)
            x2 = min(W, x1 + crop_size)
            y2 = min(H, y1 + crop_size)

            center_roi = frame[y1:y2, x1:x2]
            sign_center, conf_center, top_center = self._classify_roi(center_roi)
            sign_full, conf_full, top_full = self._classify_roi(frame)

            if conf_center >= conf_full:
                best_sign, best_conf, best_top = sign_center, conf_center, top_center
            else:
                best_sign, best_conf, best_top = sign_full, conf_full, top_full

            # If confidence is reasonable and not background "nothing"
            if best_sign and best_sign != "nothing" and best_conf >= 18.0:
                # Synthesize gesture hint from known sign semantics
                if best_sign in ["03_fist", "04_fist_moved", "A", "S", "E", "M", "N", "T"]:
                    gesture = "Fist / Closed Fingers"
                elif best_sign in ["01_palm", "08_palm_moved", "5", "B", "paper"]:
                    gesture = "Open Palm"
                elif best_sign in ["06_index", "1", "D"]:
                    gesture = "Pointing"
                elif best_sign in ["05_thumb"]:
                    gesture = "Thumbs Up"
                elif best_sign in ["07_ok", "F"]:
                    gesture = "Pinch / OK Sign"
                elif best_sign in ["2", "V", "scissors"]:
                    gesture = "Victory / Peace"
                elif best_sign in ["02_l", "L"]:
                    gesture = "L-Sign"
                else:
                    gesture = "Hand Detected"

                finger_tracking = {
                    "handedness": "Detected",
                    "handedness_score": round(best_conf / 100.0, 2),
                    "gesture_hint": gesture,
                    "extended_count": 0 if "Fist" in gesture else (5 if "Open Palm" in gesture else 1),
                    "is_pinch": "Pinch" in gesture,
                    "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2, "width": x2 - x1, "height": y2 - y1, "frame_width": W, "frame_height": H},
                    "landmarks": []
                }

                return {
                    "sign": best_sign,
                    "clean_sign": format_sign_label(best_sign),
                    "confidence": best_conf,
                    "is_confident": best_conf >= CONF_THRESH,
                    "top_predictions": best_top,
                    "finger_tracking": finger_tracking,
                    "model_source": "Niral AI Model (MobileNetV3 + MediaPipe 3D Finger Tracking)"
                }

            return {
                "sign": None,
                "confidence": 0,
                "clean_sign": "",
                "top_predictions": [],
                "message": "Position hand in camera frame",
                "model_source": "Niral AI Model"
            }

        except Exception as e:
            print(f"[SignDetector] Error: {e}")
            return {"error": str(e)}


# Singleton instance
detector = SignDetector()


