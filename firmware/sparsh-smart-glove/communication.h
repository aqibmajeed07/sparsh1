/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║        SPARSH AI SMART GLOVES — COMMUNICATION PROTOCOL              ║
 * ║        Triple Transport: Bluetooth BLE, Wi-Fi, and USB Serial      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

#ifndef COMMUNICATION_H
#define COMMUNICATION_H

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "sensor_config.h"
#include "calibration.h"

// ─── BLE UUIDs (Nordic UART Service compatible with Web Bluetooth) ───────────
#define BLE_SERVICE_UUID           "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_CHARACTERISTIC_UUID_TX "6e400003-b5a3-f393-e0a9-e50e24dcca9e" // Notify to Browser
#define BLE_CHARACTERISTIC_UUID_RX "6e400002-b5a3-f393-e0a9-e50e24dcca9e" // Write from Browser
#define DEVICE_BLE_NAME            "SparshSmartGlove"

class GloveCommunication {
private:
  BLEServer* pServer;
  BLECharacteristic* pTxCharacteristic;
  BLECharacteristic* pRxCharacteristic;
  bool bleConnected;
  bool oldBleConnected;

  bool wifiEnabled;
  String wifiSSID;
  String wifiPass;
  String backendEndpoint;
  unsigned long lastWifiPost;

  uint32_t sequenceNumber;

public:
  GloveCommunication()
    : pServer(nullptr), pTxCharacteristic(nullptr), pRxCharacteristic(nullptr),
      bleConnected(false), oldBleConnected(false), wifiEnabled(false),
      sequenceNumber(0), lastWifiPost(0) {}

  void beginBLE(BLECharacteristicCallbacks* rxCallbacks) {
    BLEDevice::init(DEVICE_BLE_NAME);
    pServer = BLEDevice::createServer();

    class ServerCallbacks : public BLEServerCallbacks {
      GloveCommunication* parent;
    public:
      ServerCallbacks(GloveCommunication* p) : parent(p) {}
      void onConnect(BLEServer* pServer) {
        parent->bleConnected = true;
      }
      void onDisconnect(BLEServer* pServer) {
        parent->bleConnected = false;
      }
    };

    pServer->setCallbacks(new ServerCallbacks(this));

    BLEService* pService = pServer->createService(BLE_SERVICE_UUID);

    // TX Characteristic (Notify to browser)
    pTxCharacteristic = pService->createCharacteristic(
      BLE_CHARACTERISTIC_UUID_TX,
      BLECharacteristic::PROPERTY_NOTIFY
    );
    pTxCharacteristic->addDescriptor(new BLE2902());

    // RX Characteristic (Write commands from browser)
    pRxCharacteristic = pService->createCharacteristic(
      BLE_CHARACTERISTIC_UUID_RX,
      BLECharacteristic::PROPERTY_WRITE
    );
    if (rxCallbacks) {
      pRxCharacteristic->setCallbacks(rxCallbacks);
    }

    pService->start();
    BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06); // functions that help with iPhone connections issue
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();
  }

  void beginWiFi(const String& ssid, const String& password, const String& endpoint) {
    if (ssid.length() == 0) return;
    wifiSSID = ssid;
    wifiPass = password;
    backendEndpoint = endpoint;
    wifiEnabled = true;

    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());
  }

  bool isBleConnected() const {
    return bleConnected;
  }

  bool isWiFiConnected() const {
    return wifiEnabled && (WiFi.status() == WL_CONNECTED);
  }

  void handleBleReconnection() {
    // Re-advertising if client disconnected
    if (!bleConnected && oldBleConnected) {
      delay(50);
      pServer->startAdvertising();
      oldBleConnected = bleConnected;
    }
    if (bleConnected && !oldBleConnected) {
      oldBleConnected = bleConnected;
    }
  }

  // Broadcasts telemetry packet across active transports (BLE, Serial, Wi-Fi)
  void sendSensorPacket(const uint16_t raw[NUM_FINGERS], const float norm[NUM_FINGERS], bool isCalibrated) {
    sequenceNumber++;

    // Format JSON line
    char jsonBuffer[256];
    snprintf(jsonBuffer, sizeof(jsonBuffer),
      "{\"type\":\"sensor_data\",\"seq\":%u,\"thumb\":%u,\"index\":%u,\"middle\":%u,\"ring\":%u,\"little\":%u,"
      "\"norm\":[%.2f,%.2f,%.2f,%.2f,%.2f],\"calibrated\":%s}\n",
      sequenceNumber,
      raw[FINGER_THUMB], raw[FINGER_INDEX], raw[FINGER_MIDDLE], raw[FINGER_RING], raw[FINGER_LITTLE],
      norm[FINGER_THUMB], norm[FINGER_INDEX], norm[FINGER_MIDDLE], norm[FINGER_RING], norm[FINGER_LITTLE],
      isCalibrated ? "true" : "false"
    );

    // 1. USB Serial Output (always active at 115200 baud)
    Serial.print(jsonBuffer);

    // 2. Bluetooth BLE Output (notify browser Web Bluetooth)
    if (bleConnected && pTxCharacteristic) {
      pTxCharacteristic->setValue((uint8_t*)jsonBuffer, strlen(jsonBuffer));
      pTxCharacteristic->notify();
    }

    // 3. Wi-Fi HTTP Post (if configured and connected, throttled to 10 Hz)
    if (isWiFiConnected() && (millis() - lastWifiPost > 100)) {
      lastWifiPost = millis();
      HTTPClient http;
      http.begin(backendEndpoint);
      http.addHeader("Content-Type", "application/json");
      http.POST((uint8_t*)jsonBuffer, strlen(jsonBuffer));
      http.end();
    }
  }

  void sendInfoPacket(const char* message) {
    char buf[128];
    snprintf(buf, sizeof(buf), "{\"type\":\"info\",\"msg\":\"%s\"}\n", message);
    Serial.print(buf);
    if (bleConnected && pTxCharacteristic) {
      pTxCharacteristic->setValue((uint8_t*)buf, strlen(buf));
      pTxCharacteristic->notify();
    }
  }
};

#endif // COMMUNICATION_H
