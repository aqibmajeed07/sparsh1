/*
 * ══════════════════════════════════════════════════════════════════════════════
 *  SPARSH Smart Keyboard — Production Firmware
 *  ESP32 DevKit V1 (ESP-WROOM-32)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *  Communication:  BLE UART Service + USB Serial (dual-mode, simultaneous)
 *  Keyboard:       6×5 Matrix (28 keys: A-Z + ENTER + SPACE)
 *  Features:       Debounce, long-press detection, multi-key, auto-reconnect
 *
 *  Board Package:  ESP32 by Espressif (latest Arduino Core ≥ 2.0)
 *  Compile:        Arduino IDE → Tools → Board: "ESP32 Dev Module"
 *
 * ══════════════════════════════════════════════════════════════════════════════
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ═══════════════════════════════════════════════════════════════════════════════
// BLE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
#define DEVICE_NAME           "SPARSH Keyboard"
#define SERVICE_UUID          "6e400001-b5a3-f393-e0a9-e50e24dcca9e"   // Nordic UART Service
#define CHAR_TX_UUID          "6e400003-b5a3-f393-e0a9-e50e24dcca9e"   // Notify (ESP → App)
#define CHAR_RX_UUID          "6e400002-b5a3-f393-e0a9-e50e24dcca9e"   // Write  (App → ESP)

// ═══════════════════════════════════════════════════════════════════════════════
// KEYBOARD MATRIX CONFIGURATION — 6 Rows × 5 Columns = 30 intersections
// Uses only GPIO-safe pins (avoids boot-strapping GPIOs 0, 2, 6-11, 12, 15)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Matrix Wiring Diagram:
//
//         COL0(13)  COL1(14)  COL2(27)  COL3(26)  COL4(25)
//  ROW0(33) ─[A]──────[B]──────[C]──────[D]──────[E]──
//  ROW1(32) ─[F]──────[G]──────[H]──────[I]──────[J]──
//  ROW2(18) ─[K]──────[L]──────[M]──────[N]──────[O]──
//  ROW3(19) ─[P]──────[Q]──────[R]──────[S]──────[T]──
//  ROW4(21) ─[U]──────[V]──────[W]──────[X]──────[Y]──
//  ROW5(22) ─[Z]────[SPACE]──[ENTER]───[---]───[---]──
//
// Hardware: Each key = push-button connecting ROWx to COLy (NO DIODES).
//           ROW pins = OUTPUT (Active LOW scan)
//           COL pins = INPUT_PULLUP (Read HIGH when open, LOW when pressed)
//           Single-Key Lockout & Software Ghosting Protection enabled.

#define NUM_ROWS  6
#define NUM_COLS  5

// ROW pins (Active LOW outputs during scan)
const int ROW_PINS[NUM_ROWS] = { 33, 32, 18, 19, 21, 22 };

// COL pins (INPUT_PULLUP — active LOW when key pressed)
const int COL_PINS[NUM_COLS] = { 13, 14, 27, 26, 25 };

// ═══════════════════════════════════════════════════════════════════════════════
// KEY MAPPING TABLE — Configurable: Change letters here to remap entire keyboard
// Empty string "" = unused matrix position
// ═══════════════════════════════════════════════════════════════════════════════
const char* KEY_MAP[NUM_ROWS][NUM_COLS] = {
  /*         COL0     COL1      COL2      COL3      COL4   */
  /* ROW0 */ {"A",     "B",      "C",      "D",      "E"    },
  /* ROW1 */ {"F",     "G",      "H",      "I",      "J"    },
  /* ROW2 */ {"K",     "L",      "M",      "N",      "O"    },
  /* ROW3 */ {"P",     "Q",      "R",      "S",      "T"    },
  /* ROW4 */ {"U",     "V",      "W",      "X",      "Y"    },
  /* ROW5 */ {"Z",     "SPACE",  "ENTER",  "",       ""     }
};

