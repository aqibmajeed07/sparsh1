# SPARSH VoiceVision — Smart Glasses Camera Integration

This directory contains the firmware for the **SPARSH Smart Glasses**, enabling hands-free visual assistance for visually impaired students.

---

## 👓 Hardware Architecture & Flow

```
+─────────────────────────────────────────────────────────────────────────────+
│                       SPARSH SMART GLASSES (ESP32-S3)                       │
│                                                                             │
│  [ OV3660 / OV2640 Camera ]        [ Tactile Button on Frame (GPIO 0) ]    │
│            │                                         │                      │
│            ▼                                         ▼                      │
│   GET /capture (Port 80)                   POST /api/glasses/frame          │
│   (X-Device-Token protected)               (X-Device-Token + JPEG)          │
+────────────▲─────────────────────────────────────────┬──────────────────────+
             │                                         │
             │ LAN                                     │ LAN
             ▼                                         ▼
+─────────────────────────────────────────────────────────────────────────────+
│                         SPARSH FASTAPI BACKEND                              │
│                                                                             │
│   GET  /api/glasses/status        -> Checks glasses LAN connectivity        │
│   POST /api/glasses/vision        -> Fetches frame -> Multimodal VLM -> TTS │
│   POST /api/glasses/frame         -> Receives button press frame -> VLM     │
│   GET  /api/glasses/button-result -> Frontend polling -> speaks result      │
+─────────────────────────────────────────────────────────────────────────────+
             ▲
             │ HTTPS / Proxied Next.js
             ▼
+─────────────────────────────────────────────────────────────────────────────+
│                     SPARSH NEXT.JS 14 FRONTEND                              │
│                                                                             │
│   • Voice: "Describe what is in front of me", "Read this page"             │
│   • Background poll: automatically speaks when student taps button         │
+─────────────────────────────────────────────────────────────────────────────+
```

---

## 🛠️ Hardware Requirements

1. **Board Options (Choose one):**
   - **Recommended:** Seeed Studio **XIAO ESP32S3 Sense** (very small, mounts cleanly to glasses temple)
   - **Alternative 1:** Freenove **ESP32-S3 WROVER CAM**
   - **Alternative 2:** AI-Thinker **ESP32-CAM** (Classic ESP32)
   - **Alternative 3:** Espressif **ESP32-S3-EYE**
2. **Camera Sensor:** OV3660 (3MP) or OV2640 (2MP)
3. **Button:** Tactile momentary push button mounted on the temple of the frame connected between GPIO 0 and GND.
4. **Battery:** 3.7V LiPo battery (300mAh - 500mAh) + TP4056 charger or on-board battery charging circuit on the XIAO board.

---

## ⚙️ Configuration & Flashing

### 1. Configure Credentials
Edit `secrets.h`:
```c
#define WIFI_SSID           "Your_WiFi_SSID"
#define WIFI_PASSWORD       "Your_WiFi_Password"
#define DEVICE_TOKEN        "sparsh_glasses_secret_token_12345"
#define BACKEND_URL         "http://192.168.1.100:8000"
```

### 2. Configure Backend `.env`
In `sparsh/backend/.env`:
```env
GLASSES_URL=http://<IP_PRINTED_ON_SERIAL_MONITOR>
GLASSES_DEVICE_TOKEN=sparsh_glasses_secret_token_12345
```

### 3. Flash Using Arduino IDE
1. Open `hardware/SparshSmartGlasses/SparshSmartGlasses.ino`.
2. Select Board:
   - For XIAO: `XIAO_ESP32S3` -> Enable **PSRAM: "OPI PSRAM"**.
   - For ESP32-CAM: `AI Thinker ESP32-CAM`.
3. Open Serial Monitor at **115200 baud**.
4. When connected, note the IP printed:
   ```
   [WiFi] Connected successfully!
   [WiFi] IP Address: 192.168.43.57
   Set backend env var:
     GLASSES_URL=http://192.168.43.57
   ```
