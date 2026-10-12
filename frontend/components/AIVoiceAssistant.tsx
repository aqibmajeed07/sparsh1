'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, Volume2, Sparkles, Navigation, CheckCircle2, AlertTriangle, Loader2, Bot, X } from 'lucide-react';

const VOICE_ROUTES: { keywords: string[]; path: string; label: string }[] = [
    { keywords: ['dashboard', 'home', 'main', 'student dashboard', 'go home'], path: '/student', label: 'Dashboard' },
    { keywords: ['live class', 'live classroom', 'live session', 'join live class', 'teacher live', 'live lecture', 'join class'], path: '/student/live-class', label: 'Live Classroom' },
    { keywords: ['lesson', 'lessons', 'class', 'course', 'study', 'read lesson', 'chapters'], path: '/student/lessons', label: 'Lessons' },
    { keywords: ['sign lab', 'sign language', 'sign', 'gesture', 'isl', 'avatar'], path: '/student/sign-lab', label: 'Sign Lab' },
    { keywords: ['ai tutor', 'tutor', 'ask ai', 'ncert ai', 'chat ai', 'ai teacher'], path: '/student/ai-tutor', label: 'NCERT AI Tutor' },
    { keywords: ['ocr', 'ocr reader', 'book reader', 'scan book', 'textbook', 'read book', 'reader'], path: '/student/ocr-reader', label: 'OCR Book Reader' },
    { keywords: ['braille', 'braille lab', 'speech lab', 'speech', 'tactile'], path: '/student/braille-lab', label: 'Braille & Speech Lab' },
    { keywords: ['keyboard', 'smart keyboard', 'sparsh keyboard', 'braille keyboard'], path: '/student/smart-keyboard', label: 'Smart Keyboard' },
    { keywords: ['homework', 'homework helper', 'solve homework', 'question', 'math helper'], path: '/student/homework-helper', label: 'Homework Helper' },
    { keywords: ['notes', 'smart notes', 'flashcard', 'flashcards', 'note', 'revision'], path: '/student/smart-notes', label: 'Smart Notes' },
    { keywords: ['card', 'rfid', 'smart card', 'card reader'], path: '/student/rfid-card', label: 'RFID Smart Card' },
    { keywords: ['accessibility', 'accessibility profile', 'profile setup', 'setting', 'settings'], path: '/student/accessibility-profile', label: 'Accessibility Setup' },
    { keywords: ['progress', 'analytics', 'stats', 'score', 'performance'], path: '/student/progress', label: 'Progress & Analytics' },
    { keywords: ['reward', 'rewards', 'badge', 'badges', 'streak', 'points', 'trophy'], path: '/student/rewards', label: 'Rewards & Badges' },
    { keywords: ['senseband', 'sense band', 'band', 'haptics', 'vibration'], path: '/student/senseband', label: 'SenseBand Control' },
    { keywords: ['smart gloves', 'smart glove', 'glove', 'gloves', 'flex sensor', 'flex sensors'], path: '/student/smart-gloves', label: 'AI Smart Gloves' },
    { keywords: ['ncert', 'library', 'books', 'ncert library'], path: '/student/ncert-library', label: 'NCERT Library' },
    { keywords: ['deafblind', 'tadoma', 'tactile learning', 'deaf blind'], path: '/student/deafblind', label: 'DeafBlind Learning' },
    { keywords: ['test', 'quiz', 'assessment', 'assessments', 'exam'], path: '/student/assessments', label: 'Assessments' },
];

