/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║     SPARSH AI SMART GLOVES — ESP32 + MPU-6050 GESTURE FIRMWARE       ║
 * ║   5-Finger Flex Telemetry + 6-Axis IMU Fusion + Hand Gesture Engine  ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  FEATURES:                                                          ║
 * ║    • 5-Finger 12-bit ADC Flex Sensor Telemetry (EMA Filtered)        ║
 * ║    • MPU-6050 6-Axis Motion Sensor (Accelerometer + Gyroscope)      ║
 * ║    • Complementary Filter for Drift-Free Pitch & Roll Orientation   ║
 * ║    • On-board Real-time Hand Gesture Recognition:                   ║
 * ║        Static:  PALM_DOWN, PALM_UP, TILT_LEFT, TILT_RIGHT,          ║
 * ║                 HAND_UP, HAND_DOWN                                  ║
 * ║        Dynamic: WAVE, SWIPE_LEFT, SWIPE_RIGHT, SWIPE_UP,             ║
 * ║                 SWIPE_DOWN, TAP / IMPACT                            ║
 * ║    • Web Bluetooth BLE (Nordic UART Service) for Chrome / Edge UI   ║
 * ║    • USB Web Serial (115200 baud) for Zero-Latency PC Integration   ║
 * ║    • Haptic Vibration Feedback Motor on Gesture Confirmation        ║
 * ║    • Zero External Libraries Needed (Pure Wire.h I2C register code) ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * HARDWARE PIN CONNECTIONS (ESP32 DevKit v1):
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
 *   • MPU-6050 IMU:
 *       VCC  ──> 3.3V
 *       GND  ──> GND
 *       SDA  ──> GPIO 21
 *       SCL  ──> GPIO 22
 *       AD0  ──> GND (I2C addr 0x68) or 3.3V (addr 0x69)
 *
 *   • Haptic Motor ──> GPIO 4 (via NPN Transistor Base + 100Ω resistor)
 *   • Status LED   ──> GPIO 2 (onboard blue LED)
 */

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>

// ESP32 BLE Libraries (Built-in with ESP32 board package)
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// Brownout protection
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ==============================================================================
// 1. PIN DEFINITIONS
// ==============================================================================
// Flex Sensors on ADC1 (safe with simultaneous BLE/Wi-Fi)
#define PIN_FLEX_THUMB      36  // GPIO36 (ADC1_CH0 / SENSOR_VP)
#define PIN_FLEX_INDEX      39  // GPIO39 (ADC1_CH3 / SENSOR_VN)
#define PIN_FLEX_MIDDLE     34  // GPIO34 (ADC1_CH6)
#define PIN_FLEX_RING       35  // GPIO35 (ADC1_CH7)
#define PIN_FLEX_LITTLE     32  // GPIO32 (ADC1_CH4)

// Haptic & Status Indicators
#define PIN_HAPTIC_MOTOR     4  // GPIO4 — Vibration Motor
#define PIN_STATUS_LED       2  // GPIO2 — On-board Blue LED

// I2C Pins for MPU-6050
#define I2C_SDA_PIN         21
#define I2C_SCL_PIN         22

// Device Identity & BLE UUIDs (matches frontend/lib/smartGloves.ts)
#define DEVICE_NAME         "SparshSmartGlove"
#define BLE_SERVICE_UUID    "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_TX_CHAR_UUID    "6e400003-b5a3-f393-e0a9-e50e24dcca9e" // Notify to Browser
#define BLE_RX_CHAR_UUID    "6e400002-b5a3-f393-e0a9-e50e24dcca9e" // Write from Browser

// ==============================================================================
// 2. MPU-6050 REGISTERS & CONFIGURATION
// ==============================================================================
uint8_t mpuAddress = 0x68;      // Auto-scanned: 0x68 or 0x69
bool mpuReady = false;

