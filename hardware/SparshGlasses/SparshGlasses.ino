/*
  SPARSH VoiceVision — Smart Glasses Camera Node (All-In-One Standalone)
  Hardware : ESP32-S3 / ESP32 Camera Board + OV3660 / OV2640
  Role     : On-demand JPEG capture for the SPARSH FastAPI backend.
             Standalone file — No external header files (secrets.h or camera_pins.h) needed!

  Arduino IDE Settings ("esp32 by Espressif Systems" core):
    Board            : "XIAO_ESP32S3" or "ESP32S3 Dev Module" (or "AI Thinker ESP32-CAM")
    PSRAM            : "OPI PSRAM"  if module is marked ...R8 (e.g. N16R8)
                       "QSPI PSRAM" if module is marked ...R2
    Flash Size       : match module (8MB or 16MB)
    Partition Scheme : "Huge APP (3MB No OTA/1MB SPIFFS)"
    USB CDC On Boot  : "Enabled" if Serial Monitor runs over native USB
*/

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ESPmDNS.h>

// ==============================================================================
// 1. WI-FI & BACKEND CREDENTIALS (EMBEDDED DIRECTLY - NO SECRETS.H NEEDED)
// ==============================================================================
#define WIFI_SSID          "Aqib"
#define WIFI_PASS          "mir1aqib"

// Shared authentication token matching GLASSES_DEVICE_TOKEN in backend/.env
#define DEVICE_TOKEN       "sparsh_glasses_aqib_mir_2026"

// Laptop/Server URL where the physical button pushes frames
// Laptop IP on Wi-Fi: 10.93.154.216:8000
#define BACKEND_FRAME_URL  "http://10.93.154.216:8000/api/glasses/frame"

#define HOSTNAME           "sparsh-glasses"

// ==============================================================================
// 2. CAMERA MODEL SELECTION (EMBEDDED DIRECTLY - NO CAMERA_PINS.H NEEDED)
// ==============================================================================
// Uncomment EXACTLY ONE camera model that matches your board:
#define CAMERA_MODEL_XIAO_ESP32S3          // Recommended: Seeed XIAO ESP32S3 Sense
// #define CAMERA_MODEL_ESP32S3_EYE        // Espressif ESP32-S3-EYE
// #define CAMERA_MODEL_FREENOVE_ESP32S3_CAM  // Freenove ESP32-S3 WROVER CAM
// #define CAMERA_MODEL_AI_THINKER         // AI-Thinker ESP32-CAM (Classic)

// ─── Camera Pinout Definitions ──────────────────────────────────────────────
#if defined(CAMERA_MODEL_XIAO_ESP32S3)
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

  #define BUTTON_PIN        0     // BOOT button on XIAO
  #define STATUS_LED_PIN    21    // XIAO User LED (active low)
  #define LED_ACTIVE_LOW    true

#elif defined(CAMERA_MODEL_ESP32S3_EYE)
  #define PWDN_GPIO_NUM     -1
  #define RESET_GPIO_NUM    -1
  #define XCLK_GPIO_NUM     15
  #define SIOD_GPIO_NUM      4
  #define SIOC_GPIO_NUM      5

  #define Y9_GPIO_NUM       16
  #define Y8_GPIO_NUM       17
  #define Y7_GPIO_NUM       18
  #define Y6_GPIO_NUM       12
  #define Y5_GPIO_NUM       10
  #define Y4_GPIO_NUM        8
  #define Y3_GPIO_NUM        9
  #define Y2_GPIO_NUM       11
  #define VSYNC_GPIO_NUM     6
  #define HREF_GPIO_NUM      7
  #define PCLK_GPIO_NUM     13

  #define BUTTON_PIN        0
  #define STATUS_LED_PIN    3
  #define LED_ACTIVE_LOW    false

#elif defined(CAMERA_MODEL_FREENOVE_ESP32S3_CAM)
  #define PWDN_GPIO_NUM     -1
  #define RESET_GPIO_NUM    -1
  #define XCLK_GPIO_NUM     15
  #define SIOD_GPIO_NUM      4
  #define SIOC_GPIO_NUM      5

  #define Y9_GPIO_NUM       16
  #define Y8_GPIO_NUM       17
  #define Y7_GPIO_NUM       18
  #define Y6_GPIO_NUM       12
  #define Y5_GPIO_NUM       10
  #define Y4_GPIO_NUM        8
  #define Y3_GPIO_NUM        9
  #define Y2_GPIO_NUM       11
  #define VSYNC_GPIO_NUM     6
  #define HREF_GPIO_NUM      7
  #define PCLK_GPIO_NUM     13

  #define BUTTON_PIN        0
  #define STATUS_LED_PIN    2
  #define LED_ACTIVE_LOW    false

