# SPARSH VoiceVision — Comprehensive Run & Demo Guide

This guide details how to run, test, and present the **SPARSH VoiceVision** voice-accessibility layer and the smart-glasses camera integration.

---

## 1. Quick Start / Running Locally

### A. Backend (FastAPI AI Engine)
```bash
cd backend
# Ensure virtualenv is activated if using one
py main.py
```
- Runs at `http://127.0.0.1:8000`.
- Health check: `http://127.0.0.1:8000/health`
- Smart Glasses API: `http://127.0.0.1:8000/api/glasses/status`

### B. Frontend (Next.js 14 App Router)
```bash
cd frontend
npm run dev
```
- Runs at `http://localhost:3000`.
- Direct login: `http://localhost:3000/login`
- Student dashboard: `http://localhost:3000/student`

---

## 2. Environment Variables Configuration

### Backend (`backend/.env`)
```ini
PORT=8000
ALLOWED_ORIGINS=http://localhost:3000,https://www.spaarsh.online

# Supabase Auth & PostgreSQL
SUPABASE_URL=https://jxqazpfuzxkctfntxtzi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# LLM & Vision Models
NVIDIA_API_KEY=<your-nvidia-nim-api-key>
NVIDIA_MODEL=meta/llama-3.3-70b-instruct
VISION_MODEL=meta/llama-3.2-11b-vision-instruct

# Smart Glasses Camera (ESP32-S3 + OV3660)
GLASSES_URL=http://192.168.1.150:80
GLASSES_DEVICE_TOKEN=<your-device-token>
```

### Frontend (`frontend/.env.local`)
```ini
NEXT_PUBLIC_SUPABASE_URL=https://jxqazpfuzxkctfntxtzi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_DAILY_API_KEY=<your-daily-co-api-key>
```

---

## 3. Android Phone Testing & Secure Context Setup

1. **Secure Context Requirement:**
   - Modern browsers (Chrome for Android) restrict `window.SpeechRecognition` and `navigator.mediaDevices` to **secure contexts** (`https://` or `http://localhost`).
   - Connect the Android phone via USB and enable USB Debugging.
   - Run ADB port forwarding:
     ```bash
     adb reverse tcp:3000 tcp:3000
     adb reverse tcp:8000 tcp:8000
     ```
   - Open Chrome on the phone and navigate to `http://localhost:3000`. Because it uses `localhost`, Chrome treats it as a secure context and allows microphone access.

2. **Network & Recognition Notes:**
   - Chrome's built-in `SpeechRecognition` requires an active internet connection to contact Google's speech recognition servers.
   - The ESP32-S3 microcontroller requires a **2.4 GHz Wi-Fi hotspot**. Ensure the phone's hotspot is configured to 2.4 GHz band (disable 5 GHz band).

---

## 4. Smart-Glasses Camera Setup

1. The glasses firmware (`SparshGlasses`) is flashed on the ESP32-S3.
2. When powered, the glasses connect to the local 2.4 GHz network and listen on port 80.
3. Two endpoints are exposed:
   - `GET /status` (returns device telemetry, battery percentage, FPS)
   - `GET /capture` (returns raw JPEG frame)
4. Both require header `X-Device-Token`.
5. The browser never connects directly to the ESP32. All requests are securely proxied through the FastAPI backend (`/api/glasses/*`), preventing mixed-content SSL blocks and device token exposure.

---

## 5. Spoken Demo Script (Verbatim)

Follow this sequence for live presentations or evaluations:

### Step 1: Activation
- **Action:** Click the floating **VoiceVision** button at the bottom-left, press **Alt + V**, or say **"Hello SPARSH"**.
- **SPARSH Speaks:** *"SPARSH VoiceVision is active. Say open dashboard, open online classes, open lessons, or what can I do here."*

### Step 2: Dashboard Navigation
- **Student Speaks:** *"Open my dashboard."*
- **SPARSH Speaks:** *"Opening dashboard."*
- **Result:** Navigates to `/student`.

### Step 3: Check Learning Stats
- **Student Speaks:** *"What is my streak?"*
- **SPARSH Speaks:** *"Hello saqib. You have a 4 day streak, 12 lessons completed, and 5 hours of sign language practice."*

### Step 4: Online Classes & Real Schedule
- **Student Speaks:** *"Show my online classes."*
- **SPARSH Speaks:** *"Opening online classes."*
- **Result:** Navigates to `/student/live-class`.
- **Student Speaks:** *"What classes do I have?"*
- **SPARSH Speaks:** *"You have 1 live class available: Science Experiment & Atoms with Instructor. Say join next class to connect."*

### Step 5: Join Online Class with Confirmation
- **Student Speaks:** *"Join my next class."*
- **SPARSH Speaks:** *"Join Science Experiment & Atoms with Instructor? Say yes to confirm, or no to cancel."*
- **Student Speaks:** *"Yes."*
- **SPARSH Speaks:** *"Connecting to Science Experiment & Atoms. Your microphone and camera remain off for privacy."*

### Step 6: Lesson Catalog & Content Reading
- **Student Speaks:** *"Open lessons."*
- **SPARSH Speaks:** *"Opening lessons."*
- **Result:** Navigates to `/student/lessons`.
- **Student Speaks:** *"Open first lesson."*
- **SPARSH Speaks:** *"Opening Structure of Atom."*
- **Result:** Navigates to `/student/lessons/[id]`.
- **Student Speaks:** *"Read this lesson."*
- **SPARSH Speaks:** *"Reading lesson summary for Structure of Atom. Atoms are the fundamental building blocks of all matter. Every atom consists of a central nucleus containing protons and neutrons, surrounded by electrons in orbit."*

### Step 7: Pause and Resumable Reading
- **Student Speaks:** *"Pause reading."*
- **SPARSH:** *(Immediately pauses speech without losing place).*
- **Student Speaks:** *"Resume reading."*
- **SPARSH Speaks:** *(Resumes seamlessly from the exact same sentence chunk).*

### Step 8: Contextual Introspection
- **Student Speaks:** *"What can I do here?"*
- **SPARSH Speaks:** *"On this page you can say: read this lesson, next sentence, previous sentence, play the lesson video, pause the video, explain simply, or open quiz."*

### Step 9: Media Control
- **Student Speaks:** *"Play the lesson video."*
- **SPARSH Speaks:** *"Playing lesson video."*
- **Result:** HTML5 `<video id="lesson-video">` begins playing.
- **Student Speaks:** *"Pause the video."*
- **SPARSH Speaks:** *"Lesson video paused."*

### Step 10: Non-Verbal / Browser Agent Verification
- **Action:** Click the keyboard terminal icon or press **Alt + T** to open `TypedCommandInput`.
- **Input:** Type `"what is my streak"` and hit Enter.
- **Result:** Displays the exact same parsed intent, visual response, and audio output.

### Step 11: Smart Glasses Camera (ESP32-S3)
- **Student Speaks:** *"Are my glasses connected?"*
- **SPARSH Speaks:** *"Checking smart glasses connection. Smart glasses are connected. Battery is at 98 percent."* *(Or if offline: "Smart glasses are configured, but currently unreachable on your local Wi-Fi.")*
- **Student Speaks:** *"Describe what is in front of me."*
- **SPARSH Speaks:** *"Looking through your glasses now. In front of you is a wooden study desk with a science textbook open to page 42, a pen holder, and a notebook."*