#define MPU_REG_SMPLRT_DIV   0x19
#define MPU_REG_CONFIG       0x1A
#define MPU_REG_GYRO_CONFIG  0x1B
#define MPU_REG_ACCEL_CONFIG 0x1C
#define MPU_REG_ACCEL_XOUT_H 0x3B
#define MPU_REG_PWR_MGMT_1   0x6B
#define MPU_REG_WHO_AM_I     0x75

// Calibration Offsets
float gyroX_offset = 0.0, gyroY_offset = 0.0, gyroZ_offset = 0.0;
float accelX_offset = 0.0, accelY_offset = 0.0, accelZ_offset = 0.0;

// Filtered Orientation (Degrees)
float pitch = 0.0;
float roll  = 0.0;
float yaw   = 0.0;

// Filtered Acceleration (g's) & Angular Velocity (°/s)
float ax = 0.0, ay = 0.0, az = 1.0;
float gx = 0.0, gy = 0.0, gz = 0.0;

// Timing for complementary filter integration
unsigned long lastImuMicros = 0;

// ==============================================================================
// 3. HAND GESTURE RECOGNITION STATE
// ==============================================================================
enum HandMotionGesture {
  GESTURE_STILL,
  GESTURE_PALM_DOWN,
  GESTURE_PALM_UP,
  GESTURE_TILT_LEFT,
  GESTURE_TILT_RIGHT,
  GESTURE_HAND_UP,
  GESTURE_HAND_DOWN,
  GESTURE_SWIPE_LEFT,
  GESTURE_SWIPE_RIGHT,
  GESTURE_SWIPE_UP,
  GESTURE_SWIPE_DOWN,
  GESTURE_WAVE,
  GESTURE_TAP
};

const char* GESTURE_NAMES[] = {
  "STILL", "PALM_DOWN", "PALM_UP", "TILT_LEFT", "TILT_RIGHT",
  "HAND_UP", "HAND_DOWN", "SWIPE_LEFT", "SWIPE_RIGHT",
  "SWIPE_UP", "SWIPE_DOWN", "WAVE", "TAP"
};

HandMotionGesture currentGesture = GESTURE_STILL;
HandMotionGesture lastTriggeredGesture = GESTURE_STILL;
unsigned long lastGestureTriggerTime = 0;
const unsigned long GESTURE_COOLDOWN_MS = 600; // Debounce between dynamic gestures

// Wave detector ring buffer
float gzHistory[16] = {0};
uint8_t gzHistoryIdx = 0;

// ==============================================================================
// 4. BLE & SERIAL TELEMETRY STATE
// ==============================================================================
BLEServer* pServer = nullptr;
BLECharacteristic* pTxCharacteristic = nullptr;
BLECharacteristic* pRxCharacteristic = nullptr;

bool bleDeviceConnected = false;
bool oldBleDeviceConnected = false;

uint32_t packetSequence = 0;
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 35; // ~28 Hz output rate for smooth UI

// Flex Sensor EMA Filter Values
float filteredThumb  = 1000.0;
float filteredIndex  = 1000.0;
float filteredMiddle = 1000.0;
float filteredRing   = 1000.0;
float filteredLittle = 1000.0;
const float EMA_ALPHA = 0.35;

// Haptic Vibration State
unsigned long hapticStopTime = 0;
bool hapticActive = false;

