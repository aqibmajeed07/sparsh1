'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send, Volume2, Globe, Sparkles, StopCircle, Eye, Ear, Hand, Settings2, X, Activity, Plus, Trash2, BookOpen } from 'lucide-react';
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

type Message = { id: string; sender: 'user' | 'ai'; text: string; isl_translation?: string; isAudio?: boolean; };

export default function AccessibilityAITutorPage() {
  const router = useRouter();
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

  useEffect(() => {
    let channel: any;

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

    const loadChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMessages([{ id: Date.now().toString(), sender: 'ai', text: currentLang.greeting.text, isl_translation: currentLang.greeting.isl }]);
        return;
      }

      const { data } = await supabase.from('ai_tutor_chats').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
      if (data && data.length > 0) {
        setMessages(data.map((d: any) => ({ id: d.id, sender: d.sender, text: d.text })));
      } else {
        setMessages([{ id: Date.now().toString(), sender: 'ai', text: currentLang.greeting.text, isl_translation: currentLang.greeting.isl }]);
      }

      channel = supabase.channel('realtime_tutor_chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_tutor_chats', filter: `user_id=eq.${user.id}` }, (payload) => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, { id: payload.new.id, sender: payload.new.sender, text: payload.new.text }];
          });
        }).subscribe();
    };

    loadChat();

    // Auto-trigger initial 3D ISL gestures
    setSignQueue(convertTextToSigns(currentLang.greeting.isl));

    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (recognitionRef.current) recognitionRef.current.lang = currentLang.code;
  }, [currentLang]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Voice Command App Navigation
  const handleVoiceCommandOrSend = (transcript: string) => {
    const text = transcript.toLowerCase().trim();

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

  const handleSend = async (text: string = input, isAudio: boolean = false) => {
    if (!text.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();

    const tempUserId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: tempUserId, sender: 'user', text, isAudio }]);
    setInput('');
    setIsThinking(true);

    if (user) {
      supabase.from('ai_tutor_chats').insert({
        id: tempUserId,
        user_id: user.id,
        sender: 'user',
        text: text,
        language: currentLang.code
      }).then(({ error }) => {
        if (error) console.error("Supabase insert error (user msg):", error);
      });
    }

    try {
      const res = await fetch('/api/ai-tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, language: currentLang.code, detailed: isDetailedMode })
      });
      const data = await res.json();
      setIsThinking(false);

      const tempAiId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: tempAiId, sender: 'ai', text: data.reply, isl_translation: data.isl_translation }]);

      if (user) {
        supabase.from('ai_tutor_chats').insert({
          id: tempAiId,
          user_id: user.id,
          sender: 'ai',
          text: data.reply,
          language: currentLang.code
        }).then(({ error }) => {
          if (error) console.error("Supabase insert error (AI msg):", error);
        });
      }

      // Connect 3D Avatar + Audio + Haptic Output
      speak(data.reply, currentLang.code);
      const signWords = convertTextToSigns(data.isl_translation || data.reply);
      setSignQueue(signWords);
      if (deafBlindMode) vibrateMorse(data.reply);
      senseBand.send('AI_READY');

    } catch (e) {
      console.error(e);
      setIsThinking(false);
    }
  };

  const handleNewChat = () => {
    setMessages([{ id: Date.now().toString(), sender: 'ai', text: currentLang.greeting.text, isl_translation: currentLang.greeting.isl }]);
    setSignQueue(convertTextToSigns(currentLang.greeting.isl));
    window.speechSynthesis?.cancel();
  };

  const handleDeleteChat = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('ai_tutor_chats').delete().eq('user_id', user.id);
    }
    handleNewChat();
  };

  const themeColors = highContrast
    ? { bg: 'bg-black', text: 'text-yellow-400', card: 'bg-[#111] border-2 border-yellow-400', userMsg: 'bg-[#222] text-yellow-300 border-yellow-500', aiMsg: 'bg-black text-white border-white', accent: 'bg-yellow-400 text-black' }
    : { bg: '', text: 'text-white', card: 'glass-card border border-white/10', userMsg: 'bg-gradient-to-br from-[#00C9A7]/20 to-[#00C9A7]/5 border border-[#00C9A7]/30 text-white', aiMsg: 'bg-white/5 border border-white/10 text-white/90', accent: 'bg-[#6C63FF] text-white' };

  return (
    <div className={`flex flex-col h-[calc(100vh-2rem)] gap-4 ${themeColors.bg}`}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className={`text-3xl font-bold flex items-center gap-3 ${themeColors.text}`}>
            <Sparkles className={`w-8 h-8 ${highContrast ? 'text-yellow-400' : 'text-[#6C63FF]'}`} />
            Inclusive AI Tutor & Voice Navigator
          </h1>
          <p className={`${highContrast ? 'text-white' : 'text-white/60'} mt-1`}>
            Multi-Sensory Learning with 3D Avatar ISL & Voice Control (Say "Open Sign Lab", "Homework Helper", etc.)
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Detailed Mode Toggle */}
          <button
            onClick={() => setIsDetailedMode(!isDetailedMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${isDetailedMode ? 'bg-[#00C9A7] text-black shadow-lg' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
          >
            <BookOpen className="w-4 h-4" />
            {isDetailedMode ? 'Detailed Mode ON' : 'Detailed Mode OFF'}
          </button>

          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="px-3 py-1.5 bg-[#6C63FF] hover:bg-[#5b52e0] text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-md"
          >
            <Plus className="w-4 h-4" /> New Chat
          </button>

          {/* Delete Chat Button */}
          <button
            onClick={handleDeleteChat}
            className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-xl transition border border-red-500/30"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Settings */}
          <button onClick={() => setShowSettings(true)} className={`p-2 rounded-xl transition ${highContrast ? 'bg-yellow-400 text-black hover:bg-yellow-500' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <Settings2 className="w-5 h-5" />
          </button>

          {/* Language Selector */}
          <div className={`flex items-center gap-3 p-2 px-4 rounded-2xl ${themeColors.card}`}>
            <Globe className={`w-5 h-5 ${highContrast ? 'text-yellow-400' : 'text-[#00C9A7]'}`} />
            <div className="flex gap-1">
              {LANGUAGES.map((lang, idx) => (
                <button
                  key={lang.code}
                  onClick={() => { setLangIndex(idx); window.speechSynthesis?.cancel(); setSignQueue([]); }}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${langIndex === idx ? themeColors.accent : (highContrast ? 'text-white hover:bg-white/10' : 'text-white/60 hover:bg-white/5')
                    }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-[600px]">

        {/* Left Panel: 3D ISL Avatar Connected to AI */}
        <div className={`w-full lg:w-1/2 flex flex-col relative overflow-hidden rounded-2xl border ${themeColors.card}`}>
          <div className="absolute top-4 left-4 z-20 flex gap-2">
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

          {/* 3D Avatar Rendering */}
          <div className="flex-1 w-full bg-black relative">
            <SignAvatarOverlay queue={signQueue} onSignComplete={(w) => setSignQueue(q => q.slice(1))} isProcessing={isThinking} isSpeaking={isSpeaking} speakingText={speakingText} />
          </div>

          {/* Live Captions */}
          <div className={`p-4 min-h-[80px] flex items-center justify-center text-center border-t ${highContrast ? 'bg-black border-yellow-400' : 'bg-[#060412]/90 border-white/10'}`}>
            <p className={`text-xl font-bold ${highContrast ? 'text-yellow-400' : 'text-emerald-400'}`}>
              {signQueue.length > 0 ? signQueue[0].toUpperCase() : isListening ? "LISTENING (Voice Commands Enabled)..." : ""}
            </p>
          </div>
        </div>

        {/* Right Panel: High Contrast Chat */}
        <div className={`flex-1 flex flex-col min-h-0 relative rounded-2xl ${themeColors.card}`}>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`p-5 rounded-2xl relative ${msg.sender === 'user' ? themeColors.userMsg : themeColors.aiMsg}`}>
                      <p className={`text-lg font-medium leading-relaxed whitespace-pre-wrap ${highContrast ? (msg.sender === 'user' ? 'text-yellow-300' : 'text-white') : ''}`}>{msg.text}</p>
                      {msg.sender === 'ai' && (
                        <div className="mt-4 flex gap-4">
                          <button onClick={() => speak(msg.text, currentLang.code)} className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${highContrast ? 'text-yellow-400 hover:text-white' : 'text-[#6C63FF] hover:text-white'}`}>
                            <Volume2 className="w-4 h-4" /> Listen
                          </button>
                          <button onClick={() => setSignQueue(convertTextToSigns(msg.isl_translation || msg.text))} className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${highContrast ? 'text-white hover:text-yellow-400' : 'text-[#00C9A7] hover:text-white'}`}>
                            <Activity className="w-4 h-4" /> Sign 3D Avatar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} className="h-6" />
          </div>

          <div className={`p-4 border-t rounded-b-2xl ${highContrast ? 'bg-black border-yellow-400' : 'border-white/10 bg-black/20'}`}>
            <div className="flex items-center gap-3">
              <button onClick={toggleListen} className={`p-5 rounded-2xl transition-all shadow-lg ${isListening ? 'bg-[#ff3366] text-white animate-pulse' : (highContrast ? 'bg-yellow-400 text-black hover:bg-yellow-500' : 'bg-white/10 text-white hover:bg-white/20')}`} title="Voice Command / Dictation">
                {isListening ? <StopCircle className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <div className="flex-1 relative">
                <input
                  type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isListening ? "Say 'Open Sign Lab' or ask any question..." : "Type your message or voice command..."}
                  className={`w-full rounded-2xl py-5 pl-6 pr-16 text-lg transition-all focus:outline-none ${highContrast ? 'bg-[#222] border-2 border-yellow-400 text-yellow-400 placeholder-yellow-700 focus:bg-[#111]' : 'bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-[#6C63FF]/50 focus:bg-white/10'}`}
                  disabled={isListening}
                />
                <button onClick={() => handleSend()} disabled={!input.trim()} className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 ${highContrast ? 'text-yellow-400 hover:text-white disabled:opacity-50' : 'text-white/40 hover:text-[#00C9A7] disabled:opacity-50'}`}>
                  <Send className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
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
}
