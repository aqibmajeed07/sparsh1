'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { convertTextToSigns } from '@/lib/isl/textToSigns';
import {
  Mic, MicOff, Video, VideoOff, ScreenShare, Hand, Smile,
  MessageSquare, Users, Settings, PhoneOff, Send, Volume2,
  Sparkles, Maximize2, Minimize2, Check, Radio, HelpCircle,
  Eye, RefreshCw, ChevronRight, BookOpen, AlertCircle
} from 'lucide-react';

// Dynamically import 3D ISL Avatar (WebGL canvas requires client-side only)
const SignAvatarOverlay = dynamic(
  () => import('@/components/live/SignAvatarOverlay'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0f0c29]/70 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="flex flex-col items-center gap-3">
          <span className="w-9 h-9 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
          <span className="text-white/60 text-xs font-medium">Initializing 3D ISL Avatar...</span>
        </div>
      </div>
    ),
  }
);

interface LiveSession {
  id: string;
  rtc_channel_id: string;
  title: string;
  subject: string;
  grade: string;
  institution_id?: string;
  teacher_id?: string;
  teacher_name?: string;
  status: 'live' | 'ended';
  started_at: string;
  student_count?: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  role: 'teacher' | 'student' | 'you';
  text: string;
  time: string;
}

interface Participant {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  isHost?: boolean;
  hasAudio: boolean;
  hasVideo: boolean;
  handRaised?: boolean;
}

// Preset active educational demo classes if database is empty or teacher offline
const DEMO_CLASSES: LiveSession[] = [
  {
    id: 'demo-science-8',
    rtc_channel_id: 'sparsh-science-g8-live',
    title: 'Grade 8 Science: Laboratory Experiments, Gravity & Atoms',
    subject: 'Science',
    grade: '8',
    teacher_name: 'Prof. Sunita Sharma',
    status: 'live',
    started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    student_count: 18,
  },
  {
    id: 'demo-math-10',
    rtc_channel_id: 'sparsh-math-g10-algebra',
    title: 'Grade 10 Mathematics: Linear Equations & Quadratic Formulas',
    subject: 'Mathematics',
    grade: '10',
    teacher_name: 'Dr. Rajesh Kumar',
    status: 'live',
    started_at: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    student_count: 24,
  },
  {
    id: 'demo-env-7',
    rtc_channel_id: 'sparsh-env-g7-ecology',
    title: 'Environmental Studies: Climate Protection & Ecosystems',
    subject: 'EVS',
    grade: '7',
    teacher_name: 'Mrs. Neha Patel',
    status: 'live',
    started_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    student_count: 12,
  },
];

// Rich educational demonstration speech presets covering difficult & useful ISL signs
const TEACHER_SPEECH_PRESETS = [
  {
    label: '🧪 Science Experiment & Atoms',
    text: 'Welcome to science class! Today we will do an experiment on gravity and atoms.',
    hindi: 'विज्ञान कक्षा में आपका स्वागत है! आज हम गुरुत्वाकर्षण और परमाणुओं पर एक प्रयोग करेंगे।',
  },
  {
    label: '📐 Mathematics & Focus',
    text: 'Please concentrate and focus on the mathematics lesson and formulas.',
    hindi: 'कृपया गणित के पाठ और सूत्रों पर ध्यान और एकाग्रता दें।',
  },
  {
    label: '❓ Inquiry & Understanding',
    text: 'Do you understand this question? Who can explain the correct answer?',
    hindi: 'क्या आप इस सवाल को समझते हैं? सही जवाब कौन समझा सकता है?',
  },
  {
    label: '🚨 Emergency & Medical Help',
    text: 'In emergency situations, call the hospital and doctor for quick help.',
    hindi: 'आपातकालीन स्थिति में, तुरंत अस्पताल और डॉक्टर से सहायता लें।',
  },
  {
    label: '🤝 Friends & Teamwork',
    text: 'Hello friends! Together we read, write, learn, and achieve great success.',
    hindi: 'नमस्ते मित्रों! मिलकर हम पढ़ते हैं, लिखते हैं, सीखते हैं और सफलता पाते हैं।',
  },
];