// ═══════════════════════════════════════════════════════════════════════════════
// TIMING CONSTANTS (milliseconds)
// ═══════════════════════════════════════════════════════════════════════════════
#define DEBOUNCE_MS         35    // Key debounce lockout
#define LONG_PRESS_MS       800   // Long press threshold
#define SCAN_INTERVAL_MS    5     // Matrix scan period
#define STATUS_INTERVAL_MS  5000  // Periodic status broadcast
#define WORD_TIMEOUT_MS     2000  // Auto-send word after idle
#define BLE_RECONNECT_MS    3000  // BLE advertising restart delay

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL STATE
// ═══════════════════════════════════════════════════════════════════════════════
// Key state tracking for debounce and long-press
struct KeyState {
  bool     pressed;          // Current logical state (debounced)
  bool     rawPrev;          // Previous raw scan result
  uint32_t lastChangeMs;     // Timestamp of last state change
  uint32_t pressStartMs;     // When the key was first pressed
  bool     longPressFired;   // Whether long-press event was already sent
};

KeyState keyStates[NUM_ROWS][NUM_COLS];

// Diode-less single-key lockout state (-1 means no active key locked)
int8_t activeKeyRow = -1;
int8_t activeKeyCol = -1;

// Word buffer — accumulates typed letters, sends on SPACE/ENTER/timeout
char wordBuffer[128];
uint8_t wordBufferLen = 0;
uint32_t lastKeyTimeMs = 0;

// Timing
uint32_t lastScanMs     = 0;
uint32_t lastStatusMs   = 0;
uint32_t lastBleCheckMs = 0;

// ═══════════════════════════════════════════════════════════════════════════════
// FORWARD DECLARATIONS
// ═══════════════════════════════════════════════════════════════════════════════
void initMatrix();
void initBLE();
void scanKeyboard();
void processKeyPress(uint8_t row, uint8_t col);
void processKeyRelease(uint8_t row, uint8_t col);
void processLongPress(uint8_t row, uint8_t col);
void sendKey(const char* keyLabel);
void sendWord();
void sendMessage(const char* msg);
void sendBLE(const char* msg);
void sendUSB(const char* msg);
void checkBLEReconnect();
void checkWordTimeout();
void sendPeriodicStatus();
void feedWatchdog();

// ═══════════════════════════════════════════════════════════════════════════════
// BLE STATE
// ═══════════════════════════════════════════════════════════════════════════════
BLEServer*         pServer         = nullptr;
BLECharacteristic* pTxCharacteristic = nullptr;
bool               bleConnected    = false;
bool               bleAdvertising  = false;

// BLE connection callbacks
class KeyboardBLECallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* s) override {
    bleConnected = true;
    bleAdvertising = false;
    Serial.println("[BLE] Client connected");
    sendUSB("STATUS:CONNECTED");
    sendUSB("MODE:BLE");
  }

  void onDisconnect(BLEServer* s) override {
    bleConnected = false;
    bleAdvertising = true;
    Serial.println("[BLE] Client disconnected — restarting advertising...");
    BLEDevice::startAdvertising();
  }
};

