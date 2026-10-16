/*
  ╔══════════════════════════════════════════════════════════════════════════╗
  ║       SPARSH AI SMART GLOVES — ESP32 DevKit V1 (WROOM-32) Firmware v3    ║
  ║      Universal ADC1 Calibrated Flex Telemetry (USB Serial + BLE)         ║
  ╚══════════════════════════════════════════════════════════════════════════╝

  FEATURES:
    • Explicit ADC Calibration (ADC_11db = Full 0.0V to 3.3V dynamic range)
    • Mux-settling dual-pass sampling (eliminates pin-to-pin crosstalk)
    • Trimmed-mean outlier rejection filter (8 samples per finger)
    • Dual Output: JSON telemetry stream (25Hz) + Human-readable Serial monitor debug (2Hz)
    • Live Millivolt & ADC Raw readings
    • Interactive Commands (Serial & BLE):
        PING    -> PONG
        STATUS  -> seq, BLE state, sample rate, pin voltage summary
        SCAN    -> Live wiring diagnostic on all 6 ADC1 pins (32, 33, 34, 35, 36, 39)
        CAL     -> Reset runtime min/max calibration
        HELP    -> List all available commands

  HARDWARE PIN ASSIGNMENTS (ESP32 DevKit V1 ADC1):
    • Thumb   : GPIO 36 (VP / ADC1_CH0)
    • Index   : GPIO 39 (VN / ADC1_CH3)
    • Middle  : GPIO 34 (D34 / ADC1_CH6)
    • Ring    : GPIO 35 (D35 / ADC1_CH7)
    • Little  : GPIO 32 (D32 / ADC1_CH4)
    (Note: ADC1 pins are required because ADC2 is disabled when Wi-Fi/BLE is active)

  VOLTAGE DIVIDER WIRING:
    • 3.3V ─── [ Flex Sensor ] ───┬─── GPIO Pin (ADC1)
                                  │
                             [ 10kΩ to 47kΩ Resistor ]
                                  │
                                 GND
*/

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ==============================================================================
// 1. PIN CONFIGURATION & PRESETS
// ==============================================================================
#define DEVICE_NAME "Sparsh-Glove"

// Primary ADC1 pins for 5 fingers (MUST match your DevKit V1 wiring)
// Pin board labels: VP = 36, VN = 39, D34 = 34, D35 = 35, D32 = 32
const int FLEX_PINS[5] = {36, 39, 34, 35, 32}; // Thumb, Index, Middle, Ring, Little

// All ADC1 pins on the DevKit V1 available for diagnostic wiring scan
const int SCAN_PINS[6] = {32, 33, 34, 35, 36, 39};

// Sampling & Telemetry Rates
const uint32_t SEND_INTERVAL_MS = 40;   // 25 Hz telemetry stream for Web UI
const uint32_t DEBUG_INTERVAL_MS = 500; // 2 Hz human-readable Serial monitor
const float SMOOTHING = 0.35f;          // Exponential Moving Average weight (0.0 to 1.0)

// Nordic UART Service UUIDs (matches Web Bluetooth in Chrome / Edge)
#define SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define RX_UUID      "6e400002-b5a3-f393-e0a9-e50e24dcca9e" // Web Client -> Glove
#define TX_UUID      "6e400003-b5a3-f393-e0a9-e50e24dcca9e" // Glove -> Web Client

// ==============================================================================
// 2. STATE VARIABLES
// ==============================================================================
BLEServer* pServer = nullptr;
BLECharacteristic* pTxCharacteristic = nullptr;
volatile bool bleConnected = false;
bool wasConnected = false;

// Thread-safe command buffer for BLE
portMUX_TYPE cmdLock = portMUX_INITIALIZER_UNLOCKED;
char bleCmd[48];
volatile bool bleCmdReady = false;

char serialCmd[48];
size_t serialLen = 0;
bool serialOverflow = false;

float smoothed[5] = {0, 0, 0, 0, 0};
bool smoothInit = false;
bool scanMode = false;
bool humanDebugMode = true; // Set to true to print clear voltages in Serial Monitor

