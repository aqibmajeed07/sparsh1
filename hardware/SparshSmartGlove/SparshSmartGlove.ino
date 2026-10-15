/*
  SPARSH Smart Glove firmware v2 - ESP32 DevKit V1 (WROOM-32)
  USB Serial + BLE (Nordic UART). One JSON line per sample:
  {"type":"sensor_data","seq":1,"thumb":75,"index":70,"middle":78,"ring":72,"little":70}

  Commands (USB Serial or BLE, one per line):
    PING    -> PONG
    STATUS  -> sequence number, BLE state, sample rate
    SCAN    -> toggle wiring check: prints millivolts on every ADC1 pin
*/

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ---------- Configuration ----------
#define DEVICE_NAME "Sparsh-Glove"   // web client filters by name prefix "Sparsh"

// MUST match your wiring. Use the SCAN command to find which pin each finger is on.
const int FLEX_PINS[5] = {36, 39, 34, 35, 32};   // thumb, index, middle, ring, little

const uint32_t SEND_INTERVAL_MS = 40;   // 25 Hz
const int SAMPLES = 10;                 // per reading; highest and lowest are discarded
const float SMOOTHING = 0.4f;           // 0..1 (lower = smoother, but slower response)

// All ADC1 pins on the DevKit V1 (ADC2 pins don't work while Wi-Fi is on)
const int SCAN_PINS[6] = {32, 33, 34, 35, 36, 39};

// Nordic UART Service (same UUIDs as the web client)
#define SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define RX_UUID      "6e400002-b5a3-f393-e0a9-e50e24dcca9e"  // browser -> glove
#define TX_UUID      "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  // glove -> browser

// ---------- State ----------
BLEServer* server = nullptr;
BLECharacteristic* txChar = nullptr;
volatile bool bleConnected = false;   // written by the BLE task, read in loop()
bool wasConnected = false;

// BLE command hand-off (BLE task -> loop), protected by a lock
portMUX_TYPE cmdLock = portMUX_INITIALIZER_UNLOCKED;
char bleCmd[33];
volatile bool bleCmdReady = false;

char serialCmd[33];
size_t serialLen = 0;
bool serialOverflow = false;

float smoothed[5];
bool smoothInit = false;
bool scanMode = false;
uint32_t seq = 0;
uint32_t lastSend = 0;

// ---------- Output (fixed-size buffers, no String in the hot path) ----------
void sendLine(const char* line) {
  Serial.println(line);
  if (!bleConnected || !txChar) return;

  char data[160];
  int len = snprintf(data, sizeof(data), "%s\n", line);
  if (len <= 0 || len >= (int)sizeof(data)) return;

  // Default BLE packet = 20 bytes; the web client joins chunks until '\n'
  for (int i = 0; i < len; i += 20) {
    int n = (len - i < 20) ? (len - i) : 20;
    txChar->setValue((uint8_t*)(data + i), n);
    txChar->notify();
    delay(2);
  }
}

void sendInfo(const char* msg) {
  char line[128];
  snprintf(line, sizeof(line), "{\"type\":\"info\",\"msg\":\"%s\"}", msg);
  sendLine(line);
}

// ---------- Commands ----------
void handleCommand(const char* text) {
  String cmd(text);
  cmd.trim();
  cmd.toUpperCase();
  if (cmd.length() == 0) return;

  if (cmd == "PING") {
    sendInfo("PONG");
  } else if (cmd == "STATUS") {
    char msg[64];
    snprintf(msg, sizeof(msg), "seq=%lu ble=%s rate=%luHz",
             (unsigned long)seq, bleConnected ? "on" : "off",
             (unsigned long)(1000 / SEND_INTERVAL_MS));
    sendInfo(msg);
  } else if (cmd == "SCAN") {
    scanMode = !scanMode;
    sendInfo(scanMode ? "SCAN on: bend one finger at a time" : "SCAN off");
  } else {
    sendInfo("Unknown command");   // input is never echoed back
  }
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* s) { bleConnected = true; }
  void onDisconnect(BLEServer* s) { bleConnected = false; }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) {
    auto value = c->getValue();
    if (value.length() == 0 || value.length() >= sizeof(bleCmd)) return;  // ignore oversized
    portENTER_CRITICAL(&cmdLock);
    if (!bleCmdReady) {
      memcpy(bleCmd, value.c_str(), value.length());
      bleCmd[value.length()] = '\0';
      bleCmdReady = true;
    }
    portEXIT_CRITICAL(&cmdLock);
  }
};

void readSerialCommands() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n') {
      serialCmd[serialLen] = '\0';
      if (!serialOverflow) handleCommand(serialCmd);
      serialLen = 0;
      serialOverflow = false;
    } else if (ch != '\r') {
      if (serialLen < sizeof(serialCmd) - 1) serialCmd[serialLen++] = ch;
      else serialOverflow = true;   // line too long: drop the whole line
    }
  }
}

void takeBleCommand() {
  char cmd[33];
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

// ---------- Sensors ----------
int readFlex(int pin) {
  analogRead(pin);          // dummy read: lets the ADC settle after switching pins
  delayMicroseconds(50);

  int minV = 4095, maxV = 0;
  long sum = 0;
  for (int i = 0; i < SAMPLES; i++) {
    int v = analogRead(pin);
    sum += v;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  return (sum - minV - maxV) / (SAMPLES - 2);   // average without the two extremes
}

void sendSensorData() {
  int val[5];
  for (int i = 0; i < 5; i++) {
    float r = readFlex(FLEX_PINS[i]);
    smoothed[i] = smoothInit ? smoothed[i] + SMOOTHING * (r - smoothed[i]) : r;
    val[i] = (int)(smoothed[i] + 0.5f);
  }
  smoothInit = true;

  seq++;
  char line[128];
  snprintf(line, sizeof(line),
           "{\"type\":\"sensor_data\",\"seq\":%lu,\"thumb\":%d,\"index\":%d,"
           "\"middle\":%d,\"ring\":%d,\"little\":%d}",
           (unsigned long)seq, val[0], val[1], val[2], val[3], val[4]);
  sendLine(line);
}

void sendScan() {
  char msg[100];
  int n = snprintf(msg, sizeof(msg), "mV");
  for (int i = 0; i < 6; i++) {
    analogRead(SCAN_PINS[i]);   // settle
    n += snprintf(msg + n, sizeof(msg) - n, " %d:%lu",
                  SCAN_PINS[i], (unsigned long)analogReadMilliVolts(SCAN_PINS[i]));
  }
  sendInfo(msg);
}

// ---------- Setup / Loop ----------
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);   // 0..4095

  BLEDevice::init(DEVICE_NAME);
  server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  BLEService* service = server->createService(SERVICE_UUID);

  txChar = service->createCharacteristic(TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  txChar->addDescriptor(new BLE2902());

  BLECharacteristic* rxChar = service->createCharacteristic(
      RX_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rxChar->setCallbacks(new RxCallbacks());

  service->start();

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();

  sendInfo("Sparsh Glove ready (USB + BLE). Send SCAN to check wiring.");
}

void loop() {
  // Restart advertising after the browser disconnects
  if (!bleConnected && wasConnected) {
    delay(300);
    server->startAdvertising();
    wasConnected = false;
  }
  if (bleConnected) wasConnected = true;

  readSerialCommands();
  takeBleCommand();

  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    if (scanMode) {
      static uint8_t tick = 0;
      if (++tick >= 10) { tick = 0; sendScan(); }   // every 400 ms
    } else {
      sendSensorData();
    }
  }
}