export default function StudentLiveClassPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channelParam = searchParams.get('channel') || '';

  // ── Session & Navigation State ──
  const [activeChannel, setActiveChannel] = useState<string>(channelParam);
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>(DEMO_CLASSES);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);

  // ── Zoom-Style Media & Classroom State ──
  const [micMuted, setMicMuted] = useState(true);
  const [camOff, setCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [handRaiseAlert, setHandRaiseAlert] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'participants' | null>('chat');
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [subtitleLang, setSubtitleLang] = useState<'en' | 'hi'>('en');
  const [avatarSize, setAvatarSize] = useState<'normal' | 'large' | 'hidden'>('normal');
  const [callDuration, setCallDuration] = useState(0);

  // ── Reaction Emojis ──
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // ── Real-Time 3D ISL Avatar & Speech State ──
  const [avatarQueue, setAvatarQueue] = useState<string[]>([]);
  const [isProcessingCaption, setIsProcessingCaption] = useState(false);
  const [currentSubtitleEn, setCurrentSubtitleEn] = useState(
    'Welcome to the live interactive classroom! Listen to the teacher or test signs below.'
  );
  const [currentSubtitleHi, setCurrentSubtitleHi] = useState(
    'लाइव इंटरेक्टिव कक्षा में आपका स्वागत है! शिक्षक को सुनें या नीचे संकेतों का परीक्षण करें।'
  );
  const [activeSignedWord, setActiveSignedWord] = useState<string>('');
  const [customTeacherSpeech, setCustomTeacherSpeech] = useState('');
  const [isSpeakingTts, setIsSpeakingTts] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);

  // ── Chat State ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'Prof. Sunita Sharma', role: 'teacher', text: 'Good morning students! Please open your science notes.', time: '10:02 AM' },
    { id: '2', sender: 'Priya Sharma', role: 'student', text: 'Good morning ma’am! Notes are ready. 👍', time: '10:03 AM' },
    { id: '3', sender: 'System AI', role: 'teacher', text: '🤟 3D ISL Interpreter & Live Bilingual Captions are active.', time: '10:03 AM' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Participants State ──
  const [participants, setParticipants] = useState<Participant[]>([
    { id: 'p-1', name: 'Prof. Sunita Sharma', role: 'teacher', isHost: true, hasAudio: true, hasVideo: true },
    { id: 'p-2', name: 'Aqib Majeed (You)', role: 'student', hasAudio: false, hasVideo: true },
    { id: 'p-3', name: 'Priya Sharma', role: 'student', hasAudio: false, hasVideo: true },
    { id: 'p-4', name: 'Rahul Verma', role: 'student', hasAudio: true, hasVideo: false },
    { id: 'p-5', name: 'Ananya Singh', role: 'student', hasAudio: false, hasVideo: true },
    { id: 'p-6', name: 'Vikram Patel', role: 'student', hasAudio: false, hasVideo: false },
  ]);

  // ── Webcam & Screen Stream Refs ──
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  // ── 1. Fetch User Profile & Live Sessions from Supabase ──
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (prof) {
            setUserProfile(prof);
            setParticipants(prev =>
              prev.map(p => p.id === 'p-2' ? { ...p, name: `${prof.full_name || 'Student'} (You)` } : p)
            );
          }
        }

        // Fetch active live sessions from Supabase
        const { data: sessions } = await supabase
          .from('live_sessions')
          .select('*')
          .eq('status', 'live')
          .order('started_at', { ascending: false });

        if (sessions && sessions.length > 0) {
          // Merge real sessions with demo sessions
          const realWithTeacher = sessions.map((s: any) => ({
            ...s,
            teacher_name: s.teacher_name || 'Class Teacher',
            student_count: Math.floor(Math.random() * 15) + 5,
          }));
          setLiveSessions([...realWithTeacher, ...DEMO_CLASSES]);
        } else {
          setLiveSessions(DEMO_CLASSES);
        }
      } catch (err) {
        console.warn('Error loading live sessions from Supabase:', err);
        setLiveSessions(DEMO_CLASSES);
      } finally {
        setLoadingSessions(false);
      }
    }

    loadData();

    // Subscribe to real-time live session changes
    const ch = supabase
      .channel('student_live_sessions_lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // ── 2. Handle URL Query Param Channel Join ──
  useEffect(() => {
    if (channelParam) {
      setActiveChannel(channelParam);
      const found = liveSessions.find(s => s.rtc_channel_id === channelParam);
      if (found) {
        setActiveSession(found);
      } else {
        // Create custom session metadata for this channel
        setActiveSession({
          id: `room-${channelParam}`,
          rtc_channel_id: channelParam,
          title: `Live Classroom — ${channelParam.replace(/^sparsh-/, '').replace(/-/g, ' ')}`,
          subject: 'Inclusive Live Class',
          grade: '8',
          teacher_name: 'Live Instructor',
          status: 'live',
          started_at: new Date().toISOString(),
          student_count: 14,
        });
      }
    }
  }, [channelParam, liveSessions]);

  // ── 3. Initialize Webcam Stream When in Active Class ──
  useEffect(() => {
    if (!activeChannel) return;

    let localStream: MediaStream | null = null;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        localStream = stream;
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Webcam permission not granted or camera busy:', err);
        setCamOff(true);
      }
    }

    startCamera();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [activeChannel]);

  // ── 4. Call Duration Timer ──
  useEffect(() => {
    if (!activeChannel) return;
    const interval = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeChannel]);

  // Format call duration MM:SS or HH:MM:SS
  const formattedDuration = useCallback(() => {
    const hrs = Math.floor(callDuration / 3600);
    const mins = Math.floor((callDuration % 3600) / 60);
    const secs = callDuration % 60;
    const p = (n: number) => String(n).padStart(2, '0');
    return hrs > 0 ? `${p(hrs)}:${p(mins)}:${p(secs)}` : `${p(mins)}:${p(secs)}`;
  }, [callDuration]);

  // ── 5. Trigger Speech & ISL Signs Engine ──
  const triggerTeacherSpeech = useCallback((text: string, hindiTranslation?: string) => {
    if (!text.trim()) return;

    setCurrentSubtitleEn(text);
    if (hindiTranslation) {
      setCurrentSubtitleHi(hindiTranslation);
    }

    // 1. Convert text to ISL sign tokens using our expanded dictionary
    const signTokens = convertTextToSigns(text);
    setIsProcessingCaption(true);

    if (signTokens.length > 0) {
      setAvatarQueue(prev => {
        // Enqueue fresh sign tokens
        return [...prev, ...signTokens];
      });
      setActiveSignedWord(signTokens[0]);
    }

    // 2. Play audible teacher speech via Web SpeechSynthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.lang = 'en-IN';

      utterance.onstart = () => setIsSpeakingTts(true);
      utterance.onend = () => {
        setIsSpeakingTts(false);
        setIsProcessingCaption(false);
      };
      utterance.onerror = () => {
        setIsSpeakingTts(false);
        setIsProcessingCaption(false);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsProcessingCaption(false), 800);
    }
  }, []);

  // Callback from 3D Avatar when a sign keyframe finishes
  const handleSignComplete = useCallback((completedWord: string) => {
    setAvatarQueue(prev => {
      if (prev.length > 0 && prev[0] === completedWord) {
        const nextQueue = prev.slice(1);
        setActiveSignedWord(nextQueue[0] || '');
        return nextQueue;
      }
      return prev;
    });
  }, []);

  // ── 6. Live Microphone Speech-to-Sign (Web Speech API) ──
  const toggleLiveMicListening = useCallback(() => {
    if (isListeningMic) {
      recognitionRef.current?.stop();
      setIsListeningMic(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Web Speech API is not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => setIsListeningMic(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        if (transcript) {
          triggerTeacherSpeech(transcript);
        }
      };
      recognition.onerror = (err: any) => {
        if (err.error !== 'no-speech') console.warn('Speech recognition error:', err);
      };
      recognition.onend = () => setIsListeningMic(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      setIsListeningMic(false);
    }
  }, [isListeningMic, triggerTeacherSpeech]);

  // ── 7. Toggle Student Camera ──
  const toggleCam = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = camOff; // invert
      }
    }
    setCamOff(!camOff);
    setParticipants(prev =>
      prev.map(p => p.id === 'p-2' ? { ...p, hasVideo: camOff } : p)
    );
  };

  // ── 8. Toggle Student Mic ──
  const toggleMic = () => {
    const nextState = !micMuted;
    setMicMuted(nextState);
    setParticipants(prev =>
      prev.map(p => p.id === 'p-2' ? { ...p, hasAudio: !nextState } : p)
    );
  };

  // ── 9. Toggle Screen Share ──
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        screenStreamRef.current = stream;
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
        };
        setIsScreenSharing(true);
      } catch (err) {
        console.warn('Screen share cancelled or not supported:', err);
      }
    }
  };

  // ── 10. Hand Raise Toggle ──
  const toggleHandRaise = () => {
    const nextState = !handRaised;
    setHandRaised(nextState);
    setParticipants(prev =>
      prev.map(p => p.id === 'p-2' ? { ...p, handRaised: nextState } : p)
    );
    if (nextState) {
      setHandRaiseAlert('✋ You raised your hand! The teacher has been notified.');
      setTimeout(() => setHandRaiseAlert(null), 4000);
      // Auto post to chat
      setChatMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          sender: userProfile?.full_name || 'You',
          role: 'you',
          text: '✋ Raised hand to ask a question.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // ── 11. Send Floating Reaction ──
  const sendReaction = (emoji: string) => {
    const id = String(Date.now() + Math.random());
    const x = Math.floor(Math.random() * 60) + 20; // 20% to 80% horizontal
    setReactions(prev => [...prev, { id, emoji, x }]);
    setShowReactionPicker(false);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 2800);
  };

  // ── 12. Send Chat Message ──
  const sendChatMessage = (textToSend?: string) => {
    const msg = (textToSend || chatInput).trim();
    if (!msg) return;

    const newMessage: ChatMessage = {
      id: String(Date.now()),
      sender: userProfile?.full_name || 'You',
      role: 'you',
      text: msg,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages(prev => [...prev, newMessage]);
    if (!textToSend) setChatInput('');

    // Scroll chat to bottom
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    // Simulated Teacher AI response if asking a question
    if (msg.includes('?') || msg.toLowerCase().includes('repeat') || msg.toLowerCase().includes('experiment')) {
      setTimeout(() => {
        const teacherReply: ChatMessage = {
          id: String(Date.now() + 1),
          sender: 'Prof. Sunita Sharma',
          role: 'teacher',
          text: 'Great question! Notice how the experiment works with atomic gravity. The 3D avatar is demonstrating the sign.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages(prev => [...prev, teacherReply]);
        triggerTeacherSpeech(teacherReply.text);
      }, 1800);
    }
  };

  // ── 13. Join Class Action ──
  const joinClass = (session: LiveSession) => {
    setActiveSession(session);
    setActiveChannel(session.rtc_channel_id);
    router.push(`/student/live-class?channel=${encodeURIComponent(session.rtc_channel_id)}`);
  };

  // ── 14. Leave Classroom Action ──
  const leaveClass = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setActiveChannel('');
    setActiveSession(null);
    setCallDuration(0);
    setIsScreenSharing(false);
    setHandRaised(false);
    router.push('/student/live-class');
  };

  // ══════════════════════════════════════════════════════════════
  // RENDER: LOBBY VIEW (Select or Join a Live Classroom)
  // ══════════════════════════════════════════════════════════════
  if (!activeChannel) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        {/* Header Banner */}
        <div className="glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden border border-red-500/30 bg-gradient-to-r from-red-950/30 via-[#1e1e32]/80 to-[#0f0c29]">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-3 border border-red-500/30">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                Live Student Classroom
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                Join Teacher Live Class
              </h1>
              <p className="text-white/60 text-sm mt-1 max-w-xl">
                Connect directly with your teacher in real time with high-definition video, interactive Zoom controls,
                synchronized bilingual subtitles, and our 3D ISL Sign Language Avatar.
              </p>
            </div>

            {/* Quick Room Code Box */}
            <div className="w-full md:w-auto shrink-0 bg-black/40 border border-white/10 p-3 rounded-2xl flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={e => setJoinCodeInput(e.target.value)}
                placeholder="Enter Channel ID or Room Code..."
                className="px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-white/30 focus:outline-none focus:border-[#6C63FF] w-full sm:w-64"
                onKeyDown={e => {
                  if (e.key === 'Enter' && joinCodeInput.trim()) {
                    joinClass({
                      id: `custom-${joinCodeInput}`,
                      rtc_channel_id: joinCodeInput.trim(),
                      title: `Live Room — ${joinCodeInput}`,
                      subject: 'General Class',
                      grade: '8',
                      teacher_name: 'Online Teacher',
                      status: 'live',
                      started_at: new Date().toISOString(),
                    });
                  }
                }}
              />
              <button
                onClick={() => {
                  if (joinCodeInput.trim()) {
                    joinClass({
                      id: `custom-${joinCodeInput}`,
                      rtc_channel_id: joinCodeInput.trim(),
                      title: `Live Room — ${joinCodeInput}`,
                      subject: 'General Class',
                      grade: '8',
                      teacher_name: 'Online Teacher',
                      status: 'live',
                      started_at: new Date().toISOString(),
                    });
                  }
                }}
                className="px-5 py-2.5 bg-[#6C63FF] hover:bg-[#5b54e6] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
              >
                Join Code →
              </button>
            </div>
          </div>
        </div>

        {/* Active Classes Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-xl font-bold text-white">Active Live Teacher Classes</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                {liveSessions.length} Available
              </span>
            </div>
            <button
              onClick={() => setLoadingSessions(true)}
              className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {liveSessions.map(session => (
              <div
                key={session.id}
                className="glass-card rounded-2xl overflow-hidden border border-white/10 hover:border-red-500/50 transition-all duration-300 flex flex-col group hover:shadow-[0_0_25px_rgba(239,68,68,0.2)]"
              >
                {/* Visual Header */}
                <div className="relative aspect-video bg-gradient-to-br from-[#1e1e32] via-[#0f0c29] to-[#04060c] p-4 flex flex-col justify-between overflow-hidden">
                  <div className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:scale-105 transition-transform duration-500" />
                  <div className="flex items-center justify-between relative z-10">
                    <span className="px-2.5 py-1 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      LIVE NOW
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[#00C9A7] text-[10px] font-bold border border-[#00C9A7]/30">
                      Grade {session.grade} • {session.subject}
                    </span>
                  </div>

                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white/80 text-xs">
                      <Users className="w-3.5 h-3.5 text-[#00C9A7]" />
                      <span>{session.student_count || 14} Students joined</span>
                    </div>
                    <span className="text-xl">🤟</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-white font-bold text-base group-hover:text-red-400 transition leading-snug line-clamp-2">
                      {session.title}
                    </h3>
                    <p className="text-white/50 text-xs mt-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Host: {session.teacher_name || 'Class Teacher'}
                    </p>
                  </div>

                  {/* Feature Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-[#6C63FF]/20 text-[#6C63FF] font-semibold border border-[#6C63FF]/30">
                      3D ISL Avatar
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#00C9A7]/20 text-[#00C9A7] font-semibold border border-[#00C9A7]/30">
                      Subtitles CC
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                      Live Chat
                    </span>
                  </div>

                  {/* Join Button */}
                  <button
                    onClick={() => joinClass(session)}
                    className="w-full py-3 bg-gradient-to-r from-red-600 to-[#6C63FF] hover:from-red-500 hover:to-[#5a52e0] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span>Join Live Classroom</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Information & Accessibility Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="glass-card p-5 rounded-2xl border border-white/5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#6C63FF]/20 text-[#6C63FF] flex items-center justify-center text-xl shrink-0">
              🤟
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">3D Real-Time ISL Interpreter</h4>
              <p className="text-white/50 text-xs mt-1">
                Every sentence spoken by the teacher is converted into authentic 3D Indian Sign Language keyframe gestures.
              </p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-white/5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#00C9A7]/20 text-[#00C9A7] flex items-center justify-center text-xl shrink-0">
              🔤
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Bilingual Live Captions</h4>
              <p className="text-white/50 text-xs mt-1">
                Instant speech-to-text subtitles available in both English and Hindi with active keyword tracking.
              </p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-white/5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center text-xl shrink-0">
              💬
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Zoom-Style Collaboration</h4>
              <p className="text-white/50 text-xs mt-1">
                Real-time interactive chat, screen sharing, raise-hand alerts, and emoji reactions right from your seat.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: ACTIVE CLASSROOM VIEW (The Full Zoom Experience)
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] bg-[#070913] rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
      {/* ── Top Bar ── */}
      <div className="px-4 py-3 bg-[#0d1021]/90 border-b border-white/10 flex items-center justify-between gap-4 shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            LIVE
          </span>
          <div className="min-w-0">
            <h2 className="text-white font-bold text-sm truncate">
              {activeSession?.title || `Classroom: ${activeChannel}`}
            </h2>
            <p className="text-white/40 text-[11px] truncate">
              {activeSession?.teacher_name || 'Host: Prof. Sunita Sharma'} • Grade {activeSession?.grade || '8'} • {formattedDuration()}
            </p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Subtitles Language Toggle */}
          <button
            onClick={() => setSubtitleLang(l => l === 'en' ? 'hi' : 'en')}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-xs font-semibold border border-white/10 transition"
            title="Toggle English / Hindi Captions"
          >
            {subtitleLang === 'en' ? 'EN 🇬🇧' : 'HI 🇮🇳'}
          </button>

          {/* Subtitles CC Toggle */}
          <button
            onClick={() => setShowSubtitles(!showSubtitles)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
              showSubtitles
                ? 'bg-[#00C9A7]/20 text-[#00C9A7] border-[#00C9A7]/40'
                : 'bg-white/5 text-white/40 border-white/10'
            }`}
          >
            CC
          </button>

          {/* Avatar View Toggle */}
          <button
            onClick={() => {
              setAvatarSize(s => s === 'normal' ? 'large' : s === 'large' ? 'hidden' : 'normal');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
              avatarSize !== 'hidden'
                ? 'bg-[#6C63FF]/20 text-[#6C63FF] border-[#6C63FF]/40'
                : 'bg-white/5 text-white/40 border-white/10'
            }`}
            title="Toggle 3D ISL Avatar PIP"
          >
            <span>🤟 Avatar</span>
            <span className="text-[10px] opacity-60 capitalize">({avatarSize})</span>
          </button>

          {/* Leave Button */}
          <button
            onClick={leaveClass}
            className="px-3.5 py-1.5 bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 shadow-lg active:scale-95"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* ── Main Stage Body (Video Screen + Subtitles + Avatar + Sidebar) ── */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Left Video Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-black/60 p-3">
          {/* Hand Raise Alert Banner */}
          {handRaiseAlert && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 bg-amber-500/90 text-black px-4 py-2 rounded-2xl font-bold text-xs shadow-xl animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
              <span>{handRaiseAlert}</span>
            </div>
          )}

          {/* Floating Reactions Canvas */}
          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
            {reactions.map(r => (
              <div
                key={r.id}
                style={{ left: `${r.x}%` }}
                className="absolute bottom-16 text-3xl animate-bounce transition-all duration-1000"
              >
                {r.emoji}
              </div>
            ))}
          </div>

          {/* Video Grid (Teacher Screen + Student Self Preview) */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 relative rounded-2xl overflow-hidden min-h-0">
            {/* Main Stage: Teacher Video or Screen Share */}
            <div className="md:col-span-3 relative rounded-2xl overflow-hidden bg-[#0c0f1d] border border-white/10 flex items-center justify-center shadow-inner group">
              {isScreenSharing ? (
                <div className="w-full h-full relative bg-black flex items-center justify-center">
                  <video
                    ref={screenVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 left-3 px-3 py-1 bg-black/70 backdrop-blur rounded-lg text-xs font-semibold text-white flex items-center gap-2">
                    <ScreenShare className="w-3.5 h-3.5 text-[#00C9A7]" />
                    <span>Screen Share Active</span>
                  </div>
                </div>
              ) : (
                /* Simulated / Real Teacher Stream */
                <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-[#12162e] via-[#0a0d1b] to-[#04060c]">
                  {/* Teacher Avatar Visual with pulsating sound waves */}
                  <div className="flex flex-col items-center gap-4 text-center p-6">
                    <div className="relative">
                      <div className={`w-28 h-28 md:w-36 md:h-36 rounded-full bg-gradient-to-tr from-[#6C63FF] to-[#00C9A7] p-1 shadow-2xl transition-all duration-300 ${
                        isSpeakingTts ? 'ring-8 ring-[#00C9A7]/40 scale-105' : ''
                      }`}>
                        <div className="w-full h-full rounded-full bg-[#1e1e32] flex items-center justify-center text-5xl md:text-6xl overflow-hidden">
                          👩‍🏫
                        </div>
                      </div>
                      {isSpeakingTts && (
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#00C9A7] text-black text-[10px] font-black uppercase tracking-wider animate-pulse shadow-md">
                          Speaking 🎙️
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg md:text-xl">
                        {activeSession?.teacher_name || 'Prof. Sunita Sharma'}
                      </h3>
                      <p className="text-white/50 text-xs mt-0.5">Host & Science Faculty</p>
                    </div>
                  </div>

                  {/* Teacher Stream Badge */}
                  <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-xl text-xs text-white flex items-center gap-2 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-semibold">{activeSession?.teacher_name || 'Teacher'}</span>
                    <span className="text-white/40">| Host</span>
                  </div>
                </div>
              )}

              {/* In-Video 3D ISL Avatar (PIP Mode) */}
              {avatarSize !== 'hidden' && (
                <div
                  className={`absolute z-30 transition-all duration-300 ${
                    avatarSize === 'large'
                      ? 'inset-y-3 right-3 w-72 md:w-84'
                      : 'bottom-4 right-4 w-52 md:w-64 h-72 md:h-84'
                  }`}
                >
                  <div className="w-full h-full rounded-2xl overflow-hidden border border-[#6C63FF]/50 bg-[#070913]/90 shadow-[0_0_30px_rgba(108,99,255,0.3)] backdrop-blur-md flex flex-col">
                    {/* Header bar on avatar */}
                    <div className="px-3 py-1.5 bg-black/60 border-b border-white/10 flex items-center justify-between text-[11px] text-white shrink-0">
                      <div className="flex items-center gap-1.5 font-bold text-[#6C63FF]">
                        <span>🤟</span>
                        <span>3D ISL Interpreter</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setAvatarSize(s => s === 'normal' ? 'large' : 'normal')}
                          className="hover:text-[#00C9A7] transition"
                        >
                          {avatarSize === 'large' ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {/* 3D Canvas */}
                    <div className="flex-1 relative">
                      <SignAvatarOverlay
                        queue={avatarQueue}
                        onSignComplete={handleSignComplete}
                        isProcessing={isProcessingCaption}
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Student Self View & Peers */}
            <div className="md:col-span-1 flex flex-col gap-3 min-h-0">
              {/* Local Student Camera View */}
              <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#0c0f1d] border border-white/10 flex items-center justify-center min-h-[160px]">
                {camOff ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      {userProfile?.full_name ? userProfile.full_name.charAt(0).toUpperCase() : 'AM'}
                    </div>
                    <span className="text-white/40 text-xs">Camera Off</span>
                  </div>
                ) : (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                )}

                {/* Local Badge */}
                <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 bg-black/70 backdrop-blur rounded-lg text-[11px] text-white flex items-center gap-1.5">
                  <span className="font-semibold">{userProfile?.full_name ? `${userProfile.full_name} (You)` : 'You (Student)'}</span>
                  {micMuted ? <span className="text-red-400">🔇</span> : <span className="text-emerald-400">🎙️</span>}
                  {handRaised && <span className="text-xs">✋</span>}
                </div>
              </div>

              {/* Classmate Peer Preview Cards */}
              <div className="h-28 rounded-2xl bg-[#0c0f1d]/70 border border-white/5 p-2 flex gap-2 overflow-x-auto shrink-0 items-center">
                {participants.slice(2, 6).map(peer => (
                  <div
                    key={peer.id}
                    className="w-24 h-full rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center p-1.5 shrink-0 relative"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                      {peer.name.charAt(0)}
                    </div>
                    <span className="text-white text-[10px] font-medium truncate w-full text-center mt-1">
                      {peer.name.split(' ')[0]}
                    </span>
                    <span className="text-white/30 text-[9px]">{peer.hasAudio ? '🎙️' : '🔇'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Real-Time Subtitles & Captions Bar ── */}
          {showSubtitles && (
            <div className="mt-3 px-4 py-3 bg-[#0d1021]/95 border border-white/10 rounded-2xl backdrop-blur-xl shadow-xl flex items-center gap-4 relative z-20">
              <div className="w-9 h-9 rounded-xl bg-[#00C9A7]/20 text-[#00C9A7] flex items-center justify-center text-lg shrink-0 font-bold">
                CC
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[#00C9A7] text-[10px] font-bold uppercase tracking-wider">
                    Live Teacher Speech
                  </span>
                  {activeSignedWord && (
                    <span className="px-2 py-0.2 rounded bg-[#6C63FF]/30 text-[#6C63FF] text-[10px] font-bold">
                      Signing: &quot;{activeSignedWord}&quot;
                    </span>
                  )}
                </div>
                <p className="text-white font-medium text-sm md:text-base leading-snug truncate">
                  &quot;{subtitleLang === 'hi' ? currentSubtitleHi : currentSubtitleEn}&quot;
                </p>
                {subtitleLang === 'en' && currentSubtitleHi && (
                  <p className="text-white/50 text-xs truncate mt-0.5">
                    {currentSubtitleHi}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSubtitleLang(l => l === 'en' ? 'hi' : 'en')}
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs font-medium border border-white/10 shrink-0"
              >
                {subtitleLang === 'en' ? 'Hindi' : 'English'}
              </button>
            </div>
          )}

          {/* ── Interactive Speech Test & Teacher Preset Controller ── */}
          <div className="mt-2.5 p-2.5 bg-black/40 border border-white/5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-white/40 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 mr-1">
                <Volume2 className="w-3.5 h-3.5 text-[#6C63FF]" /> Teacher Voice & Signs:
              </span>
              {TEACHER_SPEECH_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => triggerTeacherSpeech(preset.text, preset.hindi)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#6C63FF]/20 text-white/80 hover:text-white border border-white/10 transition text-[11px] font-medium"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Teacher Speech Input */}
            <div className="flex items-center gap-1.5 w-full md:w-auto">
              <input
                type="text"
                value={customTeacherSpeech}
                onChange={e => setCustomTeacherSpeech(e.target.value)}
                placeholder="Type custom teacher speech..."
                className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-[11px] placeholder-white/30 focus:outline-none focus:border-[#6C63FF] w-48"
                onKeyDown={e => {
                  if (e.key === 'Enter' && customTeacherSpeech.trim()) {
                    triggerTeacherSpeech(customTeacherSpeech);
                    setCustomTeacherSpeech('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (customTeacherSpeech.trim()) {
                    triggerTeacherSpeech(customTeacherSpeech);
                    setCustomTeacherSpeech('');
                  }
                }}
                className="px-2.5 py-1 bg-[#6C63FF] hover:bg-[#5b54e6] text-white rounded-lg font-bold text-[11px] transition shadow"
              >
                Speak & Sign
              </button>
              <button
                onClick={toggleLiveMicListening}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 ${
                  isListeningMic
                    ? 'bg-red-500 text-white border-red-400 animate-pulse'
                    : 'bg-white/5 text-white/70 border-white/10 hover:text-white'
                }`}
                title="Speak into your microphone to generate live ISL signs"
              >
                <Mic className="w-3 h-3" />
                <span>{isListeningMic ? 'Listening...' : 'Live Mic'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Collaboration Drawer (Zoom-Style Chat / Participants) ── */}
        {sidebarTab && (
          <div className="w-80 md:w-88 bg-[#0d1021]/95 border-l border-white/10 flex flex-col shrink-0 z-20">
            {/* Tab Selector */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSidebarTab('chat')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    sidebarTab === 'chat'
                      ? 'bg-[#6C63FF] text-white shadow-md'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  Live Chat
                </button>
                <button
                  onClick={() => setSidebarTab('participants')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    sidebarTab === 'participants'
                      ? 'bg-[#6C63FF] text-white shadow-md'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  Participants ({participants.length})
                </button>
              </div>
              <button
                onClick={() => setSidebarTab(null)}
                className="text-white/40 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            {/* TAB 1: LIVE CHAT */}
            {sidebarTab === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                  {chatMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`rounded-2xl p-3 text-xs leading-relaxed ${
                        msg.role === 'you'
                          ? 'bg-[#6C63FF]/25 border border-[#6C63FF]/30 ml-4'
                          : msg.role === 'teacher'
                          ? 'bg-red-500/10 border border-red-500/20 mr-4'
                          : 'bg-white/5 border border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold ${
                          msg.role === 'teacher' ? 'text-red-400' : msg.role === 'you' ? 'text-[#00C9A7]' : 'text-white/80'
                        }`}>
                          {msg.sender}
                        </span>
                        <span className="text-[10px] text-white/30">{msg.time}</span>
                      </div>
                      <p className="text-white/90">{msg.text}</p>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>

                {/* Quick Reply Chips */}
                <div className="px-3 py-1.5 border-t border-white/5 flex gap-1.5 overflow-x-auto text-[11px] shrink-0">
                  {[
                    'Understood! 👍',
                    'Please repeat ✋',
                    'Great lesson! 👏',
                    'Show signs again 🤟',
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendChatMessage(chip)}
                      className="px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white whitespace-nowrap transition"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Chat Input */}
                <div className="p-3 border-t border-white/10 flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Type a message to class..."
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-white/30 focus:outline-none focus:border-[#6C63FF]"
                    onKeyDown={e => {
                      if (e.key === 'Enter') sendChatMessage();
                    }}
                  />
                  <button
                    onClick={() => sendChatMessage()}
                    className="p-2 bg-[#6C63FF] hover:bg-[#5b54e6] text-white rounded-xl transition shadow active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: PARTICIPANTS */}
            {sidebarTab === 'participants' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                {participants.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition border border-white/5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        p.isHost ? 'bg-red-500 text-white' : 'bg-[#6C63FF] text-white'
                      }`}>
                        {p.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-xs font-semibold truncate flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {p.isHost && (
                            <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 text-[9px] font-bold">
                              Host
                            </span>
                          )}
                        </p>
                        <span className="text-[10px] text-white/40 capitalize">{p.role}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {p.handRaised && <span title="Hand Raised">✋</span>}
                      <span title={p.hasAudio ? 'Mic On' : 'Mic Off'}>
                        {p.hasAudio ? '🎙️' : '🔇'}
                      </span>
                      <span title={p.hasVideo ? 'Video On' : 'Video Off'}>
                        {p.hasVideo ? '📹' : '🚫'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Zoom Bottom Control Dock ── */}
      <div className="px-4 py-3 bg-[#0a0d1b] border-t border-white/10 flex items-center justify-between gap-3 shrink-0 z-30 flex-wrap">
        {/* Left: Audio & Video Toggles */}
        <div className="flex items-center gap-2">
          {/* Mute/Unmute */}
          <button
            onClick={toggleMic}
            className={`flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold transition ${
              micMuted
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-white/10 text-emerald-400 hover:bg-white/15'
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="mt-0.5">{micMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Start/Stop Video */}
          <button
            onClick={toggleCam}
            className={`flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold transition ${
              camOff
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-white/10 text-emerald-400 hover:bg-white/15'
            }`}
          >
            {camOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            <span className="mt-0.5">{camOff ? 'Start Video' : 'Stop Video'}</span>
          </button>
        </div>

        {/* Center: Interactive Collaboration Controls */}
        <div className="flex items-center gap-2">
          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold transition ${
              isScreenSharing
                ? 'bg-[#00C9A7]/20 text-[#00C9A7]'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <ScreenShare className="w-4 h-4" />
            <span className="mt-0.5">Share</span>
          </button>

          {/* Raise Hand */}
          <button
            onClick={toggleHandRaise}
            className={`flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold transition ${
              handRaised
                ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Hand className="w-4 h-4" />
            <span className="mt-0.5">{handRaised ? 'Lower Hand' : 'Raise Hand'}</span>
          </button>

          {/* Reactions */}
          <div className="relative">
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition"
            >
              <Smile className="w-4 h-4" />
              <span className="mt-0.5">React</span>
            </button>

            {/* Reaction Picker Popover */}
            {showReactionPicker && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-[#1e1e32] border border-white/20 p-2 rounded-2xl shadow-2xl flex gap-2 z-50 animate-in fade-in zoom-in-95">
                {['👍', '👏', '❤️', '🎉', '💡', '🤟'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    className="text-2xl hover:scale-125 transition-transform p-1 rounded-lg hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chat Toggle */}
          <button
            onClick={() => setSidebarTab(t => t === 'chat' ? null : 'chat')}
            className={`flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold transition relative ${
              sidebarTab === 'chat'
                ? 'bg-[#6C63FF]/30 text-[#6C63FF]'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="mt-0.5">Chat</span>
            {chatMessages.length > 3 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#6C63FF]" />
            )}
          </button>

          {/* Participants Toggle */}
          <button
            onClick={() => setSidebarTab(t => t === 'participants' ? null : 'participants')}
            className={`flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold transition ${
              sidebarTab === 'participants'
                ? 'bg-[#6C63FF]/30 text-[#6C63FF]'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="mt-0.5">Peers</span>
          </button>
        </div>

        {/* Right: End Call Button */}
        <div>
          <button
            onClick={leaveClass}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition shadow-lg flex items-center gap-1.5 active:scale-95"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}
