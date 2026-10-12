# SPARSH VoiceVision — Smart Glasses (ESP32-S3 + OV3660)

Arduino IDE sketch for the **SPARSH VoiceVision Smart Glasses**.
Captures on-demand JPEG camera frames for the FastAPI backend and supports tactile button triggering.

---

## 📁 Sketch Files
* `SparshGlasses.ino` — Main Arduino sketch (Port 80 webserver with `/status`, `/capture`, button interrupt)
* `secrets.h` — Wi-Fi credentials (`Aqib`), device token, and backend URL
* `camera_pins.h` — Pin configurations for Xiao ESP32S3 Sense, ESP32S3 EYE, Freenove, and AI-Thinker

---

## 🛠️ Arduino IDE Setup
1. **Install Board Package:**
   - Tools > Board > Boards Manager > search `esp32` by Espressif Systems (v3.x or latest)
2. **Board Settings:**
   - **Board:** `XIAO_ESP32S3` (or `ESP32S3 Dev Module`)
   - **PSRAM:** `OPI PSRAM` (or QSPI PSRAM depending on module)
   - **Flash Size:** `8MB` (or matching your module marking)
   - **Partition Scheme:** `Huge APP (3MB No OTA/1MB SPIFFS)`
   - **USB CDC On Boot:** `Enabled`
3. **Flashing:**
   - Plug in USB-C cable to the ESP32-S3 board.
   - Select Port > Click **Upload**.
   - Open **Serial Monitor** at **115200 baud**.
4. **On Boot:**
   The board joins the Wi-Fi network `Aqib` and prints:
   ```
   [wifi] connected! IP: 10.93.154.xxx
   [ok] SPARSH Smart Glasses Ready!
   ```
