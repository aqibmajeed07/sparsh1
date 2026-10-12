/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║           SPARSH SENSEBAND — ESP32 BLE Firmware v2.0               ║
 * ║        AI Powered Haptic & Audio Learning Companion                 ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  HARDWARE REQUIRED:                                                 ║
 * ║    • ESP32 DevKit v1 / ESP32-WROOM-32 (any variant)                 ║
 * ║    • Coin Vibration Motor (ERM type, 3V)                            ║
 * ║    • NPN Transistor — BC547 or 2N2222 or S8050                     ║
 * ║    • 1× 100Ω resistor (base resistor)                              ║
 * ║    • 1× 1N4007 flyback diode (motor protection)                    ║
 * ║    • 1× Active Buzzer (5V / 3.3V) on GPIO 2                         ║
 * ║    • USB cable + 5V power (USB or LiPo)                            ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  WIRING DIAGRAM:                                                    ║
 * ║                                                                     ║
 * ║   ESP32 GPIO 2  ──────────── Buzzer (+) Positive / Signal pin       ║
 * ║   ESP32 GND     ──────────── Buzzer (–) Ground                      ║
 * ║                                                                     ║
 * ║   ESP32 GPIO 4  ──[100Ω]──  Base of BC547 NPN Transistor           ║
 * ║                              Collector ── Motor (–)                 ║
 * ║                              Emitter   ── GND                       ║
 * ║   3.3V or 5V   ──────────── Motor (+) ── [1N4007 diode] ── GND     ║
 * ║                 (diode cathode → Motor+, anode → GND, reverse)     ║
 * ║                                                                     ║
 * ║  IMPORTANT: Always use a transistor — do NOT connect the motor      ║
 * ║  directly to the GPIO pin. The motor draws too much current.        ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  BLE SERVICE UUID:    4fafc201-1fb5-459e-8fcc-c5c9c331914b         ║
 * ║  CHARACTERISTIC UUID: beb5483e-36e1-4688-b7f5-ea07361b26a8         ║
 * ║  Device Name:         Sparsh SenseBand                              ║
 * ║                                                                     ║
 * ║  Supported commands (sent as plain text strings over BLE):          ║
 * ║    CONNECTED, AI_READY, CORRECT, WRONG, LESSON_COMPLETE,            ║
 * ║    ASSIGNMENT, MESSAGE, NAV_NEXT, NAV_PREVIOUS, NAV_MENU,           ║
 * ║    EMERGENCY, TEST, BATTERY_REQUEST                                 ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * LIBRARIES NEEDED (install via Arduino Library Manager):
 *   1. ESP32 BLE Arduino  (search "ESP32 BLE" by Neil Kolban)
 *      OR — if using Arduino ESP32 core ≥ 2.0, BLE is built-in.
 *
 * BOARD SETUP:
 *   Tools → Board → "ESP32 Dev Module"
 *   Tools → Upload Speed → 115200
 *   Tools → Flash Size → 4MB
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ─── Pin Definitions ─────────────────────────────────────────────────────────
#define MOTOR_PIN    4   // GPIO4 — connected to transistor base via 100Ω resistor
#define BUZZER_PIN   2   // GPIO2 — Active / Piezo Buzzer (+) signal pin
#define BATT_ADC_PIN 34  // GPIO34 — battery voltage divider (ADC1_CH6)

// ─── BLE UUIDs ────────────────────────────────────────────────────────────────
// These MUST match exactly what senseband.ts uses in the browser
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// ─── Battery helpers ──────────────────────────────────────────────────────────
int readBatteryPercent() {
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) {
    sum += analogRead(BATT_ADC_PIN);
    delayMicroseconds(300);
  }
  uint32_t raw = sum / 16;
  if (raw < 100) return 100; // default safe fallback if no voltage divider connected
  float adcMv = (raw / 4095.0f) * 3300.0f;
  float battMv = adcMv * 2.0f; // 100k/100k voltage divider
  int pct = (int)(((battMv - 3300.0f) / (4200.0f - 3300.0f)) * 100.0f);
  if (pct > 100) pct = 100;
  if (pct < 0) pct = 0;
  return pct;
}

