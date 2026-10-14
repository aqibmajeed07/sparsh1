'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, Send, Volume2, Globe, Sparkles, StopCircle, Eye, Ear, Hand, 
  Settings2, X, Activity, Plus, Trash2, BookOpen, History, MessageSquare, 
  Search, Clock, ChevronRight, Check, AlertCircle, RefreshCw 
} from 'lucide-react';
import SignAvatarOverlay from '@/components/live/SignAvatarOverlay';
import { convertTextToSigns } from '@/lib/isl/textToSigns';
import { supabase } from '@/lib/supabase';
import { senseBand } from '@/lib/senseband';

const LANGUAGES = [
  { code: 'en-US', name: 'English', greeting: { text: 'Hello! I am your AI Tutor. I can understand, write, sign, and take voice commands to control the app.', isl: 'hello me your ai tutor me understand write sign real time' } },
  { code: 'hi-IN', name: 'हिंदी', greeting: { text: 'नमस्ते! मैं आपका एआई शिक्षक हूँ।', isl: 'hello me your ai teacher' } },
  { code: 'ta-IN', name: 'தமிழ்', greeting: { text: 'வணக்கம்! நான் உங்கள் AI ஆசிரியர்.', isl: 'hello me your ai teacher' } },
  { code: 'te-IN', name: 'తెలుగు', greeting: { text: 'నమస్కారం! నేను మీ AI ట్యూటర్‌ని.', isl: 'hello me your ai teacher' } },
  { code: 'bn-IN', name: 'বাংলা', greeting: { text: 'নমস্কার! আমি আপনার এআই শিক্ষক।', isl: 'hello me your ai teacher' } },
];

export type Message = {
  id: string;
  session_id?: string;
  sender: 'user' | 'ai';
  text: string;
  isl_translation?: string;
  isAudio?: boolean;
  created_at?: string;
};

export type ChatSession = {
  id: string;
  user_id?: string | null;
  title: string;
  language: string;
  created_at: string;
  updated_at: string;
};

const LOCAL_STORAGE_SESSIONS_KEY = 'sparsh_ai_tutor_sessions_v2';
const LOCAL_STORAGE_MESSAGES_KEY = 'sparsh_ai_tutor_messages_v2';

