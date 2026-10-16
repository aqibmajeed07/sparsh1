'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Webcam from 'react-webcam';
import { hasSign } from '@/lib/isl/signMap';
import CelebrationOverlay from '@/components/ui/CelebrationOverlay';
import { speakGeminiLady } from '@/lib/geminiVoice';

const SignAvatarOverlay = dynamic(
  () => import('@/components/live/SignAvatarOverlay'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0f0c29]/60 rounded-2xl">
        <span className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

export interface IslSignItem {
  word: string;
  display: string;
  hindi: string;
  category: 'common' | 'classroom' | 'science' | 'emergency' | 'questions' | 'academic';
  difficulty: 'beginner' | 'intermediate' | 'difficult';
  mastered: boolean;
}

const ISL_SIGNS: IslSignItem[] = [
  // ── Difficult & Advanced Academic Signs ──────────────────────────────
  { word: 'experiment', display: 'Experiment', hindi: 'प्रयोग', category: 'science', difficulty: 'difficult', mastered: false },
  { word: 'atom', display: 'Atom', hindi: 'परमाणु', category: 'science', difficulty: 'difficult', mastered: false },
  { word: 'gravity', display: 'Gravity', hindi: 'गुरुत्वाकर्षण', category: 'science', difficulty: 'difficult', mastered: false },
  { word: 'mathematics', display: 'Mathematics', hindi: 'गणित', category: 'science', difficulty: 'difficult', mastered: false },
  { word: 'technology', display: 'Technology', hindi: 'प्रौद्योगिकी', category: 'science', difficulty: 'difficult', mastered: false },
  { word: 'computer', display: 'Computer', hindi: 'कंप्यूटर', category: 'science', difficulty: 'intermediate', mastered: false },
  { word: 'environment', display: 'Environment', hindi: 'पर्यावरण', category: 'science', difficulty: 'difficult', mastered: false },
  { word: 'research', display: 'Research', hindi: 'अनुसंधान', category: 'academic', difficulty: 'difficult', mastered: false },
  { word: 'constitution', display: 'Constitution', hindi: 'संविधान', category: 'academic', difficulty: 'difficult', mastered: false },
  { word: 'democracy', display: 'Democracy', hindi: 'लोकतंत्र', category: 'academic', difficulty: 'difficult', mastered: false },
  { word: 'difficult', display: 'Difficult', hindi: 'कठिन', category: 'academic', difficulty: 'difficult', mastered: false },
  { word: 'important', display: 'Important', hindi: 'महत्वपूर्ण', category: 'academic', difficulty: 'intermediate', mastered: false },
  { word: 'concentrate', display: 'Concentrate', hindi: 'एकाग्रता', category: 'academic', difficulty: 'difficult', mastered: false },
  { word: 'focus', display: 'Focus', hindi: 'ध्यान देना', category: 'academic', difficulty: 'difficult', mastered: false },
  { word: 'remember', display: 'Remember', hindi: 'याद रखना', category: 'academic', difficulty: 'intermediate', mastered: false },
  { word: 'communication', display: 'Communication', hindi: 'संचार', category: 'academic', difficulty: 'difficult', mastered: false },
  { word: 'success', display: 'Success', hindi: 'सफलता', category: 'academic', difficulty: 'intermediate', mastered: true },

  // ── Critical & Useful Emergency / Medical Signs ────────────────────
  { word: 'emergency', display: 'Emergency', hindi: 'आपातकाल', category: 'emergency', difficulty: 'difficult', mastered: false },
  { word: 'danger', display: 'Danger', hindi: 'ख़तरा', category: 'emergency', difficulty: 'difficult', mastered: false },
  { word: 'hospital', display: 'Hospital', hindi: 'अस्पताल', category: 'emergency', difficulty: 'intermediate', mastered: false },
  { word: 'doctor', display: 'Doctor', hindi: 'चिकित्सक', category: 'emergency', difficulty: 'intermediate', mastered: false },
  { word: 'medicine', display: 'Medicine', hindi: 'दवाई', category: 'emergency', difficulty: 'intermediate', mastered: false },
  { word: 'pain', display: 'Pain', hindi: 'दर्द', category: 'emergency', difficulty: 'intermediate', mastered: false },
  { word: 'police', display: 'Police', hindi: 'पुलिस', category: 'emergency', difficulty: 'intermediate', mastered: false },

  // ── Highly Useful Conversational & Question Signs ───────────────────
  { word: 'where', display: 'Where', hindi: 'कहाँ', category: 'questions', difficulty: 'intermediate', mastered: false },
  { word: 'when', display: 'When', hindi: 'कब', category: 'questions', difficulty: 'intermediate', mastered: false },
  { word: 'why', display: 'Why', hindi: 'क्यों', category: 'questions', difficulty: 'difficult', mastered: false },
  { word: 'how', display: 'How', hindi: 'कैसे', category: 'questions', difficulty: 'difficult', mastered: false },
  { word: 'question', display: 'Question', hindi: 'सवाल', category: 'questions', difficulty: 'intermediate', mastered: false },
  { word: 'answer', display: 'Answer', hindi: 'जवाब', category: 'questions', difficulty: 'intermediate', mastered: false },
  { word: 'time', display: 'Time', hindi: 'समय', category: 'questions', difficulty: 'intermediate', mastered: false },

  // ── Classroom & Education Signs ────────────────────────────────────
  { word: 'book', display: 'Book', hindi: 'किताब', category: 'classroom', difficulty: 'beginner', mastered: false },
  { word: 'open', display: 'Open', hindi: 'खोलें', category: 'classroom', difficulty: 'beginner', mastered: false },
  { word: 'teacher', display: 'Teacher', hindi: 'शिक्षक', category: 'classroom', difficulty: 'beginner', mastered: true },
  { word: 'student', display: 'Student', hindi: 'विद्यार्थी', category: 'classroom', difficulty: 'beginner', mastered: false },
  { word: 'class', display: 'Class', hindi: 'कक्षा', category: 'classroom', difficulty: 'beginner', mastered: false },
  { word: 'lesson', display: 'Lesson', hindi: 'पाठ', category: 'classroom', difficulty: 'intermediate', mastered: false },
  { word: 'read', display: 'Read', hindi: 'पढ़ना', category: 'classroom', difficulty: 'beginner', mastered: false },
  { word: 'write', display: 'Write', hindi: 'लिखना', category: 'classroom', difficulty: 'beginner', mastered: false },
  { word: 'learn', display: 'Learn', hindi: 'सीखना', category: 'classroom', difficulty: 'beginner', mastered: true },
  { word: 'attention', display: 'Attention', hindi: 'ध्यान', category: 'classroom', difficulty: 'beginner', mastered: false },
  { word: 'school', display: 'School', hindi: 'स्कूल', category: 'classroom', difficulty: 'beginner', mastered: false },
  { word: 'braille', display: 'Braille', hindi: 'ब्रेल लिपि', category: 'classroom', difficulty: 'intermediate', mastered: false },
  { word: 'exam', display: 'Exam', hindi: 'परीक्षा', category: 'classroom', difficulty: 'intermediate', mastered: false },
  { word: 'understand', display: 'Understand', hindi: 'समझना', category: 'classroom', difficulty: 'intermediate', mastered: false },

  // ── Common Vocabulary & Social Signs ───────────────────────────────
  { word: 'hello', display: 'Hello / Namaste', hindi: 'नमस्ते', category: 'common', difficulty: 'beginner', mastered: true },
  { word: 'thank', display: 'Thank You', hindi: 'धन्यवाद', category: 'common', difficulty: 'beginner', mastered: true },
  { word: 'please', display: 'Please', hindi: 'कृपया', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'welcome', display: 'Welcome', hindi: 'स्वागत', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'yes', display: 'Yes', hindi: 'हाँ', category: 'common', difficulty: 'beginner', mastered: true },
  { word: 'no', display: 'No', hindi: 'नहीं', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'you', display: 'You', hindi: 'आप', category: 'common', difficulty: 'beginner', mastered: true },
  { word: 'good', display: 'Good', hindi: 'अच्छा', category: 'common', difficulty: 'beginner', mastered: true },
  { word: 'bad', display: 'Bad', hindi: 'बुरा', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'come', display: 'Come', hindi: 'आओ', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'go', display: 'Go', hindi: 'जाओ', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'stop', display: 'Stop', hindi: 'रुको', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'help', display: 'Help', hindi: 'मदद', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'love', display: 'Love', hindi: 'प्रेम', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'happy', display: 'Happy', hindi: 'खुश', category: 'common', difficulty: 'beginner', mastered: true },
  { word: 'sorry', display: 'Sorry', hindi: 'माफ़ करना', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'water', display: 'Water', hindi: 'पानी', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'eat', display: 'Eat', hindi: 'खाना', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'food', display: 'Food', hindi: 'भोजन', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'friend', display: 'Friend', hindi: 'मित्र', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'family', display: 'Family', hindi: 'परिवार', category: 'common', difficulty: 'beginner', mastered: false },
  { word: 'peace', display: 'Peace', hindi: 'शांति', category: 'common', difficulty: 'intermediate', mastered: false },
];

const CATEGORIES = ['All', 'science', 'academic', 'emergency', 'questions', 'classroom', 'common'] as const;
type TabId = 'dictionary' | 'document' | 'live-translator' | 'media';

export default function SignLabPage() {
  // ── Dictionary tab state ─────────────────────────────────────
  const [selectedSign, setSelectedSign] = useState(ISL_SIGNS[0]);
  const [category, setCategory] = useState<string>('All');
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'beginner' | 'intermediate' | 'difficult'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarQueue, setAvatarQueue] = useState<string[]>([]);
  const [masteredWords, setMasteredWords] = useState<Set<string>>(
    new Set(ISL_SIGNS.filter(s => s.mastered).map(s => s.word))
  );
  const [celebration, setCelebration] = useState(false);
  const filtered = ISL_SIGNS.filter(s => {
    const matchCat = category === 'All' || s.category === category;
    const matchDiff = difficultyFilter === 'All' || s.difficulty === difficultyFilter;
    const matchSearch = !searchQuery.trim() || 
      s.display.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.hindi.includes(searchQuery) || 
      s.word.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchDiff && matchSearch;
  });
  const mastered = masteredWords.size;

  const markMastered = useCallback(() => {
    setMasteredWords(prev => {
      const next = new Set(prev);
      next.add(selectedSign.word);
      return next;
    });
    setCelebration(true);
  }, [selectedSign]);

  const selectSign = useCallback((sign: typeof ISL_SIGNS[0]) => {
    setSelectedSign(sign);
    setAvatarQueue([]);
    setTimeout(() => {
      setAvatarQueue([sign.word]);
    }, 40);
  }, []);

  const replaySign = useCallback(() => {
    setAvatarQueue([]);
    setTimeout(() => {
      setAvatarQueue([selectedSign.word]);
    }, 40);
  }, [selectedSign]);

  const handleSignComplete = useCallback(() => {
    setAvatarQueue([]);
  }, []);

  // ── Document AI tab state ────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('dictionary');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [extractedSentences, setExtractedSentences] = useState<string[]>([]);
  const [islTokens, setIslTokens] = useState<string[]>([]);
  const [docQueue, setDocQueue] = useState<string[]>([]);
  const [isSigning, setIsSigning] = useState(false);
  const [currentTokenIdx, setCurrentTokenIdx] = useState(0);
  const [extractError, setExtractError] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Live Translator Tab State ──
  const [translatorMode, setTranslatorMode] = useState<'speech-to-isl' | 'isl-to-speech'>('speech-to-isl');
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [translatorQueue, setTranslatorQueue] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const [selectedLang, setSelectedLang] = useState('en-IN');

  const [webcamActive, setWebcamActive] = useState(false);
  const [visionTranslation, setVisionTranslation] = useState('');
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visionSimRef = useRef<any>(null);
  const [fingerTracking, setFingerTracking] = useState<any>(null);

  // ── Media Tab State ──
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [isMediaProcessing, setIsMediaProcessing] = useState(false);
  const [mediaQueue, setMediaQueue] = useState<string[]>([]);
  const [mediaTokens, setMediaTokens] = useState<string[]>([]);
  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (visionSimRef.current) clearInterval(visionSimRef.current);
    };
  }, []);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleFileSelect = (f: File) => {
    const allowed = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(f.type) && !f.name.match(/\.(pdf|txt|docx|doc)$/i)) {
      setExtractError('Only PDF, TXT, or DOCX files are supported.'); return;
    }
    setFile(f); setExtractError(''); setExtractedText(''); setIslTokens([]); setDocQueue([]);
  };

  const extractAndSign = async () => {
    if (!file) return;
    setIsExtracting(true); setExtractError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/isl-extract', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');
      setExtractedText(data.text || '');
      setExtractedSentences(data.sentences || []);
      setIslTokens(data.tokens || []);
      setWordCount(data.wordCount || 0);
      setCurrentTokenIdx(0);
    } catch (e: any) {
      setExtractError(e.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const startSigning = () => {
    if (islTokens.length === 0) return;
    setDocQueue([islTokens[0]]);
    setCurrentTokenIdx(0);
    setIsSigning(true);
  };

  const handleDocSignComplete = useCallback((completedWord: string) => {
    setDocQueue([]);
    setCurrentTokenIdx(prev => {
      const next = prev + 1;
      if (next < islTokens.length) {
        // Small delay between signs
        setTimeout(() => setDocQueue([islTokens[next]]), 1400);
        return next;
      } else {
        setIsSigning(false);
        return prev;
      }
    });
  }, [islTokens]);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setMediaFile(f);
      setMediaUrl(URL.createObjectURL(f));
      setMediaTokens([]);
      setMediaQueue([]);
    }
  };

  const processMedia = () => {
    setIsMediaProcessing(true);
    // Simulate AI processing audio/video to ISL tokens
    setTimeout(() => {
      setMediaTokens(['hello', 'welcome', 'student', 'please', 'attention', 'class', 'today', 'we', 'understand', 'science', 'thank', 'you']);
      setIsMediaProcessing(false);
    }, 2000);
  };

  const playMediaAndSign = () => {
    if (mediaRef.current) {
      mediaRef.current.play();
      // Start feeding the avatar
      if (mediaTokens.length > 0) {
        setMediaQueue([mediaTokens[0]]);
        setCurrentMediaIdx(0);
      }
    }
  };

  const handleMediaSignComplete = useCallback((completedWord: string) => {
    setMediaQueue([]);
    setCurrentMediaIdx(prev => {
      const next = prev + 1;
      if (next < mediaTokens.length) {
        setTimeout(() => setMediaQueue([mediaTokens[next]]), 1000); // 1 sec delay between signs to sync with media
        return next;
      }
      return prev;
    });
  }, [mediaTokens]);

  const stopSigning = () => { setIsSigning(false); setDocQueue([]); };

  // ── Live Translator Methods ──
  const toggleListening = () => {
    if (isListening) {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('Browser not supported for STT. Please use Chrome or Edge.');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLang;

      recognition.onresult = async (e: any) => {
        const finalResults = Array.from(e.results).map((r: any) => r[0].transcript).join(' ');
        setLiveTranscript(finalResults);

        const lastResult = e.results && e.results.length > 0 ? e.results[e.results.length - 1] : null;
        if (lastResult && lastResult.isFinal) {
          try {
            const res = await fetch('/api/isl-grammar', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: lastResult[0].transcript, lang: selectedLang })
            });
            const data = await res.json();
            if (data.isl_text && data.isl_text.length > 0) {
              setTranslatorQueue(prev => {
                const fresh = data.isl_text.filter((t: string) => !prev.includes(t));
                return [...prev, ...fresh];
              });
            }
          } catch (e) { }
        }
      };

      recognition.onend = () => {
        // Auto-restart if we haven't manually stopped
        if (isListeningRef.current) {
          try { recognition.start(); } catch (e) { }
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech') console.warn('STT Error:', e.error);
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
        isListeningRef.current = true;
        setIsListening(true);
        setLiveTranscript('');
        setTranslatorQueue([]);
      } catch (e) {
        console.error('Failed to start STT:', e);
      }
    }
  };

  const handleTranslatorSignComplete = useCallback((completedWord: string) => {
    setTranslatorQueue(prev => prev.slice(1));
  }, []);

  const drawSkeleton = useCallback((landmarks: Array<{ x: number; y: number; z: number }>, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const CONNECTIONS = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],       // Index
      [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
      [0, 13], [13, 14], [14, 15], [15, 16],// Ring
      [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
      [5, 9], [9, 13], [13, 17],            // Palm
    ];

    // Mirror horizontal coordinates to align with mirrored webcam
    const pts = landmarks.map(lm => ({
      x: (1 - lm.x) * width,
      y: lm.y * height,
    }));

    // Draw connecting bones
    CONNECTIONS.forEach(([i, j]) => {
      if (!pts[i] || !pts[j]) return;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[j].x, pts[j].y);
      ctx.strokeStyle = '#00C9A7';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    });

    // Draw joints
    pts.forEach((p, idx) => {
      const isTip = [4, 8, 12, 16, 20].includes(idx);
      ctx.beginPath();
      ctx.arc(p.x, p.y, isTip ? 6 : 4, 0, 2 * Math.PI);
      ctx.fillStyle = isTip ? '#FF6B6B' : '#6C63FF';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, []);

  const toggleWebcam = () => {
    if (webcamActive) {
      setWebcamActive(false);
      clearInterval(visionSimRef.current);
      setVisionTranslation('');
      setFingerTracking(null);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    } else {
      setWebcamActive(true);
      setVisionTranslation('Warming up Niral AI Model...');

      // Real-time inference using Sparsh AI Backend + Niral AI Model
      visionSimRef.current = setInterval(async () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        try {
          const res = await fetch('/api/predict-sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageSrc })
          });
          const data = await res.json();

          if (data.finger_tracking) {
            setFingerTracking(data.finger_tracking);
            if (canvasRef.current && data.finger_tracking.landmarks && data.finger_tracking.landmarks.length > 0) {
              if (canvasRef.current.width !== canvasRef.current.clientWidth) {
                canvasRef.current.width = canvasRef.current.clientWidth;
                canvasRef.current.height = canvasRef.current.clientHeight;
              }
              drawSkeleton(data.finger_tracking.landmarks, canvasRef.current);
            }
          } else {
            setFingerTracking(null);
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
          }

          if (data.sign) {
            const displaySign = data.clean_sign || data.sign.replace(/^\d+_/, '').replace(/_/g, ' ');
            const formatted = displaySign.charAt(0).toUpperCase() + displaySign.slice(1);
            const gestureHint = data.finger_tracking?.gesture_hint ? ` • ${data.finger_tracking.gesture_hint}` : '';

            if (data.is_confident) {
              setVisionTranslation(`Sign detected: ${formatted} (${data.confidence.toFixed(1)}%)${gestureHint}`);

              // Add sign to avatar if it matches dictionary!
              setTranslatorQueue(prev => {
                const token = formatted.toLowerCase();
                // Avoid spamming the same sign
                if (prev[prev.length - 1] === token) return prev;

                // Speak the sign out loud!
                playTTS(formatted, selectedLang);

                return [...prev, token];
              });
            } else {
              setVisionTranslation(`Detecting: ${formatted} (${data.confidence.toFixed(1)}%)${gestureHint}`);
            }
          } else if (data.message) {
            setVisionTranslation(data.message);
          }
        } catch (e) {
          console.error("Sign prediction error:", e);
          setVisionTranslation('AI Backend disconnected');
        }
      }, 500); // 2 FPS for smooth realtime feeling without overloading backend
    }
  };

  const playTTS = (text: string, langCode: string) => {
    speakGeminiLady(text, {
      lang: langCode || 'en-US',
      pitch: 1.08,
      rate: 1.0,
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Celebration Overlay ── */}
      <CelebrationOverlay
        show={celebration}
        variant="sign_mastered"
        title={`${selectedSign.display} Mastered!`}
        subtitle={`You learned the ISL sign for "${selectedSign.hindi}" 🤟`}
        xp={15}
        onClose={() => setCelebration(false)}
        autoCloseSec={5}
      />

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Sign Lab</h1>
          <p className="text-white/60 mt-1">Practice ISL with real-time AI avatar · Upload documents to sign</p>
        </div>
        <div className="glass-card px-4 py-2 flex items-center gap-3">
          <span className="text-white/60 text-sm">Mastered:</span>
          <span className="text-[#00C9A7] font-bold">{mastered}/{ISL_SIGNS.length}</span>
          <div className="w-24 bg-white/10 rounded-full h-2">
            <div className="h-full bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] rounded-full transition-all"
              style={{ width: `${(mastered / ISL_SIGNS.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl overflow-x-auto max-w-full">
        {([
          { id: 'dictionary', label: '📖 Sign Dictionary', icon: '📖' },
          { id: 'document', label: '📄 AI Document Signer', icon: '📄' },
          { id: 'live-translator', label: '🎙️ Live AI Translator', icon: '🎙️' },
          { id: 'media', label: '🎬 Media to ISL', icon: '🎬' },
        ] as { id: TabId; label: string; icon: string }[]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${activeTab === tab.id
                ? 'bg-gradient-to-r from-[#6C63FF] to-[#4F46E5] text-white shadow'
                : 'text-white/50 hover:text-white/80'
              }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════ DICTIONARY TAB ════════════════ */}
      {activeTab === 'dictionary' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — 3D Avatar + info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card overflow-hidden border border-[#6C63FF]/20">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#6C63FF] animate-pulse" />
                  <h3 className="text-white font-semibold text-sm">AI Avatar Demo</h3>
                  <span className="px-2 py-0.5 bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white text-[9px] font-bold rounded">LIVE 3D</span>
                </div>
                <button onClick={replaySign}
                  className="px-3 py-1.5 rounded-lg bg-[#6C63FF]/20 text-[#6C63FF] text-xs hover:bg-[#6C63FF]/30 transition flex items-center gap-1">
                  ↺ Replay
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 min-h-[450px] lg:min-h-[550px]">
                <div className="relative lg:col-span-3 min-h-[350px]">
                  <SignAvatarOverlay queue={avatarQueue} onSignComplete={handleSignComplete} className="absolute inset-0 w-full h-full rounded-none" />
                </div>
                <div className="p-6 lg:p-8 lg:col-span-2 flex flex-col justify-center space-y-5 border-t lg:border-t-0 lg:border-l border-white/5 bg-black/20">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Currently Showing</p>
                    <h2 className="text-4xl lg:text-5xl font-black text-white">{selectedSign.display}</h2>
                    <p className="text-[#00C9A7] text-2xl font-medium mt-1">{selectedSign.hindi}</p>
                  </div>
                  <div className="space-y-3 text-sm">
                    {[
                      { label: 'Category', value: selectedSign.category },
                      { label: 'Difficulty', value: selectedSign.difficulty },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center bg-white/5 px-3 py-2 rounded-lg">
                        <span className="text-white/40">{label}</span>
                        <span className="text-white/80 capitalize font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap pt-2">
                    {masteredWords.has(selectedSign.word)
                      ? <span className="px-3 py-1 rounded-full bg-[#00C9A7]/20 text-[#00C9A7] text-xs font-semibold shadow-[0_0_10px_rgba(0,201,167,0.2)]">✓ Mastered</span>
                      : <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-semibold">Learning</span>}
                    {hasSign(selectedSign.word) && (
                      <span className="px-3 py-1 rounded-full bg-[#6C63FF]/20 text-[#6C63FF] text-xs font-semibold shadow-[0_0_10px_rgba(108,99,255,0.2)]">✨ AI Animated</span>
                    )}
                  </div>
                  <div className="pt-4 flex flex-col gap-2">
                    <button onClick={replaySign}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-bold text-lg hover:opacity-90 transition hover:scale-[1.02] active:scale-95 shadow-xl">
                      ▶ Play Sign Again
                    </button>
                    {!masteredWords.has(selectedSign.word) && (
                      <button onClick={markMastered}
                        className="w-full py-3 rounded-xl bg-[#00C9A7]/10 border border-[#00C9A7]/30 text-[#00C9A7] font-bold hover:bg-[#00C9A7]/20 transition active:scale-95">
                        ✓ Mark as Mastered
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Sign Dictionary */}
          <div className="space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-white font-semibold">ISL 3D Dictionary</h3>
                  <p className="text-white/40 text-xs">{filtered.length} of {ISL_SIGNS.length} signs</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#6C63FF]/20 text-[#6C63FF] text-[10px] font-bold uppercase tracking-wider border border-[#6C63FF]/30">
                  Interactive
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search signs (e.g. Science, Doctor, क्यों)..."
                  className="w-full px-3 py-2 pl-9 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-white/30 focus:outline-none focus:border-[#6C63FF] transition"
                />
                <span className="absolute left-3 top-2.5 text-white/30 text-xs">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-white/40 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-1 mb-2.5">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition ${
                      category === cat ? 'bg-[#6C63FF] text-white shadow-sm' : 'bg-white/5 text-white/50 hover:text-white'
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Difficulty Level Filter */}
              <div className="flex items-center gap-1 mb-3 pt-1 border-t border-white/5">
                <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mr-1">Level:</span>
                {(['All', 'beginner', 'intermediate', 'difficult'] as const).map(diff => (
                  <button
                    key={diff}
                    onClick={() => setDifficultyFilter(diff)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition ${
                      difficultyFilter === diff
                        ? diff === 'difficult'
                          ? 'bg-rose-500 text-white shadow-sm'
                          : diff === 'intermediate'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : diff === 'beginner'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/40 hover:text-white'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>

              {/* Signs List */}
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                  <div className="text-center py-8 text-white/40 text-xs">
                    No signs found matching &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  filtered.map((sign, i) => (
                    <button key={i} onClick={() => selectSign(sign)}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between group ${
                        selectedSign.word === sign.word
                          ? 'bg-[#6C63FF]/20 border border-[#6C63FF]/40 shadow-inner'
                          : 'bg-white/5 hover:bg-white/10'
                      }`}>
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-white text-xs font-semibold truncate">{sign.display}</p>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                            sign.difficulty === 'difficult'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : sign.difficulty === 'intermediate'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {sign.difficulty}
                          </span>
                        </div>
                        <p className="text-white/40 text-[11px] truncate">{sign.hindi}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {masteredWords.has(sign.word) && <span className="text-[#00C9A7] text-xs">✓</span>}
                        <span className="text-white/20 text-xs group-hover:text-[#6C63FF] transition">▶</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* AI Status */}
            <div className="glass-card p-4 border border-[#00C9A7]/20">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#00C9A7] animate-pulse" />
                <p className="text-[#00C9A7] text-xs font-bold uppercase tracking-wider">AI Engine</p>
              </div>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Signs Available', value: `${ISL_SIGNS.length} signs` },
                  { label: 'Interpolation', value: 'Smoothstep SLERP' },
                  { label: 'Animation Mode', value: 'Procedural' },
                  { label: 'STT (Live Class)', value: 'Web Speech API' },
                  { label: 'Doc AI', value: 'Sparsh AI Backend' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-white/40">{label}</span>
                    <span className="text-[#00C9A7]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ AI DOCUMENT SIGNER TAB ════════════════ */}
      {activeTab === 'document' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left — Upload + Log */}
          <div className="space-y-4">
            {/* Upload Card */}
            <div className="glass-card p-5 border border-[#6C63FF]/20">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📄</span>
                <div>
                  <h3 className="text-white font-bold">Upload Document</h3>
                  <p className="text-white/50 text-xs">PDF, TXT, or DOCX — AI will extract text &amp; sign it</p>
                </div>
              </div>

              {/* Drop Zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver
                    ? 'border-[#6C63FF] bg-[#6C63FF]/10 scale-[1.01]'
                    : file
                      ? 'border-[#00C9A7]/50 bg-[#00C9A7]/5'
                      : 'border-white/15 hover:border-[#6C63FF]/40 hover:bg-white/3'
                  }`}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.doc,.docx"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                />
                {file ? (
                  <div>
                    <span className="text-4xl block mb-2">
                      {file.name.endsWith('.pdf') ? '📕' : file.name.endsWith('.txt') ? '📝' : '📘'}
                    </span>
                    <p className="text-[#00C9A7] font-semibold text-sm">{file.name}</p>
                    <p className="text-white/40 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    <p className="text-white/30 text-xs mt-2">Click to change file</p>
                  </div>
                ) : (
                  <div>
                    <span className="text-5xl block mb-3">📂</span>
                    <p className="text-white/60 font-medium">Drop your file here</p>
                    <p className="text-white/30 text-xs mt-1">or click to browse</p>
                    <div className="flex justify-center gap-2 mt-3">
                      {['PDF', 'TXT', 'DOCX'].map(t => (
                        <span key={t} className="px-2 py-0.5 bg-white/10 text-white/50 rounded text-xs">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {extractError && (
                <p className="mt-3 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  ⚠ {extractError}
                </p>
              )}

              <button
                onClick={extractAndSign}
                disabled={!file || isExtracting}
                className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#4F46E5] text-white font-bold text-sm
                           hover:from-[#5b54e6] hover:to-[#4339ca] transition hover:scale-[1.01] active:scale-95
                           disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isExtracting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Extracting Text…
                  </>
                ) : (
                  <>✨ Extract &amp; Prepare Signs</>
                )}
              </button>
            </div>

            {/* Extracted Text */}
            {extractedText && (
              <div className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-semibold text-sm">Extracted Content</h4>
                  <span className="text-white/40 text-xs">{wordCount} words</span>
                </div>
                <div className="max-h-48 overflow-y-auto text-white/60 text-xs leading-relaxed bg-white/3 p-3 rounded-xl border border-white/5">
                  {extractedText.substring(0, 1200)}{extractedText.length > 1200 ? '…' : ''}
                </div>

                {/* ISL Tokens Found */}
                <div>
                  <p className="text-white/50 text-xs mb-2 flex items-center gap-1">
                    <span className="text-[#00C9A7]">🤟</span>
                    {islTokens.length > 0
                      ? `${islTokens.length} ISL signs found in document:`
                      : 'No known ISL signs found in document.'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {islTokens.map((t, i) => (
                      <span key={i}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${i === currentTokenIdx && isSigning
                            ? 'bg-[#6C63FF] border-[#6C63FF] text-white scale-110'
                            : i < currentTokenIdx
                              ? 'bg-[#00C9A7]/15 border-[#00C9A7]/30 text-[#00C9A7]'
                              : 'bg-white/5 border-white/10 text-white/60'
                          }`}>
                        {i === currentTokenIdx && isSigning && '▶ '}
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Controls */}
                {islTokens.length > 0 && (
                  <div className="flex gap-2 pt-1">
                    {!isSigning ? (
                      <button onClick={startSigning}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#00C9A7] to-[#0ea58c] text-white font-bold text-sm hover:opacity-90 transition">
                        ▶ Start Avatar Signing
                      </button>
                    ) : (
                      <button onClick={stopSigning}
                        className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-sm hover:bg-red-500/30 transition">
                        ⏹ Stop
                      </button>
                    )}
                    <button onClick={() => { setFile(null); setExtractedText(''); setIslTokens([]); setDocQueue([]); setIsSigning(false); }}
                      className="px-4 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition">
                      ✕ Clear
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sentences Preview */}
            {extractedSentences.length > 0 && (
              <div className="glass-card p-4">
                <h4 className="text-white font-semibold text-sm mb-3">Key Sentences ({extractedSentences.length})</h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {extractedSentences.slice(0, 8).map((s, i) => (
                    <p key={i} className="text-white/50 text-xs leading-relaxed border-l-2 border-[#6C63FF]/30 pl-2">
                      {s}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — Live Avatar */}
          <div className="space-y-4">
            <div className="glass-card overflow-hidden border border-[#6C63FF]/20 h-full min-h-[500px] flex flex-col">
              <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isSigning ? 'bg-[#6C63FF] animate-pulse' : 'bg-white/30'}`} />
                  <h3 className="text-white font-semibold text-sm">ISL Avatar</h3>
                  {isSigning && (
                    <span className="px-2 py-0.5 bg-[#6C63FF]/20 text-[#6C63FF] text-[9px] font-bold rounded border border-[#6C63FF]/30 animate-pulse">
                      SIGNING…
                    </span>
                  )}
                </div>
                {isSigning && (
                  <span className="text-white/40 text-xs">
                    {currentTokenIdx + 1} / {islTokens.length}
                  </span>
                )}
              </div>

              {/* Avatar Canvas */}
              <div className="flex-1 relative min-h-[380px]">
                <SignAvatarOverlay
                  queue={docQueue}
                  onSignComplete={handleDocSignComplete}
                  className="absolute inset-0"
                />
                {!isSigning && islTokens.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-6xl mb-4">📄</span>
                    <p className="text-white/40 text-sm">Upload a document</p>
                    <p className="text-white/20 text-xs mt-1">The avatar will sign the extracted text</p>
                  </div>
                )}
                {!isSigning && islTokens.length > 0 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                    <span className="px-3 py-1.5 bg-[#00C9A7]/20 border border-[#00C9A7]/30 text-[#00C9A7] text-xs font-medium rounded-full">
                      ✓ Ready — {islTokens.length} signs queued
                    </span>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {isSigning && islTokens.length > 0 && (
                <div className="shrink-0 px-4 pb-4 pt-2">
                  <div className="flex justify-between text-xs text-white/30 mb-1">
                    <span>Progress</span>
                    <span>{Math.round(((currentTokenIdx) / islTokens.length) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] rounded-full transition-all duration-500"
                      style={{ width: `${((currentTokenIdx) / islTokens.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="glass-card p-4 border border-white/5">
              <h4 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">How It Works</h4>
              <ol className="space-y-2">
                {[
                  { n: '1', t: 'Upload your PDF, TXT, or DOCX document' },
                  { n: '2', t: 'AI extracts and processes the text content' },
                  { n: '3', t: 'Text is tokenized into signable ISL words' },
                  { n: '4', t: 'Avatar performs each sign in sequence' },
                ].map(({ n, t }) => (
                  <li key={n} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#6C63FF]/20 text-[#6C63FF] text-xs flex items-center justify-center shrink-0 mt-0.5">{n}</span>
                    <span className="text-white/50 text-xs">{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ LIVE AI TRANSLATOR TAB ════════════════ */}
      {activeTab === 'live-translator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Mode Selector & Controls */}
          <div className="space-y-4">
            <div className="glass-card p-5 border border-[#00C9A7]/20">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white text-xs">AI</span>
                  Translator Mode
                </h3>
                <select
                  value={selectedLang}
                  onChange={(e) => {
                    setSelectedLang(e.target.value);
                    if (isListening) { toggleListening(); setTimeout(toggleListening, 100); }
                    if (webcamActive) { toggleWebcam(); setTimeout(toggleWebcam, 100); }
                  }}
                  className="bg-black/40 border border-[#00C9A7]/30 text-[#00C9A7] text-xs font-bold rounded-lg px-3 py-1.5 outline-none appearance-none cursor-pointer hover:bg-black/60 transition"
                >
                  <option value="en-IN">🇺🇸 English</option>
                  <option value="hi-IN">🇮🇳 Hindi (हिंदी)</option>
                  <option value="bn-IN">🇮🇳 Bengali (বাংলা)</option>
                  <option value="ta-IN">🇮🇳 Tamil (தமிழ்)</option>
                  <option value="te-IN">🇮🇳 Telugu (తెలుగు)</option>
                  <option value="mr-IN">🇮🇳 Marathi (मराठी)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setTranslatorMode('speech-to-isl'); if (webcamActive) toggleWebcam(); }} className={`flex-1 py-3 rounded-xl font-medium text-sm transition ${translatorMode === 'speech-to-isl' ? 'bg-[#00C9A7] text-white shadow-lg' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
                  🗣️ Speech → ISL Avatar
                </button>
                <button onClick={() => { setTranslatorMode('isl-to-speech'); if (isListening) toggleListening(); }} className={`flex-1 py-3 rounded-xl font-medium text-sm transition ${translatorMode === 'isl-to-speech' ? 'bg-[#6C63FF] text-white shadow-lg' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
                  🤟 ISL → Speech (AI)
                </button>
              </div>
            </div>

            {translatorMode === 'speech-to-isl' && (
              <div className="glass-card p-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-white font-semibold text-lg">Speak into Microphone</h4>
                    <p className="text-white/50 text-sm">Sparsh AI will translate your speech into ISL grammar.</p>
                  </div>
                </div>

                <button onClick={toggleListening} className={`w-full mt-2 py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 ${isListening ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white shadow-xl'}`}>
                  {isListening ? (
                    <><span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" /> Stop Listening</>
                  ) : (
                    <>🎙️ Start Listening</>
                  )}
                </button>

                <div className="mt-6 p-5 bg-black/40 rounded-xl border border-white/5 min-h-[120px]">
                  <p className="text-white/40 text-xs uppercase mb-3 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-[#00C9A7] animate-pulse' : 'bg-white/20'}`} />
                    Live Transcript
                  </p>
                  <p className="text-white/80 text-base leading-relaxed">{liveTranscript || (isListening ? 'Listening...' : 'Waiting for speech...')}</p>
                </div>
              </div>
            )}

            {translatorMode === 'isl-to-speech' && (
              <div className="glass-card p-6 animate-in fade-in slide-in-from-bottom-4">
                <h4 className="text-white font-semibold mb-2 text-lg">Sign to Camera</h4>
                <p className="text-white/50 text-sm mb-6">Our Vision AI analyzes your signs and speaks them aloud. Perfect for asking questions in class.</p>

                <button onClick={toggleWebcam} className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 ${webcamActive ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-gradient-to-r from-[#6C63FF] to-[#4F46E5] text-white shadow-xl'}`}>
                  {webcamActive ? (
                    <><span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" /> Stop Camera</>
                  ) : (
                    <>📷 Start Vision AI</>
                  )}
                </button>

                <div className="mt-6 p-5 bg-black/40 rounded-xl border border-white/5 min-h-[120px]">
                  <p className="text-white/40 text-xs uppercase mb-3 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${webcamActive ? 'bg-[#6C63FF] animate-pulse' : 'bg-white/20'}`} />
                    AI Translation
                  </p>
                  {visionTranslation ? (
                    <div className="flex justify-between items-start bg-[#6C63FF]/10 p-4 rounded-xl border border-[#6C63FF]/20 animate-in fade-in zoom-in-95">
                      <p className="text-white font-medium text-lg">&quot;{visionTranslation}&quot;</p>
                      <button onClick={() => playTTS(visionTranslation, selectedLang)} className="p-2.5 bg-[#6C63FF] text-white rounded-lg hover:bg-[#5b54e6] transition shadow-lg shrink-0">🔊</button>
                    </div>
                  ) : (
                    <p className="text-white/30 text-sm italic py-2">{webcamActive ? 'Analyzing hand gestures and facial expressions...' : 'Camera inactive'}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Display Area */}
          <div className="glass-card overflow-hidden border border-[#6C63FF]/20 min-h-[500px] flex flex-col relative">
            {translatorMode === 'speech-to-isl' ? (
              <>
                <div className="p-4 border-b border-white/5 flex items-center justify-between z-10 bg-[#1e1e32]/80 backdrop-blur shrink-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-[#00C9A7] animate-pulse' : 'bg-white/30'}`} />
                    <h3 className="text-white font-semibold text-sm">Real-time AI Avatar</h3>
                  </div>
                </div>
                <div className="flex-1 w-full min-h-[400px] relative">
                  <SignAvatarOverlay queue={translatorQueue} onSignComplete={handleTranslatorSignComplete} className="absolute inset-0 w-full h-full rounded-none border-0" />
                  {!isListening && translatorQueue.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/40 backdrop-blur-sm z-20">
                      <span className="text-6xl mb-4">🎙️</span>
                      <p className="text-white font-medium text-lg">Avatar Standing By</p>
                      <p className="text-white/50 text-sm mt-1">Start listening to translate speech to ISL</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="p-4 border-b border-white/5 flex items-center justify-between z-10 bg-[#1e1e32]/80 backdrop-blur shrink-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${webcamActive ? 'bg-[#6C63FF] animate-pulse' : 'bg-white/30'}`} />
                    <h3 className="text-white font-semibold text-sm">Vision AI Camera</h3>
                  </div>
                </div>
                <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                  {webcamActive ? (
                    <>
                      <Webcam ref={webcamRef} screenshotFormat="image/jpeg" screenshotQuality={0.8} className="w-full h-full object-cover opacity-80" mirrored={true} />
                      {/* Live 3D Finger Tracking Canvas Overlay */}
                      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />

                      {/* Vision UI Overlay */}
                      <div className="absolute inset-0 border-[2px] border-[#6C63FF]/30 m-8 rounded-3xl flex items-center justify-center pointer-events-none">
                        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#6C63FF] rounded-tl-3xl" />
                        <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#6C63FF] rounded-tr-3xl" />
                        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#6C63FF] rounded-bl-3xl" />
                        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#6C63FF] rounded-br-3xl" />

                        <div className="absolute top-4 right-4 flex items-center gap-2">
                          <span className="bg-black/70 backdrop-blur-md text-[#00C9A7] text-[10px] font-mono px-3 py-1 rounded border border-[#00C9A7]/30 flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${fingerTracking ? 'bg-[#00C9A7] animate-ping' : 'bg-white/40'}`} />
                            {fingerTracking ? `${fingerTracking.handedness || 'HAND'} TRACKED` : 'SEARCHING HAND'}
                          </span>
                        </div>

                        {/* Live Finger Tracking HUD */}
                        {fingerTracking && (
                          <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-[#6C63FF] font-semibold">Gesture:</span>
                              <span className="text-white font-medium bg-[#6C63FF]/20 px-2 py-0.5 rounded border border-[#6C63FF]/30">
                                {fingerTracking.gesture_hint || 'Detecting'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span className={`px-1.5 py-0.5 rounded ${fingerTracking.fingers?.thumb?.extended ? 'bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/40' : 'bg-white/5 text-white/40'}`}>T</span>
                              <span className={`px-1.5 py-0.5 rounded ${fingerTracking.fingers?.index?.extended ? 'bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/40' : 'bg-white/5 text-white/40'}`}>I</span>
                              <span className={`px-1.5 py-0.5 rounded ${fingerTracking.fingers?.middle?.extended ? 'bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/40' : 'bg-white/5 text-white/40'}`}>M</span>
                              <span className={`px-1.5 py-0.5 rounded ${fingerTracking.fingers?.ring?.extended ? 'bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/40' : 'bg-white/5 text-white/40'}`}>R</span>
                              <span className={`px-1.5 py-0.5 rounded ${fingerTracking.fingers?.pinky?.extended ? 'bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/40' : 'bg-white/5 text-white/40'}`}>P</span>
                            </div>
                            {fingerTracking.is_pinch && (
                              <span className="bg-[#FF6B6B]/20 text-[#FF6B6B] border border-[#FF6B6B]/40 px-2 py-0.5 rounded font-mono text-[10px] animate-pulse">
                                PINCH
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-6xl opacity-20 mb-4">📷</span>
                      <p className="text-white/40">Camera is off</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════ MEDIA TO ISL TAB ════════════════ */}
      {activeTab === 'media' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left - Media Upload & Player */}
          <div className="space-y-4">
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold text-white mb-2">Upload Media (MP4 / MP3)</h2>
              <p className="text-white/60 text-sm mb-6">Upload a video or audio file (like rhymes, stories, or lectures). Our AI will analyze the speech and sign it in real-time.</p>

              {!mediaFile ? (
                <div className="border-2 border-dashed border-[#1cb0f6]/50 rounded-2xl p-10 flex flex-col items-center justify-center bg-[#1cb0f6]/5 hover:bg-[#1cb0f6]/10 transition-colors cursor-pointer relative overflow-hidden group">
                  <input type="file" accept="video/mp4,audio/mp3,audio/mpeg" onChange={handleMediaUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">🎵</span>
                  <p className="text-white font-medium text-center">Click or drag MP4 / MP3 file here</p>
                  <p className="text-[#1cb0f6] text-xs mt-2 font-bold">Max 50MB</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-[#1cb0f6]/10 border border-[#1cb0f6]/20 p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{mediaFile.type.includes('video') ? '🎬' : '🎧'}</span>
                      <div>
                        <p className="text-white font-semibold text-sm truncate max-w-[200px]">{mediaFile.name}</p>
                        <p className="text-[#1cb0f6] text-xs">{(mediaFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button onClick={() => { setMediaFile(null); setMediaUrl(''); }} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition">✕</button>
                  </div>

                  {!isMediaProcessing && mediaTokens.length === 0 ? (
                    <button onClick={processMedia} className="w-full py-4 bg-[#58cc02] text-white font-bold rounded-2xl border-b-4 border-[#58a700] active:border-b-0 active:translate-y-1 transition-all">
                      Analyze Speech to ISL
                    </button>
                  ) : isMediaProcessing ? (
                    <div className="w-full py-4 bg-[#ff9600] text-white font-bold rounded-2xl flex items-center justify-center gap-3">
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing AI Audio...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {mediaFile.type.includes('video') ? (
                        <video ref={mediaRef as any} src={mediaUrl} controls className="w-full rounded-2xl border-2 border-[#1cb0f6]/30 bg-black" onPlay={playMediaAndSign} />
                      ) : (
                        <audio ref={mediaRef as any} src={mediaUrl} controls className="w-full" onPlay={playMediaAndSign} />
                      )}

                      <div className="bg-white/5 p-4 rounded-xl">
                        <p className="text-white/40 text-xs font-bold uppercase mb-2">Extracted Transcript</p>
                        <div className="flex flex-wrap gap-2">
                          {mediaTokens.map((token, i) => (
                            <span key={i} className={`px-2 py-1 rounded text-xs font-semibold ${i === currentMediaIdx ? 'bg-[#58cc02] text-white shadow-lg scale-110 transition-transform' : 'bg-white/10 text-white/60'}`}>{token}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right - Avatar */}
          <div className="glass-card overflow-hidden border-2 border-[#1cb0f6]/30 min-h-[500px] flex flex-col relative rounded-2xl">
            <div className="p-4 border-b border-white/5 flex items-center justify-between z-10 bg-[#1e1e32]/80 backdrop-blur shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${mediaQueue.length > 0 ? 'bg-[#58cc02] animate-pulse' : 'bg-white/30'}`} />
                <h3 className="text-white font-bold text-sm">Media Avatar Translation</h3>
              </div>
            </div>
            <div className="flex-1 w-full min-h-[400px] relative bg-gradient-to-br from-[#0f0c29] to-[#302b63]">
              <SignAvatarOverlay queue={mediaQueue} onSignComplete={handleMediaSignComplete} className="absolute inset-0 w-full h-full rounded-none border-0" />
              {mediaTokens.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/40 backdrop-blur-sm z-20">
                  <span className="text-6xl mb-4 opacity-50">🍿</span>
                  <p className="text-white font-bold text-lg">Upload media to begin</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