void triggerHaptic(int durationMs = 120) {
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
// 5. MPU-6050 HARDWARE DRIVER & CALIBRATION
// ==============================================================================
void writeMPU(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(mpuAddress);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

bool initMPU6050() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN, 400000); // 400 kHz Fast I2C

  // Auto-scan address 0x68 first, then 0x69
  Wire.beginTransmission(0x68);
  if (Wire.endTransmission() == 0) {
    mpuAddress = 0x68;
  } else {
    Wire.beginTransmission(0x69);
    if (Wire.endTransmission() == 0) {
      mpuAddress = 0x69;
    } else {
      Serial.println("[IMU] MPU-6050 not detected on 0x68 or 0x69. Check wiring (VCC, GND, SDA=21, SCL=22).");
      return false;
    }
  }

  Serial.printf("[IMU] Found MPU-6050 at I2C address 0x%02X\n", mpuAddress);

  // 1. Wake up MPU-6050 (clear sleep bit)
  writeMPU(MPU_REG_PWR_MGMT_1, 0x00);
  delay(20);

  // 2. Set sample rate divider (1 kHz / (1 + 7) = 125 Hz)
  writeMPU(MPU_REG_SMPLRT_DIV, 0x07);

  // 3. Set Digital Low Pass Filter (DLPF) to 42 Hz to filter mechanical motor vibration
  writeMPU(MPU_REG_CONFIG, 0x03);

  // 4. Set Gyroscope Full Scale Range: ±500 °/s (65.5 LSB / °/s)
  writeMPU(MPU_REG_GYRO_CONFIG, 0x08);

  // 5. Set Accelerometer Full Scale Range: ±4g (8192 LSB / g)
  writeMPU(MPU_REG_ACCEL_CONFIG, 0x08);

  delay(20);
  return true;
}

void calibrateMPU6050() {
  if (!mpuReady) return;

  Serial.println("[IMU] Calibrating MPU-6050... Please keep glove still on a flat table.");
  digitalWrite(PIN_STATUS_LED, HIGH);

  float gSumX = 0, gSumY = 0, gSumZ = 0;
  float aSumX = 0, aSumY = 0, aSumZ = 0;
  const int SAMPLES = 200;

  for (int i = 0; i < SAMPLES; i++) {
    Wire.beginTransmission(mpuAddress);
    Wire.write(MPU_REG_ACCEL_XOUT_H);
    Wire.endTransmission(false);
    if (Wire.requestFrom(mpuAddress, (uint8_t)14, (uint8_t)true) == 14) {
      int16_t rawAx = (Wire.read() << 8) | Wire.read();
      int16_t rawAy = (Wire.read() << 8) | Wire.read();
      int16_t rawAz = (Wire.read() << 8) | Wire.read();
      Wire.read(); Wire.read(); // skip temp
      int16_t rawGx = (Wire.read() << 8) | Wire.read();
      int16_t rawGy = (Wire.read() << 8) | Wire.read();
      int16_t rawGz = (Wire.read() << 8) | Wire.read();

      aSumX += rawAx / 8192.0;
      aSumY += rawAy / 8192.0;
      aSumZ += (rawAz / 8192.0) - 1.0; // Subtract 1g of gravity on Z
      gSumX += rawGx / 65.5;
      gSumY += rawGy / 65.5;
      gSumZ += rawGz / 65.5;
    }
    delay(5);
  }

  accelX_offset = aSumX / SAMPLES;
  accelY_offset = aSumY / SAMPLES;
  accelZ_offset = aSumZ / SAMPLES;
  gyroX_offset  = gSumX / SAMPLES;
  gyroY_offset  = gSumY / SAMPLES;
  gyroZ_offset  = gSumZ / SAMPLES;

  digitalWrite(PIN_STATUS_LED, LOW);
  triggerHaptic(80); // Quick chirp confirmation

  Serial.println("[IMU] Calibration complete!");
  Serial.printf("  Gyro Offsets  (°/s): X=%.2f, Y=%.2f, Z=%.2f\n", gyroX_offset, gyroY_offset, gyroZ_offset);
}

