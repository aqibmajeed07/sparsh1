/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║         SPARSH AI SMART GLOVES — ESP32 FIRMWARE v2.0                ║
 * ║    5-Finger Flex Telemetry + BLE + USB Serial + Wi-Fi + Haptics      ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  STANDALONE FILE:                                                   ║
 * ║    • No external header files needed (all-in-one working sketch).   ║
 * ║    • Web Bluetooth (BLE Nordic UART) for Chrome / Edge web app.     ║
 * ║    • USB Web Serial (115200 baud) for wired zero-latency demo.      ║
 * ║    • Optional Wi-Fi HTTP / WebSocket stream to FastAPI backend.     ║
 * ║    • Haptic vibration feedback for deaf-blind learner guidance.     ║
 * ║    • Auto-detects MPU6050 IMU for wrist rotation (pitch / roll).    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * HARDWARE WIRING (ESP32 DevKit v1 / 30-pin or 38-pin):
 *   • Flex Thumb   ──> GPIO 36 (VP) ──[Flex Sensor]── 3.3V
 *                                   └──[10kΩ Resistor]── GND
 *   • Flex Index   ──> GPIO 39 (VN) ──[Flex Sensor]── 3.3V
 *                                   └──[10kΩ Resistor]── GND
 *   • Flex Middle  ──> GPIO 34      ──[Flex Sensor]── 3.3V
 *                                   └──[10kΩ Resistor]── GND
 *   • Flex Ring    ──> GPIO 35      ──[Flex Sensor]── 3.3V
 *                                   └──[10kΩ Resistor]── GND
 *   • Flex Little  ──> GPIO 32      ──[Flex Sensor]── 3.3V
 *                                   └──[10kΩ Resistor]── GND
 *
 *   • Vibration Motor ──> GPIO 4 (via NPN Transistor Base + 100Ω resistor)
 *   • Status LED      ──> GPIO 2 (on-board blue LED)
 *   • MPU6050 (opt)   ──> SDA: GPIO 21 | SCL: GPIO 22 | VCC: 3.3V | GND: GND
 *
 * ARDUINO IDE SETUP:
 *   Tools → Board        : "ESP32 Dev Module" (or your ESP32 board)
 *   Tools → Upload Speed : 115200 (or 921600)
 *   Tools → Flash Size   : 4MB
 *   Tools → Partition    : "Huge APP (3MB No OTA/1MB SPIFFS)"
 */

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ESP32 BLE Libraries (Built-in with ESP32 board package)
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// Disable brownout detector to prevent power draw reboot
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ==============================================================================
// 1. CONFIGURATION & NETWORK CREDENTIALS
// ==============================================================================
#define WIFI_SSID           "Aqib"
#define WIFI_PASS           "mir1aqib"
#define ENABLE_WIFI         false   // Set true if streaming directly over Wi-Fi HTTP

// Backend endpoint for direct Wi-Fi stream
#define BACKEND_STREAM_URL  "http://10.93.154.216:8000/api/smart-gloves/stream"

// Device Identity
#define DEVICE_NAME         "SparshSmartGlove"
#define DEVICE_ID           "esp32-sparsh-glove"

// Nordic UART Service (NUS) UUIDs — EXACTLY matches frontend/lib/smartGloves.ts
#define BLE_SERVICE_UUID    "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_TX_CHAR_UUID    "6e400003-b5a3-f393-e0a9-e50e24dcca9e" // Notify to Browser
#define BLE_RX_CHAR_UUID    "6e400002-b5a3-f393-e0a9-e50e24dcca9e" // Write from Browser

// ==============================================================================
// 2. PIN DEFINITIONS (ALL SENSORS ON ADC1 TO PREVENT WI-FI/BT ADC CONFLICT)
// ==============================================================================
#define PIN_FLEX_THUMB      36  // GPIO36 / SENSOR_VP (ADC1_CH0)
#define PIN_FLEX_INDEX      39  // GPIO39 / SENSOR_VN (ADC1_CH3)
#define PIN_FLEX_MIDDLE     34  // GPIO34 (ADC1_CH6)
#define PIN_FLEX_RING       35  // GPIO35 (ADC1_CH7)
#define PIN_FLEX_LITTLE     32  // GPIO32 (ADC1_CH4)

#define PIN_HAPTIC_MOTOR     4  // GPIO4 — Haptic Vibration Motor (NPN Transistor Base)
#define PIN_STATUS_LED       2  // GPIO2 — Built-in Status LED

#define I2C_SDA_PIN         21  // MPU6050 SDA
#define I2C_SCL_PIN         22  // MPU6050 SCL

// MPU-6050 I2C Address
#define MPU6050_ADDR        0x68

// ==============================================================================
// 3. GLOBAL VARIABLES & STATE
// ==============================================================================
BLEServer* pServer = nullptr;
BLECharacteristic* pTxCharacteristic = nullptr;
BLECharacteristic* pRxCharacteristic = nullptr;

bool bleDeviceConnected = false;
bool oldBleDeviceConnected = false;
bool mpuPresent = false;

