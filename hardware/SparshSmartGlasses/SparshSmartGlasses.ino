/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║        SPARSH VOICEVISION — SMART GLASSES CAMERA FIRMWARE           ║
 * ║        ESP32-S3 + OV3660 / OV2640 Wireless Vision Assistant         ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  FLOW:                                                              ║
 * ║    1. Next.js voice command -> POST /api/glasses/vision             ║
 * ║       -> FastAPI backend GETs /capture with X-Device-Token          ║
 * ║       -> Multimodal Vision Model -> TTS speaks to student.         ║
 * ║    2. Physical Button press on glasses frame:                       ║
 * ║       -> ESP32 captures JPEG immediately                            ║
 * ║       -> POSTs to /api/glasses/frame with X-Device-Token            ║
 * ║       -> Assistant speaks description automatically.                ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include "esp_camera.h"
#include "secrets.h"

// ─── Select Camera Board Model ──────────────────────────────────────────────
// Uncomment EXACTLY ONE of the camera models below to match your hardware:
#define CAMERA_MODEL_XIAO_ESP32S3         // Recommended: Seeed XIAO ESP32S3 Sense (compact)
// #define CAMERA_MODEL_FREENOVE_ESP32S3_CAM  // Freenove ESP32-S3 WROVER CAM
// #define CAMERA_MODEL_AI_THINKER            // AI-Thinker ESP32-CAM (Classic)
// #define CAMERA_MODEL_ESP32S3_EYE           // Espressif ESP32-S3-EYE

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

  #define BUTTON_PIN        0     // BOOT button / tactile button on glasses frame
  #define LED_PIN           21    // XIAO User LED (Active Low)
  #define LED_ACTIVE_LOW    true

#elif defined(CAMERA_MODEL_FREENOVE_ESP32S3_CAM)
  #define PWDN_GPIO_NUM     -1
  #define RESET_GPIO_NUM    -1
  #define XCLK_GPIO_NUM     15
  #define SIOD_GPIO_NUM     4
  #define SIOC_GPIO_NUM     5

  #define Y9_GPIO_NUM       16
  #define Y8_GPIO_NUM       17
  #define Y7_GPIO_NUM       18
  #define Y6_GPIO_NUM       12
  #define Y5_GPIO_NUM       10
  #define Y4_GPIO_NUM       8
  #define Y3_GPIO_NUM       9
  #define Y2_GPIO_NUM       11
  #define VSYNC_GPIO_NUM    6
  #define HREF_GPIO_NUM     7
  #define PCLK_GPIO_NUM     13

  #define BUTTON_PIN        0     // BOOT button / GPIO 0
  #define LED_PIN           2     // Status LED
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

  #define BUTTON_PIN        0     // Flash button
  #define LED_PIN           33    // Built-in red indicator LED
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
  #define LED_PIN           3
  #define LED_ACTIVE_LOW    false
#endif

// ─── Web Server ─────────────────────────────────────────────────────────────
WebServer server(80);

// ─── State & Timing Variables ───────────────────────────────────────────────
unsigned long lastButtonPress = 0;
const unsigned long DEBOUNCE_DELAY_MS = 1200;
bool isSendingFrame = false;

// ─── LED Control Helpers ────────────────────────────────────────────────────
void setLed(bool state) {
#if defined(LED_PIN) && (LED_PIN >= 0)
  if (LED_ACTIVE_LOW) {
    digitalWrite(LED_PIN, state ? LOW : HIGH);
  } else {
    digitalWrite(LED_PIN, state ? HIGH : LOW);
  }
#endif
}

void blinkLed(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    setLed(true);
    delay(delayMs);
    setLed(false);
    delay(delayMs);
  }
}

// ─── Camera Configuration & Initialization ──────────────────────────────────
bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Optimize quality vs RAM buffer
  if (psramFound()) {
    config.frame_size = FRAMESIZE_VGA;   // 640x480 — perfect for quick VLM inference
    config.jpeg_quality = 12;            // Lower number = higher quality (0-63)
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    config.frame_size = FRAMESIZE_QVGA;  // 320x240 fallback if no external PSRAM
    config.jpeg_quality = 15;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[Camera] Init failed with error 0x%x\n", err);
    return false;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s != NULL) {
    s->set_brightness(s, 1);    // slight boost for indoor classroom visibility
    s->set_contrast(s, 1);
    s->set_saturation(s, 0);
    s->set_whitebal(s, 1);
    s->set_awb_gain(s, 1);
  }

  Serial.println("[Camera] Initialized successfully.");
  return true;
}

// ─── Token Authentication Helper ────────────────────────────────────────────
bool isAuthorized() {
  if (String(DEVICE_TOKEN).length() == 0) {
    return true; // No token configured in secrets
  }
  if (!server.hasHeader("X-Device-Token")) {
    return false;
  }
  String token = server.header("X-Device-Token");
  return (token == String(DEVICE_TOKEN));
}

// ─── Server Route: GET /status ──────────────────────────────────────────────
void handleStatus() {
  if (!isAuthorized()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\",\"message\":\"Invalid device token\"}");
    return;
  }

  // Simulated 95% battery level or ADC reading
  String response = "{\n";
  response += "  \"connected\": true,\n";
  response += "  \"device\": \"SPARSH Smart Glasses (ESP32-S3)\",\n";
  response += "  \"battery\": 95,\n";
  response += "  \"wifi_rssi\": " + String(WiFi.RSSI()) + ",\n";
  response += "  \"ip\": \"" + WiFi.localIP().toString() + "\"\n";
  response += "}";

  server.send(200, "application/json", response);
}

