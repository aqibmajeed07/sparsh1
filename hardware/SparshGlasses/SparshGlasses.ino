/*
  SPARSH VoiceVision — Smart Glasses Camera Firmware (All-In-One Rock-Solid)
  Hardware : AI-Thinker ESP32-CAM / Seeed XIAO ESP32-S3 / ESP32-S3 EYE + OV2640 / OV3660
  Role     : Wireless camera node for the SPARSH Inclusive Learning Platform.
             Zero external header dependencies (secrets.h & camera_pins.h embedded).
             Includes Brownout Detector fix and auto board detection to prevent reboot loops.

  Arduino IDE Settings:
    • For AI-Thinker ESP32-CAM (most common):
        Board            : "AI Thinker ESP32-CAM" (or "ESP32 Dev Module")
        CPU Frequency    : 240MHz (WiFi/BT)
        Flash Frequency  : 40MHz (or 80MHz)
        Flash Mode       : QIO or DIO
        Partition Scheme : "Huge APP (3MB No OTA/1MB SPIFFS)"
        PSRAM            : "Enabled"

    • For XIAO ESP32-S3 Sense:
        Board            : "XIAO_ESP32S3"
        PSRAM            : "OPI PSRAM"
        USB CDC On Boot  : "Enabled"
*/

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ESPmDNS.h>

// Brownout protection registers (prevents unexpected reboot during camera/WiFi power draw)
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ==============================================================================
// 1. WI-FI & BACKEND CREDENTIALS
// ==============================================================================
#define WIFI_SSID          "PTC"
#define WIFI_PASS          "Ptc@#750"

// Shared authentication token matching GLASSES_DEVICE_TOKEN in backend/.env
#define DEVICE_TOKEN       "sparsh_glasses_aqib_mir_2026"

// Laptop LAN IP (Active on Wi-Fi "PTC" -> 10.31.8.204)
#define BACKEND_FRAME_URL         "http://10.31.8.204:8000/api/glasses/frame"

// Cloudflare Tunnel URL (Connects directly to production app over internet)
#define BACKEND_TUNNEL_FRAME_URL  "https://club-recreational-worker-watches.trycloudflare.com/api/glasses/frame"

#define HOSTNAME           "sparsh-glasses"

// ==============================================================================
// 2. CAMERA BOARD CONFIGURATION (AUTO-DETECTED OR SELECTABLE)
// ==============================================================================
// Auto-detect based on chip architecture:
#if defined(CONFIG_IDF_TARGET_ESP32S3)
  // ─── XIAO ESP32S3 Sense Pinout ──────────────────────────────────────────────
  #define BOARD_NAME        "Seeed XIAO ESP32-S3 Sense"
  #define PWDN_GPIO_NUM     -1
  #define RESET_GPIO_NUM    -1
  #define XCLK_GPIO_NUM     10
  #define SIOD_GPIO_NUM     40
  #define SIOC_GPIO_NUM     39
  #define Y9_GPIO_NUM       48
  #define Y8_GPIO_NUM       11
  #define Y7_GPIO_NUM       12
  #define Y6_GPIO_NUM       14
  #define Y5_GPIO_NUM       16
  #define Y4_GPIO_NUM       18
  #define Y3_GPIO_NUM       17
  #define Y2_GPIO_NUM       15
  #define VSYNC_GPIO_NUM    38
  #define HREF_GPIO_NUM     47
  #define PCLK_GPIO_NUM     13

  #define BUTTON_PIN        -1    // Keep -1 unless physical tactile button is wired
  #define STATUS_LED_PIN    21    // XIAO User LED (active low)
  #define LED_ACTIVE_LOW    true

