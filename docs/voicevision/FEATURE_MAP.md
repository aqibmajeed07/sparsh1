# SPARSH VoiceVision — Feature Map & Route Discovery

**Generated:** October 12, 2026  
**Repository:** SPARSH Inclusive Learning Platform (`sparsh-main`)  
**Architecture:** Next.js 14 App Router (Frontend) + FastAPI (Backend) + Supabase PostgreSQL (Database & Auth)

---

## 1. App Router Student-Facing Route Catalog

All student routes reside under `frontend/app/(dashboard)/student` and are protected by `frontend/app/(dashboard)/layout.tsx` which verifies `supabase.auth.getSession()` and fetches the authenticated profile from Supabase.

| Route Path | Page Component | Core Functionality & UI | Auth Required? | Data Source(s) | Status |
|---|---|---|:---:|---|:---:|
| `/student` | `app/(dashboard)/student/page.tsx` | Student dashboard: personalized greeting, learning stats (streak, lessons total, sign hours), active live class alert banner, 3 recent lessons, quick accessibility shortcuts (ISL, Captions, TTS). | **Yes** | Supabase `profiles`, `lessons`, `live_sessions` (or `/api/live-classes/active`) | **Exists** |
| `/student/live-class` | `app/(dashboard)/student/live-class/page.tsx` | Live inclusive classroom: Daily.co WebRTC video grid (`DailyCall`), 3D ISL avatar overlay (`SignAvatarOverlay`), dual subtitles (EN/HI), real-time chat, participants list, mic/camera/share controls. | **Yes** | Supabase `live_sessions`, Daily.co API (`/api/live`), Backend `/api/live-classes/*` | **Exists** |
| `/student/lessons` | `app/(dashboard)/student/lessons/page.tsx` | NCERT syllabus lesson browser: search input, subject/grade/board filters, grid/list view toggle, duration badges, tags. | **Yes** | Supabase `lessons` table | **Exists** |
| `/student/lessons/[id]` | `app/(dashboard)/student/lessons/[id]/page.tsx` | Interactive lesson player: HTML5 `<video id="lesson-video">`, 3D ISL avatar, tabbed content (AI Summary, Key Points, Quiz, Transcript, Vocabulary, Notes), Doubt Solver ("Explain Simply with AI"), celebration overlay. | **Yes** | Supabase `lessons` table by ID, Backend `/api/isl-grammar`, `/api/doubt-solver` | **Exists** |
| `/student/assessments` | `app/(dashboard)/student/assessments/page.tsx` | Assessment catalog: list of subject quizzes, grade, questions count, pass marks, completion status, CTA to launch quiz. | **Yes** | Supabase `assessments` / Predefined assessments | **Exists** |
| `/student/assessments/[id]` | `app/(dashboard)/student/assessments/[id]/page.tsx` | Interactive quiz interface: 8 multiple choice questions, timer, option radio buttons, instant SenseBand haptic feedback, score review, passed/failed status. | **Yes** | Client component state (`QUIZ_QUESTIONS`), SenseBand BLE | **Exists** |
| `/student/ai-tutor` | `app/(dashboard)/student/ai-tutor/page.tsx` | Interactive AI Tutor: chat conversation, voice input/output, bilingual support (EN/HI), 3D ISL avatar signing responses. | **Yes** | FastAPI `/api/ai-tutor/chat` (NVIDIA NIM / Ollama with instant RAG fallback) | **Exists** |
| `/student/ncert-library` | `app/(dashboard)/student/ncert-library/page.tsx` | NCERT Digital Library: grade/subject book browser, chapter viewer, AI chapter explanation, AI quiz generator. | **Yes** | Next.js API `/api/ncert/*`, FastAPI backend | **Exists** |
| `/student/ocr-reader` | `app/(dashboard)/student/ocr-reader/page.tsx` | Accessible book scanner: camera snapshot or image upload, Tesseract.js OCR text extraction, Web Speech TTS reading, ISL gloss generation. | **Yes** | Client-side Tesseract.js, Web Speech API | **Exists** |
| `/student/braille-lab` | `app/(dashboard)/student/braille-lab/page.tsx` | Tactile Braille laboratory: 6-dot cell simulation, speech-to-braille converter, Grade 1 & 2 contracted Braille reference. | **Yes** | `frontend/lib/sparshKeyboard.ts`, Web Speech API | **Exists** |
| `/student/smart-keyboard` | `app/(dashboard)/student/smart-keyboard/page.tsx` | Accessible on-screen keyboard: large high-contrast keys, Braille 6-key input mode, tactile audio cues, Morse code switch input. | **Yes** | `frontend/lib/sparshKeyboard.ts` | **Exists** |
| `/student/homework-helper` | `app/(dashboard)/student/homework-helper/page.tsx` | AI homework solver: question input, step-by-step 3-part breakdown, practice tips. | **Yes** | FastAPI `/api/homework-helper` | **Exists** |
| `/student/smart-notes` | `app/(dashboard)/student/smart-notes/page.tsx` | Flashcard & revision system: dynamic AI summary bullets, interactive flip flashcards. | **Yes** | FastAPI `/api/smart-notes` | **Exists** |
| `/student/rfid-card` | `app/(dashboard)/student/rfid-card/page.tsx` | RFID tactile smart card: virtual card tap simulator, card linking for one-tap lesson navigation. | **Yes** | FastAPI `/api/rfid/tap`, Supabase `profiles` | **Exists** |
| `/student/accessibility-profile` | `app/(dashboard)/student/accessibility-profile/page.tsx` | Accessibility configuration: font size, contrast modes (dark, high-contrast, yellow-on-black), TTS speed/pitch, avatar size, dyslexia font. | **Yes** | `AccessibilityContext` (localStorage) | **Exists** |
| `/student/progress` | `app/(dashboard)/student/progress/page.tsx` | Learning analytics: completed lessons count, hours studied, assessment scores, subject breakdown. | **Yes** | Supabase `profiles`, `lesson_progress` | **Exists** |
| `/student/rewards` | `app/(dashboard)/student/rewards/page.tsx` | Gamification: SPARSH XP points, daily learning streak, achievement badges ("Science Explorer", "Sign Master"). | **Yes** | Supabase `profiles` (`streak_days`, `total_lessons_done`) | **Exists** |
| `/student/senseband` | `app/(dashboard)/student/senseband/page.tsx` | Sparsh SenseBand controller: Web Bluetooth BLE connection to ESP32 wristband, tactile vibration patterns. | **Yes** | `frontend/lib/senseband.ts` (Web Bluetooth) | **Exists** |
| `/student/smart-gloves` | `app/(dashboard)/student/smart-gloves/page.tsx` | AI Smart Gloves dashboard: BLE/WiFi telemetry, 5-finger flex calibration, real-time gesture recognition engine. | **Yes** | `frontend/lib/smartGloves.ts`, `/api/smart-gloves/*` | **Exists** |
| `/student/deafblind` | `app/(dashboard)/student/deafblind/page.tsx` | DeafBlind tactile learning: Tadoma facial vibration simulation, Morse code haptics on device vibrator. | **Yes** | `navigator.vibrate`, FastAPI `/api/deafblind-ai` | **Exists** |
| `/student/profile` | `app/(dashboard)/student/profile/page.tsx` | Profile editor: full name, email, disability category, grade, institution, save profile. | **Yes** | Supabase `profiles` table | **Exists** |
| `/student/analytics` | `app/(dashboard)/student/analytics/page.tsx` | Student learning analytics: study graphs, subject mastery, attendance. | **Yes** | Supabase `profiles`, `live_sessions` | **Exists** |
| `/student/sign-lab` | `app/(dashboard)/student/sign-lab/page.tsx` | 3D ISL avatar laboratory: text-to-sign converter, dictionary player, avatar speed and camera controls. | **Yes** | `frontend/lib/isl/signMap.ts`, WebGL avatar | **Exists** |
| `/(auth)/login` | `app/(auth)/login/page.tsx` | Authentication: email/password login, Google OAuth, role select. | **No** | Supabase Auth (`signInWithPassword`, `signInWithOAuth`) | **Exists** |

