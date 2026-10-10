/*
 * ══════════════════════════════════════════════════════════════════════════════
 *  SPARSH SENSEBAND — AI Powered Haptic Learning Companion
 *  Complete BLE Firmware for ESP32 DevKit V1  |  Firmware v2.2
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *  TARGET:    ESP32 DevKit V1 (38-pin or 30-pin, dual-core Xtensa LX6)
 *  BATTERY:   3.7V LiPo via HW-373 charger
 *  MOTOR:     3V Coin Vibration Motor via 2N2222A + 1kΩ base resistor
 *  BUZZER:    2-pin Active Buzzer (HIGH = ON)
 *  BLE:       Android app sends text commands; band responds with haptics
 *
 *  Arduino IDE Settings:
 *    Board       → ESP32 Dev Module
 *    Partition   → Default 4MB with spiffs
 *    Upload Speed→ 921600
 *    CPU Freq    → 240MHz
 *
 *  Pin Map:
 *    GPIO 4  → Vibration Motor (via 2N2222A)
 *    GPIO 5  → Active Buzzer
 *    GPIO 2  → Onboard LED (active HIGH on DevKit V1)
 *    GPIO 34 → Battery ADC (ADC1_CH6 — safe with BLE, input-only pin)
 *              ⚠ If you wired battery to a different pin, update PIN_BATT_ADC.
 *              ⚠ AVOID GPIO0/GPIO2/GPIO4/GPIO5 for ADC — strapping pins.
 *              ⚠ AVOID ADC2 pins (0,2,4,12-15,25-27) when using BLE/WiFi.
 *
 *  ── WDT FIX NOTES ───────────────────────────────────────────────────────────
 *  TG1WDT_SYS_RESET was caused by three bugs:
 *   1. BLEDevice::init() blocks the loopTask for 3-6s (> 5s WDT timeout)
 *   2. startupSelfTest() used delay() which never yields to FreeRTOS
 *   3. esp_task_wdt_reset() was called without subscribing the task first
 *
 *  Fixes applied:
 *   • esp_task_wdt_delete(NULL) before BLEDevice::init() to suppress WDT
 *   • esp_task_wdt_add(NULL)  + esp_task_wdt_reset() after BLE is ready
 *   • Self-test is a non-blocking state machine running in loop()
 *   • vTaskDelay(1) at the end of every loop() to feed the WDT via idle task
 *  ────────────────────────────────────────────────────────────────────────────
 *
 *  (c) 2026 Sparsh — Inclusive Education Platform
 * ══════════════════════════════════════════════════════════════════════════════
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <esp_sleep.h>
#include <esp_task_wdt.h>

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// ── GPIO Pins ──────────────────────────────────────────────────────────────────
#define PIN_MOTOR     4    // NPN transistor base (2N2222A)
#define PIN_BUZZER    5    // Active buzzer positive leg
#define PIN_LED       2    // Onboard LED — GPIO2 on ESP32 DevKit V1, active HIGH

// ── Battery ADC ────────────────────────────────────────────────────────────────
// Set this to whichever GPIO pin your voltage-divider output is wired to.
// BEST choice: GPIO34, 35, 36 (VP), or 39 (VN) — these are ADC1 input-only
// pins that are immune to BLE/WiFi radio interference.
// GPIO0 (ADC2) works but may give noisy readings when BLE is active.
// ⚠ IF YOU HAVE NO BATTERY SENSE WIRE, set BATT_ADC_DISABLED to true below.
#define PIN_BATT_ADC      34     // ← GPIO34 (ADC1_CH6) — immune to BLE radio interference
#define BATT_ADC_DISABLED false  // ← Battery hardware connected

// ── Voltage divider ─────────────────────────────────────────────────────────────
// Adjust to match your actual resistor values.
// With R1=100kΩ, R2=100kΩ: ratio = (R1+R2)/R2 = 2.0
#define VDIV_RATIO    2.0f

// ── ESP32 ADC parameters (11dB attenuation) ─────────────────────────────────────
// At ADC_11db the effective full-scale input voltage on ESP32 is ~3.3V (3300mV).
// Formula: adcVoltage_mV = (raw / 4095.0) * 3300.0
#define ADC_FULLSCALE_MV  3300.0f
#define ADC_SAMPLES       16

// ── BLE Identifiers ────────────────────────────────────────────────────────────
#define DEVICE_NAME          "Sparsh SenseBand"
#define SERVICE_UUID         "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// ── Timing Constants (ms) ──────────────────────────────────────────────────────
#define SHORT_VIB         100
#define LONG_VIB          500
#define TINY_VIB          40
#define GAP_SHORT         120
#define GAP_LONG          200
#define GAP_PATTERN       160

#define FORWARD_INTERVAL  2000
#define CALL_INTERVAL     1000
#define LOW_BATT_VIB_INT  30000
#define LOW_BATT_BEEP_INT 60000

// ── Battery Thresholds ──────────────────────────────────────────────────────────
#define BATT_FULL_MV         4200
#define BATT_EMPTY_MV        3300
#define BATT_WARN_20         20
#define BATT_WARN_10         10
#define BATT_WARN_5          5
#define BATT_SHUTDOWN        3
#define BATT_READ_INTERVAL   30000   // ms between battery reads (30s)

// ── Deep-sleep protection ───────────────────────────────────────────────────────
// Do not allow deep-sleep for this many ms after boot. Prevents false shutdown
// from unstable ADC readings during BLE stack initialisation.
#define BATT_STARTUP_GRACE_MS  60000UL  // 60 seconds

// Number of CONSECUTIVE readings at/below BATT_SHUTDOWN required before
// actually entering deep sleep. Prevents a single noisy ADC read from
// powering down the device (ADC2 + BLE radio interference can spike to 0).
#define BATT_BAD_READS_MAX     3

// ═══════════════════════════════════════════════════════════════════════════════
//  COMMAND ENUM
// ═══════════════════════════════════════════════════════════════════════════════

enum Command {
  CMD_NONE = 0,
  CMD_CONNECTED,
  CMD_AI_READY,
  CMD_LEFT,
  CMD_RIGHT,
  CMD_FORWARD,
  CMD_STOP,
  CMD_SUCCESS,
  CMD_ERROR,
  CMD_CORRECT,
  CMD_WRONG,
  CMD_MESSAGE,
  CMD_CALL,
  CMD_CALL_STOP,
  CMD_NAV_NEXT,
  CMD_NAV_PREVIOUS,
  CMD_NAV_MENU,
  CMD_LESSON_COMPLETE,
  CMD_ASSIGNMENT,
  CMD_OCR_TEXT,
  CMD_OCR_DONE,
  CMD_EMERGENCY,
  CMD_LOW_BATTERY,
  CMD_BATTERY_REQUEST,
  CMD_TEST,
  CMD_SLEEP,
  CMD_WAKE,
  CMD_UNKNOWN
};

// ═══════════════════════════════════════════════════════════════════════════════
//  FORWARD DECLARATIONS
// ═══════════════════════════════════════════════════════════════════════════════

Command parseCommand(const String& raw);
void    processCommand(Command cmd);
void    executePendingPattern();
void    motorOn();
void    motorOff();
void    buzzerOn();
void    buzzerOff();
void    ledOn();
void    ledOff();
int     readBatteryPercent();
void    sendBatteryResponse();
void    checkBatteryWarnings();
void    enterDeepSleep();

// ═══════════════════════════════════════════════════════════════════════════════
//  PATTERN SEQUENCER — non-blocking, millis()-based
// ═══════════════════════════════════════════════════════════════════════════════

struct PatternStep {
  bool     motorState;
  bool     buzzerState;
  uint16_t durationMs;
};

#define MAX_PATTERN_STEPS 24

struct PatternState {
  PatternStep steps[MAX_PATTERN_STEPS];
  uint8_t     totalSteps;
  uint8_t     currentStep;
  uint32_t    stepStartMs;
  bool        running;
};

static PatternState gPattern;

void startPattern(const PatternStep* steps, uint8_t count) {
  if (count == 0 || count > MAX_PATTERN_STEPS) return;
  memcpy(gPattern.steps, steps, sizeof(PatternStep) * count);
  gPattern.totalSteps  = count;
  gPattern.currentStep = 0;
  gPattern.stepStartMs = millis();
  gPattern.running     = true;
  if (gPattern.steps[0].motorState)  motorOn();  else motorOff();
  if (gPattern.steps[0].buzzerState) buzzerOn(); else buzzerOff();
}

void stopPattern() {
  gPattern.running = false;
  motorOff();
  buzzerOff();
}

void executePendingPattern() {
  if (!gPattern.running) return;
  uint32_t now = millis();
  PatternStep& s = gPattern.steps[gPattern.currentStep];
  if (now - gPattern.stepStartMs >= s.durationMs) {
    gPattern.currentStep++;
    if (gPattern.currentStep >= gPattern.totalSteps) { stopPattern(); return; }
    gPattern.stepStartMs = now;
    PatternStep& ns = gPattern.steps[gPattern.currentStep];
    if (ns.motorState)  motorOn();  else motorOff();
    if (ns.buzzerState) buzzerOn(); else buzzerOff();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONTINUOUS-MODE FLAGS
// ═══════════════════════════════════════════════════════════════════════════════

static bool     gForwardMode      = false;
static uint32_t gForwardLastPulse = 0;
static bool     gCallMode         = false;
static uint32_t gCallLastPulse    = 0;
static bool     gLowBattMode      = false;
static uint32_t gLowBattLastVib   = 0;
static uint32_t gLowBattLastBeep  = 0;

// ═══════════════════════════════════════════════════════════════════════════════
//  NON-BLOCKING SELF-TEST — state machine, runs in loop()
// ═══════════════════════════════════════════════════════════════════════════════
//
//  WHY: Blocking self-test in setup() (using delay()) plus BLEDevice::init()
//  combined to exceed the 5-second Task Watchdog → TG1WDT_SYS_RESET.
//  The self-test is now zero-blocking; it just checks millis() each loop tick.

enum SelfTestState {
  ST_IDLE = 0,
  ST_LED1_ON, ST_LED1_OFF,
  ST_LED2_ON, ST_LED2_OFF,
  ST_LED3_ON, ST_LED3_OFF,
  ST_MOTOR_ON, ST_MOTOR_OFF,
  ST_BUZZER_ON, ST_BUZZER_OFF,
  ST_BATTERY,
  ST_DONE
};

static SelfTestState gSelfTest      = ST_IDLE;
static uint32_t      gSelfTestTimer = 0;

void startSelfTest() {
  Serial.println("[INIT] Self-test starting...");
  Serial.println("[INIT] Self-test: LED");
  ledOn();
  gSelfTest      = ST_LED1_ON;
  gSelfTestTimer = millis();
}

void tickSelfTest() {
  if (gSelfTest == ST_IDLE || gSelfTest == ST_DONE) return;
  uint32_t now = millis();
  switch (gSelfTest) {
    case ST_LED1_ON:   if (now - gSelfTestTimer >= 200) { ledOff(); gSelfTest = ST_LED1_OFF; gSelfTestTimer = now; } break;
    case ST_LED1_OFF:  if (now - gSelfTestTimer >= 100) { ledOn();  gSelfTest = ST_LED2_ON;  gSelfTestTimer = now; } break;
    case ST_LED2_ON:   if (now - gSelfTestTimer >= 200) { ledOff(); gSelfTest = ST_LED2_OFF; gSelfTestTimer = now; } break;
    case ST_LED2_OFF:  if (now - gSelfTestTimer >= 100) { ledOn();  gSelfTest = ST_LED3_ON;  gSelfTestTimer = now; } break;
    case ST_LED3_ON:   if (now - gSelfTestTimer >= 200) { ledOff(); gSelfTest = ST_LED3_OFF; gSelfTestTimer = now; } break;
    case ST_LED3_OFF:
      if (now - gSelfTestTimer >= 200) {
        Serial.println("[INIT] Self-test: Motor");
        motorOn(); gSelfTest = ST_MOTOR_ON; gSelfTestTimer = now;
      }
      break;
    case ST_MOTOR_ON:  if (now - gSelfTestTimer >= 150) { motorOff(); gSelfTest = ST_MOTOR_OFF; gSelfTestTimer = now; } break;
    case ST_MOTOR_OFF:
      if (now - gSelfTestTimer >= 150) {
        Serial.println("[INIT] Self-test: Buzzer");
        buzzerOn(); gSelfTest = ST_BUZZER_ON; gSelfTestTimer = now;
      }
      break;
    case ST_BUZZER_ON:  if (now - gSelfTestTimer >= 100) { buzzerOff(); gSelfTest = ST_BUZZER_OFF; gSelfTestTimer = now; } break;
    case ST_BUZZER_OFF: if (now - gSelfTestTimer >= 150) { gSelfTest = ST_BATTERY; gSelfTestTimer = now; } break;
    case ST_BATTERY: {
      int pct = readBatteryPercent();
      Serial.print("[INIT] Battery: "); Serial.print(pct); Serial.println("%");
      Serial.println("[INIT] Self-test PASSED ✔");
      gSelfTest = ST_DONE;
      break;
    }
    default: gSelfTest = ST_DONE; break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BLE GLOBALS
// ═══════════════════════════════════════════════════════════════════════════════

static BLEServer*         pServer         = nullptr;
static BLECharacteristic* pCharacteristic = nullptr;

// volatile: written by BLE RTOS task (core 0), read by loop() (core 1)
static volatile bool    bleConnected    = false;
static volatile bool    bleOldConnected = false;
static volatile Command pendingCmd      = CMD_NONE;

// ═══════════════════════════════════════════════════════════════════════════════
//  BATTERY GLOBALS
// ═══════════════════════════════════════════════════════════════════════════════

static int      gBattPercent     = 100;
static uint32_t gBattLastRead    = 0;
static uint8_t  gBattBadReads   = 0;   // consecutive suspicious reads counter
static bool     gWarned20 = false, gWarned10 = false, gWarned5 = false;

// ═══════════════════════════════════════════════════════════════════════════════
//  GPIO HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

void motorOn()  { digitalWrite(PIN_MOTOR,  HIGH); }
void motorOff() { digitalWrite(PIN_MOTOR,  LOW);  }
void buzzerOn() { digitalWrite(PIN_BUZZER, HIGH); }
void buzzerOff(){ digitalWrite(PIN_BUZZER, LOW);  }

// ESP32 DevKit V1 onboard LED — GPIO2, ACTIVE HIGH
void ledOn()  { digitalWrite(PIN_LED, HIGH); }
void ledOff() { digitalWrite(PIN_LED, LOW);  }

// ═══════════════════════════════════════════════════════════════════════════════
//  BATTERY — ADC reading + percentage
// ═══════════════════════════════════════════════════════════════════════════════

int readBatteryPercent() {
#if BATT_ADC_DISABLED
  return 75;  // no sensor wired — return a safe placeholder
#endif

  // Take multiple samples with settle time to average out noise.
  // ADC2 pins (incl. GPIO0) are affected by BLE radio interference;
  // averaging 16 samples significantly reduces the noise floor.
  uint32_t sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    sum += analogRead(PIN_BATT_ADC);
    delayMicroseconds(500);   // longer settle time to reduce BLE noise
  }
  uint32_t avgRaw = sum / ADC_SAMPLES;

  // ── Floating / disconnected pin guard ────────────────────────────────────
  // A floating ADC2 pin with BLE active typically oscillates between 0-600.
  // A properly connected voltage divider will read well above this.
  // Threshold raised to 800 to safely reject noise from floating pins.
  if (avgRaw < 800) {
    Serial.print("[BATT] Suspicious ADC raw="); Serial.print(avgRaw);
    Serial.println(" (floating/noisy?) — returning safe default");
    return 50;   // safe default, prevents false deep-sleep
  }

  // ESP32 12-bit ADC at 11dB attenuation → full scale ≈ 3300 mV
  float adcVoltage = (avgRaw / 4095.0f) * ADC_FULLSCALE_MV;
  float battMv     = adcVoltage * VDIV_RATIO;

  Serial.print("[BATT] raw="); Serial.print(avgRaw);
  Serial.print(" adc="); Serial.print((int)adcVoltage); Serial.print("mV");
  Serial.print(" batt="); Serial.print((int)battMv); Serial.println("mV");

  int pct = (int)(((battMv - BATT_EMPTY_MV) /
                   (float)(BATT_FULL_MV - BATT_EMPTY_MV)) * 100.0f);
  if (pct > 100) pct = 100;
  if (pct < 0)   pct = 0;
  return pct;
}

void sendBatteryResponse() {
  if (!bleConnected || !pCharacteristic) return;
  int pct = readBatteryPercent();
  String resp = "BATTERY:" + String(pct);
  pCharacteristic->setValue(resp.c_str());
  pCharacteristic->notify();
  Serial.print("[BATT] Sent: "); Serial.println(resp);
}

void checkBatteryWarnings() {
  uint32_t now = millis();
  if (now - gBattLastRead < BATT_READ_INTERVAL) return;
  gBattLastRead = now;

  // ── Startup grace period ─────────────────────────────────────────────────
  // Block ALL battery actions for BATT_STARTUP_GRACE_MS after boot.
  // The ADC (especially ADC2 with BLE) is noisy during BT stack init.
  if (now < BATT_STARTUP_GRACE_MS) {
    Serial.print("[BATT] In startup grace (" );
    Serial.print((BATT_STARTUP_GRACE_MS - now) / 1000);
    Serial.println("s remaining) — skipping shutdown check");
    // Still read + log so user can calibrate, but DON'T act on it
    gBattPercent = readBatteryPercent();
    Serial.print("[BATT] (grace) "); Serial.print(gBattPercent); Serial.println("%");
    return;
  }

  gBattPercent = readBatteryPercent();
  Serial.print("[BATT] "); Serial.print(gBattPercent); Serial.println("%");

  // ── Consecutive-read shutdown protection ─────────────────────────────────
  // Require BATT_BAD_READS_MAX consecutive readings at/below BATT_SHUTDOWN
  // before entering deep sleep. A single noisy ADC read (0%) from BLE
  // interference must NOT kill the device.
  if (gBattPercent <= BATT_SHUTDOWN) {
    gBattBadReads++;
    Serial.print("[BATT] Critical reading #"); Serial.print(gBattBadReads);
    Serial.print(" / "); Serial.println(BATT_BAD_READS_MAX);
    if (gBattBadReads >= BATT_BAD_READS_MAX) {
      Serial.println("[BATT] CONFIRMED CRITICAL — Entering Deep Sleep!");
      enterDeepSleep();
    }
    return;  // don't update warnings on a potentially bad read
  }

  // Reading is good — reset bad-read counter
  gBattBadReads = 0;

  if      (gBattPercent <= BATT_WARN_5  && !gWarned5)  { gWarned5  = true; gLowBattMode = true; Serial.println("[BATT] WARNING 5%");  }
  else if (gBattPercent <= BATT_WARN_10 && !gWarned10) { gWarned10 = true; gLowBattMode = true; Serial.println("[BATT] WARNING 10%"); }
  else if (gBattPercent <= BATT_WARN_20 && !gWarned20) { gWarned20 = true; gLowBattMode = true; Serial.println("[BATT] WARNING 20%"); }

  if (gBattPercent > BATT_WARN_20 + 5) {
    gWarned20 = gWarned10 = gWarned5 = false;
    gLowBattMode = false;
  }
}

void enterDeepSleep() {
  Serial.println("[PWR] Entering Deep Sleep...");
  Serial.flush();
  motorOff(); buzzerOff(); ledOff();
  if (pServer) pServer->getAdvertising()->stop();
  BLEDevice::deinit(false);
  delay(100);
  esp_deep_sleep_start();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMMAND PARSER
// ═══════════════════════════════════════════════════════════════════════════════

Command parseCommand(const String& raw) {
  String cmd = raw; cmd.trim(); cmd.toUpperCase();
  if (cmd == "CONNECTED")        return CMD_CONNECTED;
  if (cmd == "AI_READY")         return CMD_AI_READY;
  if (cmd == "LEFT")             return CMD_LEFT;
  if (cmd == "RIGHT")            return CMD_RIGHT;
  if (cmd == "FORWARD")          return CMD_FORWARD;
  if (cmd == "STOP")             return CMD_STOP;
  if (cmd == "SUCCESS")          return CMD_SUCCESS;
  if (cmd == "ERROR")            return CMD_ERROR;
  if (cmd == "CORRECT")          return CMD_CORRECT;
  if (cmd == "WRONG")            return CMD_WRONG;
  if (cmd == "MESSAGE")          return CMD_MESSAGE;
  if (cmd == "CALL")             return CMD_CALL;
  if (cmd == "CALL_STOP")        return CMD_CALL_STOP;
  if (cmd == "NAV_NEXT")         return CMD_NAV_NEXT;
  if (cmd == "NAV_PREVIOUS")     return CMD_NAV_PREVIOUS;
  if (cmd == "NAV_MENU")         return CMD_NAV_MENU;
  if (cmd == "LESSON_COMPLETE")  return CMD_LESSON_COMPLETE;
  if (cmd == "ASSIGNMENT")       return CMD_ASSIGNMENT;
  if (cmd == "OCR_TEXT")         return CMD_OCR_TEXT;
  if (cmd == "OCR_DONE")         return CMD_OCR_DONE;
  if (cmd == "EMERGENCY")        return CMD_EMERGENCY;
  if (cmd == "LOW_BATTERY")      return CMD_LOW_BATTERY;
  if (cmd == "BATTERY_REQUEST")  return CMD_BATTERY_REQUEST;
  if (cmd == "TEST")             return CMD_TEST;
  if (cmd == "SLEEP")            return CMD_SLEEP;
  if (cmd == "WAKE")             return CMD_WAKE;
  return CMD_UNKNOWN;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PATTERN DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

#define M_ON  true
#define M_OFF false
#define B_ON  true
#define B_OFF false
#define PAT_COUNT(a) (sizeof(a)/sizeof(PatternStep))

static const PatternStep PAT_CONNECTED[]       = { {M_ON,B_ON,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT} };
static const PatternStep PAT_AI_READY[]        = { {M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT},{M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT} };
static const PatternStep PAT_LEFT[]            = { {M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT},{M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT} };
static const PatternStep PAT_RIGHT[]           = { {M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT},{M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT},{M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT} };
static const PatternStep PAT_STOP[]            = { {M_ON,B_OFF,LONG_VIB},{M_OFF,B_OFF,GAP_LONG} };
static const PatternStep PAT_SUCCESS[]         = { {M_ON,B_ON,60},{M_OFF,B_OFF,60},{M_ON,B_OFF,60},{M_OFF,B_OFF,60},{M_ON,B_OFF,60},{M_OFF,B_OFF,GAP_SHORT} };
static const PatternStep PAT_ERROR[]           = { {M_ON,B_ON,LONG_VIB},{M_OFF,B_OFF,GAP_PATTERN},{M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_PATTERN},{M_ON,B_OFF,LONG_VIB},{M_OFF,B_OFF,GAP_LONG} };
static const PatternStep PAT_CORRECT[]         = { {M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT},{M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT},{M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT} };
static const PatternStep PAT_WRONG[]           = { {M_ON,B_OFF,LONG_VIB},{M_OFF,B_OFF,GAP_LONG} };
static const PatternStep PAT_MESSAGE[]         = { {M_ON,B_ON,80},{M_OFF,B_OFF,80},{M_ON,B_ON,80},{M_OFF,B_OFF,GAP_LONG} };
static const PatternStep PAT_LESSON_COMPLETE[] = { {M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT},{M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT},{M_ON,B_OFF,LONG_VIB},{M_OFF,B_OFF,GAP_LONG} };
static const PatternStep PAT_ASSIGNMENT[]      = { {M_ON,B_OFF,LONG_VIB},{M_OFF,B_OFF,GAP_PATTERN},{M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_LONG} };
static const PatternStep PAT_OCR_TEXT[]        = { {M_ON,B_OFF,TINY_VIB},{M_OFF,B_OFF,GAP_SHORT} };
static const PatternStep PAT_OCR_DONE[]        = { {M_ON,B_OFF,LONG_VIB},{M_OFF,B_OFF,GAP_LONG} };
static const PatternStep PAT_EMERGENCY[]       = { {M_ON,B_ON,3000},{M_OFF,B_OFF,GAP_LONG} };
static const PatternStep PAT_NAV_NEXT[]        = { {M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT} };
static const PatternStep PAT_NAV_PREVIOUS[]    = { {M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT},{M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT} };
static const PatternStep PAT_NAV_MENU[]        = { {M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT},{M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT},{M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,GAP_SHORT} };
static const PatternStep PAT_TEST[]            = { {M_ON,B_OFF,1000},{M_OFF,B_OFF,GAP_LONG} };

// ═══════════════════════════════════════════════════════════════════════════════
//  COMMAND PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════════

void cancelContinuousModes() {
  gForwardMode = false; gCallMode = false;
  motorOff(); buzzerOff();
}

void processCommand(Command cmd) {
  if (cmd != CMD_FORWARD && cmd != CMD_CALL &&
      cmd != CMD_BATTERY_REQUEST && cmd != CMD_LOW_BATTERY) {
    if (cmd == CMD_STOP || cmd == CMD_CALL_STOP) cancelContinuousModes();
    else if (gForwardMode || gCallMode)            cancelContinuousModes();
  }
  if (cmd != CMD_FORWARD && cmd != CMD_CALL &&
      cmd != CMD_BATTERY_REQUEST && cmd != CMD_LOW_BATTERY &&
      cmd != CMD_CALL_STOP && cmd != CMD_STOP &&
      cmd != CMD_SLEEP && cmd != CMD_WAKE) {
    stopPattern();
  }
  switch (cmd) {
    case CMD_CONNECTED:
      Serial.println("[CMD] CONNECTED");
      startPattern(PAT_CONNECTED, PAT_COUNT(PAT_CONNECTED)); ledOn(); break;
    case CMD_AI_READY:
      Serial.println("[CMD] AI_READY");
      startPattern(PAT_AI_READY, PAT_COUNT(PAT_AI_READY)); break;
    case CMD_LEFT:
      Serial.println("[CMD] LEFT");
      startPattern(PAT_LEFT, PAT_COUNT(PAT_LEFT)); break;
    case CMD_RIGHT:
      Serial.println("[CMD] RIGHT");
      startPattern(PAT_RIGHT, PAT_COUNT(PAT_RIGHT)); break;
    case CMD_FORWARD:
      Serial.println("[CMD] FORWARD");
      cancelContinuousModes(); gForwardMode = true; gForwardLastPulse = 0; break;
    case CMD_STOP:
      Serial.println("[CMD] STOP");
      cancelContinuousModes(); stopPattern();
      startPattern(PAT_STOP, PAT_COUNT(PAT_STOP)); break;
    case CMD_SUCCESS:
      Serial.println("[CMD] SUCCESS");
      startPattern(PAT_SUCCESS, PAT_COUNT(PAT_SUCCESS)); break;
    case CMD_ERROR:
      Serial.println("[CMD] ERROR");
      startPattern(PAT_ERROR, PAT_COUNT(PAT_ERROR)); break;
    case CMD_CORRECT:
      Serial.println("[CMD] CORRECT");
      startPattern(PAT_CORRECT, PAT_COUNT(PAT_CORRECT)); break;
    case CMD_WRONG:
      Serial.println("[CMD] WRONG");
      startPattern(PAT_WRONG, PAT_COUNT(PAT_WRONG)); break;
    case CMD_MESSAGE:
      Serial.println("[CMD] MESSAGE");
      startPattern(PAT_MESSAGE, PAT_COUNT(PAT_MESSAGE)); break;
    case CMD_CALL:
      Serial.println("[CMD] CALL");
      cancelContinuousModes(); gCallMode = true; gCallLastPulse = 0; break;
    case CMD_CALL_STOP:
      Serial.println("[CMD] CALL_STOP");
      cancelContinuousModes(); break;
    case CMD_NAV_NEXT:
      Serial.println("[CMD] NAV_NEXT");
      startPattern(PAT_NAV_NEXT, PAT_COUNT(PAT_NAV_NEXT)); break;
    case CMD_NAV_PREVIOUS:
      Serial.println("[CMD] NAV_PREVIOUS");
      startPattern(PAT_NAV_PREVIOUS, PAT_COUNT(PAT_NAV_PREVIOUS)); break;
    case CMD_NAV_MENU:
      Serial.println("[CMD] NAV_MENU");
      startPattern(PAT_NAV_MENU, PAT_COUNT(PAT_NAV_MENU)); break;
    case CMD_LESSON_COMPLETE:
      Serial.println("[CMD] LESSON_COMPLETE");
      startPattern(PAT_LESSON_COMPLETE, PAT_COUNT(PAT_LESSON_COMPLETE)); break;
    case CMD_ASSIGNMENT:
      Serial.println("[CMD] ASSIGNMENT");
      startPattern(PAT_ASSIGNMENT, PAT_COUNT(PAT_ASSIGNMENT)); break;
    case CMD_OCR_TEXT:
      Serial.println("[CMD] OCR_TEXT");
      startPattern(PAT_OCR_TEXT, PAT_COUNT(PAT_OCR_TEXT)); break;
    case CMD_OCR_DONE:
      Serial.println("[CMD] OCR_DONE");
      startPattern(PAT_OCR_DONE, PAT_COUNT(PAT_OCR_DONE)); break;
    case CMD_EMERGENCY:
      Serial.println("[CMD] EMERGENCY");
      cancelContinuousModes();
      startPattern(PAT_EMERGENCY, PAT_COUNT(PAT_EMERGENCY)); break;
    case CMD_LOW_BATTERY:
      Serial.println("[CMD] LOW_BATTERY"); gLowBattMode = true; break;
    case CMD_BATTERY_REQUEST:
      Serial.println("[CMD] BATTERY_REQUEST"); sendBatteryResponse(); break;
    case CMD_TEST:
      Serial.println("[CMD] TEST");
      startPattern(PAT_TEST, PAT_COUNT(PAT_TEST)); break;
    case CMD_SLEEP:
      Serial.println("[CMD] SLEEP"); enterDeepSleep(); break;
    case CMD_WAKE:
      Serial.println("[CMD] WAKE — already awake"); break;
    case CMD_UNKNOWN:
    default:
      Serial.println("[CMD] UNKNOWN — ignored"); break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONTINUOUS-MODE TICK
// ═══════════════════════════════════════════════════════════════════════════════

void tickContinuousModes() {
  uint32_t now = millis();

  if (gForwardMode && (now - gForwardLastPulse >= FORWARD_INTERVAL)) {
    gForwardLastPulse = now;
    static const PatternStep fwd[] = { {M_ON,B_OFF,SHORT_VIB},{M_OFF,B_OFF,50} };
    startPattern(fwd, 2);
  }

  if (gCallMode && (now - gCallLastPulse >= CALL_INTERVAL)) {
    gCallLastPulse = now;
    static const PatternStep call[] = { {M_ON,B_ON,300},{M_OFF,B_OFF,100} };
    startPattern(call, 2);
  }

  if (gLowBattMode) {
    if (now - gLowBattLastVib >= LOW_BATT_VIB_INT) {
      gLowBattLastVib = now;
      static const PatternStep lv[] = { {M_ON,B_OFF,200},{M_OFF,B_OFF,100} };
      if (!gPattern.running) startPattern(lv, 2);
    }
    if (now - gLowBattLastBeep >= LOW_BATT_BEEP_INT) {
      gLowBattLastBeep = now;
      static const PatternStep lb[] = { {M_OFF,B_ON,150},{M_OFF,B_OFF,50} };
      if (!gPattern.running) startPattern(lb, 2);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BLE CALLBACKS
// ═══════════════════════════════════════════════════════════════════════════════

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* s) override {
    bleConnected = true;
    Serial.println("[BLE] ✔ Connected");
    ledOn();
    pendingCmd = CMD_CONNECTED;
  }
  void onDisconnect(BLEServer* s) override {
    bleConnected = false;
    Serial.println("[BLE] ✘ Disconnected");
    ledOff();
    cancelContinuousModes();
    stopPattern();
    // Do NOT delay() inside a BLE callback — it runs on BLE's RTOS task
    // and will starve the task watchdog on that task.
    BLEDevice::startAdvertising();
    Serial.println("[BLE] Re-advertising...");
  }
};

class CharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    String cmdStr = pChar->getValue();
    cmdStr.trim();
    if (cmdStr.length() > 0) {
      Serial.print("[BLE] RX: \""); Serial.print(cmdStr); Serial.println("\"");
      pendingCmd = parseCommand(cmdStr);
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  BLE INITIALIZATION — WDT-safe
// ═══════════════════════════════════════════════════════════════════════════════

void initBLE() {
  Serial.println("[BLE] Initializing... (WDT suppressed during BT stack init)");

  // ── CRITICAL FIX ────────────────────────────────────────────────────────────
  // BLEDevice::init() initialises the Bluetooth controller + Bluedroid stack.
  // On ESP32 this can block the calling task for 3-6 seconds, which exceeds
  // the 5-second Task Watchdog (TG1WDT_SYS_RESET).
  //
  // Correct fix: unsubscribe loopTask from the TWDT before the blocking call,
  // then re-subscribe immediately after BLE is ready.
  // Do NOT use esp_task_wdt_reset() alone — you must be subscribed first.
  // ────────────────────────────────────────────────────────────────────────────
  // Unsubscribe loopTask from TWDT before the blocking BLE init.
  // esp_task_wdt_delete returns ESP_OK only if the task was subscribed.
  // We track this so we can conditionally re-subscribe after — avoiding the
  // "task not found" error log on Arduino builds that don't pre-subscribe.
  bool wdtWasSubscribed = (esp_task_wdt_delete(NULL) == ESP_OK);

  BLEDevice::init(DEVICE_NAME);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_WRITE    |
    BLECharacteristic::PROPERTY_WRITE_NR |
    BLECharacteristic::PROPERTY_READ     |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pCharacteristic->setCallbacks(new CharacteristicCallbacks());
  pCharacteristic->addDescriptor(new BLE2902());
  pService->start();

  BLEAdvertising* pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(SERVICE_UUID);
  pAdv->setScanResponse(true);
  pAdv->setMinPreferred(0x06);
  BLEDevice::startAdvertising();

  // Re-subscribe to TWDT only if we were subscribed before — avoids adding
  // an unwanted subscription on Arduino builds that don't pre-subscribe.
  // vTaskDelay(1) in loop() feeds the WDT regardless via the idle task.
  if (wdtWasSubscribed) {
    esp_task_wdt_add(NULL);
    esp_task_wdt_reset();
  }

  Serial.println("[BLE] Advertising as \"" DEVICE_NAME "\"");
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ARDUINO SETUP — must remain fast; no blocking delays
// ═══════════════════════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);

  Serial.println();
  Serial.println("╔═══════════════════════════════════════════════╗");
  Serial.println("║      SPARSH SENSEBAND — Firmware v2.2        ║");
  Serial.println("║   AI Powered Haptic Learning Companion       ║");
  Serial.println("║   Target: ESP32 DevKit V1  |  BLE Wearable   ║");
  Serial.println("╚═══════════════════════════════════════════════╝");
  Serial.println();

  // ── GPIO ────────────────────────────────────────────────────────────────────
  pinMode(PIN_MOTOR,  OUTPUT); motorOff();
  pinMode(PIN_BUZZER, OUTPUT); buzzerOff();
  pinMode(PIN_LED,    OUTPUT); ledOff();

  // ── ADC ─────────────────────────────────────────────────────────────────────
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);   // full scale: ~3300mV on ESP32 DevKit V1

  // ── Pattern engine ──────────────────────────────────────────────────────────
  memset(&gPattern, 0, sizeof(gPattern));

  // ── BLE (WDT is internally suppressed + restored) ───────────────────────────
  initBLE();

  // ── Non-blocking self-test (runs via loop) ──────────────────────────────────
  startSelfTest();

  Serial.println("[READY] Waiting for BLE connection...");
  Serial.println();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ARDUINO LOOP — 100% non-blocking, WDT-friendly
// ═══════════════════════════════════════════════════════════════════════════════

void loop() {
  // 1. Advance self-test state machine (no-op after ~1.5s)
  tickSelfTest();

  // 2. Process pending BLE command
  Command cmd = (Command)pendingCmd;
  if (cmd != CMD_NONE) {
    pendingCmd = CMD_NONE;
    processCommand(cmd);
  }

  // 3. Drive haptic pattern sequencer
  executePendingPattern();

  // 4. Drive continuous modes (FORWARD / CALL / LOW_BATTERY)
  tickContinuousModes();

  // 5. Battery monitoring (every 10s)
  checkBatteryWarnings();

  // 6. Track BLE state
  if (!bleConnected && bleOldConnected) bleOldConnected = false;
  if ( bleConnected && !bleOldConnected) bleOldConnected = true;

  // 7. LED heartbeat when disconnected (3-second slow blink)
  if (!bleConnected) {
    static uint32_t lastBlink = 0;
    uint32_t now = millis();
    if      (now - lastBlink >= 3000) { lastBlink = now; ledOn();  }
    else if (now - lastBlink >= 100)  {                  ledOff(); }
  }

  // 8. Yield to FreeRTOS — lets idle task run, which resets the TWDT.
  //    Without this, the BLE + main task could starve the watchdog.
  vTaskDelay(1);
}