uint32_t seq = 0;
uint32_t lastSend = 0;
uint32_t lastDebug = 0;

// Dynamic runtime min/max tracking (helps auto-detect user's flex range)
int minSeen[5] = {4095, 4095, 4095, 4095, 4095};
int maxSeen[5] = {0, 0, 0, 0, 0};

// ==============================================================================
// 3. LOW-LEVEL COMMUNICATION HELPERS
// ==============================================================================
void sendLine(const char* line) {
  // Always output to USB Serial
  Serial.println(line);

  if (!bleConnected || !pTxCharacteristic) return;

  char data[180];
  int len = snprintf(data, sizeof(data), "%s\n", line);
  if (len <= 0 || len >= (int)sizeof(data)) return;

  // Slice into 20-byte chunks for standard BLE MTU compatibility
  for (int i = 0; i < len; i += 20) {
    int n = (len - i < 20) ? (len - i) : 20;
    pTxCharacteristic->setValue((uint8_t*)(data + i), n);
    pTxCharacteristic->notify();
    delay(2);
  }
}

void sendInfo(const char* msg) {
  char line[160];
  snprintf(line, sizeof(line), "{\"type\":\"info\",\"msg\":\"%s\"}", msg);
  sendLine(line);
}

// ==============================================================================
// 4. INTERACTIVE COMMAND HANDLER
// ==============================================================================
void handleCommand(const char* text) {
  String cmd(text);
  cmd.trim();
  cmd.toUpperCase();
  if (cmd.length() == 0) return;

  if (cmd == "PING") {
    sendInfo("PONG");
  } else if (cmd == "STATUS") {
    char msg[128];
    snprintf(msg, sizeof(msg), "seq=%lu ble=%s rate=%luHz | T:%d I:%d M:%d R:%d L:%d",
             (unsigned long)seq, bleConnected ? "on" : "off",
             (unsigned long)(1000 / SEND_INTERVAL_MS),
             analogRead(FLEX_PINS[0]), analogRead(FLEX_PINS[1]),
             analogRead(FLEX_PINS[2]), analogRead(FLEX_PINS[3]),
             analogRead(FLEX_PINS[4]));
    sendInfo(msg);
  } else if (cmd == "SCAN") {
    scanMode = !scanMode;
    sendInfo(scanMode ? "SCAN on: live millivolts on GPIO 32,33,34,35,36,39" : "SCAN off");
  } else if (cmd == "CAL") {
    for (int i = 0; i < 5; i++) {
      minSeen[i] = 4095;
      maxSeen[i] = 0;
    }
    sendInfo("Calibration reset. Move fingers through full straight and bent range.");
  } else if (cmd == "DEBUG") {
    humanDebugMode = !humanDebugMode;
    sendInfo(humanDebugMode ? "Serial human debug ENABLED" : "Serial human debug DISABLED");
  } else if (cmd == "HELP") {
    sendInfo("Commands: PING, STATUS, SCAN (wiring check), CAL (reset range), DEBUG");
  } else {
    sendInfo("Unknown command. Send HELP for list.");
  }
}

// ==============================================================================
// 5. BLE CALLBACKS
// ==============================================================================
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* s) override {
    bleConnected = true;
  }
  void onDisconnect(BLEServer* s) override {
    bleConnected = false;
  }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    auto value = c->getValue();
    if (value.length() == 0 || value.length() >= sizeof(bleCmd)) return;
    portENTER_CRITICAL(&cmdLock);
    if (!bleCmdReady) {
      memcpy(bleCmd, value.c_str(), value.length());
      bleCmd[value.length()] = '\0';
      bleCmdReady = true;
    }
    portEXIT_CRITICAL(&cmdLock);
  }
};

// ==============================================================================
// 6. HIGH-PRECISION SETTLED ADC SAMPLING
// ==============================================================================
/**
 * Reads a single ADC pin with multiplexer settling and outlier-rejected averaging.
 * Prevents channel cross-talk caused by rapid multiplexer channel switching on ESP32.
 */