#elif defined(CAMERA_MODEL_AI_THINKER)
  #define PWDN_GPIO_NUM     32
  #define RESET_GPIO_NUM    -1
  #define XCLK_GPIO_NUM      0
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

  #define BUTTON_PIN        0
  #define STATUS_LED_PIN    33
  #define LED_ACTIVE_LOW    true

#else
  #error "Camera model not selected! Please uncomment ONE camera model above."
#endif

// ==============================================================================
// 3. IMAGE SETTINGS
// ==============================================================================
// FRAMESIZE_XGA (1024x768) provides high quality for scene description & OCR.
// Other options: FRAMESIZE_SVGA (800x600), FRAMESIZE_VGA (640x480)
#define FRAME_SIZE         FRAMESIZE_XGA
#define JPEG_QUALITY       12   // 10..20 (lower number = higher quality, larger file)

// ==============================================================================
// 4. CORE ENGINE & SERVER
// ==============================================================================
WebServer server(80);
uint32_t lastWifiCheckMs = 0;

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
  if (!psramFound()) {
    Serial.println("[cam] Warning: PSRAM not found. Check Tools > PSRAM (OPI PSRAM).");
  }

  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0;
  c.ledc_timer   = LEDC_TIMER_0;
  c.pin_d0 = Y2_GPIO_NUM;
  c.pin_d1 = Y3_GPIO_NUM;
  c.pin_d2 = Y4_GPIO_NUM;
  c.pin_d3 = Y5_GPIO_NUM;
  c.pin_d4 = Y6_GPIO_NUM;
  c.pin_d5 = Y7_GPIO_NUM;
  c.pin_d6 = Y8_GPIO_NUM;
  c.pin_d7 = Y9_GPIO_NUM;
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
    c.fb_count     = 2;
    c.fb_location  = CAMERA_FB_IN_PSRAM;
    c.grab_mode    = CAMERA_GRAB_LATEST;   // always grab the newest frame
  } else {
    c.frame_size   = FRAMESIZE_VGA;
    c.fb_count     = 1;
    c.fb_location  = CAMERA_FB_IN_DRAM;
    c.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  }

  esp_err_t err = esp_camera_init(&c);
  if (err != ESP_OK) {
    Serial.printf("[cam] Init failed with error 0x%x\n", err);
    return false;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s != NULL) {
    Serial.printf("[cam] Sensor PID 0x%04X\n", s->id.PID);
    if (s->id.PID == OV3660_PID) {
      // OV3660 sensor optimization
      s->set_vflip(s, 1);
      s->set_brightness(s, 1);
      s->set_saturation(s, -2);
    }
  }

  Serial.println("[cam] Camera initialized successfully.");
  return true;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.setSleep(false);              // low latency
  WiFi.begin(WIFI_SSID, WIFI_PASS);  // 2.4 GHz Wi-Fi

  Serial.printf("[wifi] Connecting to '%s'", WIFI_SSID);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] Connected! IP: %s, RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    if (MDNS.begin(HOSTNAME)) {
      MDNS.addService("http", "tcp", 80);
      Serial.println("[mdns] Responder started at http://sparsh-glasses.local");
    }
  } else {
    Serial.println("[wifi] Could not connect yet - will keep retrying in loop.");
  }
}

// Every endpoint verifies the device token
bool authorized() {
  if (strlen(DEVICE_TOKEN) == 0) return true;
  if (!server.hasHeader("X-Device-Token") ||
      server.header("X-Device-Token") != DEVICE_TOKEN) {
    server.send(401, "application/json", "{\"ok\":false,\"error\":\"unauthorized\"}");
    return false;
  }
  return true;
}

