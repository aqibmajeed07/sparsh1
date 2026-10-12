# SPARSH AI Smart Gloves — ESP32 + MPU-6050 Hand Gesture Guide

Firmware for the **SPARSH AI Smart Gloves** combining 5-finger flex sensors with an **MPU-6050 6-Axis Motion Sensor** (Accelerometer + Gyroscope) for real-time sign language recognition, hand orientation tracking, and dynamic gesture detection.

---

## 🎯 Hand Gestures Detected by MPU-6050

The firmware includes an **on-board real-time gesture recognition engine**:

### 1. Static Hand Orientations (Postures)
* **`PALM_DOWN`**: Normal resting hand pose (palm facing table).
* **`PALM_UP`**: Supination pose (palm turned upward to ceiling).
* **`HAND_UP`**: Hand raised upright (e.g., "STOP" or "HELLO" ready pose, Pitch > 45°).
* **`HAND_DOWN`**: Hand pointing downward (Pitch < -45°).
* **`TILT_LEFT`**: Wrist tilted to the left (Roll < -45°).
* **`TILT_RIGHT`**: Wrist tilted to the right (Roll > 45°).

### 2. Dynamic Motion Gestures
* **`WAVE`**: Horizontal back-and-forth hand waving motion.
* **`SWIPE_LEFT` / `SWIPE_RIGHT`**: Quick horizontal flick/swipe of the hand.
* **`SWIPE_UP` / `SWIPE_DOWN`**: Quick vertical flick of the hand.
* **`TAP` / `IMPACT`**: Forward fist-bump or surface tap impact.

> **Haptic Feedback:** Whenever a dynamic gesture (like `WAVE` or `SWIPE`) is detected, the glove automatically delivers a **tactile vibration buzz** to confirm recognition!

---

## 🔌 Hardware Pin Connections

```
                         ESP32 DevKit v1
                   ┌────────────────────────┐
                   │                        │
  Thumb Flex  ───> │ GPIO 36 (VP)       GND │ ─── Common GND
  Index Flex  ───> │ GPIO 39 (VN)      3.3V │ ─── 3.3V Power Rail
  Middle Flex ───> │ GPIO 34                │
  Ring Flex   ───> │ GPIO 35        GPIO 21 │ ─── MPU-6050 SDA
  Little Flex ───> │ GPIO 32        GPIO 22 │ ─── MPU-6050 SCL
                   │                        │
  Haptic Motor───> │ GPIO 4          GPIO 2 │ ─── Built-in Status LED
                   └────────────────────────┘
```

### MPU-6050 Wiring:
| MPU-6050 Pin | ESP32 Pin | Notes |
| :--- | :--- | :--- |
| **VCC** | **3.3V** | Power (do not connect to 5V unless board has regulator) |
| **GND** | **GND** | Ground |
| **SDA** | **GPIO 21** | I2C Data line |
| **SCL** | **GPIO 22** | I2C Clock line |
| **AD0** | **GND** | Sets I2C address to `0x68` (firmware also auto-checks `0x69`) |
| **INT** | *Not needed* | Left disconnected (polling at ~28 Hz) |

---

## ⚙️ How MPU-6050 Calibration Works
1. When you power on the glove, the ESP32 automatically runs a **2-second gyro zero-rate calibration**.
2. **Keep the glove resting still on a flat table** for 2 seconds while the blue LED stays on.
3. Once calibrated, the glove vibrates with a quick chirp and starts streaming drift-free `pitch`, `roll`, and `yaw`.

---

## 💻 Arduino IDE Setup
1. Open `hardware/SparshSmartGlove/SparshSmartGlove.ino` in Arduino IDE.
2. Select Board: **ESP32 Dev Module**.
3. Settings:
   - **Upload Speed:** `115200`
   - **Flash Frequency:** `80MHz`
   - **Partition Scheme:** `Huge APP (3MB No OTA/1MB SPIFFS)`
4. Click **Upload (→)**.
5. Open Serial Monitor at **115200 baud** to see live flex values, pitch, roll, and detected gestures!