---

## 2. Feature-by-Feature Status Matrix

| Feature Area | Status | Location & Technical Details |
|---|:---:|---|
| **Dashboard** | **EXISTS** | `app/(dashboard)/student/page.tsx`. Reads real profile stats, live class banner, and recent lessons from Supabase. |
| **Login / Logout** | **EXISTS** | Login at `app/(auth)/login/page.tsx`. Logout button in universal header (`app/(dashboard)/layout.tsx:115` `handleSignOut`), clears `localStorage` and calls `supabase.auth.signOut()`. |
| **Profile / Settings** | **EXISTS** | Profile at `app/(dashboard)/student/profile/page.tsx`. Settings at `app/(dashboard)/student/accessibility-profile/page.tsx`. |
| **Courses / Lessons** | **EXISTS** | Lesson catalog at `app/(dashboard)/student/lessons/page.tsx`. Detail at `app/(dashboard)/student/lessons/[id]/page.tsx`. Lessons are rich text, transcripts, summaries, and videos. |
| **Learning Materials / PDFs** | **EXISTS** | NCERT Library at `app/(dashboard)/student/ncert-library/page.tsx` contains chapter reading; OCR book scanner at `app/(dashboard)/student/ocr-reader/page.tsx`. |
| **Videos** | **EXISTS** | Native HTML5 `<video id="lesson-video">` implemented in `app/(dashboard)/student/lessons/[id]/page.tsx:171`. No YouTube iframe dependency. |
| **Online Classes & Schedule** | **EXISTS** | Implemented via Daily.co WebRTC room in `app/(dashboard)/student/live-class/page.tsx`. "Join" is triggered by navigating to `/student/live-class?channel=<channel_id>`. Active sessions retrieved from Supabase `live_sessions` table (`status = 'live'`) and `/api/live-classes/active`. |
| **Assignments & Quizzes** | **EXISTS** | Quiz at `app/(dashboard)/student/assessments/[id]/page.tsx`. 8 questions with radio selection, score calculation, pass/fail result, and retry. |
| **Progress / Results** | **EXISTS** | Analytics & progress at `app/(dashboard)/student/progress/page.tsx` and `app/(dashboard)/student/analytics/page.tsx`. |
| **Notifications / Announcements** | **EXISTS** | Real-time live class toast notification in `components/live/LiveClassNotification.tsx` mounted in layout. |
| **Sign-Language Avatar** | **EXISTS** | 3D WebGL Three.js ISL avatar component `components/live/SignAvatarOverlay.tsx` mounted in `lessons/[id]`, `live-class`, `sign-lab`, and `ai-tutor`. |
| **AI Tutor** | **EXISTS** | Interactive conversational tutor at `app/(dashboard)/student/ai-tutor/page.tsx` calling FastAPI backend `/api/ai-tutor/chat`. |
| **Help / Accessibility Settings** | **EXISTS** | Floating `AccessibilityToolbar.tsx` in layout + full profile setup at `app/(dashboard)/student/accessibility-profile/page.tsx`. |