export default function AIVoiceAssistant() {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [aiResponse, setAiResponse] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState(true);
    const [activeToast, setActiveToast] = useState<{ message: string; target: string; type?: 'success' | 'info' | 'error' } | null>(null);

    const recognitionRef = useRef<any>(null);
    const shouldKeepListeningRef = useRef<boolean>(false);
    const isSpeakingRef = useRef<boolean>(false);
    const consecutiveErrorsRef = useRef<number>(0);
    const router = useRouter();

    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

    const restartTimerRef = useRef<any>(null);

    // Speak helper using Web Speech Synthesis with pause guard
    const speak = (text: string, onDone?: () => void) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            if (onDone) onDone();
            return;
        }

        try {
            window.speechSynthesis.cancel();
            isSpeakingRef.current = true;
            setIsSpeaking(true);

            // Temporarily pause mic so speaker output doesn't re-trigger STT
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }

            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'en-US';
            u.rate = 1.0;
            u.pitch = 1.0;

            const handleEnd = () => {
                isSpeakingRef.current = false;
                setIsSpeaking(false);
                if (onDone) onDone();
                if (shouldKeepListeningRef.current) {
                    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
                    restartTimerRef.current = setTimeout(() => restartRecognition(), 400);
                }
            };

            u.onend = handleEnd;
            u.onerror = handleEnd;

            window.speechSynthesis.speak(u);
        } catch (err) {
            console.error('[AI Voice Assistant] Speak error:', err);
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            if (onDone) onDone();
        }
    };

    const restartRecognition = () => {
        if (!shouldKeepListeningRef.current || isSpeakingRef.current) return;

        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
                setIsListening(true);
                setErrorMsg(null);
            } catch (e: any) {
                // If already running, ensure state is updated
                if (e?.name === 'InvalidStateError' || e?.message?.includes('already started')) {
                    setIsListening(true);
                }
            }
        } else {
            initListeningService(true);
        }
    };

    const processVoiceCommand = async (rawText: string) => {
        const text = rawText.toLowerCase().trim();
        if (!text) return;

        setTranscript(rawText);
        setErrorMsg(null);
        setAiResponse(null);

        // Send async voice authentication telemetry to Gemma 4 endpoint
        try {
            fetch(`${BACKEND_URL}/api/voice-auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio_transcript: rawText, passphrase: "Open Sparsh" })
            }).catch(() => { });
        } catch (e) { }

        // 1. Check matching navigation route
        for (const route of VOICE_ROUTES) {
            for (const kw of route.keywords) {
                if (text.includes(kw)) {
                    const confirmMsg = `Opening ${route.label} now.`;
                    speak(confirmMsg);

                    setActiveToast({
                        message: `Voice Command: "${rawText}"`,
                        target: `Navigating to ${route.label}`,
                        type: 'success'
                    });

                    setTimeout(() => {
                        router.push(route.path);
                    }, 400);

                    setTimeout(() => setActiveToast(null), 4000);
                    return true;
                }
            }
        }

        // 2. Fallback: If not a navigation route, query SPARSH AI Tutor to answer question directly!
        setIsProcessing(true);
        setActiveToast({
            message: `Asking SPARSH AI...`,
            target: `"${rawText}"`,
            type: 'info'
        });

        try {
            const res = await fetch(`${BACKEND_URL}/api/ai-tutor/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: rawText, language: 'en-US', detailed: false })
            });

            if (res.ok) {
                const data = await res.json();
                const reply = data.reply || "I am here to help you learn on Sparsh.";
                setAiResponse(reply);
                speak(reply);
                setActiveToast({
                    message: `SPARSH AI Answered`,
                    target: reply.length > 60 ? reply.substring(0, 60) + '...' : reply,
                    type: 'success'
                });
            } else {
                throw new Error("AI query failed");
            }
        } catch (e) {
            const fallbackMsg = `Sorry, I heard "${rawText}". Try saying "Open Lessons" or "Open Sign Lab".`;
            speak(fallbackMsg);
            setActiveToast({
                message: `Unrecognized Command: "${rawText}"`,
                target: `Say "Open Lessons", "Open AI Tutor", or "Open Rewards"`,
                type: 'error'
            });
        } finally {
            setIsProcessing(false);
            setTimeout(() => setActiveToast(null), 5000);
        }
    };

    const initListeningService = (autoStart: boolean = false) => {
        if (typeof window === 'undefined') return;

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setIsSupported(false);
            setErrorMsg("Speech Recognition not supported in this browser. Please use Chrome or Edge.");
            return;
        }

        try {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }

            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                setIsListening(true);
                setErrorMsg(null);
                consecutiveErrorsRef.current = 0;
            };

            recognition.onresult = (event: any) => {
                const lastIdx = event.results.length - 1;
                const heard = event.results[lastIdx][0].transcript;
                console.log("[AI Voice Assistant] Heard:", heard);
                processVoiceCommand(heard);
            };

            recognition.onerror = (e: any) => {
                const errorType = e?.error;

                // 'aborted' is a normal lifecycle event when stopping/pausing speech recognition
                if (errorType === 'aborted') {
                    return;
                }

                if (errorType === 'not-allowed' || errorType === 'service-not-allowed' || errorType === 'audio-capture') {
                    // Microphone permission denied by user or browser policy -> stop continuous retry loop
                    shouldKeepListeningRef.current = false;
                    setIsListening(false);
                    setErrorMsg("Microphone access blocked. Click mic button to grant permission.");
                    return;
                }

                if (errorType === 'no-speech') {
                    consecutiveErrorsRef.current += 1;
                    if (consecutiveErrorsRef.current > 5) {
                        setIsListening(false);
                        return;
                    }
                } else {
                    console.warn("[AI Voice Assistant] Error:", errorType);
                }
            };

            recognition.onend = () => {
                if (shouldKeepListeningRef.current && !isSpeakingRef.current && consecutiveErrorsRef.current <= 5) {
                    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
                    restartTimerRef.current = setTimeout(() => restartRecognition(), 400);
                } else {
                    setIsListening(false);
                }
            };

            recognitionRef.current = recognition;

            if (autoStart) {
                shouldKeepListeningRef.current = true;
                recognition.start();
            }
        } catch (err: any) {
            console.warn("[AI Voice Assistant] Initialization deferred:", err);
            setIsListening(false);
        }
    };

    // Mount setup
    useEffect(() => {
        initListeningService(false);

        return () => {
            shouldKeepListeningRef.current = false;
            if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }
        };
    }, []);

    const toggleListening = () => {
        if (!isSupported) {
            alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
            return;
        }

        if (isListening || shouldKeepListeningRef.current) {
            shouldKeepListeningRef.current = false;
            if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }
            setIsListening(false);
            speak("Voice command listening stopped.");
        } else {
            shouldKeepListeningRef.current = true;
            consecutiveErrorsRef.current = 0;
            setErrorMsg(null);

            if (recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                    setIsListening(true);
                    speak("AI Voice Assistant active. Say open lessons, open sign lab, or ask any question.");
                } catch (e) {
                    initListeningService(true);
                }
            } else {
                initListeningService(true);
            }
        }
    };

    return (
        <div className="fixed bottom-3 left-3 sm:bottom-5 sm:left-5 z-40 flex flex-col items-start gap-2 max-w-[calc(100vw-4.5rem)] sm:max-w-sm">
            {/* AI Response Card Modal */}
            {aiResponse && (
                <div className="glass-card p-4 rounded-2xl border-2 border-[#6C63FF] bg-[#0f0c29]/95 text-white shadow-2xl space-y-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-3 backdrop-blur-xl relative">
                    <button
                        onClick={() => setAiResponse(null)}
                        className="absolute top-2 right-2 p-1 text-white/50 hover:text-white rounded-lg transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 text-[#6C63FF] font-bold text-xs">
                        <Bot className="w-4 h-4" />
                        <span>SPARSH Voice AI Answer</span>
                    </div>
                    <p className="text-white text-xs font-medium leading-relaxed max-h-40 overflow-y-auto pr-1">
                        {aiResponse}
                    </p>
                </div>
            )}

            {/* Active Command Toast */}
            {activeToast && !aiResponse && (
                <div className={`glass-card p-3.5 sm:p-4 rounded-2xl border-2 bg-[#0f0c29]/95 text-white shadow-2xl space-y-1 w-72 sm:w-80 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-3 backdrop-blur-xl ${activeToast.type === 'error' ? 'border-red-500' : activeToast.type === 'info' ? 'border-[#6C63FF]' : 'border-[#00C9A7]'
                    }`}>
                    <div className="flex items-center gap-2 font-bold text-xs" style={{ color: activeToast.type === 'error' ? '#ef4444' : activeToast.type === 'info' ? '#6C63FF' : '#00C9A7' }}>
                        {activeToast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>{activeToast.message}</span>
                    </div>
                    <p className="text-white font-extrabold text-sm truncate">{activeToast.target}</p>
                </div>
            )}

            {/* Permission / Browser Error Card */}
            {errorMsg && (
                <div className="glass-card p-3 rounded-2xl border border-red-500/50 bg-red-950/80 text-white text-xs font-semibold flex items-start gap-2 shadow-lg w-72 max-w-[calc(100vw-2rem)]">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Listening / Processing Indicator Badge */}
            {isListening && !activeToast && !errorMsg && (
                <div className="glass-card px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl border border-pink-500/40 bg-pink-500/10 text-white text-[10px] sm:text-xs font-bold flex items-center gap-2 animate-pulse shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                    <span className="truncate max-w-[200px] sm:max-w-none">AI Listening...</span>
                </div>
            )}

            {/* Mic Toggle Button */}
            <button
                onClick={toggleListening}
                className={`px-3 py-2.5 sm:px-4 sm:py-3 rounded-full shadow-2xl flex items-center gap-2 text-xs font-black transition-all border-2 transform hover:scale-105 active:scale-95 ${isListening
                    ? 'bg-gradient-to-r from-pink-600 to-rose-600 border-pink-300 text-white animate-pulse'
                    : isProcessing
                        ? 'bg-gradient-to-r from-[#6C63FF] to-indigo-600 border-indigo-300 text-white'
                        : 'bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] border-white/20 text-white hover:border-white/40'
                    }`}
                title="Toggle AI Voice Assistant (e.g. 'Open Lessons' or ask questions)"
                aria-label="Toggle AI Voice Assistant"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white animate-spin" />
                        <span>Thinking...</span>
                    </>
                ) : isListening ? (
                    <>
                        <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white animate-bounce" />
                        <span>Listening...</span>
                    </>
                ) : (
                    <>
                        <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                        <span>AI Voice</span>
                    </>
                )}
            </button>
        </div>
    );
}