uint32_t packetSequence = 0;
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 35; // ~28 Hz output rate (smooth for 3D avatar)

// Exponential Moving Average (EMA) Filter state for jitter-free readings
float filteredThumb  = 1000.0;
float filteredIndex  = 1000.0;
float filteredMiddle = 1000.0;
float filteredRing   = 1000.0;
float filteredLittle = 1000.0;
const float EMA_ALPHA = 0.35; // 0.0 = high smoothing, 1.0 = raw response

// Wrist orientation
float pitchAngle = 0.0;
float rollAngle  = 0.0;

// Haptic vibration state
unsigned long hapticStopTime = 0;
bool hapticActive = false;

// ==============================================================================
// 4. HAPTIC FEEDBACK CONTROLLER
// ==============================================================================
void triggerHaptic(int durationMs = 150) {
  digitalWrite(PIN_HAPTIC_MOTOR, HIGH);
  hapticActive = true;
  hapticStopTime = millis() + durationMs;
}

void updateHaptic() {
  if (hapticActive && millis() >= hapticStopTime) {
    digitalWrite(PIN_HAPTIC_MOTOR, LOW);
    hapticActive = false;
  }
}

// ==============================================================================
// 5. MPU6050 IMU HELPER (AUTO-DETECTED WITH NON-BLOCKING FALLBACK)
// ==============================================================================
bool initMPU6050() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN, 400000);
  Wire.beginTransmission(MPU6050_ADDR);
  if (Wire.endTransmission() == 0) {
    // Wake up MPU6050 (clear sleep bit in PWR_MGMT_1)
    Wire.beginTransmission(MPU6050_ADDR);
    Wire.write(0x6B); // PWR_MGMT_1 register
    Wire.write(0x00); // Set to 0 to wake up
    Wire.endTransmission();
    Serial.println("[IMU] MPU-6050 detected and initialized.");
    return true;
  }
  Serial.println("[IMU] Notice: MPU-6050 not detected. Defaulting pitch/roll to 0.");
  return false;
}

void readMPU6050(float &pitch, float &roll) {
  if (!mpuPresent) {
    pitch = 0.0;
    roll  = 0.0;
    return;
  }

  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x3B); // Starting from ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return;

  if (Wire.requestFrom(MPU6050_ADDR, 6, true) == 6) {
    int16_t ax = (Wire.read() << 8) | Wire.read();
    int16_t ay = (Wire.read() << 8) | Wire.read();
    int16_t az = (Wire.read() << 8) | Wire.read();

    float axG = ax / 16384.0;
    float ayG = ay / 16384.0;
    float azG = az / 16384.0;

    pitch = atan2(-axG, sqrt(ayG * ayG + azG * azG)) * 57.2957795;
    roll  = atan2(ayG, azG) * 57.2957795;
  }
}

// ==============================================================================
// 6. ADC SAMPLING & SMOOTHING
// ==============================================================================
int readFilteredADC(int pin, float &emaVal) {
  // 8× Oversampling to suppress electrical noise
  long sum = 0;
  for (int i = 0; i < 8; i++) {
    sum += analogRead(pin);
  }
  float rawSample = sum / 8.0;

  // Exponential moving average filter
  emaVal = (EMA_ALPHA * rawSample) + ((1.0 - EMA_ALPHA) * emaVal);
  return (int)round(emaVal);
}

// ==============================================================================
// 7. BLE SERVER CALLBACKS & COMMAND HANDLER
// ==============================================================================
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    bleDeviceConnected = true;
    digitalWrite(PIN_STATUS_LED, HIGH);
    Serial.println("[BLE] Client connected to Sparsh Smart Glove!");
    triggerHaptic(80); // Tactile confirmation buzz on connect
  }

  void onDisconnect(BLEServer* pServer) {
    bleDeviceConnected = false;
    digitalWrite(PIN_STATUS_LED, LOW);
    Serial.println("[BLE] Client disconnected.");
  }
};

void handleIncomingCommand(String cmd) {
  cmd.trim();
  Serial.printf("[CMD] Received: '%s'\n", cmd.c_str());

  if (cmd.startsWith("VIBRATE") || cmd.startsWith("HAPTIC") || cmd.startsWith("BUZZ")) {
    int duration = 150;
    int spaceIdx = cmd.indexOf(' ');
    if (spaceIdx > 0) {
      duration = cmd.substring(spaceIdx + 1).toInt();
      if (duration <= 0 || duration > 2000) duration = 150;
    }
    triggerHaptic(duration);
  } else if (cmd == "PING") {
    String reply = "{\"type\":\"info\",\"msg\":\"pong\",\"device\":\"" + String(DEVICE_ID) + "\"}\n";
    if (pTxCharacteristic && bleDeviceConnected) {
      pTxCharacteristic->setValue(reply.c_str());
      pTxCharacteristic->notify();
    }
    Serial.print(reply);
  }
}

class CharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    std::string rxVal = pCharacteristic->getValue();
    if (rxVal.length() > 0) {
      String cmd = String(rxVal.c_str());
      handleIncomingCommand(cmd);
    }
  }
};