export default function AccessibilityAITutorPage() {
  const router = useRouter();

  // Sessions & History State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState<string>('New Conversation');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // Chat & AI State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [langIndex, setLangIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [signQueue, setSignQueue] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState('');
  const [isDetailedMode, setIsDetailedMode] = useState(false);

  // Accessibility Settings
  const [highContrast, setHighContrast] = useState(false);
  const [deafBlindMode, setDeafBlindMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentLang = LANGUAGES[langIndex];

  // Helper: Get local storage fallback data
  const getLocalSessions = (): ChatSession[] => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveLocalSessions = (newSessions: ChatSession[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(newSessions));
    } catch {}
  };

  const getLocalMessages = (sessionId: string): Message[] => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(`${LOCAL_STORAGE_MESSAGES_KEY}_${sessionId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveLocalMessages = (sessionId: string, newMessages: Message[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${LOCAL_STORAGE_MESSAGES_KEY}_${sessionId}`, JSON.stringify(newMessages));
    } catch {}
  };

  // 1. Initial Load: Speech Recognition + Load Sessions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.onstart = () => setIsListening(true);
        recognitionRef.current.onend = () => setIsListening(false);
        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          handleVoiceCommandOrSend(transcript);
        };
        recognitionRef.current.onerror = () => setIsListening(false);
      }
    }

    loadInitialData();

    // Default greeting sign
    setSignQueue(convertTextToSigns(currentLang.greeting.isl));

    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  // Update speech recognition language when lang changes
  useEffect(() => {
    if (recognitionRef.current) recognitionRef.current.lang = currentLang.code;
  }, [currentLang]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // 2. Fetch Sessions List from Backend / Supabase
  const loadInitialData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    let loadedSessions: ChatSession[] = [];

    // Try backend proxy API
    try {
      const res = await fetch(`/api/ai-tutor/sessions${user ? `?user_id=${user.id}` : ''}`);
      if (res.ok) {
        const json = await res.json();
        if (json.sessions && json.sessions.length > 0) {
          loadedSessions = json.sessions;
        }
      }
    } catch (e) {
      console.warn('[AI Tutor] Backend sessions fetch failed, checking Supabase direct:', e);
    }

    // Try direct Supabase if backend returned empty
    if (loadedSessions.length === 0 && user) {
      try {
        const { data } = await supabase
          .from('ai_tutor_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(50);
        if (data && data.length > 0) {
          loadedSessions = data;
        }
      } catch (err) {
        // Table may not exist yet if user hasn't run the migration
      }
    }

    // Fallback to localStorage if no remote sessions found
    if (loadedSessions.length === 0) {
      loadedSessions = getLocalSessions();
    }

    setSessions(loadedSessions);

    // If sessions exist, load the most recent session
    if (loadedSessions.length > 0) {
      const mostRecent = loadedSessions[0];
      await selectSession(mostRecent);
    } else {
      // Fresh new chat
      setMessages([
        { id: Date.now().toString(), sender: 'ai', text: currentLang.greeting.text, isl_translation: currentLang.greeting.isl }
      ]);
      setActiveSessionId(null);
      setActiveSessionTitle('New Conversation');
    }
  };

  // 3. Switch to a specific session and load its message history
  const selectSession = async (session: ChatSession) => {
    setIsLoadingSession(true);
    setActiveSessionId(session.id);
    setActiveSessionTitle(session.title);

    // Update language if matches
    const foundLangIdx = LANGUAGES.findIndex(l => l.code === session.language);
    if (foundLangIdx !== -1) setLangIndex(foundLangIdx);

    let sessionMessages: Message[] = [];

    // 1. Try Backend API
    try {
      const res = await fetch(`/api/ai-tutor/sessions/${session.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          sessionMessages = data.messages.map((m: any) => ({
            id: m.id,
            session_id: m.session_id,
            sender: m.sender,
            text: m.text,
            isl_translation: m.isl_translation,
            created_at: m.created_at
          }));
        }
      }
    } catch (e) {
      console.warn('[AI Tutor] Error fetching session messages from backend:', e);
    }

    // 2. Try Supabase direct
    if (sessionMessages.length === 0) {
      try {
        const { data } = await supabase
          .from('ai_tutor_messages')
          .select('*')
          .eq('session_id', session.id)
          .order('created_at', { ascending: true });

        if (data && data.length > 0) {
          sessionMessages = data.map((m: any) => ({
            id: m.id,
            session_id: m.session_id,
            sender: m.sender,
            text: m.text,
            isl_translation: m.isl_translation,
            created_at: m.created_at
          }));
        }
      } catch (err) {
        // Table not ready or no rows
      }
    }

    // 3. Fallback to localStorage
    if (sessionMessages.length === 0) {
      sessionMessages = getLocalMessages(session.id);
    }

    if (sessionMessages.length > 0) {
      setMessages(sessionMessages);
      const lastAiMsg = [...sessionMessages].reverse().find(m => m.sender === 'ai');
      if (lastAiMsg?.isl_translation || lastAiMsg?.text) {
        setSignQueue(convertTextToSigns(lastAiMsg.isl_translation || lastAiMsg.text));
      }
    } else {
      // Empty session
      setMessages([
        { id: Date.now().toString(), session_id: session.id, sender: 'ai', text: currentLang.greeting.text, isl_translation: currentLang.greeting.isl }
      ]);
    }

    setIsLoadingSession(false);
    if (window.innerWidth < 1024) setIsHistoryOpen(false); // Auto close history on mobile
  };

  // 4. Voice Commands
  const handleVoiceCommandOrSend = (transcript: string) => {
    const text = transcript.toLowerCase().trim();

    if (text.includes('new chat') || text.includes('start new chat') || text.includes('start over')) {
      speak('Starting a new chat session...', currentLang.code);
      handleNewChat();
      return;
    }
    if (text.includes('chat history') || text.includes('show history') || text.includes('open history')) {
      speak('Opening chat history...', currentLang.code);
      setIsHistoryOpen(true);
      return;
    }
    if (text.includes('delete chat') || text.includes('clear chat')) {
      if (activeSessionId) {
        speak('Deleting current chat session...', currentLang.code);
        handleDeleteCurrentSession();
      } else {
        handleNewChat();
      }
      return;
    }

    // App Navigation Voice Commands
    if (text.includes('sign lab') || text.includes('open sign lab')) {
      speak('Opening Sign Lab...', currentLang.code);
      router.push('/student/sign-lab');
      return;
    }
    if (text.includes('homework helper') || text.includes('open homework helper')) {
      speak('Opening Homework Helper...', currentLang.code);
      router.push('/student/homework-helper');
      return;
    }
    if (text.includes('smart notes') || text.includes('open smart notes')) {
      speak('Opening Smart Notes...', currentLang.code);
      router.push('/student/smart-notes');
      return;
    }
    if (text.includes('ocr reader') || text.includes('book reader') || text.includes('open ocr reader')) {
      speak('Opening Book Reader...', currentLang.code);
      router.push('/student/ocr-reader');
      return;
    }
    if (text.includes('live classroom') || text.includes('open live classroom')) {
      speak('Opening Live Classroom...', currentLang.code);
      router.push('/student/live-classroom');
      return;
    }
    if (text.includes('dashboard') || text.includes('student dashboard') || text.includes('go to dashboard')) {
      speak('Going to Dashboard...', currentLang.code);
      router.push('/student');
      return;
    }

    handleSend(transcript, true);
  };

  const speak = (text: string, langCode: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      utterance.pitch = 1.0;
      utterance.rate = 0.90;
      utterance.onstart = () => { setIsSpeaking(true); setSpeakingText(text); };
      utterance.onend = () => { setIsSpeaking(false); setSpeakingText(''); };
      utterance.onpause = () => setIsSpeaking(false);
      utterance.onresume = () => setIsSpeaking(true);
      utterance.onerror = () => { setIsSpeaking(false); setSpeakingText(''); };
      window.speechSynthesis.speak(utterance);
    }
  };

  const vibrateMorse = (text: string) => {
    if (!('vibrate' in navigator)) return;
    const morseMap: Record<string, number[]> = {
      'a': [100, 300], 'b': [300, 100, 100, 100], 'c': [300, 100, 300, 100], 'd': [300, 100, 100], 'e': [100],
      'f': [100, 100, 300, 100], 'g': [300, 300, 100], 'h': [100, 100, 100, 100], 'i': [100, 100], 'j': [100, 300, 300, 300],
      'k': [300, 100, 300], 'l': [100, 300, 100, 100], 'm': [300, 300], 'n': [300, 100], 'o': [300, 300, 300],
      'p': [100, 300, 300, 100], 'q': [300, 300, 100, 300], 'r': [100, 300, 100], 's': [100, 100, 100], 't': [300],
      'u': [100, 100, 300], 'v': [100, 100, 100, 300], 'w': [100, 300, 300], 'x': [300, 100, 100, 300],
      'y': [300, 100, 300, 300], 'z': [300, 300, 100, 100], ' ': [0, 0, 0]
    };
    const pattern: number[] = [];
    for (const char of text.toLowerCase().replace(/[^a-z ]/g, '')) {
      if (morseMap[char]) { pattern.push(...morseMap[char]); pattern.push(200); }
    }
    navigator.vibrate(pattern);
  };

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      window.speechSynthesis?.cancel();
      try { recognitionRef.current?.start(); } catch (e) { }
    }
  };

  // 5. Send Message (with Session Persistence & History)
  const handleSend = async (text: string = input, isAudio: boolean = false) => {
    if (!text.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();

    // Determine session ID
    let currentSessionId = activeSessionId;
    let newSessionCreated = false;

    if (!currentSessionId) {
      currentSessionId = crypto.randomUUID();
      newSessionCreated = true;
      const initialTitle = text.length > 36 ? text.substring(0, 36) + '...' : text;
      
      const newSession: ChatSession = {
        id: currentSessionId,
        user_id: user?.id || null,
        title: initialTitle,
        language: currentLang.code,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setActiveSessionId(currentSessionId);
      setActiveSessionTitle(initialTitle);
      
      setSessions(prev => {
        const updated = [newSession, ...prev.filter(s => s.id !== currentSessionId)];
        saveLocalSessions(updated);
        return updated;
      });

      // Post session creation to backend asynchronously
      fetch('/api/ai-tutor/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSession)
      }).catch(() => {});
    }

    const tempUserId = crypto.randomUUID();
    const userMsgObj: Message = {
      id: tempUserId,
      session_id: currentSessionId,
      sender: 'user',
      text,
      isAudio,
      created_at: new Date().toISOString()
    };

    setMessages(prev => {
      const updated = [...prev, userMsgObj];
      saveLocalMessages(currentSessionId!, updated);
      return updated;
    });

    setInput('');
    setIsThinking(true);

    try {
      let data: any = null;
      const directCandidates = [
        process.env.NEXT_PUBLIC_BACKEND_URL,
        'http://localhost:8000',
        'http://127.0.0.1:8000',
      ].filter(Boolean) as string[];

      // 1. Direct connection attempt to local backend for fast AI execution
      for (const candidate of directCandidates) {
        try {
          const directController = new AbortController();
          const directTimeout = setTimeout(() => directController.abort(), 12000);
          const directRes = await fetch(`${candidate}/api/ai-tutor/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: text,
              language: currentLang.code,
              detailed: isDetailedMode,
              session_id: currentSessionId,
              user_id: user?.id
            }),
            signal: directController.signal
          });
          clearTimeout(directTimeout);
          if (directRes.ok) {
            data = await directRes.json();
            break;
          }
        } catch {
          // Continue to next candidate
        }
      }

      // 2. Next.js API Proxy Fallback
      if (!data) {
        const res = await fetch('/api/ai-tutor/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            language: currentLang.code,
            detailed: isDetailedMode,
            session_id: currentSessionId,
            user_id: user?.id
          })
        });
        data = await res.json();
      }

      setIsThinking(false);

      const tempAiId = crypto.randomUUID();
      const aiReplyText = data.reply || "I am processing your query. Please ask any science or math question!";
      const aiIslTranslation = data.isl_translation || data.reply || text;

      const aiMsgObj: Message = {
        id: tempAiId,
        session_id: currentSessionId,
        sender: 'ai',
        text: aiReplyText,
        isl_translation: aiIslTranslation,
        created_at: new Date().toISOString()
      };

      setMessages(prev => {
        const updated = [...prev, aiMsgObj];
        saveLocalMessages(currentSessionId!, updated);
        return updated;
      });

      // Update session timestamp in list
      setSessions(prev => {
        const updated = prev.map(s => s.id === currentSessionId ? { ...s, updated_at: new Date().toISOString() } : s);
        saveLocalSessions(updated);
        return updated;
      });

      // Connect 3D Avatar + Audio + Haptic Output
      speak(aiReplyText, currentLang.code);
      const signWords = convertTextToSigns(aiIslTranslation);
      setSignQueue(signWords);
      if (deafBlindMode) vibrateMorse(aiReplyText);
      senseBand.send('AI_READY');

    } catch (e) {
      console.error('[AI Tutor] Send error:', e);
      setIsThinking(false);
    }
  };

  // 6. Action: Start New Chat
  const handleNewChat = () => {
    setActiveSessionId(null);
    setActiveSessionTitle('New Conversation');
    setMessages([
      { id: Date.now().toString(), sender: 'ai', text: currentLang.greeting.text, isl_translation: currentLang.greeting.isl }
    ]);
    setSignQueue(convertTextToSigns(currentLang.greeting.isl));
    window.speechSynthesis?.cancel();
    if (window.innerWidth < 1024) setIsHistoryOpen(false);
  };

  // 7. Action: Delete a specific Session
  const handleDeleteSession = async (session: ChatSession) => {
    const sessionId = session.id;

    // Remove from backend API
    fetch(`/api/ai-tutor/sessions/${sessionId}`, { method: 'DELETE' }).catch(() => {});

    // Remove from Supabase direct if authenticated
    try {
      await supabase.from('ai_tutor_messages').delete().eq('session_id', sessionId);
      await supabase.from('ai_tutor_sessions').delete().eq('id', sessionId);
      await supabase.from('ai_tutor_chats').delete().eq('session_id', sessionId);
    } catch {}

    // Remove from localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`${LOCAL_STORAGE_MESSAGES_KEY}_${sessionId}`);
      } catch {}
    }

    // Update sessions state
    const remaining = sessions.filter(s => s.id !== sessionId);
    setSessions(remaining);
    saveLocalSessions(remaining);
    setSessionToDelete(null);

    // If deleting active session, switch to next or start new chat
    if (activeSessionId === sessionId) {
      if (remaining.length > 0) {
        selectSession(remaining[0]);
      } else {
        handleNewChat();
      }
    }
  };

  // 8. Action: Delete Current Active Session
  const handleDeleteCurrentSession = () => {
    if (!activeSessionId) {
      handleNewChat();
      return;
    }
    const currentSession = sessions.find(s => s.id === activeSessionId) || {
      id: activeSessionId,
      title: activeSessionTitle,
      language: currentLang.code,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setSessionToDelete(currentSession);
  };

  // 9. Action: Clear All Chat History
  const handleClearAllHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    // Call backend API
    fetch(`/api/ai-tutor/sessions${user ? `?user_id=${user.id}` : ''}`, { method: 'DELETE' }).catch(() => {});

    // Clear Supabase
    if (user) {
      try {
        await supabase.from('ai_tutor_messages').delete().eq('user_id', user.id);
        await supabase.from('ai_tutor_sessions').delete().eq('user_id', user.id);
        await supabase.from('ai_tutor_chats').delete().eq('user_id', user.id);
      } catch {}
    }

    // Clear localStorage
    if (typeof window !== 'undefined') {
      sessions.forEach(s => {
        try { localStorage.removeItem(`${LOCAL_STORAGE_MESSAGES_KEY}_${s.id}`); } catch {}
      });
      try { localStorage.removeItem(LOCAL_STORAGE_SESSIONS_KEY); } catch {}
    }

    setSessions([]);
    setShowClearConfirm(false);
    handleNewChat();
  };

  // Filtered Sessions for Search
  const filteredSessions = useMemo(() => {
    if (!historySearch.trim()) return sessions;
    const query = historySearch.toLowerCase();
    return sessions.filter(s => s.title.toLowerCase().includes(query));
  }, [sessions, historySearch]);

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const today: ChatSession[] = [];
    const yesterday: ChatSession[] = [];
    const older: ChatSession[] = [];

    const now = new Date();
    const todayStr = now.toDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();

    filteredSessions.forEach(session => {
      const sessionDate = new Date(session.updated_at || session.created_at).toDateString();
      if (sessionDate === todayStr) {
        today.push(session);
      } else if (sessionDate === yesterdayStr) {
        yesterday.push(session);
      } else {
        older.push(session);
      }
    });

    return { today, yesterday, older };
  }, [filteredSessions]);

  const themeColors = highContrast
    ? {
        bg: 'bg-black',
        text: 'text-yellow-400',
        card: 'bg-[#111] border-2 border-yellow-400',
        userMsg: 'bg-[#222] text-yellow-300 border-yellow-500',
        aiMsg: 'bg-black text-white border-white',
        accent: 'bg-yellow-400 text-black',
        drawer: 'bg-black border-l-2 border-yellow-400'
      }
    : {
        bg: '',
        text: 'text-white',
        card: 'glass-card border border-white/10',
        userMsg: 'bg-gradient-to-br from-[#00C9A7]/20 to-[#00C9A7]/5 border border-[#00C9A7]/30 text-white',
        aiMsg: 'bg-white/5 border border-white/10 text-white/90',
        accent: 'bg-[#6C63FF] text-white',
        drawer: 'bg-[#0f0c29]/95 backdrop-blur-2xl border-l border-white/10'
      };

  return (
    <div className={`flex flex-col h-[calc(100vh-2rem)] gap-4 relative overflow-hidden ${themeColors.bg}`}>

      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold flex items-center gap-3 ${themeColors.text}`}>
            <Sparkles className={`w-7 h-7 sm:w-8 h-8 ${highContrast ? 'text-yellow-400' : 'text-[#6C63FF]'}`} />
            Inclusive AI Tutor & Voice Navigator
          </h1>
          <p className={`${highContrast ? 'text-white' : 'text-white/60'} text-xs sm:text-sm mt-1 flex items-center gap-2 flex-wrap`}>
            <span>Multi-Sensory Learning with 3D Avatar ISL & Voice Control</span>
            {activeSessionId && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${highContrast ? 'border-yellow-400 text-yellow-400' : 'border-[#00C9A7]/40 bg-[#00C9A7]/10 text-[#00C9A7]'}`}>
                Topic: {activeSessionTitle}
              </span>
            )}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">

          {/* History Drawer Toggle Button */}
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md border ${
              isHistoryOpen 
                ? (highContrast ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-[#00C9A7] text-black border-[#00C9A7]') 
                : (highContrast ? 'bg-[#222] text-yellow-400 border-yellow-400 hover:bg-[#333]' : 'bg-white/10 text-white hover:bg-white/20 border-white/15')
            }`}
            title="Toggle Chat History Drawer"
          >
            <History className="w-4 h-4" />
            <span>Chat History</span>
            {sessions.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${isHistoryOpen ? 'bg-black/20 text-black' : 'bg-[#6C63FF] text-white'}`}>
                {sessions.length}
              </span>
            )}
          </button>

          {/* + New Chat Button */}
          <button
            onClick={handleNewChat}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
              highContrast
                ? 'bg-yellow-400 text-black hover:bg-yellow-500'
                : 'bg-gradient-to-r from-[#6C63FF] to-[#8075ff] hover:from-[#5b52e0] hover:to-[#6C63FF] text-white'
            }`}
            title="Start a Fresh Conversation"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          {/* Delete Active Chat Button */}
          <button
            onClick={handleDeleteCurrentSession}
            disabled={!activeSessionId && messages.length <= 1}
            className={`p-2 rounded-xl transition border ${
              messages.length <= 1 && !activeSessionId
                ? 'opacity-40 cursor-not-allowed border-transparent bg-white/5 text-white/40'
                : highContrast
                ? 'bg-red-950 text-red-300 border-red-500 hover:bg-red-900'
                : 'bg-red-500/20 hover:bg-red-500/40 text-red-300 border-red-500/30'
            }`}
            title="Delete Current Chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Detailed Mode Toggle */}
          <button
            onClick={() => setIsDetailedMode(!isDetailedMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              isDetailedMode 
                ? 'bg-[#00C9A7] text-black shadow-lg' 
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {isDetailedMode ? 'Detailed Mode ON' : 'Detailed Mode OFF'}
          </button>

          {/* Accessibility Settings */}
          <button 
            onClick={() => setShowSettings(true)} 
            className={`p-2 rounded-xl transition ${highContrast ? 'bg-yellow-400 text-black hover:bg-yellow-500' : 'bg-white/10 text-white hover:bg-white/20'}`}
            title="Accessibility Settings"
          >
            <Settings2 className="w-5 h-5" />
          </button>

          {/* Language Selector */}
          <div className={`flex items-center gap-2 p-1.5 px-3 rounded-2xl ${themeColors.card}`}>
            <Globe className={`w-4 h-4 ${highContrast ? 'text-yellow-400' : 'text-[#00C9A7]'}`} />
            <div className="flex gap-1">
              {LANGUAGES.map((lang, idx) => (
                <button
                  key={lang.code}
                  onClick={() => { setLangIndex(idx); window.speechSynthesis?.cancel(); setSignQueue([]); }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                    langIndex === idx ? themeColors.accent : (highContrast ? 'text-white hover:bg-white/10' : 'text-white/60 hover:bg-white/5')
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Workspace Area ── */}
      <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-[600px] relative overflow-hidden">

        {/* ── Left Panel: 3D ISL Avatar ── */}
        <div className={`w-full lg:w-[52%] flex flex-col relative overflow-hidden rounded-3xl border shadow-2xl ${themeColors.card}`}>
          <div className="absolute top-4 left-4 z-20 flex gap-2 flex-wrap">
            <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full flex items-center gap-1 ${highContrast ? 'bg-yellow-400 text-black' : 'bg-[#6C63FF]/20 text-[#6C63FF]'}`}>
              <Eye className="w-3 h-3" /> Visual (ISL 3D Avatar)
            </span>
            <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full flex items-center gap-1 ${highContrast ? 'bg-white text-black' : 'bg-[#00C9A7]/20 text-[#00C9A7]'}`}>
              <Ear className="w-3 h-3" /> Audio (TTS)
            </span>
            {deafBlindMode && (
              <span className="px-3 py-1 text-[10px] font-bold uppercase rounded-full bg-red-500/20 text-red-400 flex items-center gap-1 animate-pulse">
                <Hand className="w-3 h-3" /> Haptic Active
              </span>
            )}
          </div>

          {/* 3D Avatar Canvas */}
          <div className="flex-1 w-full bg-black relative flex flex-col overflow-hidden min-h-[440px]">
            <SignAvatarOverlay
              queue={signQueue}
              onSignComplete={() => setSignQueue(q => q.slice(1))}
              isProcessing={isThinking}
              isSpeaking={isSpeaking}
              speakingText={speakingText}
              framing="full"
              showIslBadge={false}
              className="w-full h-full flex-1 rounded-none border-0"
            />
          </div>

          {/* Live Subtitles / Captions */}
          <div className={`p-4 min-h-[70px] flex items-center justify-center text-center border-t ${highContrast ? 'bg-black border-yellow-400' : 'bg-[#060412]/90 border-white/10'}`}>
            <p className={`text-base sm:text-lg font-bold ${highContrast ? 'text-yellow-400' : 'text-emerald-400'}`}>
              {isThinking 
                ? "AI PROCESSING COMMAND & REASONING....." 
                : signQueue.length > 0 
                ? `SIGNING: ${signQueue[0].toUpperCase()}` 
                : isListening 
                ? "LISTENING: Say 'What is photosynthesis', 'New chat', etc." 
                : "Ready for your question or voice command"}
            </p>
          </div>
        </div>

        {/* ── Right Panel: Chat Messages & Input ── */}
        <div className={`flex-1 min-w-[320px] flex flex-col min-h-0 relative rounded-3xl shadow-xl ${themeColors.card}`}>

          {/* Chat Header Chip / Switch Bar */}
          <div className={`px-5 py-3 border-b flex items-center justify-between text-xs ${highContrast ? 'border-yellow-400 bg-[#111]' : 'border-white/10 bg-white/5'}`}>
            <div className="flex items-center gap-2 truncate">
              <MessageSquare className="w-4 h-4 text-[#00C9A7] shrink-0" />
              <span className="font-semibold text-white/90 truncate">
                {activeSessionTitle}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isLoadingSession && (
                <span className="flex items-center gap-1 text-[#00C9A7] animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Loading...
                </span>
              )}
              <span className="text-white/50 text-[11px]">
                {messages.length} message{messages.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div 
                  key={msg.id} 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[88%] flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`p-4 sm:p-5 rounded-2xl relative shadow-md ${msg.sender === 'user' ? themeColors.userMsg : themeColors.aiMsg}`}>
                      <p className={`text-base sm:text-lg font-medium leading-relaxed whitespace-pre-wrap ${highContrast ? (msg.sender === 'user' ? 'text-yellow-300' : 'text-white') : ''}`}>
                        {msg.text}
                      </p>
                      
                      {msg.sender === 'ai' && (
                        <div className="mt-4 flex gap-4 flex-wrap">
                          <button 
                            onClick={() => speak(msg.text, currentLang.code)} 
                            className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition ${
                              highContrast ? 'text-yellow-400 hover:text-white' : 'text-[#6C63FF] hover:text-white'
                            }`}
                          >
                            <Volume2 className="w-4 h-4" /> Listen
                          </button>
                          <button 
                            onClick={() => setSignQueue(convertTextToSigns(msg.isl_translation || msg.text))} 
                            className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition ${
                              highContrast ? 'text-white hover:text-yellow-400' : 'text-[#00C9A7] hover:text-white'
                            }`}
                          >
                            <Activity className="w-4 h-4" /> Sign 3D Avatar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Processing Bubble Indicator */}
              {isThinking && (
                <motion.div
                  key="ai-thinking-indicator"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex justify-start"
                >
                  <div className="max-w-[85%] flex gap-3 flex-row items-center">
                    <div className={`p-4 px-6 rounded-2xl ${themeColors.aiMsg} flex items-center gap-3 border border-[#6C63FF]/40 bg-gradient-to-r from-[#6C63FF]/20 via-[#00C9A7]/15 to-[#6C63FF]/20 shadow-xl backdrop-blur-md`}>
                      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#00C9A7] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#00C9A7] animate-spin" />
                        Processing Command
                      </span>
                      <div className="flex items-center gap-1.5 ml-1">
                        <span className="w-2 h-2 rounded-full bg-[#00C9A7] animate-bounce [animation-delay:-0.32s]" />
                        <span className="w-2 h-2 rounded-full bg-[#6C63FF] animate-bounce [animation-delay:-0.16s]" />
                        <span className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" />
                      </div>
                      <span className="text-sm font-mono font-bold text-white/70 tracking-widest animate-pulse ml-1">.....</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} className="h-4" />
          </div>

          {/* Bottom Chat Input Bar */}
          <div className={`p-4 border-t rounded-b-3xl ${highContrast ? 'bg-black border-yellow-400' : 'border-white/10 bg-black/20'}`}>
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleListen} 
                className={`p-4 sm:p-5 rounded-2xl transition-all shadow-lg shrink-0 ${
                  isListening 
                    ? 'bg-[#ff3366] text-white animate-pulse' 
                    : (highContrast ? 'bg-yellow-400 text-black hover:bg-yellow-500' : 'bg-white/10 text-white hover:bg-white/20')
                }`} 
                title="Voice Command / Dictation"
              >
                {isListening ? <StopCircle className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <div className="flex-1 relative">
                <input
                  type="text" 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={
                    isThinking 
                      ? "Thinking & formulating response....." 
                      : isListening 
                      ? "Say 'What is cell' or 'New chat'..." 
                      : "Type your message or voice command..."
                  }
                  className={`w-full rounded-2xl py-4 sm:py-5 pl-5 pr-14 text-base sm:text-lg transition-all focus:outline-none ${
                    highContrast 
                      ? 'bg-[#222] border-2 border-yellow-400 text-yellow-400 placeholder-yellow-700 focus:bg-[#111]' 
                      : 'bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-[#6C63FF]/50 focus:bg-white/10'
                  }`}
                  disabled={isListening || isThinking}
                />
                <button 
                  onClick={() => handleSend()} 
                  disabled={!input.trim() || isThinking} 
                  className={`absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 transition ${
                    highContrast 
                      ? 'text-yellow-400 hover:text-white disabled:opacity-40' 
                      : 'text-white/40 hover:text-[#00C9A7] disabled:opacity-30'
                  }`}
                  title="Send message"
                >
                  {isThinking ? <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-[#00C9A7]" /> : <Send className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Slide-Out Chat History Drawer / Sidebar ── */}
        <AnimatePresence>
          {isHistoryOpen && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`absolute top-0 right-0 bottom-0 z-40 w-full sm:w-[380px] flex flex-col shadow-2xl rounded-3xl ${themeColors.drawer}`}
            >
              {/* Drawer Header */}
              <div className={`p-5 border-b flex items-center justify-between ${highContrast ? 'border-yellow-400' : 'border-white/10'}`}>
                <div className="flex items-center gap-2">
                  <History className={`w-5 h-5 ${highContrast ? 'text-yellow-400' : 'text-[#00C9A7]'}`} />
                  <h2 className="text-lg font-bold text-white">Chat History</h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/10 text-white/70">
                    {sessions.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleNewChat}
                    className={`p-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                      highContrast ? 'bg-yellow-400 text-black hover:bg-yellow-500' : 'bg-[#6C63FF] hover:bg-[#584feb] text-white'
                    }`}
                    title="Start new conversation"
                  >
                    <Plus className="w-3.5 h-3.5" /> New
                  </button>
                  <button
                    onClick={() => setIsHistoryOpen(false)}
                    className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Search History Bar */}
              <div className="p-3 border-b border-white/10">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search past conversations..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#6C63FF]"
                  />
                  {historySearch && (
                    <button onClick={() => setHistorySearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Sessions List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {sessions.length === 0 ? (
                  <div className="p-8 text-center text-white/40 space-y-2">
                    <MessageSquare className="w-8 h-8 mx-auto opacity-40" />
                    <p className="text-sm font-medium">No chat history yet</p>
                    <p className="text-xs">Ask a question to begin your learning journal!</p>
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="p-8 text-center text-white/40">
                    <p className="text-sm">No chats matching "{historySearch}"</p>
                  </div>
                ) : (
                  <>
                    {/* Today */}
                    {groupedSessions.today.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-white/40">Today</div>
                        {groupedSessions.today.map(session => renderSessionItem(session))}
                      </div>
                    )}

                    {/* Yesterday */}
                    {groupedSessions.yesterday.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-white/40">Yesterday</div>
                        {groupedSessions.yesterday.map(session => renderSessionItem(session))}
                      </div>
                    )}

                    {/* Older */}
                    {groupedSessions.older.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-white/40">Previous Chats</div>
                        {groupedSessions.older.map(session => renderSessionItem(session))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Drawer Footer: Clear All Option */}
              {sessions.length > 0 && (
                <div className={`p-4 border-t flex justify-between items-center ${highContrast ? 'border-yellow-400 bg-[#111]' : 'border-white/10 bg-black/20'}`}>
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="text-xs text-red-400 hover:text-red-300 transition flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All History
                  </button>
                  <span className="text-[11px] text-white/40">
                    Realtime sync active
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* ── Delete Confirmation Dialog ── */}
      <AnimatePresence>
        {sessionToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className={`w-full max-w-md p-6 rounded-3xl ${highContrast ? 'bg-black border-4 border-red-500 text-white' : 'glass-card border border-white/20'}`}
            >
              <div className="flex items-center gap-3 text-red-400 mb-3">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-xl font-bold text-white">Delete Chat Conversation?</h3>
              </div>
              <p className="text-sm text-white/70 mb-2 leading-relaxed">
                Are you sure you want to delete this chat session:
              </p>
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold text-[#00C9A7] mb-6 truncate">
                "{sessionToDelete.title}"
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSessionToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteSession(sessionToDelete)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-1.5 shadow-lg"
                >
                  <Trash2 className="w-4 h-4" /> Delete Permanently
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Clear All History Confirmation Dialog ── */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className={`w-full max-w-md p-6 rounded-3xl ${highContrast ? 'bg-black border-4 border-red-500 text-white' : 'glass-card border border-white/20'}`}
            >
              <div className="flex items-center gap-3 text-red-400 mb-3">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-xl font-bold text-white">Clear All Chat History?</h3>
              </div>
              <p className="text-sm text-white/70 mb-6 leading-relaxed">
                This will permanently delete all {sessions.length} saved conversation threads and their messages from your database. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAllHistory}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-1.5 shadow-lg"
                >
                  <Trash2 className="w-4 h-4" /> Yes, Clear All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Settings Modal ── */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={`w-full max-w-md p-8 rounded-3xl ${highContrast ? 'bg-black border-4 border-yellow-400' : 'glass-card border border-white/10'}`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-2xl font-bold ${highContrast ? 'text-yellow-400' : 'text-white'}`}>Accessibility Settings</h2>
                <button onClick={() => setShowSettings(false)} className={highContrast ? 'text-white hover:text-yellow-400' : 'text-white/50 hover:text-white'}><X className="w-6 h-6" /></button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-bold ${highContrast ? 'text-white' : 'text-white/90'}`}>High Contrast UI</h3>
                    <p className={`text-sm ${highContrast ? 'text-yellow-400/80' : 'text-white/50'}`}>For visually impaired users.</p>
                  </div>
                  <button onClick={() => setHighContrast(!highContrast)} className={`relative w-14 h-8 rounded-full transition-colors ${highContrast ? 'bg-yellow-400' : 'bg-white/20'}`}>
                    <span className={`absolute top-1 left-1 w-6 h-6 bg-black rounded-full transition-transform ${highContrast ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-bold ${highContrast ? 'text-white' : 'text-white/90'}`}>DeafBlind Haptics</h3>
                    <p className={`text-sm ${highContrast ? 'text-yellow-400/80' : 'text-white/50'}`}>Translates text to Morse vibrations.</p>
                  </div>
                  <button onClick={() => setDeafBlindMode(!deafBlindMode)} className={`relative w-14 h-8 rounded-full transition-colors ${deafBlindMode ? 'bg-[#00C9A7]' : 'bg-white/20'}`}>
                    <span className={`absolute top-1 left-1 w-6 h-6 bg-black rounded-full transition-transform ${deafBlindMode ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );

  // Helper render function for each chat session card in drawer
  function renderSessionItem(session: ChatSession) {
    const isActive = activeSessionId === session.id;
    return (
      <div
        key={session.id}
        onClick={() => selectSession(session)}
        className={`group relative p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-2 border ${
          isActive
            ? (highContrast ? 'bg-yellow-400/20 border-yellow-400' : 'bg-gradient-to-r from-[#6C63FF]/30 to-[#00C9A7]/20 border-[#6C63FF] shadow-lg')
            : (highContrast ? 'bg-[#1a1a1a] border-yellow-400/20 hover:border-yellow-400' : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10')
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? (highContrast ? 'text-yellow-400' : 'text-[#00C9A7]') : 'text-white/40'}`} />
          <div className="min-w-0 flex-1">
            <h4 className={`text-xs font-semibold truncate ${isActive ? 'text-white font-bold' : 'text-white/80'}`}>
              {session.title || 'Untitled Conversation'}
            </h4>
            <p className="text-[10px] text-white/40 truncate flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {new Date(session.updated_at || session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Delete individual chat button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSessionToDelete(session);
          }}
          className={`p-1.5 rounded-lg transition shrink-0 ${
            isActive 
              ? 'text-red-400 hover:bg-red-500/20 hover:text-red-300' 
              : 'text-white/30 hover:text-red-400 hover:bg-red-500/20 opacity-70 group-hover:opacity-100'
          }`}
          title="Delete this chat"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }
}