int readFlexChannel(int pin) {
  // 1. Dummy read to discharge internal multiplexer sample capacitor
  analogRead(pin);
  delayMicroseconds(60);

  // 2. Sample 8 readings and record extremes
  long sum = 0;
  int minVal = 4095;
  int maxVal = 0;

  for (int i = 0; i < 8; i++) {
    int v = analogRead(pin);
    sum += v;
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
    delayMicroseconds(25);
  }

  // 3. Trimmed mean: discard lowest and highest outlier readings
  return (sum - minVal - maxVal) / 6;
}

/**
 * Transmits JSON telemetry packet for the web app (Bluetooth BLE and USB Serial)
 */
void sendSensorData() {
  int raw[5];
  int mv[5];

  for (int i = 0; i < 5; i++) {
    float r = readFlexChannel(FLEX_PINS[i]);
    smoothed[i] = smoothInit ? smoothed[i] + SMOOTHING * (r - smoothed[i]) : r;
    raw[i] = (int)(smoothed[i] + 0.5f);
    mv[i] = analogReadMilliVolts(FLEX_PINS[i]);

    // Update dynamic range
    if (raw[i] < minSeen[i]) minSeen[i] = raw[i];
    if (raw[i] > maxSeen[i]) maxSeen[i] = raw[i];
  }
  smoothInit = true;

  seq++;
  char line[180];
  snprintf(line, sizeof(line),
           "{\"type\":\"sensor_data\",\"seq\":%lu,\"thumb\":%d,\"index\":%d,"
           "\"middle\":%d,\"ring\":%d,\"little\":%d,\"mv\":[%d,%d,%d,%d,%d]}",
           (unsigned long)seq, raw[0], raw[1], raw[2], raw[3], raw[4],
           mv[0], mv[1], mv[2], mv[3], mv[4]);
  sendLine(line);
}

/**
 * Diagnostic scan mode: prints live millivolts on all ADC1 pins
 */
void sendScanData() {
  char msg[140];
  int n = snprintf(msg, sizeof(msg), "mV");
  for (int i = 0; i < 6; i++) {
    analogRead(SCAN_PINS[i]); // settle
    delayMicroseconds(40);
    n += snprintf(msg + n, sizeof(msg) - n, " %d:%lu",
                  SCAN_PINS[i], (unsigned long)analogReadMilliVolts(SCAN_PINS[i]));
  }
  sendInfo(msg);
}

// ==============================================================================
// 7. INPUT POLLING
// ==============================================================================
void readSerialCommands() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n') {
      serialCmd[serialLen] = '\0';
      if (!serialOverflow) handleCommand(serialCmd);
      serialLen = 0;
      serialOverflow = false;
    } else if (ch != '\r') {
      if (serialLen < sizeof(serialCmd) - 1) {
        serialCmd[serialLen++] = ch;
      } else {
        serialOverflow = true; // Drop line if too long
      }
    }
  }
}

void takeBleCommand() {
  char cmd[48];
  bool have = false;
  portENTER_CRITICAL(&cmdLock);
  if (bleCmdReady) {
    memcpy(cmd, bleCmd, sizeof(cmd));
    bleCmdReady = false;
    have = true;
  }
  portEXIT_CRITICAL(&cmdLock);
  if (have) handleCommand(cmd);
}