// ─── Server Route: GET /capture ─────────────────────────────────────────────
void handleCapture() {
  if (!isAuthorized()) {
    server.send(401, "application/json", "{\"error\":\"Unauthorized\",\"message\":\"Invalid device token\"}");
    return;
  }

  setLed(true);
  camera_fb_t *fb = esp_camera_fb_get();
  setLed(false);

  if (!fb) {
    Serial.println("[Camera] Capture failed");
    server.send(500, "application/json", "{\"error\":\"Camera capture failed\"}");
    return;
  }

  WiFiClient client = server.client();
  String responseHeaders = "HTTP/1.1 200 OK\r\n";
  responseHeaders += "Content-Type: image/jpeg\r\n";
  responseHeaders += "Content-Length: " + String(fb->len) + "\r\n";
  responseHeaders += "Access-Control-Allow-Origin: *\r\n";
  responseHeaders += "Connection: close\r\n\r\n";

  client.write((const uint8_t*)responseHeaders.c_str(), responseHeaders.length());
  client.write(fb->buf, fb->len);

  esp_camera_fb_return(fb);
}

// ─── Trigger: Physical Button POST to FastAPI Backend ───────────────────────
void sendButtonFrame() {
  if (isSendingFrame) return;
  isSendingFrame = true;

  Serial.println("\n[Button] Glasses button pressed! Capturing frame for SPARSH...");
  setLed(true);

  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[Button] Capture failed!");
    setLed(false);
    isSendingFrame = false;
    blinkLed(3, 100);
    return;
  }

  HTTPClient http;
  String targetEndpoint = String(BACKEND_URL) + "/api/glasses/frame";
  Serial.printf("[Button] Uploading %u bytes to %s\n", fb->len, targetEndpoint.c_str());

  http.begin(targetEndpoint);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("X-Device-Token", String(DEVICE_TOKEN));
  http.addHeader("X-Trigger", "button");
  http.setTimeout(12000);

  int httpCode = http.POST(fb->buf, fb->len);

  if (httpCode == 200 || httpCode == 201) {
    Serial.printf("[Button] Frame sent successfully! Response: %s\n", http.getString().c_str());
    setLed(false);
    blinkLed(2, 80); // Success double-blink
  } else {
    Serial.printf("[Button] POST failed with HTTP code %d: %s\n", httpCode, http.errorToString(httpCode).c_str());
    setLed(false);
    blinkLed(4, 150); // Error blinks
  }

  http.end();
  esp_camera_fb_return(fb);
  isSendingFrame = false;
}

// ─── Wi-Fi Setup ────────────────────────────────────────────────────────────
void setupWiFi() {
  Serial.printf("[WiFi] Connecting to %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
    blinkLed(3, 100);
  } else {
    Serial.println("\n[WiFi] Connection failed. Restarting...");
    delay(2000);
    ESP.restart();
  }
}

// ─── Arduino Setup ──────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=======================================================");
  Serial.println("  SPARSH VoiceVision — Smart Glasses Camera Firmware  ");
  Serial.println("=======================================================");

#if defined(LED_PIN) && (LED_PIN >= 0)
  pinMode(LED_PIN, OUTPUT);
  setLed(false);
#endif

#if defined(BUTTON_PIN) && (BUTTON_PIN >= 0)
  pinMode(BUTTON_PIN, INPUT_PULLUP);
#endif

  // 1. Initialize Camera
  if (!initCamera()) {
    Serial.println("[Fatal] Camera initialization failed! Halting.");
    while (true) {
      blinkLed(1, 500);
    }
  }

  // 2. Connect to Wi-Fi
  setupWiFi();

  // 3. Register HTTP Routes
  const char *headerKeys[] = {"X-Device-Token"};
  size_t headerKeysSize = sizeof(headerKeys) / sizeof(char*);
  server.collectHeaders(headerKeys, headerKeysSize);

  server.on("/status", HTTP_GET, handleStatus);
  server.on("/capture", HTTP_GET, handleCapture);
  server.begin();

  Serial.println("\n[SPARSH Ready] Web server listening on port 80.");
  Serial.println("-------------------------------------------------------");
  Serial.println("Set the following environment variables in your backend:");
  Serial.printf("  GLASSES_URL=http://%s\n", WiFi.localIP().toString().c_str());
  Serial.printf("  GLASSES_DEVICE_TOKEN=%s\n", DEVICE_TOKEN);
  Serial.println("-------------------------------------------------------\n");
}

// ─── Arduino Main Loop ──────────────────────────────────────────────────────
void loop() {
  // 1. Handle incoming LAN requests from FastAPI backend (/capture, /status)
  server.handleClient();

  // 2. Monitor physical button on smart glasses frame
#if defined(BUTTON_PIN) && (BUTTON_PIN >= 0)
  if (digitalRead(BUTTON_PIN) == LOW) { // Button pressed (active LOW)
    unsigned long now = millis();
    if (now - lastButtonPress > DEBOUNCE_DELAY_MS) {
      lastButtonPress = now;
      sendButtonFrame();
    }
  }
#endif

  // 3. Auto-reconnect Wi-Fi if connection drops
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconnecting...");
    WiFi.reconnect();
    delay(1000);
  }
}