// Read raw registers and compute complementary filter
void updateIMU() {
  if (!mpuReady) return;

  unsigned long nowMicros = micros();
  float dt = (nowMicros - lastImuMicros) / 1000000.0;
  if (dt <= 0.0 || dt > 0.2) dt = 0.035; // Guard against rollover
  lastImuMicros = nowMicros;

  Wire.beginTransmission(mpuAddress);
  Wire.write(MPU_REG_ACCEL_XOUT_H);
  if (Wire.endTransmission(false) != 0) return;

  if (Wire.requestFrom(mpuAddress, (uint8_t)14, (uint8_t)true) == 14) {
    int16_t rawAx = (Wire.read() << 8) | Wire.read();
    int16_t rawAy = (Wire.read() << 8) | Wire.read();
    int16_t rawAz = (Wire.read() << 8) | Wire.read();
    Wire.read(); Wire.read(); // skip temp
    int16_t rawGx = (Wire.read() << 8) | Wire.read();
    int16_t rawGy = (Wire.read() << 8) | Wire.read();
    int16_t rawGz = (Wire.read() << 8) | Wire.read();

    // Convert raw counts to physical units
    ax = (rawAx / 8192.0) - accelX_offset;
    ay = (rawAy / 8192.0) - accelY_offset;
    az = (rawAz / 8192.0) - accelZ_offset;

    gx = (rawGx / 65.5) - gyroX_offset;
    gy = (rawGy / 65.5) - gyroY_offset;
    gz = (rawGz / 65.5) - gyroZ_offset;

    // Calculate accelerometer tilt angles
    float accelPitch = atan2(-ax, sqrt(ay * ay + az * az)) * 57.2957795;
    float accelRoll  = atan2(ay, az) * 57.2957795;

    // Complementary Filter Fusion (96% gyro integration + 4% accel gravity reference)
    pitch = 0.96 * (pitch + (gy * dt)) + 0.04 * accelPitch;
    roll  = 0.96 * (roll  + (gx * dt)) + 0.04 * accelRoll;
    yaw   += (gz * dt); // Gyro yaw integration (relative heading)
  }
}

// ==============================================================================
// 6. ON-BOARD HAND GESTURE RECOGNITION ALGORITHM
// ==============================================================================
void processHandGestures() {
  if (!mpuReady) return;

  unsigned long now = millis();

  // Store gz in ring buffer for wave detection
  gzHistory[gzHistoryIdx] = gz;
  gzHistoryIdx = (gzHistoryIdx + 1) % 16;

  HandMotionGesture detectedDynamic = GESTURE_STILL;

  // 1. Dynamic Gesture: WAVE (Oscillating Z-gyro angular velocity)
  int zeroCrossings = 0;
  float maxGz = 0.0, minGz = 0.0;
  for (int i = 0; i < 15; i++) {
    int idxA = (gzHistoryIdx + i) % 16;
    int idxB = (gzHistoryIdx + i + 1) % 16;
    if ((gzHistory[idxA] > 80.0 && gzHistory[idxB] < -80.0) ||
        (gzHistory[idxA] < -80.0 && gzHistory[idxB] > 80.0)) {
      zeroCrossings++;
    }
    if (gzHistory[idxA] > maxGz) maxGz = gzHistory[idxA];
    if (gzHistory[idxA] < minGz) minGz = gzHistory[idxA];
  }
  if (zeroCrossings >= 2 && (maxGz - minGz > 220.0)) {
    detectedDynamic = GESTURE_WAVE;
  }

  // 2. Dynamic Gesture: SWIPES (Sharp velocity & acceleration spikes)
  else if (ay > 1.35 || gz > 220.0) {
    detectedDynamic = GESTURE_SWIPE_RIGHT;
  }
  else if (ay < -1.35 || gz < -220.0) {
    detectedDynamic = GESTURE_SWIPE_LEFT;
  }
  else if (ax < -1.40 || gy < -200.0) {
    detectedDynamic = GESTURE_SWIPE_UP;
  }
  else if (ax > 1.40 || gy > 200.0) {
    detectedDynamic = GESTURE_SWIPE_DOWN;
  }

  // 3. Dynamic Gesture: TAP / FORWARD IMPACT
  else if (fabs(az - 1.0) > 1.80) {
    detectedDynamic = GESTURE_TAP;
  }

  // If a dynamic gesture occurred, trigger with cooldown
  if (detectedDynamic != GESTURE_STILL) {
    if (now - lastGestureTriggerTime > GESTURE_COOLDOWN_MS) {
      lastGestureTriggerTime = now;
      currentGesture = detectedDynamic;
      lastTriggeredGesture = detectedDynamic;

      triggerHaptic(60); // 60ms tactile buzz confirmation!
      Serial.printf("\n>>> [GESTURE DETECTED] %s <<<\n\n", GESTURE_NAMES[detectedDynamic]);

      // Emit instant dedicated gesture event JSON
      char gBuf[128];
      snprintf(gBuf, sizeof(gBuf),
        "{\"type\":\"gesture\",\"name\":\"%s\",\"confidence\":0.92,\"pitch\":%.1f,\"roll\":%.1f}\n",
        GESTURE_NAMES[detectedDynamic], pitch, roll
      );
      Serial.print(gBuf);
      if (bleDeviceConnected && pTxCharacteristic) {
        pTxCharacteristic->setValue((uint8_t*)gBuf, strlen(gBuf));
        pTxCharacteristic->notify();
      }
      return;
    }
  }

  // 4. Static Hand Poses (Orientation based)
  if (now - lastGestureTriggerTime > 300) {
    if (pitch > 45.0) {
      currentGesture = GESTURE_HAND_UP;     // Hand held upright (Stop / Wave ready)
    } else if (pitch < -45.0) {
      currentGesture = GESTURE_HAND_DOWN;   // Hand pointed downward
    } else if (roll > 45.0 && roll < 135.0) {
      currentGesture = GESTURE_TILT_RIGHT;  // Hand tilted right
    } else if (roll < -45.0 && roll > -135.0) {
      currentGesture = GESTURE_TILT_LEFT;   // Hand tilted left
    } else if (fabs(roll) > 140.0) {
      currentGesture = GESTURE_PALM_UP;     // Palm facing up
    } else if (fabs(roll) < 30.0 && fabs(pitch) < 30.0) {
      currentGesture = GESTURE_PALM_DOWN;   // Palm facing down flat
    } else {
      currentGesture = GESTURE_STILL;
    }
  }
}