// ==============================================================================
// 8. BLE INITIALIZATION
// ==============================================================================
void setupBLE() {
  BLEDevice::init(DEVICE_NAME);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  // Create Nordic UART Service
  BLEService* pService = pServer->createService(BLE_SERVICE_UUID);

  // TX Characteristic (ESP32 -> Web Browser Notifications)
  pTxCharacteristic = pService->createCharacteristic(
    BLE_TX_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());

  // RX Characteristic (Web Browser -> ESP32 Commands)
  pRxCharacteristic = pService->createCharacteristic(
    BLE_RX_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pRxCharacteristic->setCallbacks(new CharacteristicCallbacks());

  pService->start();

  // Start BLE Advertising
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06); // functions that help with iPhone connections
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Advertising started as 'SparshSmartGlove'");
}

// ==============================================================================
// 9. TELEMETRY PACKET DISPATCHER
// ==============================================================================
void emitTelemetry(int thumb, int index, int middle, int ring, int little, float pitch, float roll) {
  packetSequence++;

  // Construct compact JSON packet formatted exactly as expected by smartGloves.ts
  char buffer[220];
  snprintf(buffer, sizeof(buffer),
    "{\"type\":\"sensor_data\",\"seq\":%lu,\"thumb\":%d,\"index\":%d,\"middle\":%d,\"ring\":%d,\"little\":%d,\"pitch\":%.1f,\"roll\":%.1f}\n",
    (unsigned long)packetSequence, thumb, index, middle, ring, little, pitch, roll
  );

  // 1. Emit via USB Serial (for Web Serial in Chrome/Edge & Arduino Serial Plotter)
  Serial.print(buffer);

  // 2. Emit via Bluetooth BLE (for Web Bluetooth API)
  if (bleDeviceConnected && pTxCharacteristic != nullptr) {
    pTxCharacteristic->setValue((uint8_t*)buffer, strlen(buffer));
    pTxCharacteristic->notify();
  }

  // 3. Optional: Emit via Wi-Fi HTTP POST to backend
#if ENABLE_WIFI
  if (WiFi.status() == WL_CONNECTED && (packetSequence % 4 == 0)) { // 4x decimation for Wi-Fi HTTP
    HTTPClient http;
    http.begin(BACKEND_STREAM_URL);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(80);
    http.POST((uint8_t*)buffer, strlen(buffer));
    http.end();
  }
#endif
}

// ==============================================================================
// 10. SETUP & MAIN LOOP
// ==============================================================================
void setup() {
  // Disable brownout detector to prevent power surge reboot
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=======================================================");
  Serial.println("     SPARSH AI Smart Gloves — Firmware v2.0 Boot       ");
  Serial.println("=======================================================");

  pinMode(PIN_HAPTIC_MOTOR, OUTPUT);
  digitalWrite(PIN_HAPTIC_MOTOR, LOW);

  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  // Configure ADC resolution (12-bit = 0..4095 counts)
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db); // Full range 0 - 3.3V

  // Initialize MPU-6050
  mpuPresent = initMPU6050();

  // Initialize BLE
  setupBLE();

  // Optional Wi-Fi connection
#if ENABLE_WIFI
  Serial.printf("[WiFi] Connecting to %s...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
#endif

  // Initial power-on vibration confirmation
  triggerHaptic(120);

  Serial.println("[Ready] Streaming telemetry via USB Serial and BLE...");
  Serial.println("Open https://sparsh-education.org/student/smart-gloves");
  Serial.println("Click 'Connect via Bluetooth' or 'Connect via USB Serial'");
  Serial.println("=======================================================\n");
}

void loop() {
  updateHaptic();

  // Check for incoming USB Serial commands
  if (Serial.available() > 0) {
    String serialCmd = Serial.readStringUntil('\n');
    handleIncomingCommand(serialCmd);
  }

  // Handle BLE disconnection & re-advertising
  if (!bleDeviceConnected && oldBleDeviceConnected) {
    delay(500); // Give bluetooth stack time
    pServer->startAdvertising();
    Serial.println("[BLE] Restarted advertising.");
    oldBleDeviceConnected = bleDeviceConnected;
  }
  if (bleDeviceConnected && !oldBleDeviceConnected) {
    oldBleDeviceConnected = bleDeviceConnected;
  }

  // Read Sensors & Send Telemetry at fixed interval
  unsigned long now = millis();
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;

    int thumbVal  = readFilteredADC(PIN_FLEX_THUMB,  filteredThumb);
    int indexVal  = readFilteredADC(PIN_FLEX_INDEX,  filteredIndex);
    int middleVal = readFilteredADC(PIN_FLEX_MIDDLE, filteredMiddle);
    int ringVal   = readFilteredADC(PIN_FLEX_RING,   filteredRing);
    int littleVal = readFilteredADC(PIN_FLEX_LITTLE, filteredLittle);

    readMPU6050(pitchAngle, rollAngle);

    emitTelemetry(thumbVal, indexVal, middleVal, ringVal, littleVal, pitchAngle, rollAngle);
  }

  delay(2);
}