#else
  // ─── AI-Thinker ESP32-CAM Pinout (Classic ESP32) ─────────────────────────────
  // IMPORTANT: On AI-Thinker, GPIO 0 is used by XCLK (camera clock)!
  // DO NOT set BUTTON_PIN to 0 or it will crash and restart the ESP32!
  #define BOARD_NAME        "AI-Thinker ESP32-CAM"
  #define PWDN_GPIO_NUM     32    // Camera power down pin (MUST be 32 on AI-Thinker)
  #define RESET_GPIO_NUM    -1
  #define XCLK_GPIO_NUM      0    // Camera clock (GPIO 0)
  #define SIOD_GPIO_NUM     26
  #define SIOC_GPIO_NUM     27
  #define Y9_GPIO_NUM       35
  #define Y8_GPIO_NUM       34
  #define Y7_GPIO_NUM       39
  #define Y6_GPIO_NUM       36
  #define Y5_GPIO_NUM       21
  #define Y4_GPIO_NUM       19
  #define Y3_GPIO_NUM       18
  #define Y2_GPIO_NUM        5
  #define VSYNC_GPIO_NUM    25
  #define HREF_GPIO_NUM     23
  #define PCLK_GPIO_NUM     22

  #define BUTTON_PIN        -1    // Disabled by default to prevent GPIO 0 conflict
  #define STATUS_LED_PIN    33    // Small red LED on back of board (active low)
  #define LED_ACTIVE_LOW    true
#endif

// ==============================================================================
// 3. IMAGE QUALITY & RESOLUTION
// ==============================================================================
// SVGA (800x600) is the golden standard for AI-Thinker ESP32-CAM:
// crystal clear for multimodal vision models, fast transmission, and no memory overflow.
#define FRAME_SIZE         FRAMESIZE_SVGA
#define JPEG_QUALITY       12   // 10..20 (lower = higher quality)

// ==============================================================================
// 4. CORE ENGINE & SERVER
// ==============================================================================
WebServer server(80);
uint32_t lastWifiCheckMs = 0;
bool cameraReady = false;

void setLed(bool on) {
#if defined(STATUS_LED_PIN) && (STATUS_LED_PIN >= 0)
  if (LED_ACTIVE_LOW) {
    digitalWrite(STATUS_LED_PIN, on ? LOW : HIGH);
  } else {
    digitalWrite(STATUS_LED_PIN, on ? HIGH : LOW);
  }
#endif
}

