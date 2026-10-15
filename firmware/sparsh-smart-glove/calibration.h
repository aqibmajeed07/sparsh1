/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║        SPARSH AI SMART GLOVES — CALIBRATION MANAGEMENT              ║
 * ║        Non-Volatile Storage (NVS) & Normalization Engine            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

#ifndef CALIBRATION_H
#define CALIBRATION_H

#include <Arduino.h>
#include <Preferences.h>
#include "sensor_config.h"

// Minimum ADC delta between straight and bent for valid calibration (lowered for 100-200 sensors)
#define MIN_CALIBRATION_DELTA 25

struct FingerCalibration {
  uint16_t straightVal; // ADC reading when finger is flat / extended
  uint16_t bentVal;     // ADC reading when finger is fully curled
  bool inverted;        // True if bent value is lower than straight value
};

class GloveCalibration {
private:
  Preferences prefs;
  FingerCalibration cal[NUM_FINGERS];
  bool isCalibrated;

public:
  GloveCalibration() : isCalibrated(false) {
    // Default sensible baselines for low-range sensors (<100 to 200)
    for (int i = 0; i < NUM_FINGERS; i++) {
      cal[i].straightVal = 70;
      cal[i].bentVal     = 200;
      cal[i].inverted    = false;
    }
  }

  void begin() {
    prefs.begin("sparsh_glove", false);
    isCalibrated = prefs.getBool("cal_valid", false);

    if (isCalibrated) {
      for (int i = 0; i < NUM_FINGERS; i++) {
        char keyS[16], keyB[16];
        snprintf(keyS, sizeof(keyS), "s_%d", i);
        snprintf(keyB, sizeof(keyB), "b_%d", i);
        cal[i].straightVal = prefs.getUShort(keyS, 70);
        cal[i].bentVal     = prefs.getUShort(keyB, 200);
        // If stored calibration is still using old 1000/2200 defaults, migrate to 70/200:
        if (cal[i].straightVal >= 500) {
          cal[i].straightVal = 70;
          cal[i].bentVal     = 200;
        }
        cal[i].inverted    = (cal[i].bentVal < cal[i].straightVal);
      }
    }
  }

  bool isReady() const {
    return isCalibrated;
  }

  void recordStraight(const uint16_t currentReadings[NUM_FINGERS]) {
    for (int i = 0; i < NUM_FINGERS; i++) {
      cal[i].straightVal = currentReadings[i];
    }
  }

  void recordBent(const uint16_t currentReadings[NUM_FINGERS]) {
    for (int i = 0; i < NUM_FINGERS; i++) {
      cal[i].bentVal = currentReadings[i];
      cal[i].inverted = (cal[i].bentVal < cal[i].straightVal);
    }
  }

  bool validateAndSave() {
    // Validate each finger has sufficient delta
    for (int i = 0; i < NUM_FINGERS; i++) {
      int delta = abs((int)cal[i].bentVal - (int)cal[i].straightVal);
      if (delta < MIN_CALIBRATION_DELTA) {
        return false; // Delta too small
      }
    }

    // Persist to NVS
    for (int i = 0; i < NUM_FINGERS; i++) {
      char keyS[16], keyB[16];
      snprintf(keyS, sizeof(keyS), "s_%d", i);
      snprintf(keyB, sizeof(keyB), "b_%d", i);
      prefs.putUShort(keyS, cal[i].straightVal);
      prefs.putUShort(keyB, cal[i].bentVal);
    }
    prefs.putBool("cal_valid", true);
    isCalibrated = true;
    return true;
  }

  void reset() {
    prefs.clear();
    isCalibrated = false;
    for (int i = 0; i < NUM_FINGERS; i++) {
      cal[i].straightVal = 70;
      cal[i].bentVal     = 200;
      cal[i].inverted    = false;
    }
  }

  // Calculates normalized bend from 0.00 (straight) to 1.00 (fully bent)
  // Handles both standard (bent > straight) and inverted (bent < straight) flex behavior
  float normalize(int fingerIdx, uint16_t raw) const {
    if (fingerIdx < 0 || fingerIdx >= NUM_FINGERS) return 0.0f;

    const FingerCalibration& fc = cal[fingerIdx];
    float norm = 0.0f;

    if (!fc.inverted) {
      if (raw <= fc.straightVal) norm = 0.0f;
      else if (raw >= fc.bentVal) norm = 1.0f;
      else {
        float span = (float)(fc.bentVal - fc.straightVal);
        norm = span > 0 ? ((float)(raw - fc.straightVal) / span) : 0.0f;
      }
    } else {
      // Inverted flex sensor: lower ADC = more bent
      if (raw >= fc.straightVal) norm = 0.0f;
      else if (raw <= fc.bentVal) norm = 1.0f;
      else {
        float span = (float)(fc.straightVal - fc.bentVal);
        norm = span > 0 ? ((float)(fc.straightVal - raw) / span) : 0.0f;
      }
    }

    if (norm < 0.0f) norm = 0.0f;
    if (norm > 1.0f) norm = 1.0f;
    return norm;
  }

  const FingerCalibration& getFinger(int i) const {
    return cal[i];
  }
};

#endif // CALIBRATION_H
