# SPARSH AI Smart Glove — ESP32 Firmware & Hardware Guide

## 1. Hardware Overview
The SPARSH AI Smart Glove translates 5-finger flex sensor deflection into digitized sign language characters, words, and text-to-speech.

### Component Bill of Materials (BOM):
| Component | Quantity | Specification / Description |
|---|---|---|
| **Microcontroller** | 1 | Classic ESP32-WROOM-32 / LILYGO Dev Module (38-pin or 30-pin) |
| **Flex Sensors** | 5 | 2.2" or 4.5" Flex Resistors (Flat: ~10kΩ–25kΩ, Bent: ~30kΩ–60kΩ) |
| **Resistors** | 5 | 10kΩ ¼W Resistors (Pull-down voltage divider) |
| **Power Source** | 1 | 5V USB (via Micro-USB / Type-C) or 3.7V LiPo with boost to 3.3V/5V |
| **Glove & Wires** | 1 set | Flexible cotton/nylon glove, silicone hookup wire, heat shrink tubing |

---

## 2. Electrical Wiring Diagram (Voltage Divider)

All 5 sensors MUST be wired to **ADC1** pins on the Classic ESP32 because ADC2 is disabled whenever the Wi-Fi or Bluetooth radio is active.

```
                    3.3V (Pin on ESP32)
                       │
                 [Flex Sensor]
                       │
       Signal Node ────┼──────── GPIO Analog Pin on ESP32
                       │
                 [10kΩ Resistor]
                       │
                      GND (Pin on ESP32)
```

### Pin Mapping (Classic ESP32-WROOM-32):
| Finger | ESP32 GPIO Pin | ADC Channel | Direction | Notes |
|---|---|---|---|---|
| **Thumb** | `GPIO 34` | `ADC1_CH6` | Input Only | Confirmed test pin (~1600 bent) |
| **Index** | `GPIO 35` | `ADC1_CH7` | Input Only | Dedicated ADC1 |
| **Middle** | `GPIO 32` | `ADC1_CH4` | Input/Output | Dedicated ADC1 |
| **Ring** | `GPIO 33` | `ADC1_CH5` | Input/Output | Dedicated ADC1 |
| **Little (Pinky)** | `GPIO 36` (VP) | `ADC1_CH0` | Input Only | Dedicated ADC1 |
| **Status LED** | `GPIO 2` | Digital Out | Output | Onboard Blue LED |

> [!CAUTION]
> Never connect flex sensors to the 5V rail. The ESP32 ADC cannot tolerate voltages above 3.3V. Always use the ESP32 3.3V rail.

---

## 3. Communication Transports Supported

### Mode A: Web Bluetooth (BLE) — Direct Browser Pairing
- **Service UUID**: `6e400001-b5a3-f393-e0a9-e50e24dcca9e` (Nordic UART Service)
- **TX Characteristic** (Notify): `6e400003-b5a3-f393-e0a9-e50e24dcca9e`
- **RX Characteristic** (Write): `6e400002-b5a3-f393-e0a9-e50e24dcca9e`
- **Device Advertised Name**: `SparshSmartGlove`
- **Connection**: One-click pairing directly in Google Chrome / Microsoft Edge without installing external drivers.

### Mode B: USB Serial (Web Serial API)
- **Baud Rate**: `115200`
- **Format**: Newline-delimited JSON lines:
  ```json
  {"type":"sensor_data","seq":142,"thumb":1250,"index":980,"middle":1100,"ring":900,"little":1050,"norm":[0.15,0.88,0.10,0.12,0.91],"calibrated":true}
  ```

### Mode C: Wi-Fi HTTP / WebSocket
- Dynamically configurable via `SET_WIFI:<ssid>:<pass>:<url>` command.
- Streams telemetry packets directly to SPARSH FastAPI backend.

---

## 4. Arduino IDE Flashing Instructions

1. Open **Arduino IDE**.
2. Go to **File → Preferences**, add ESP32 package URL:
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. Install **esp32** board package (by Espressif Systems).
4. Select **Tools → Board → ESP32 Dev Module**.
5. Set:
   - **Upload Speed**: `115200`
   - **Flash Frequency**: `80MHz`
   - **CPU Frequency**: `240MHz`
   - **Port**: Select your COM port (e.g. `COM3` on Windows).
6. Click **Upload** (hold the `BOOT` button on ESP32 if upload stays on `Connecting...`).

---

## 5. Serial Calibration Commands
Send any of the following over Serial Monitor (115200 baud, newline enabled):
- `CAL_STRAIGHT`: Records flat open-hand baseline.
- `CAL_BENT`: Records fully curled bent-finger baseline.
- `SAVE_CAL`: Validates delta and saves to non-volatile flash (NVS).
- `RESET_CAL`: Resets calibration to defaults.
- `GET_INFO`: Returns firmware version, uptime, and calibration state.