// ==============================================================================
// 8. SETUP & MAIN LOOP
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(200);

  Serial.println("\n\n=======================================================");
  Serial.println("  SPARSH Smart Glove Firmware v3 Initializing...");
  Serial.println("=======================================================");

  // 1. Explicitly configure ESP32 ADC for full 3.3V range
  analogSetAttenuation(ADC_11db); // Full-scale range ~3.3V (avoids clamping at 1.1V)
  analogReadResolution(12);       // 12-bit resolution: 0 to 4095 counts

  // 2. Configure Pin Modes
  for (int i = 0; i < 5; i++) {
    pinMode(FLEX_PINS[i], INPUT);
  }

  // 3. Print Hardware Pin Assignments
  Serial.println("ADC Pin Configuration (ADC1):");
  Serial.printf("  • Thumb  (FLEX[0]) -> GPIO %d (VP)\n", FLEX_PINS[0]);
  Serial.printf("  • Index  (FLEX[1]) -> GPIO %d (VN)\n", FLEX_PINS[1]);
  Serial.printf("  • Middle (FLEX[2]) -> GPIO %d\n", FLEX_PINS[2]);
  Serial.printf("  • Ring   (FLEX[3]) -> GPIO %d\n", FLEX_PINS[3]);
  Serial.printf("  • Little (FLEX[4]) -> GPIO %d\n", FLEX_PINS[4]);

  // 4. Initial Hardware Voltage Check
  Serial.println("Initial Voltage Readings:");
  for (int i = 0; i < 5; i++) {
    int raw = analogRead(FLEX_PINS[i]);
    uint32_t mv = analogReadMilliVolts(FLEX_PINS[i]);
    Serial.printf("  Finger %d (GPIO %d): RAW=%d (%lu mV)\n", i, FLEX_PINS[i], raw, (unsigned long)mv);
  }

  // 5. Initialize Web Bluetooth BLE
  BLEDevice::init(DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  pTxCharacteristic = pService->createCharacteristic(
      TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pTxCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic* pRxCharacteristic = pService->createCharacteristic(
      RX_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  pRxCharacteristic->setCallbacks(new RxCallbacks());

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  BLEDevice::startAdvertising();

  Serial.println("BLE Advertising started. Device Name: " DEVICE_NAME);
  Serial.println("Ready! Connect via Web Bluetooth or USB Serial (115200 baud).");
  Serial.println("Send 'SCAN' to check all pins, or 'HELP' for commands.");
  Serial.println("=======================================================\n");

  sendInfo("Sparsh Glove ready (USB + BLE). ADC_11db calibrated.");
}

void loop() {
  // Re-start advertising when client disconnects
  if (!bleConnected && wasConnected) {
    delay(300);
    pServer->startAdvertising();
    wasConnected = false;
    Serial.println("[BLE] Client disconnected. Re-advertising...");
  }
  if (bleConnected) wasConnected = true;

  // Process incoming commands from USB Serial and BLE
  readSerialCommands();
  takeBleCommand();

  // 25 Hz Sensor Telemetry Stream (every 40ms)
  uint32_t now = millis();
  if (now - lastSend >= SEND_INTERVAL_MS) {
    lastSend = now;
    if (scanMode) {
      static uint8_t scanTick = 0;
      if (++scanTick >= 10) { // Send scan data every 400ms
        scanTick = 0;
        sendScanData();
      }
    } else {
      sendSensorData();
    }
  }

  // 2 Hz Human-Readable Serial Monitor Print (every 500ms)
  // Allows student to watch live finger voltages in Arduino Serial Monitor!
  if (humanDebugMode && (now - lastDebug >= DEBUG_INTERVAL_MS) && !scanMode) {
    lastDebug = now;
    Serial.printf("[FLEX] T(36):%4d (%4dmV) | I(39):%4d (%4dmV) | M(34):%4d (%4dmV) | R(35):%4d (%4dmV) | L(32):%4d (%4dmV) | BLE:%s\n",
                  analogRead(FLEX_PINS[0]), analogReadMilliVolts(FLEX_PINS[0]),
                  analogRead(FLEX_PINS[1]), analogReadMilliVolts(FLEX_PINS[1]),
                  analogRead(FLEX_PINS[2]), analogReadMilliVolts(FLEX_PINS[2]),
                  analogRead(FLEX_PINS[3]), analogReadMilliVolts(FLEX_PINS[3]),
                  analogRead(FLEX_PINS[4]), analogReadMilliVolts(FLEX_PINS[4]),
                  bleConnected ? "CONNECTED" : "OFF");
  }
}