---

## 3. Existing Voice-Navigation Implementation

- **File:** `frontend/components/AIVoiceAssistant.tsx` (mounted directly in `frontend/app/(dashboard)/layout.tsx:187`).
- **Trigger:**
  - Floating bottom-left mic button toggles listening state.
  - Optional auto-restart loop attempts to restart `SpeechRecognition` on `onend`.
- **How It Works:**
  - Uses `window.SpeechRecognition` or `webkitSpeechRecognition`.
  - Performs case-insensitive substring checks against a static `VOICE_ROUTES` table:
    ```typescript
    for (const route of VOICE_ROUTES) {
      for (const kw of route.keywords) {
        if (text.includes(kw)) {
          speak(`Opening ${route.label} now.`);
          router.push(route.path);
          return true;
        }
      }
    }
    ```
  - If no route matches, it forwards the query as an AI question to `/api/ai-tutor/chat` and reads the response using `window.speechSynthesis`.
- **Limitations & Architectural Flaws:**
  1. **No Page-Scoped Commands:** Pages cannot register or unregister their own context-aware commands (e.g. reading lesson paragraphs, answering quiz questions, seeking video).
  2. **No Sentence Chunking:** Sends entire raw paragraphs to `SpeechSynthesisUtterance`. Long utterances (>200 chars) prematurely terminate on Chrome/Edge.
  3. **No Resumable Reading:** Cannot pause and resume from the same sentence index.
  4. **No Spoken Confirmation:** Irreversible actions (logout, quiz submission) cannot ask for confirmation or handle "yes/no/cancel".
  5. **No Readable Page Region Protocol:** Cannot read structured DOM elements with `data-voice-region` or `data-voice-item`.
  6. **No Typed Command Input:** Non-verbal students and automated browser testing cannot test voice intents through text input.
  7. **Hardcoded Locale:** Uses `en-US` instead of `en-IN` (Indian English) with configurable Indian languages (`hi-IN`, `ta-IN`, `te-IN`).
  8. **No Wake Word / Screen Wake Lock:** Lacks "Hello SPARSH" wake phrase detection and Screen Wake Lock API for hands-free sessions.

---

## 4. Authentication Mechanism

### Frontend
- **Library:** `@supabase/supabase-js` via `@/lib/supabase`.
- **Session Check:** `supabase.auth.getSession()` and `supabase.auth.getUser()`.
- **Route Guard:** Implemented in `frontend/app/(dashboard)/layout.tsx` (lines 40–90). If no valid session exists within 5 seconds, the user is redirected to `/login`.
- **Sign Out:** `supabase.auth.signOut()` followed by `router.replace('/login')`.

### Backend
- **Framework:** FastAPI (`backend/main.py`).
- **Supabase Client:** Initialized via `create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`.
- **User Authentication Dependency:**
  To securely verify callers without exposing secrets, the real FastAPI auth dependency verifies incoming Supabase JWTs:
  ```python
  from fastapi import Depends, HTTPException, Header
  from typing import Optional

  async def get_current_user(authorization: Optional[str] = Header(None)):
      if not authorization:
          raise HTTPException(status_code=401, detail="Missing Authorization header")
      token = authorization.replace("Bearer ", "").strip()
      if not token:
          raise HTTPException(status_code=401, detail="Invalid bearer token")
      if supabase:
          try:
              user_resp = supabase.auth.get_user(token)
              if user_resp and user_resp.user:
                  return user_resp.user
          except Exception:
              raise HTTPException(status_code=401, detail="Invalid or expired token")
      raise HTTPException(status_code=401, detail="Authentication failed")
  ```
  This dependency will be imported and used by `backend/routers/glasses.py` to ensure only authenticated students can access smart-glasses camera vision.