// BLE RX callback (receive commands from app)
class KeyboardRxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    String rx = pChar->getValue().c_str();
    Serial.print("[BLE RX] ");
    Serial.println(rx);
    // Future: handle app commands (e.g., LED feedback, mode switch)
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println("════════════════════════════════════════════════");
  Serial.println("  SPARSH Smart Keyboard v1.0");
  Serial.println("  ESP32 DevKit V1 — BLE + USB Dual-Mode");
  Serial.println("════════════════════════════════════════════════");

  initMatrix();
  initBLE();

  // Clear key states
  memset(keyStates, 0, sizeof(keyStates));
  memset(wordBuffer, 0, sizeof(wordBuffer));

  Serial.println("[INIT] Keyboard ready. Waiting for connection...");
  sendUSB("STATUS:READY");
  sendUSB("MODE:USB");
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN LOOP — Non-blocking state machine
// ═══════════════════════════════════════════════════════════════════════════════
void loop() {
  uint32_t now = millis();

  // 1. Scan keyboard matrix at fixed interval
  if (now - lastScanMs >= SCAN_INTERVAL_MS) {
    lastScanMs = now;
    scanKeyboard();
  }

  // 2. Check for word completion timeout
  checkWordTimeout();

  // 3. Auto-reconnect BLE if disconnected
  checkBLEReconnect();

  // 4. Periodic status heartbeat
  if (now - lastStatusMs >= STATUS_INTERVAL_MS) {
    lastStatusMs = now;
    sendPeriodicStatus();
  }

  // 5. Feed the watchdog (yield to system tasks)
  feedWatchdog();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATRIX INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════
void initMatrix() {
  // ROW pins: Start as INPUT_PULLUP (prevents floating line cross-talk)
  for (int r = 0; r < NUM_ROWS; r++) {
    pinMode(ROW_PINS[r], INPUT_PULLUP);
  }

  // COL pins: INPUT with internal pull-up — reads HIGH when no key pressed
  for (int c = 0; c < NUM_COLS; c++) {
    pinMode(COL_PINS[c], INPUT_PULLUP);
  }

  Serial.println("[MATRIX] 6x5 matrix initialized with pull-ups");
  Serial.print("[MATRIX] ROW pins: ");
  for (int r = 0; r < NUM_ROWS; r++) { Serial.print(ROW_PINS[r]); Serial.print(" "); }
  Serial.println();
  Serial.print("[MATRIX] COL pins: ");
  for (int c = 0; c < NUM_COLS; c++) { Serial.print(COL_PINS[c]); Serial.print(" "); }
  Serial.println();
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════
void initBLE() {
  Serial.println("[BLE] Initializing BLE UART service...");

  BLEDevice::init(DEVICE_NAME);

  // Create BLE server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new KeyboardBLECallbacks());

  // Create UART service
  BLEService* pService = pServer->createService(SERVICE_UUID);

  // TX characteristic (ESP → App) with Notify
  pTxCharacteristic = pService->createCharacteristic(
    CHAR_TX_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());

  // RX characteristic (App → ESP) with Write
  BLECharacteristic* pRxCharacteristic = pService->createCharacteristic(
    CHAR_RX_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pRxCharacteristic->setCallbacks(new KeyboardRxCallbacks());

  // Start service and begin advertising
  pService->start();

  BLEAdvertising* pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(SERVICE_UUID);
  pAdv->setScanResponse(true);
  pAdv->setMinPreferred(0x06);   // Connection interval hint for iOS
  pAdv->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  bleAdvertising = true;

  Serial.println("[BLE] Advertising as: " DEVICE_NAME);
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEYBOARD SCANNING ALGORITHM (ROBUST SINGLE-KEY LOCKOUT)
// Drives active row LOW while keeping inactive rows at INPUT_PULLUP.
// Debounces keys and locks to the primary active key until release.
// ═══════════════════════════════════════════════════════════════════════════════
void scanKeyboard() {
  uint32_t now = millis();

  for (uint8_t r = 0; r < NUM_ROWS; r++) {
    // Drive active row LOW for scanning
    pinMode(ROW_PINS[r], OUTPUT);
    digitalWrite(ROW_PINS[r], LOW);
    delayMicroseconds(30);

    for (uint8_t c = 0; c < NUM_COLS; c++) {
      if (KEY_MAP[r][c][0] == '\0') continue;

      bool rawPressed = (digitalRead(COL_PINS[c]) == LOW);
      KeyState& ks = keyStates[r][c];

      // Track raw changes for debounce
      if (rawPressed != ks.rawPrev) {
        ks.lastChangeMs = now;
        ks.rawPrev = rawPressed;
      }

      if ((now - ks.lastChangeMs) >= DEBOUNCE_MS) {
        bool stableState = rawPressed;

        if (stableState && !ks.pressed) {
          // Key Press: Lock to first active key
          if (activeKeyRow == -1) {
            ks.pressed = true;
            ks.pressStartMs = now;
            ks.longPressFired = false;
            activeKeyRow = r;
            activeKeyCol = c;
            processKeyPress(r, c);
          }
        } else if (!stableState && ks.pressed) {
          // Key Release: Unlock when active key is released
          if (activeKeyRow == r && activeKeyCol == c) {
            ks.pressed = false;
            activeKeyRow = -1;
            activeKeyCol = -1;
            processKeyRelease(r, c);
          } else {
            ks.pressed = false;
          }
        } else if (stableState && ks.pressed && !ks.longPressFired) {
          // Long Press check
          if (activeKeyRow == r && activeKeyCol == c) {
            if ((now - ks.pressStartMs) >= LONG_PRESS_MS) {
              ks.longPressFired = true;
              processLongPress(r, c);
            }
          }
        }
      }
    }

    // Restore row pin to high-impedance pullup mode
    pinMode(ROW_PINS[r], INPUT_PULLUP);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEY EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════
void processKeyPress(uint8_t row, uint8_t col) {
  const char* keyLabel = KEY_MAP[row][col];

  if (strcmp(keyLabel, "ENTER") == 0) {
    // Send accumulated word first, then ENTER command
    if (wordBufferLen > 0) {
      sendWord();
    }
    sendKey("ENTER");

  } else if (strcmp(keyLabel, "SPACE") == 0) {
    // Send accumulated word, then SPACE
    if (wordBufferLen > 0) {
      sendWord();
    }
    sendKey("SPACE");

  } else {
    // Regular alphabet key — append to word buffer
    sendKey(keyLabel);

    if (wordBufferLen < sizeof(wordBuffer) - 1) {
      wordBuffer[wordBufferLen++] = keyLabel[0];
      wordBuffer[wordBufferLen] = '\0';
    }
    lastKeyTimeMs = millis();
  }
}

void processKeyRelease(uint8_t row, uint8_t col) {
  // Key release event — used for future multi-key chord detection
  // Currently no-op
}

void processLongPress(uint8_t row, uint8_t col) {
  const char* keyLabel = KEY_MAP[row][col];
  char msg[32];
  snprintf(msg, sizeof(msg), "LONG:%s", keyLabel);
  sendMessage(msg);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE TRANSMISSION — Dual-mode: BLE + USB simultaneously
// ═══════════════════════════════════════════════════════════════════════════════
void sendKey(const char* keyLabel) {
  char msg[32];
  snprintf(msg, sizeof(msg), "KEY:%s", keyLabel);
  sendMessage(msg);
}

void sendWord() {
  if (wordBufferLen == 0) return;

  char msg[140];
  snprintf(msg, sizeof(msg), "WORD:%s", wordBuffer);
  sendMessage(msg);

  // Reset buffer
  wordBufferLen = 0;
  memset(wordBuffer, 0, sizeof(wordBuffer));
}

void sendMessage(const char* msg) {
  sendBLE(msg);
  sendUSB(msg);
}

void sendBLE(const char* msg) {
  if (!bleConnected || !pTxCharacteristic) return;

  pTxCharacteristic->setValue(msg);
  pTxCharacteristic->notify();
}

void sendUSB(const char* msg) {
  Serial.println(msg);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-RECONNECT BLE
// ═══════════════════════════════════════════════════════════════════════════════
void checkBLEReconnect() {
  if (!bleConnected && !bleAdvertising) {
    uint32_t now = millis();
    if (now - lastBleCheckMs >= BLE_RECONNECT_MS) {
      lastBleCheckMs = now;
      BLEDevice::startAdvertising();
      bleAdvertising = true;
      Serial.println("[BLE] Restarted advertising");
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORD TIMEOUT — Auto-send partial word after idle period
// ═══════════════════════════════════════════════════════════════════════════════
void checkWordTimeout() {
  if (wordBufferLen > 0 && (millis() - lastKeyTimeMs) >= WORD_TIMEOUT_MS) {
    sendWord();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERIODIC STATUS HEARTBEAT
// ═══════════════════════════════════════════════════════════════════════════════
void sendPeriodicStatus() {
  if (bleConnected) {
    sendMessage("STATUS:CONNECTED");
    sendMessage("MODE:BLE");
  } else {
    sendUSB("STATUS:WAITING");
    sendUSB("MODE:USB");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WATCHDOG FEED — Prevent WDT reset on ESP32
// ═══════════════════════════════════════════════════════════════════════════════
void feedWatchdog() {
  yield();
  vTaskDelay(1);   // 1 tick yield to FreeRTOS idle task + WDT
}