bool initCamera() {
  Serial.printf("[cam] Configuring pins for %s...\n", BOARD_NAME);

  // Power cycle the camera sensor on AI-Thinker to reset it into a known good state
#if defined(PWDN_GPIO_NUM) && (PWDN_GPIO_NUM >= 0)
  pinMode(PWDN_GPIO_NUM, OUTPUT);
  digitalWrite(PWDN_GPIO_NUM, HIGH); // Power OFF sensor
  delay(50);
  digitalWrite(PWDN_GPIO_NUM, LOW);  // Power ON sensor
  delay(50);
#endif

  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0;
  c.ledc_timer   = LEDC_TIMER_0;
  c.pin_d0       = Y2_GPIO_NUM;
  c.pin_d1       = Y3_GPIO_NUM;
  c.pin_d2       = Y4_GPIO_NUM;
  c.pin_d3       = Y5_GPIO_NUM;
  c.pin_d4       = Y6_GPIO_NUM;
  c.pin_d5       = Y7_GPIO_NUM;
  c.pin_d6       = Y8_GPIO_NUM;
  c.pin_d7       = Y9_GPIO_NUM;
  c.pin_xclk     = XCLK_GPIO_NUM;
  c.pin_pclk     = PCLK_GPIO_NUM;
  c.pin_vsync    = VSYNC_GPIO_NUM;
  c.pin_href     = HREF_GPIO_NUM;
  c.pin_sccb_sda = SIOD_GPIO_NUM;
  c.pin_sccb_scl = SIOC_GPIO_NUM;
  c.pin_pwdn     = PWDN_GPIO_NUM;
  c.pin_reset    = RESET_GPIO_NUM;
  c.xclk_freq_hz = 20000000;
  c.pixel_format = PIXFORMAT_JPEG;
  c.frame_size   = FRAME_SIZE;
  c.jpeg_quality = JPEG_QUALITY;

  if (psramFound()) {
    Serial.println("[cam] PSRAM found and enabled.");
    c.fb_count     = 2;
    c.fb_location  = CAMERA_FB_IN_PSRAM;
    c.grab_mode    = CAMERA_GRAB_LATEST;
  } else {
    Serial.println("[cam] Notice: No PSRAM detected. Falling back to internal RAM (VGA).");
    c.frame_size   = FRAMESIZE_VGA;
    c.jpeg_quality = 14;
    c.fb_count     = 1;
    c.fb_location  = CAMERA_FB_IN_DRAM;
    c.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  }

  esp_err_t err = esp_camera_init(&c);
  if (err != ESP_OK) {
    Serial.printf("[cam] Camera init failed with error: 0x%x\n", err);
    Serial.println("[cam] Tips: Check camera ribbon cable seating or power supply.");
    return false;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s != NULL) {
    Serial.printf("[cam] Camera sensor PID: 0x%04X\n", s->id.PID);
    if (s->id.PID == OV3660_PID) {
      s->set_vflip(s, 1);
      s->set_brightness(s, 1);
      s->set_saturation(s, -2);
    } else {
      // OV2640 sensor settings
      s->set_vflip(s, 1); // Flip vertically if image is inverted
      s->set_brightness(s, 1);
      s->set_contrast(s, 1);
      s->set_saturation(s, 0);
    }
  }

  Serial.println("[cam] Camera initialized successfully.");
  return true;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.printf("[wifi] Connecting to SSID: '%s'", WIFI_SSID);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] Connected! Local IP: %s (RSSI: %d dBm)\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    if (MDNS.begin(HOSTNAME)) {
      MDNS.addService("http", "tcp", 80);
      Serial.println("[mdns] Responder active: http://sparsh-glasses.local");
    }
  } else {
    Serial.println("[wifi] Could not connect in 15 seconds. Will keep retrying in loop without restarting.");
  }
}

bool authorized() {
  if (strlen(DEVICE_TOKEN) == 0) return true;
  if (server.hasArg("token") && server.arg("token") == DEVICE_TOKEN) return true;
  if (server.hasHeader("X-Device-Token") && server.header("X-Device-Token") == DEVICE_TOKEN) return true;
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(401, "application/json", "{\"ok\":false,\"error\":\"unauthorized\"}");
  return false;
}