// ─── BLE Objects ─────────────────────────────────────────────────────────────
BLEServer*         pServer         = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool               deviceConnected = false;
bool               oldConnected    = false;

// ─── Buzzer helpers ───────────────────────────────────────────────────────────
void buzzerOn()  { digitalWrite(BUZZER_PIN, HIGH); }
void buzzerOff() { digitalWrite(BUZZER_PIN, LOW);  }

void beep(uint32_t durationMs, uint32_t pauseAfterMs = 60) {
  buzzerOn();
  delay(durationMs);
  buzzerOff();
  delay(pauseAfterMs);
}

void beepTimes(int times, uint32_t onMs = 90, uint32_t offMs = 70) {
  for (int i = 0; i < times; i++) {
    buzzerOn();
    delay(onMs);
    buzzerOff();
    delay(offMs);
  }
}

// ─── Vibration helpers ────────────────────────────────────────────────────────
void motorOn()  { digitalWrite(MOTOR_PIN, HIGH); }
void motorOff() { digitalWrite(MOTOR_PIN, LOW);  }

// Single pulse of `durationMs` milliseconds
void pulse(uint32_t durationMs, uint32_t pauseAfterMs = 80) {
  motorOn();
  delay(durationMs);
  motorOff();
  delay(pauseAfterMs);
}

// Short pulse = 100 ms
void shortPulse()     { pulse(100, 100); }
// Long pulse  = 500 ms
void longPulse()      { pulse(500, 120); }
// Micro pulse = 40 ms (for navigation / rain effect)
void microPulse()     { pulse(40,  60);  }

// ─── All haptic command patterns ─────────────────────────────────────────────

void haptic_CONNECTED() {
  // · (one short pulse) — "I'm here!"
  shortPulse();
}

void haptic_AI_READY() {
  // · · (two short pulses) — AI response is ready
  shortPulse();
  shortPulse();
}

void haptic_CORRECT() {
  // · · · (three short pulses) — correct answer / right braille cell
  shortPulse();
  shortPulse();
  shortPulse();
}

void haptic_WRONG() {
  // — (one long pulse) — wrong answer
  longPulse();
}

void haptic_LESSON_COMPLETE() {
  // · · — (short, short, long) — chapter/lesson done!
  shortPulse();
  shortPulse();
  longPulse();
}

void haptic_ASSIGNMENT() {
  // — · (long, short) — new assignment from teacher
  longPulse();
  shortPulse();
}

void haptic_MESSAGE() {
  // ·· ·· (double-double pulse) — new message
  pulse(80, 60);
  pulse(80, 200);
  pulse(80, 60);
  pulse(80, 80);
}

void haptic_NAV_NEXT() {
  // · (one pulse) — navigate forward
  shortPulse();
}

void haptic_NAV_PREVIOUS() {
  // · · (two pulses) — navigate back
  shortPulse();
  shortPulse();
}

void haptic_NAV_MENU() {
  // · · · (three pulses) — open menu
  shortPulse();
  shortPulse();
  shortPulse();
}

void haptic_EMERGENCY() {
  // Continuous emergency alert
  motorOn();
  delay(2000);
  motorOff();
}

void haptic_TEST() {
  // One solid second — used to confirm band is working
  motorOn();
  delay(1000);
  motorOff();
}

void sendBatteryResponse() {
  if (!deviceConnected || !pCharacteristic) return;
  int pct = readBatteryPercent();
  String resp = "BATTERY:" + String(pct);
  pCharacteristic->setValue(resp.c_str());
  pCharacteristic->notify();
  Serial.print("[SenseBand] Sent battery notification: "); Serial.println(resp);
}

// ─── Command dispatcher ───────────────────────────────────────────────────────

