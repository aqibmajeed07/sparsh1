# SPARSH VoiceVision — Voice Commands Reference

This reference documents all active voice commands implemented in SPARSH VoiceVision.
Commands are strictly tied to real platform features and data.

---

## 1. Global Commands (Available on All Routes)

| Command ID | Example Spoken Phrases | Action & Behavior | Scope | Confirmation Required? | Status |
|---|---|---|:---:|:---:|:---:|
| `global-nav-dashboard` | "open my dashboard", "go home", "return to dashboard", "open dashboard" | Navigates student to `/student` | Global | No | **Implemented** |
| `global-nav-classes` | "open my classes", "show online classes", "what classes do I have", "go to live class" | Navigates student to `/student/live-class` | Global | No | **Implemented** |
| `global-nav-lessons` | "open lessons", "show lessons", "go to lessons", "ncert lessons", "open courses" | Navigates student to `/student/lessons` | Global | No | **Implemented** |
| `global-nav-ai-tutor` | "open ai tutor", "ask ai tutor", "talk to ai tutor", "ncert tutor" | Navigates student to `/student/ai-tutor` | Global | No | **Implemented** |
| `global-nav-assessments`| "open assessments", "show assessments", "go to quizzes", "take test" | Navigates student to `/student/assessments` | Global | No | **Implemented** |
| `global-nav-profile` | "open my profile", "show profile", "go to profile", "my account" | Navigates student to `/student/profile` | Global | No | **Implemented** |
| `global-nav-rewards` | "open rewards", "show my badges", "check rewards", "my streak" | Navigates student to `/student/rewards` | Global | No | **Implemented** |
| `global-nav-back` | "go back", "previous page", "take me back" | Calls `window.history.back()` | Global | No | **Implemented** |
| `global-help-what-can-i-do` | "what can I do here", "what are the commands", "available commands" | Introspects and speaks commands valid on the active page | Global | No | **Implemented** |
| `global-help-overview` | "help", "help me", "how to use voice", "voice instructions" | Speaks a summary of voice navigation and controls | Global | No | **Implemented** |
| `global-speech-pause` | "pause reading", "pause audio", "pause" | Pauses sentence-chunked TTS at the current sentence | Global | No | **Implemented** |
| `global-speech-resume` | "resume reading", "resume audio", "resume", "continue reading" | Resumes TTS playback from the exact paused sentence | Global | No | **Implemented** |
| `global-speech-stop` | "stop reading", "stop", "be quiet", "cancel speech" | Cancels active TTS and clears chunk queue | Global | No | **Implemented** |
| `global-speech-repeat` | "repeat that", "repeat sentence", "say that again", "repeat" | Repeats current or previous sentence chunk | Global | No | **Implemented** |
| `global-tts-slower` | "slower", "speak slower", "read slower" | Sets TTS speech rate to 0.85x | Global | No | **Implemented** |
| `global-tts-faster` | "faster", "speak faster", "read faster" | Sets TTS speech rate to 1.15x | Global | No | **Implemented** |
| `global-auth-logout` | "log out", "sign out", "logout of sparsh", "exit account" | Prompts: *"Are you sure you want to log out of SPARSH?"* On confirmed "yes", logs out and redirects to `/login` | Global | **Yes** | **Implemented** |

---

## 2. Dashboard Commands (`/student`)

| Command ID | Example Spoken Phrases | Action & Behavior | Scope | Confirmation Required? | Status |
|---|---|---|:---:|:---:|:---:|
| `dash-read-stats` | "what is my streak", "read my stats", "tell me my progress", "how many lessons done" | Speaks real profile stats: streak days, lessons completed, sign hours | `/student` | No | **Implemented** |
| `dash-check-live` | "tell me about upcoming classes", "is there a class now", "check live class" | Checks real Supabase `live_sessions` / API and announces active class | `/student` | No | **Implemented** |

---

## 3. Online Classroom Commands (`/student/live-class`)

| Command ID | Example Spoken Phrases | Action & Behavior | Scope | Confirmation Required? | Status |
|---|---|---|:---:|:---:|:---:|
| `live-read-classes` | "what classes do I have", "list live classes", "tell me about upcoming classes" | Reads titles, teacher names, and status of real available live classes | `/student/live-class` | No | **Implemented** |
| `live-join-next` | "join my next class", "join class", "connect to class", "enter class" | Prompts: *"Join <title> with <teacher>?"* On confirmed "yes", joins the session room without altering mic/camera | `/student/live-class` | **Yes** | **Implemented** |
| `live-raise-hand` | "raise hand", "raise my hand" | Toggles the hand-raise state in the real Daily.co room | `/student/live-class` | No | **Implemented** |
| `live-subtitles-toggle`| "toggle subtitles", "switch subtitle language", "turn captions on" | Toggles subtitle visibility or flips between English and Hindi | `/student/live-class` | No | **Implemented** |

