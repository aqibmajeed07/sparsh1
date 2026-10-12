# SPARSH AI Smart Gloves — Hardware & Firmware Guide

Firmware for the **SPARSH AI Smart Gloves** enabling real-time 5-finger sign language recognition, 3D hand avatar synchronization, and haptic feedback for deaf-blind learners.

---

## 🧤 Features
- **5-Finger Flex Telemetry:** 12-bit ADC readings (0–4095 counts) smoothed with 8× oversampling and Exponential Moving Average (EMA) filtering.
- **Dual Transport:**
  - **Web Bluetooth (BLE):** Nordic UART Service (NUS) for wireless connection directly to Chrome / Edge.
  - **Web Serial (USB):** Zero-latency wired serial streaming at 115200 baud.
- **Wrist Orientation:** Integrated MPU-6050 6-Axis IMU for pitch/roll detection (auto-detected with non-blocking fallback if omitted).
- **Haptic Vibration Feedback:** ERM coin motor provides tactile alerts and sign confirmations.
- **All-in-One Standalone:** Zero external header files required; paste or open directly in Arduino IDE.

---

## 🔌 Wiring Diagram

```
                         ESP32 DevKit v1
                   ┌────────────────────────┐
                   │                        │
  Thumb Flex  ───> │ GPIO 36 (VP)       GND │ ─── Common GND
  Index Flex  ───> │ GPIO 39 (VN)      3.3V │ ─── 3.3V Power Rail
  Middle Flex ───> │ GPIO 34                │
  Ring Flex   ───> │ GPIO 35        GPIO 21 │ ─── MPU6050 SDA
  Little Flex ───> │ GPIO 32        GPIO 22 │ ─── MPU6050 SCL
                   │                        │
  Haptic Motor───> │ GPIO 4          GPIO 2 │ ─── Built-in Status LED
                   └────────────────────────┘
```

### Flex Sensor Voltage Divider Circuit (Repeat for all 5 fingers):
```
  3.3V  ─────────── [ Flex Sensor (~10kΩ - 30kΩ) ] ───┬───> ESP32 ADC GPIO (36/39/34/35/32)
                                                      │
                                             [ 10kΩ Resistor ]
                                                      │
  GND   ──────────────────────────────────────────────┴───> GND
```

### Vibration Motor Circuit:
```
  ESP32 GPIO 4 ──[ 100Ω Resistor ]── Base of NPN Transistor (2N2222 / BC547)
                                      Collector ── Motor (–)
                                      Emitter   ── GND
  3.3V / 5V    ───────────────────── Motor (+) ── [ 1N4007 Diode ] ── GND (Reverse flyback)
```

---

## 🛠️ Arduino IDE Setup
1. Open `hardware/SparshSmartGlove/SparshSmartGlove.ino` in Arduino IDE.
2. Select Board: **Tools > Board > ESP32 Arduino > ESP32 Dev Module**.
3. Settings:
   - **Upload Speed:** `115200` (or `921600`)
   - **Flash Frequency:** `80MHz`
   - **Partition Scheme:** `Huge APP (3MB No OTA/1MB SPIFFS)`
4. Click **Upload (→)**.

---

## 🌐 Connecting to the SPARSH Web App
1. Open your browser and navigate to:
   ```
   http://localhost:3000/student/smart-gloves
   ```
2. Click **"Connect via Bluetooth"** (search for `SparshSmartGlove`) or plug in the USB cable and click **"Connect via USB Serial"**.
3. Go to the **Calibration Tab** to calibrate straight vs bent hand poses in 3 easy steps!