void handleStatus() {
  if (!authorized()) return;
  sensor_t *s = esp_camera_sensor_get();
  String json = "{\"ok\":true";
  json += ",\"connected\":true";
  json += ",\"battery\":98";
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
  if (!authorized()) return;

  setLed(true);  // camera in use indicator
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    setLed(false);
    server.send(503, "application/json", "{\"ok\":false,\"error\":\"capture_failed\"}");
    return;
  }

  server.sendHeader("Cache-Control", "no-store");
  server.setContentLength(fb->len);
  server.send(200, "image/jpeg", "");
  server.client().write(fb->buf, fb->len);

  esp_camera_fb_return(fb);
  setLed(false);
}

void handleNotFound() {
  server.send(404, "application/json", "{\"ok\":false,\"error\":\"not_found\"}");
}

// Physical button press: captures and pushes frame directly to the backend
void pushFrameToBackend(const char *trigger) {
  if (strlen(BACKEND_FRAME_URL) == 0 || WiFi.status() != WL_CONNECTED) {
    Serial.println("[btn] BACKEND_FRAME_URL not configured or Wi-Fi offline");
    return;
  }

  Serial.println("\n[btn] Button pressed! Capturing frame for SPARSH Assistant...");
  setLed(true);
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    setLed(false);
    Serial.println("[btn] Camera capture failed!");
    return;
  }

  HTTPClient http;
  http.setTimeout(15000);
  http.begin(BACKEND_FRAME_URL);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("X-Trigger", trigger);

  int code = http.POST(fb->buf, fb->len);
  http.end();

  esp_camera_fb_return(fb);
  setLed(false);
  Serial.printf("[btn] POST %u bytes to backend -> HTTP %d\n", (unsigned)fb->len, code);
}

void handleButton() {
#if defined(BUTTON_PIN) && (BUTTON_PIN >= 0)
  static int stableState = HIGH;
  static int lastReading = HIGH;
  static uint32_t lastChangeMs = 0;

  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastReading) {
    lastReading = reading;
    lastChangeMs = millis();
  }
  if (millis() - lastChangeMs > 40 && reading != stableState) {  // 40 ms debounce
    stableState = reading;
    if (stableState == LOW) {
      pushFrameToBackend("button"); // Button pressed (active low)
    }
  }
#endif
}

// ==============================================================================
// 5. SETUP & MAIN LOOP
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n=======================================================");
  Serial.println("   SPARSH VoiceVision — Smart Glasses Camera Firmware   ");
  Serial.println("=======================================================");

#if defined(STATUS_LED_PIN) && (STATUS_LED_PIN >= 0)
  pinMode(STATUS_LED_PIN, OUTPUT);
  setLed(false);
#endif

#if defined(BUTTON_PIN) && (BUTTON_PIN >= 0)
  pinMode(BUTTON_PIN, INPUT_PULLUP);
#endif

  // Initialize camera sensor
  if (!initCamera()) {
    Serial.println("[cam] Fatal: Camera setup failed. Please check board and camera ribbon.");
    while (true) delay(1000);
  }

  // Connect to Wi-Fi
  connectWiFi();

  // Register HTTP routes
  const char *headerKeys[] = {"X-Device-Token"};
  server.collectHeaders(headerKeys, 1);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/capture", HTTP_GET, handleCapture);
  server.onNotFound(handleNotFound);
  server.begin();

  Serial.println("\n[SPARSH Ready] Web server listening on port 80.");
  Serial.println("-------------------------------------------------------");
  Serial.printf("  Glasses IP:   http://%s\n", WiFi.localIP().toString().c_str());
  Serial.printf("  mDNS URL:     http://%s.local\n", HOSTNAME);
  Serial.printf("  Device Token: %s\n", DEVICE_TOKEN);
  Serial.println("-------------------------------------------------------");
  Serial.println("Set the backend environment variables:");
  Serial.printf("  GLASSES_URL=http://%s\n", WiFi.localIP().toString().c_str());
  Serial.printf("  GLASSES_DEVICE_TOKEN=%s\n", DEVICE_TOKEN);
  Serial.println("=======================================================\n");
}

void loop() {
  // Handle LAN requests from FastAPI backend (/capture and /status)
  server.handleClient();

  // Handle tactile button press
  handleButton();

  // Keep Wi-Fi connected
  if (millis() - lastWifiCheckMs > 10000) {
    lastWifiCheckMs = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[wifi] Reconnecting...");
      WiFi.reconnect();
    }
  }
  delay(2);
}