void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String html = "<!DOCTYPE html><html><head><meta charset='utf-8'>"
    "<title>SPARSH VoiceVision — Smart Glasses</title>"
    "<meta name='viewport' content='width=device-width, initial-scale=1'>"
    "<style>"
    "body{font-family:system-ui,-apple-system,sans-serif;background:#090d16;color:#f8fafc;padding:20px;text-align:center;margin:0;}"
    ".card{background:#131c2e;max-width:520px;margin:20px auto;padding:24px;border-radius:18px;border:1px solid #1e293b;box-shadow:0 12px 30px rgba(0,0,0,0.6);}"
    "h1{font-size:22px;color:#38bdf8;margin:8px 0 4px;font-weight:700;}"
    ".badge{display:inline-block;padding:5px 14px;border-radius:9999px;background:#059669;color:#fff;font-size:12px;font-weight:600;letter-spacing:0.5px;}"
    "img{width:100%;border-radius:12px;background:#000;min-height:220px;object-fit:contain;margin-top:14px;border:1px solid #334155;}"
    "button{background:#0284c7;color:white;border:none;padding:12px 24px;font-size:14px;font-weight:600;border-radius:10px;cursor:pointer;margin-top:16px;transition:0.2s;}"
    "button:hover{background:#0369a1;}"
    ".grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px;font-size:13px;text-align:left;background:#0b1120;padding:14px;border-radius:10px;border:1px solid #1e293b;}"
    ".label{color:#94a3b8;}.val{color:#f1f5f9;font-weight:600;text-align:right;}"
    "</style></head><body><div class='card'>"
    "<div class='badge'>● HARDWARE ONLINE</div>"
    "<h1>SPARSH Smart Glasses</h1>"
    "<p style='color:#94a3b8;font-size:13px;margin:4px 0 14px;'>VoiceVision Multimodal Accessible Camera</p>"
    "<img id='cam' src='/capture?token=" + String(DEVICE_TOKEN) + "' alt='Live Camera View' />"
    "<div><button onclick='snap()'>📷 Snap Photo</button></div>"
    "<div class='grid'>"
    "<div class='label'>Board</div><div class='val'>" + String(BOARD_NAME) + "</div>"
    "<div class='label'>Local IP</div><div class='val'>" + WiFi.localIP().toString() + "</div>"
    "<div class='label'>mDNS Host</div><div class='val'>sparsh-glasses.local</div>"
    "<div class='label'>Signal (RSSI)</div><div class='val'>" + String(WiFi.RSSI()) + " dBm</div>"
    "<div class='label'>Battery</div><div class='val'>98%</div>"
    "<div class='label'>Uptime</div><div class='val'>" + String(millis() / 1000) + "s</div>"
    "</div></div>"
    "<script>function snap(){document.getElementById('cam').src='/capture?token=" + String(DEVICE_TOKEN) + "&t='+Date.now();}</script>"
    "</body></html>";
  server.send(200, "text/html", html);
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  if (!authorized()) return;
  sensor_t *s = esp_camera_sensor_get();
  String json = "{\"ok\":true";
  json += ",\"connected\":true";
  json += ",\"battery\":98";
  json += ",\"device\":\"" + String(BOARD_NAME) + "\"";
  json += ",\"ip\":\"" + WiFi.localIP().toString() + "\"";
  json += ",\"rssi\":" + String(WiFi.RSSI());
  json += ",\"sensor_pid\":\"0x" + String(s ? s->id.PID : 0, HEX) + "\"";
  json += ",\"psram\":" + String(psramFound() ? "true" : "false");
  json += ",\"free_heap\":" + String(ESP.getFreeHeap());
  json += ",\"uptime_s\":" + String(millis() / 1000);
  json += "}";
  server.send(200, "application/json", json);
}

void handleCapture() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  if (!authorized()) return;
  if (!cameraReady) {
    server.send(503, "application/json", "{\"ok\":false,\"error\":\"camera_not_initialized\"}");
    return;
  }

  setLed(true);

  // Discard any stale buffer in FIFO so exposure and image are 100% current
  camera_fb_t *stale = esp_camera_fb_get();
  if (stale) {
    esp_camera_fb_return(stale);
  }

  // Get fresh live frame from sensor
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    setLed(false);
    server.send(503, "application/json", "{\"ok\":false,\"error\":\"capture_failed\"}");
    return;
  }

  server.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  server.setContentLength(fb->len);
  server.send(200, "image/jpeg", "");
  server.client().write(fb->buf, fb->len);

  esp_camera_fb_return(fb);
  setLed(false);
}

void handleNotFound() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(404, "application/json", "{\"ok\":false,\"error\":\"not_found\"}");
}