// ==============================================================================
// 7. ADC SAMPLING & SMOOTHING
// ==============================================================================
int readFilteredADC(int pin, float &emaVal) {
  long sum = 0;
  for (int i = 0; i < 8; i++) {
    sum += analogRead(pin);
  }
  float rawSample = sum / 8.0;
  emaVal = (EMA_ALPHA * rawSample) + ((1.0 - EMA_ALPHA) * emaVal);
  return (int)round(emaVal);
}

// ==============================================================================
// 8. BLE SERVER & COMMAND DISPATCHER
// ==============================================================================
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    bleDeviceConnected = true;
    digitalWrite(PIN_STATUS_LED, HIGH);
    Serial.println("[BLE] Client connected to Sparsh Smart Glove!");
    triggerHaptic(100);
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

  if (cmd.startsWith("VIBRATE") || cmd.startsWith("HAPTIC")) {
    int duration = 150;
    int spaceIdx = cmd.indexOf(' ');
    if (spaceIdx > 0) {
      duration = cmd.substring(spaceIdx + 1).toInt();
      if (duration <= 0 || duration > 2000) duration = 150;
    }
    triggerHaptic(duration);
  } else if (cmd == "CAL_IMU") {
    calibrateMPU6050();
  } else if (cmd == "PING") {
    String reply = "{\"type\":\"info\",\"msg\":\"pong\",\"device\":\"" + String(DEVICE_NAME) + "\",\"mpu\":true}\n";
    if (pTxCharacteristic && bleDeviceConnected) {
      pTxCharacteristic->setValue(reply.c_str());
      pTxCharacteristic->notify();
    }
    Serial.print(reply);
  }
}

class CharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    String cmd = pCharacteristic->getValue().c_str();
    if (cmd.length() > 0) {
      handleIncomingCommand(cmd);
    }
  }
};