---

## 4. Lessons Catalog & Search (`/student/lessons`)

| Command ID | Example Spoken Phrases | Action & Behavior | Scope | Confirmation Required? | Status |
|---|---|---|:---:|:---:|:---:|
| `lessons-search` | "search for physics", "filter by mathematics", "find science" | Applies search term to filter NCERT lessons | `/student/lessons` | No | **Implemented** |
| `lessons-open-first` | "open first lesson", "open lesson one", "start learning" | Navigates to the first visible NCERT lesson | `/student/lessons` | No | **Implemented** |

---

## 5. Lesson Player & Reader Commands (`/student/lessons/[id]`)

| Command ID | Example Spoken Phrases | Action & Behavior | Scope | Confirmation Required? | Status |
|---|---|---|:---:|:---:|:---:|
| `lesson-read-summary` | "read this lesson", "read summary", "read accessible summary" | Reads real `lesson.accessible_summary` or `transcript_text` in sentence chunks | `/student/lessons/*` | No | **Implemented** |
| `lesson-next-sentence`| "next sentence", "next paragraph", "forward" | Steps forward one sentence chunk in the lesson text | `/student/lessons/*` | No | **Implemented** |
| `lesson-prev-sentence`| "previous sentence", "previous paragraph", "go back a sentence" | Steps backward one sentence chunk in the lesson text | `/student/lessons/*` | No | **Implemented** |
| `lesson-video-play` | "play the lesson video", "play video", "start video" | Calls `PageMediaController.play()` on `#lesson-video` | `/student/lessons/*` | No | **Implemented** |
| `lesson-video-pause` | "pause the video", "pause video" | Calls `PageMediaController.pause()` on `#lesson-video` | `/student/lessons/*` | No | **Implemented** |
| `lesson-video-seek-fwd`| "fast forward 10 seconds", "skip forward", "forward 10 seconds" | Skips forward 10 seconds on the HTML5 video | `/student/lessons/*` | No | **Implemented** |
| `lesson-video-seek-bwd`| "rewind 10 seconds", "skip back", "back 10 seconds" | Skips backward 10 seconds on the HTML5 video | `/student/lessons/*` | No | **Implemented** |
| `lesson-doubt-solver` | "explain simply", "have a doubt", "simplify this lesson" | Queries `/api/doubt-solver` and speaks simplified concept breakdown | `/student/lessons/*` | No | **Implemented** |

---

## 6. Assessments & Quizzes (`/student/assessments/[id]`)

| Command ID | Example Spoken Phrases | Action & Behavior | Scope | Confirmation Required? | Status |
|---|---|---|:---:|:---:|:---:|
| `quiz-read-question` | "read the question", "read question", "what is the question" | Speaks question number and question statement | `/student/assessments/*` | No | **Implemented** |
| `quiz-read-options` | "read options", "read the choices", "what are the options" | Speaks options 1 through 4 clearly with index labels | `/student/assessments/*` | No | **Implemented** |
| `quiz-select-option` | "select option 1", "choose option two", "option 3", "answer atom" | Selects specified option and provides immediate verbal acknowledgment | `/student/assessments/*` | No | **Implemented** |
| `quiz-next-question` | "next question", "go to next question" | Advances to the next question | `/student/assessments/*` | No | **Implemented** |
| `quiz-prev-question` | "previous question", "go back a question" | Returns to the previous question | `/student/assessments/*` | No | **Implemented** |
| `quiz-submit` | "submit quiz", "finish quiz", "submit assessment" | Prompts: *"You have answered <N> of 8 questions. Are you sure you want to submit? Say yes to submit."* On confirmed "yes", submits and announces percentage score | `/student/assessments/*` | **Yes** | **Implemented** |

---

## 7. Smart-Glasses Camera Commands

| Command ID | Example Spoken Phrases | Action & Behavior | Scope | Confirmation Required? | Status |
|---|---|---|:---:|:---:|:---:|
| `glasses-status` | "are my glasses connected", "check glasses", "glasses status" | Queries backend proxy `/api/glasses/status` and announces connectivity | Global | No | **Implemented** |
| `glasses-describe` | "describe what is in front of me", "what is in front of me", "describe scene" | Captures frame via `/api/glasses/vision` and speaks descriptive scene overview | Global | No | **Implemented** |
| `glasses-read-page` | "read this page", "read the page in front of me", "read text on paper" | Captures frame and performs OCR/document reading via `/api/glasses/vision` | Global | No | **Implemented** |
| `glasses-objects` | "what objects can you see", "detect objects" | Detects and speaks objects in field of view | Global | No | **Implemented** |
