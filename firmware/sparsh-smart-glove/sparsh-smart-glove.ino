/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║        SPARSH AI SMART GLOVES — MAIN ESP32 FIRMWARE                  ║
 * ║        Inclusive 5-Finger Sign Language & Gesture Controller        ║
 * ║        Version: 2.1.0                                               ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * TARGET BOARD: ESP32 Dev Module (WROOM-32 / LILYGO ESP32)
 *
 * ARDUINO IDE SETUP:
 *   • Tools → Board → "ESP32 Dev Module"
 *   • Tools → Upload Speed → 115200
 *   • Tools → CPU Frequency → 240MHz
 *   • Tools → Flash Frequency → 80MHz
 *   • Tools → Partition Scheme → "Default 4MB with spiffs"
 */

#include <Arduino.h>
#include "sensor_config.h"
#include "calibration.h"
#include "communication.h"

// ─── Global State ────────────────────────────────────────────────────────────
GloveCalibration calManager;
GloveCommunication commManager;

float filteredReadings[NUM_FINGERS] = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f};
uint16_t currentRaw[NUM_FINGERS]     = {0, 0, 0, 0, 0};
float normalizedValues[NUM_FINGERS]  = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f};

unsigned long lastSampleTime = 0;
unsigned long lastLedBlink   = 0;
bool ledState                = false;

// ─── Forward Declarations ───────────────────────────────────────────────────
void processCommand(const String& cmd);

// ─── BLE Command Callback Handler ───────────────────────────────────────────
class GloveRxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    std::string rxValue = pCharacteristic->getValue();
    if (rxValue.length() > 0) {
      String cmd = String(rxValue.c_str());
      cmd.trim();
      processCommand(cmd);
    }
  }
};

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n==================================================");
  Serial.println("  SPARSH AI SMART GLOVES — ESP32 CONTROLLER v2.1.0");
  Serial.println("  Triple Transport: Web Bluetooth, Wi-Fi, USB Serial");
  Serial.println("==================================================");

  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  // Configure ADC resolution (12-bit: 0..4095) & attenuation (11dB: full 0..3.3V)
  analogReadResolution(12);
  for (int i = 0; i < NUM_FINGERS; i++) {
    pinMode(SENSOR_PINS[i], INPUT);
    analogSetPinAttenuation(SENSOR_PINS[i], ADC_11db);
  }

  // Initial sensor warm-up read
  for (int i = 0; i < NUM_FINGERS; i++) {
    filteredReadings[i] = analogRead(SENSOR_PINS[i]);
  }

  // Load calibration from NVS
  calManager.begin();
  if (calManager.isReady()) {
    Serial.println("[CALIBRATION] Loaded valid calibration profile from NVS storage.");
  } else {
    Serial.println("[CALIBRATION] Notice: Device not yet calibrated. Using standard baselines.");
  }

  // Initialize Bluetooth Low Energy (BLE)
  commManager.beginBLE(new GloveRxCallbacks());
  Serial.println("[BLE] Bluetooth advertising started as 'SparshSmartGlove'.");
  Serial.println("[SERIAL] USB Serial active at 115200 baud.");
}

// ─── Main Non-Blocking Loop ──────────────────────────────────────────────────
void loop() {
  commManager.handleBleReconnection();

  // 1. Process USB Serial Commands
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.length() > 0) {
      processCommand(cmd);
    }
  }

  // 2. High-Frequency Non-Blocking Sensor Sampling
  unsigned long now = millis();
  if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    lastSampleTime = now;

    // Read analog channels & apply Exponential Moving Average (EMA)
    for (int i = 0; i < NUM_FINGERS; i++) {
      uint16_t sample = analogRead(SENSOR_PINS[i]);
      // Noise filter
      filteredReadings[i] = (EMA_ALPHA * (float)sample) + ((1.0f - EMA_ALPHA) * filteredReadings[i]);
      currentRaw[i] = (uint16_t)round(filteredReadings[i]);

      // Calculate normalized bend (0.0 to 1.0)
      normalizedValues[i] = calManager.normalize(i, currentRaw[i]);
    }

    // Broadcast telemetry packet
    commManager.sendSensorPacket(currentRaw, normalizedValues, calManager.isReady());
  }

  // 3. Status LED Management
  if (commManager.isBleConnected() || commManager.isWiFiConnected()) {
    digitalWrite(STATUS_LED_PIN, HIGH); // Solid ON when connected
  } else {
    // Slow blink when in standby / disconnected
    if (now - lastLedBlink >= 700) {
      lastLedBlink = now;
      ledState = !ledState;
      digitalWrite(STATUS_LED_PIN, ledState ? HIGH : LOW);
    }
  }
}

// ─── Command Interpreter ─────────────────────────────────────────────────────
void processCommand(const String& cmd) {
  if (cmd.equalsIgnoreCase("PING")) {
    commManager.sendInfoPacket("PONG");
  }
  else if (cmd.equalsIgnoreCase("CAL_STRAIGHT")) {
    calManager.recordStraight(currentRaw);
    commManager.sendInfoPacket("Recorded straight open-hand baseline.");
  }
  else if (cmd.equalsIgnoreCase("CAL_BENT")) {
    calManager.recordBent(currentRaw);
    commManager.sendInfoPacket("Recorded bent curled-hand baseline.");
  }
  else if (cmd.equalsIgnoreCase("SAVE_CAL")) {
    bool ok = calManager.validateAndSave();
    if (ok) {
      commManager.sendInfoPacket("Calibration validated & saved to NVS successfully.");
    } else {
      commManager.sendInfoPacket("Error: Calibration delta too low. Please bend further.");
    }
  }
  else if (cmd.equalsIgnoreCase("RESET_CAL")) {
    calManager.reset();
    commManager.sendInfoPacket("Calibration reset to factory defaults.");
  }
  else if (cmd.equalsIgnoreCase("GET_INFO")) {
    char infoBuf[256];
    snprintf(infoBuf, sizeof(infoBuf),
      "{\"type\":\"device_info\",\"firmware\":\"2.1.0\",\"model\":\"Classic ESP32-WROOM-32\","
      "\"uptime_sec\":%lu,\"calibrated\":%s,\"ble\":%s,\"wifi\":%s}",
      millis() / 1000,
      calManager.isReady() ? "true" : "false",
      commManager.isBleConnected() ? "true" : "false",
      commManager.isWiFiConnected() ? "true" : "false"
    );
    Serial.println(infoBuf);
  }
  else if (cmd.startsWith("SET_WIFI:")) {
    // Format: SET_WIFI:<ssid>:<password>:<endpoint_url>
    int firstColon = cmd.indexOf(':', 9);
    int secondColon = cmd.indexOf(':', firstColon + 1);
    if (firstColon > 0 && secondColon > 0) {
      String ssid = cmd.substring(9, firstColon);
      String pass = cmd.substring(firstColon + 1, secondColon);
      String url  = cmd.substring(secondColon + 1);
      commManager.beginWiFi(ssid, pass, url);
      commManager.sendInfoPacket("Connecting to Wi-Fi...");
    }
  }
  else {
    commManager.sendInfoPacket("Unknown command received.");
  }
}