void setupBLE() {
  BLEDevice::init(DEVICE_NAME);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(BLE_SERVICE_UUID);

  pTxCharacteristic = pService->createCharacteristic(
    BLE_TX_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());

  pRxCharacteristic = pService->createCharacteristic(
    BLE_RX_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pRxCharacteristic->setCallbacks(new CharacteristicCallbacks());

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Advertising started as 'SparshSmartGlove'");
}

// ==============================================================================
// 9. TELEMETRY PACKET DISPATCHER
// ==============================================================================
void emitTelemetry(int thumb, int index, int middle, int ring, int little) {
  packetSequence++;

  // Construct comprehensive telemetry with 5 flex sensors + MPU-6050 pitch, roll, yaw & gesture
  char buffer[256];
  snprintf(buffer, sizeof(buffer),
    "{\"type\":\"sensor_data\",\"seq\":%lu,\"thumb\":%d,\"index\":%d,\"middle\":%d,\"ring\":%d,\"little\":%d,\"pitch\":%.1f,\"roll\":%.1f,\"yaw\":%.1f,\"motion\":\"%s\"}\n",
    (unsigned long)packetSequence,
    thumb, index, middle, ring, little,
    pitch, roll, yaw,
    GESTURE_NAMES[currentGesture]
  );

  // 1. Emit via USB Serial (Web Serial in Chrome / Edge)
  Serial.print(buffer);

  // 2. Emit via Bluetooth BLE (Web Bluetooth)
  if (bleDeviceConnected && pTxCharacteristic != nullptr) {
    pTxCharacteristic->setValue((uint8_t*)buffer, strlen(buffer));
    pTxCharacteristic->notify();
  }
}

// ==============================================================================
// 10. ARDUINO SETUP & LOOP
// ==============================================================================
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout resets

  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=======================================================");
  Serial.println("  SPARSH AI Smart Gloves — 5-Flex + MPU-6050 Firmware  ");
  Serial.println("=======================================================");

  pinMode(PIN_HAPTIC_MOTOR, OUTPUT);
  digitalWrite(PIN_HAPTIC_MOTOR, LOW);

  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  analogReadResolution(12);       // 12-bit ADC (0..4095)
  analogSetAttenuation(ADC_11db); // Full range 0 - 3.3V

  // Initialize MPU-6050 IMU
  mpuReady = initMPU6050();
  if (mpuReady) {
    calibrateMPU6050();
    lastImuMicros = micros();
  }

  // Initialize Bluetooth BLE
  setupBLE();

  // Startup haptic confirmation
  triggerHaptic(120);

  Serial.println("\n[SPARSH Glove Ready] Telemetry running at 115200 baud & BLE!");
  Serial.println("Open: http://localhost:3000/student/smart-gloves");
  Serial.println("=======================================================\n");
}

void loop() {
  updateHaptic();

  // Update MPU-6050 filter & gesture engine at high frequency
  if (mpuReady) {
    updateIMU();
    processHandGestures();
  }

  // Handle incoming commands over USB Serial
  if (Serial.available() > 0) {
    String serialCmd = Serial.readStringUntil('\n');
    handleIncomingCommand(serialCmd);
  }

  // Handle BLE re-advertising on disconnect
  if (!bleDeviceConnected && oldBleDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("[BLE] Restarted advertising.");
    oldBleDeviceConnected = bleDeviceConnected;
  }
  if (bleDeviceConnected && !oldBleDeviceConnected) {
    oldBleDeviceConnected = bleDeviceConnected;
  }

  // Emit telemetry at steady rate (~28 Hz)
  unsigned long now = millis();
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;

    int thumbVal  = readFilteredADC(PIN_FLEX_THUMB,  filteredThumb);
    int indexVal  = readFilteredADC(PIN_FLEX_INDEX,  filteredIndex);
    int middleVal = readFilteredADC(PIN_FLEX_MIDDLE, filteredMiddle);
    int ringVal   = readFilteredADC(PIN_FLEX_RING,   filteredRing);
    int littleVal = readFilteredADC(PIN_FLEX_LITTLE, filteredLittle);

    emitTelemetry(thumbVal, indexVal, middleVal, ringVal, littleVal);
  }

  delay(2);
}
