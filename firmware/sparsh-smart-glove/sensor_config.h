/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║        SPARSH AI SMART GLOVES — SENSOR & HARDWARE CONFIG            ║
 * ║        Classic ESP32 (WROOM-32 / LILYGO) Flex Sensor Pinout        ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * CIRCUIT TOPOLOGY:
 *   For each finger:
 *   3.3V ─── Flex Sensor (10k–30kΩ) ─── Signal Junction ───[10kΩ Resistor]─── GND
 *                                             │
 *                                             └─── ESP32 ADC1 Pin
 *
 * NOTE ON ESP32 ADC CHANNELS:
 *   All 5 sensors MUST be connected to ADC1 pins because ADC2 is disabled
 *   whenever the ESP32 Wi-Fi / Bluetooth radio is active.
 *   ADC1 pins on Classic ESP32: GPIO 32, 33, 34, 35, 36 (VP), 39 (VN).
 *
 * PIN ASSIGNMENTS (Classic ESP32):
 *   • Thumb:         GPIO 34 (ADC1_CH6)  [Confirmed test input, ~1600 bent]
 *   • Index:         GPIO 35 (ADC1_CH7)
 *   • Middle:        GPIO 32 (ADC1_CH4)
 *   • Ring:          GPIO 33 (ADC1_CH5)
 *   • Little (Pinky):GPIO 36 (ADC1_CH0 / VP)
 *   • Status LED:    GPIO 2  (Onboard blue LED)
 */

#ifndef SENSOR_CONFIG_H
#define SENSOR_CONFIG_H

#include <Arduino.h>

// ─── Number of Flex Sensors ──────────────────────────────────────────────────
#define NUM_FINGERS 5

// ─── Finger Indices ─────────────────────────────────────────────────────────
#define FINGER_THUMB  0
#define FINGER_INDEX  1
#define FINGER_MIDDLE 2
#define FINGER_RING   3
#define FINGER_LITTLE 4

// ─── Pin Definitions ─────────────────────────────────────────────────────────
const uint8_t SENSOR_PINS[NUM_FINGERS] = {
  34, // Thumb  (ADC1_CH6 - input only)
  35, // Index  (ADC1_CH7 - input only)
  32, // Middle (ADC1_CH4)
  33, // Ring   (ADC1_CH5)
  36  // Little (ADC1_CH0 - VP - input only)
};

const char* const FINGER_NAMES[NUM_FINGERS] = {
  "thumb",
  "index",
  "middle",
  "ring",
  "little"
};

#define STATUS_LED_PIN 2

// ─── Sampling & Filtering Settings ───────────────────────────────────────────
#define DEFAULT_SAMPLE_RATE_HZ 40   // 40 samples per second (25ms interval)
#define SAMPLE_INTERVAL_MS     (1000 / DEFAULT_SAMPLE_RATE_HZ)

// Exponential Moving Average filter coefficient:
// alpha = 0.35 gives responsive tracking with stable noise rejection
#define EMA_ALPHA 0.35f

// Minimum valid ADC reading (open circuit detection, lowered to 10 for low-range sensors)
#define ADC_MIN_VALID 10
// Maximum valid ADC reading (short circuit detection)
#define ADC_MAX_VALID 4050

#endif // SENSOR_CONFIG_H