void dispatchCommand(String cmd) {
  cmd.trim();
  Serial.print("[SenseBand] CMD: ");
  Serial.println(cmd);

  if      (cmd == "CONNECTED")       { haptic_CONNECTED();       beepTimes(1, 100, 50); }
  else if (cmd == "AI_READY")        { haptic_AI_READY();        beepTimes(2, 80, 60); }
  else if (cmd == "CORRECT")         { haptic_CORRECT();         beepTimes(3, 70, 50); }
  else if (cmd == "WRONG")           { haptic_WRONG();           beep(350, 0); }
  else if (cmd == "LESSON_COMPLETE") { haptic_LESSON_COMPLETE(); beepTimes(3, 100, 60); }
  else if (cmd == "ASSIGNMENT")      { haptic_ASSIGNMENT();      beepTimes(2, 180, 80); }
  else if (cmd == "MESSAGE")         { haptic_MESSAGE();         beepTimes(4, 50, 50); }
  else if (cmd == "NAV_NEXT")        { haptic_NAV_NEXT();        beep(40, 20); }
  else if (cmd == "NAV_PREVIOUS")    { haptic_NAV_PREVIOUS();    beep(40, 20); }
  else if (cmd == "NAV_MENU")        { haptic_NAV_MENU();        beep(60, 30); }
  else if (cmd == "EMERGENCY")       { haptic_EMERGENCY();       beepTimes(8, 100, 60); }
  else if (cmd == "TEST")            { haptic_TEST();            beepTimes(2, 180, 100); }
  else if (cmd == "BATTERY_REQUEST") { sendBatteryResponse(); }
  else {
    Serial.print("[SenseBand] Unknown command: ");
    Serial.println(cmd);
    shortPulse(); shortPulse(); shortPulse(); longPulse();
    beepTimes(3, 50, 50);
  }
}

// ─── BLE Server Callbacks ─────────────────────────────────────────────────────

class SenseBandServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    deviceConnected = true;
    Serial.println("[BLE] SenseBand connected to Sparsh Web App!");
    beepTimes(2, 80, 60); // Confirmation audio chime on BLE connect
    delay(200);
    haptic_CONNECTED();
  }
  void onDisconnect(BLEServer* pServer) override {
    deviceConnected = false;
    Serial.println("[BLE] Device disconnected.");
    beep(200, 50); // Single tone on disconnect
  }
};

// Callback fires when the app WRITES a value to the characteristic
class CommandCharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) override {
    std::string rawValue = pCharacteristic->getValue();
    if (rawValue.length() > 0) {
      String cmd = String(rawValue.c_str());
      dispatchCommand(cmd);
    }
  }
};

// ─── SETUP ────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n╔═════════════════════════════════════╗");
  Serial.println("║        Sparsh SenseBand v2.0        ║");
  Serial.println("║   AI Haptic & Buzzer Companion      ║");
  Serial.println("╚═════════════════════════════════════╝");

  // Init pins
  pinMode(MOTOR_PIN,  OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  motorOff();
  buzzerOff();

  // ── Startup sequence ──────────────────────────────────────────────────────
  // Two quick beeps + motor test to confirm hardware is operational
  beepTimes(2, 80, 60);
  delay(150);
  haptic_TEST();
  delay(200);
  buzzerOff();

  // ── Init BLE ──────────────────────────────────────────────────────────────
  // Device Name: Sparsh SenseBand (matches Web Bluetooth search)
  BLEDevice::init("Sparsh SenseBand");

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new SenseBandServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  // Characteristic with WRITE, READ, NOTIFY capabilities
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_WRITE    |
    BLECharacteristic::PROPERTY_WRITE_NR |
    BLECharacteristic::PROPERTY_READ     |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pCharacteristic->setCallbacks(new CommandCharacteristicCallbacks());
  pCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  // Start advertising so the browser can discover the band
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Advertising started as 'Sparsh SenseBand' — waiting for Sparsh connection...");
  buzzerOff();
}

// ─── LOOP ─────────────────────────────────────────────────────────────────────

void loop() {
  // Handle reconnection: after a disconnect, restart advertising
  if (!deviceConnected && oldConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("[BLE] Re-advertising...");
    oldConnected = false;
  }
  if (deviceConnected && !oldConnected) {
    oldConnected = true;
  }

  // Safety: Buzzer and Motor remain OFF during idle/standby
  buzzerOff();
  motorOff();

  delay(20);
}
