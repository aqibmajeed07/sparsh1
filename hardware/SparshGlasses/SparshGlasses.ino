/*
  SPARSH VoiceVision - Glasses Camera Node
  Hardware : ESP32-S3 camera board + OV3660 / OV2640
  Role     : On-demand JPEG capture for the SPARSH FastAPI backend.
             Audio is NOT handled here - the phone/laptop does speech in/out
             through a Bluetooth / bone-conduction headset or speakers.

  HTTP API (LAN only; every request needs header  X-Device-Token: <DEVICE_TOKEN>)
    GET /status   -> JSON: ok, connected, battery, ip, rssi, sensor id, psram, heap, uptime
    GET /capture  -> one JPEG frame (image/jpeg)
  Optional tactile button: press -> capture -> POST JPEG to BACKEND_FRAME_URL

  Arduino IDE settings ("esp32 by Espressif Systems" core, v3.x):
    Board            : "XIAO_ESP32S3" or "ESP32S3 Dev Module"
    PSRAM            : "OPI PSRAM"  if the module is marked ...R8 (e.g. N16R8)
                       "QSPI PSRAM" if the module is marked ...R2
    Flash Size       : match the module marking (N8 = 8MB, N16 = 16MB)
    Partition Scheme : "Huge APP (3MB No OTA/1MB SPIFFS)"
    USB CDC On Boot  : "Enabled" if Serial Monitor runs over the native USB port

  Sketch folder must contain: SparshGlasses.ino, secrets.h, camera_pins.h
*/

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ESPmDNS.h>
#include "secrets.h"   // WIFI_SSID, WIFI_PASS, DEVICE_TOKEN, BACKEND_FRAME_URL

// ===================== USER CONFIGURATION =====================

// 1) Camera pin map. Uncomment the ONE model that your board confirms:
#define CAMERA_MODEL_XIAO_ESP32S3          // Recommended: Seeed XIAO ESP32S3 Sense
// #define CAMERA_MODEL_ESP32S3_EYE        // Espressif ESP32-S3-EYE
// #define CAMERA_MODEL_FREENOVE_ESP32S3_CAM  // Freenove ESP32-S3 WROVER CAM
// #define CAMERA_MODEL_AI_THINKER         // AI-Thinker ESP32-CAM
#include "camera_pins.h"

// 2) Optional I/O Pins:
// For XIAO ESP32S3 Sense: GPIO 0 is the on-board BOOT button, GPIO 21 is user LED.
// Set to -1 if you do not want to use physical button/LED.
#define BUTTON_PIN      0    // Push button to GND (internal pull-up used; GPIO 0 on XIAO)
#define STATUS_LED_PIN  21   // LED indicator; lights while capturing / uploading

// 3) Image settings. XGA (1024x768) suits scene description; try FRAMESIZE_SXGA
// or FRAMESIZE_UXGA for reading fine printed pages (bigger files, slower).
#define FRAME_SIZE      FRAMESIZE_XGA
#define JPEG_QUALITY    12   // lower = better quality, larger file (10..20)

#define HOSTNAME        "sparsh-glasses"

// ==============================================================

WebServer server(80);
uint32_t lastWifiCheckMs = 0;

void setLed(bool on) {
#if STATUS_LED_PIN >= 0
  // XIAO LED is active LOW
  digitalWrite(STATUS_LED_PIN, on ? LOW : HIGH);
#endif
}

bool initCamera() {
  if (!psramFound()) {
    Serial.println("[cam] PSRAM not found. Fix Tools > PSRAM (OPI for ...R8 modules).");
    return false;
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
  c.fb_count     = 2;
  c.fb_location  = CAMERA_FB_IN_PSRAM;
  c.grab_mode    = CAMERA_GRAB_LATEST;   // always hand out the newest frame

  esp_err_t err = esp_camera_init(&c);
  if (err != ESP_OK) {
    Serial.printf("[cam] init failed: 0x%x (check model define, ribbon cable, PSRAM)\n", err);
    return false;
  }

  sensor_t *s = esp_camera_sensor_get();
  Serial.printf("[cam] sensor PID 0x%04X (OV3660 = 0x3660)\n", s->id.PID);
  if (s->id.PID == OV3660_PID) {
    // Correction for OV3660 sensor
    s->set_vflip(s, 1);
    s->set_brightness(s, 1);
    s->set_saturation(s, -2);
  }
  return true;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.setSleep(false);              // lower latency; costs some battery
  WiFi.begin(WIFI_SSID, WIFI_PASS);  // ESP32-S3 is 2.4 GHz only

  Serial.printf("[wifi] connecting to '%s'", WIFI_SSID);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] connected! IP: %s, RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    if (MDNS.begin(HOSTNAME)) {
      MDNS.addService("http", "tcp", 80);
      Serial.println("[mdns] responder started at http://sparsh-glasses.local");
    }
  } else {
    Serial.println("[wifi] connection failed or timed out - will keep retrying in loop");
  }
}

// Every endpoint requires the shared device token.
bool authorized() {
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

  setLed(true);  // visible "camera in use" indicator (privacy)
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

// Button press: capture and push the frame to the backend (no browser involved).
void pushFrameToBackend(const char *trigger) {
  if (strlen(BACKEND_FRAME_URL) == 0 || WiFi.status() != WL_CONNECTED) {
    Serial.println("[btn] backend URL not set or Wi-Fi down");
    return;
  }

  Serial.println("[btn] capturing frame for SPARSH assistant...");
  setLed(true);
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    setLed(false);
    Serial.println("[btn] capture failed");
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
#if BUTTON_PIN >= 0
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
    if (stableState == LOW) pushFrameToBackend("button");         // pressed
  }
#endif
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=================================================");
  Serial.println("  SPARSH VoiceVision — Glasses Camera Node Boot  ");
  Serial.println("=================================================");

#if STATUS_LED_PIN >= 0
  pinMode(STATUS_LED_PIN, OUTPUT);
  setLed(false);
#endif
#if BUTTON_PIN >= 0
  pinMode(BUTTON_PIN, INPUT_PULLUP);
#endif

  if (String(DEVICE_TOKEN) == "CHANGE_ME" || strlen(DEVICE_TOKEN) < 8) {
    Serial.println("[warn] set a long random DEVICE_TOKEN in secrets.h");
  }

  if (!initCamera()) {
    Serial.println("[cam] halted - fix the camera setup and reset the board");
    while (true) delay(1000);
  }

  connectWiFi();

  const char *headerKeys[] = {"X-Device-Token"};
  server.collectHeaders(headerKeys, 1);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/capture", HTTP_GET, handleCapture);
  server.onNotFound(handleNotFound);
  server.begin();

  Serial.println("\n[ok] SPARSH Smart Glasses Ready!");
  Serial.printf("  LAN URL: http://%s\n", WiFi.localIP().toString().c_str());
  Serial.printf("  mDNS:    http://%s.local\n", HOSTNAME);
  Serial.printf("  Token:   %s\n", DEVICE_TOKEN);
  Serial.println("-------------------------------------------------");
  Serial.println("Set the backend env vars:");
  Serial.printf("  GLASSES_URL=http://%s\n", WiFi.localIP().toString().c_str());
  Serial.printf("  GLASSES_DEVICE_TOKEN=%s\n", DEVICE_TOKEN);
  Serial.println("=================================================\n");
}

void loop() {
  server.handleClient();
  handleButton();

  if (millis() - lastWifiCheckMs > 10000) {
    lastWifiCheckMs = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[wifi] lost - reconnecting");
      WiFi.reconnect();
    }
  }
  delay(2);
}