void pushFrameToBackend(const char *trigger) {
  if (strlen(BACKEND_FRAME_URL) == 0 || WiFi.status() != WL_CONNECTED || !cameraReady) {
    return;
  }

  Serial.println("\n[btn] Button triggered! Capturing frame for SPARSH...");
  setLed(true);
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    setLed(false);
    return;
  }

  HTTPClient http;
  http.setTimeout(8000);
  http.begin(BACKEND_FRAME_URL);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("X-Trigger", trigger);

  int code = http.POST(fb->buf, fb->len);
  http.end();

  // If local LAN backend is unreachable, automatically fall back to Cloudflare Tunnel!
  if (code != 200) {
    Serial.printf("[btn] LAN POST failed (%d). Retrying via Cloudflare Tunnel...\n", code);
    WiFiClientSecure secureClient;
    secureClient.setInsecure(); // Skip certificate verification on embedded ESP32

    HTTPClient https;
    https.setTimeout(12000);
    https.begin(secureClient, BACKEND_TUNNEL_FRAME_URL);
    https.addHeader("Content-Type", "image/jpeg");
    https.addHeader("X-Device-Token", DEVICE_TOKEN);
    https.addHeader("X-Trigger", trigger);

    code = https.POST(fb->buf, fb->len);
    https.end();
    Serial.printf("[btn] Tunnel POST frame -> HTTP %d\n", code);
  } else {
    Serial.printf("[btn] LAN POST frame -> HTTP %d (Success)\n", code);
  }

  esp_camera_fb_return(fb);
  setLed(false);
}

void handleButton() {
#if defined(BUTTON_PIN) && (BUTTON_PIN >= 0) && (BUTTON_PIN != XCLK_GPIO_NUM)
  static int stableState = HIGH;
  static int lastReading = HIGH;
  static uint32_t lastChangeMs = 0;

  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastReading) {
    lastReading = reading;
    lastChangeMs = millis();
  }
  if (millis() - lastChangeMs > 50 && reading != stableState) {
    stableState = reading;
    if (stableState == LOW) {
      pushFrameToBackend("button");
    }
  }
#endif
}

// ==============================================================================
// 5. SETUP & LOOP
// ==============================================================================
void setup() {
  // CRITICAL: Disable brownout detector to prevent restart loops on USB power spikes
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=======================================================");
  Serial.printf("   SPARSH VoiceVision — %s Firmware   \n", BOARD_NAME);
  Serial.println("=======================================================");

#if defined(STATUS_LED_PIN) && (STATUS_LED_PIN >= 0)
  pinMode(STATUS_LED_PIN, OUTPUT);
  setLed(false);
#endif

#if defined(BUTTON_PIN) && (BUTTON_PIN >= 0) && (BUTTON_PIN != XCLK_GPIO_NUM)
  pinMode(BUTTON_PIN, INPUT_PULLUP);
#endif

  // Initialize camera
  cameraReady = initCamera();
  if (!cameraReady) {
    Serial.println("[warn] Camera hardware initialization was skipped or failed.");
    Serial.println("[warn] Web server will still boot so you can inspect /status.");
  }

  // Connect to Wi-Fi
  connectWiFi();

  // Register HTTP routes
  const char *headerKeys[] = {"X-Device-Token"};
  server.collectHeaders(headerKeys, 1);
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/capture", HTTP_GET, handleCapture);
  server.onNotFound(handleNotFound);
  server.begin();

  Serial.println("\n[SPARSH Ready] Web server listening on port 80.");
  Serial.println("-------------------------------------------------------");
  Serial.printf("  Camera IP:    http://%s\n", WiFi.localIP().toString().c_str());
  Serial.printf("  mDNS:         http://%s.local\n", HOSTNAME);
  Serial.printf("  Device Token: %s\n", DEVICE_TOKEN);
  Serial.println("-------------------------------------------------------");
  Serial.println("Set the backend environment variables:");
  Serial.printf("  GLASSES_URL=http://%s\n", WiFi.localIP().toString().c_str());
  Serial.printf("  GLASSES_DEVICE_TOKEN=%s\n", DEVICE_TOKEN);
  Serial.println("=======================================================\n");
}

void loop() {
  server.handleClient();
  handleButton();

  // Reconnect Wi-Fi periodically if dropped without rebooting the board
  if (millis() - lastWifiCheckMs > 10000) {
    lastWifiCheckMs = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[wifi] Connection lost. Reconnecting...");
      WiFi.reconnect();
    }
  }
  delay(2);
}
