#pragma once

// ==============================================================================
// SPARSH Smart Glasses — Hardware Secrets & Wi-Fi Configuration
// ==============================================================================
// Copy this file to secrets.h on your development machine and update with your credentials.
// NEVER commit your real Wi-Fi passwords to public version control.

#define WIFI_SSID           "Your_WiFi_SSID"
#define WIFI_PASSWORD       "Your_WiFi_Password"

// Device authentication token shared between ESP32 and FastAPI backend.
// This MUST match the value of GLASSES_DEVICE_TOKEN in backend/.env
#define DEVICE_TOKEN        "sparsh_glasses_secret_token_12345"

// SPARSH FastAPI backend LAN URL (where POST /api/glasses/frame is routed)
// E.g. http://192.168.43.10:8000 or http://192.168.1.100:8000
#define BACKEND_URL         "http://192.168.43.10:8000"
