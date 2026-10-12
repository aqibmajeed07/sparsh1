'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { convertTextToSigns } from '@/lib/isl/textToSigns';
import {
  Mic, MicOff, Video, VideoOff, ScreenShare, Hand, Smile,
  MessageSquare, Users, PhoneOff, Send, Volume2,
  Maximize2, Minimize2, RefreshCw, ChevronRight, AlertCircle,
  Radio, Check
} from 'lucide-react';

// Dynamically import 3D ISL Avatar (WebGL canvas requires client-side only)
const SignAvatarOverlay = dynamic(
  () => import('@/components/live/SignAvatarOverlay'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0f0c29]/80 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="flex flex-col items-center gap-3">
          <span className="w-9 h-9 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
          <span className="text-white/60 text-xs font-medium">Loading 3D ISL Avatar...</span>
        </div>
      </div>
    ),
  }
);

// Dynamically import Daily.co Real-Time Multi-Party Video
const DailyCall = dynamic(
  () => import('@/components/live/DailyCall'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#070913] text-white gap-3 rounded-2xl">
        <div className="w-10 h-10 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
        <p className="text-white/60 text-xs font-medium">Connecting to Live Video Grid…</p>
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
  role: 'teacher' | 'student' | 'system' | 'you';
  text: string;
  time: string;
}

interface Participant {
  id: string;
  participant_id?: string;
  name: string;
  role: 'teacher' | 'student';
  is_host?: boolean;
  has_audio: boolean;
  has_video: boolean;
  hand_raised?: boolean;
}

// Educational demonstration speech presets for teacher speech and sign testing
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

/**
 * Extracts and sanitizes clean channel ID even if the user pasted a full URL or space-separated string
 * e.g., "https://www.spaarsh.online/student/live class?channel=sparsh mathematics g8 63031"
 * -> "sparsh-mathematics-g8-63031"
 */
function sanitizeChannelId(input: string): string {
  if (!input) return '';
  let str = input.trim();
  if (str.includes('channel=')) {
    const after = str.substring(str.indexOf('channel=') + 8);
    str = after.split('&')[0];
  }
  try {
    str = decodeURIComponent(str);
  } catch (_) {}
  // Clean whitespace, convert spaces to hyphens, remove duplicate dashes
  str = str.trim().replace(/\s+/g, '-').replace(/-+/g, '-').toLowerCase();
  return str;
}

export default function StudentLiveClassPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawChannel = searchParams.get('channel') || '';
  const initialChannel = sanitizeChannelId(rawChannel);

  // ── Session & Navigation State ──
  const [activeChannel, setActiveChannel] = useState<string>(initialChannel);
  const [dailyRoomUrl, setDailyRoomUrl] = useState<string>('');
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
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

  // ── Floating Reactions ──
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // ── Real-Time 3D ISL Avatar & Speech State ──
  const [avatarQueue, setAvatarQueue] = useState<string[]>([]);
  const [isProcessingCaption, setIsProcessingCaption] = useState(false);
  const [currentSubtitleEn, setCurrentSubtitleEn] = useState(
    'Connected to live classroom. Real-time subtitles and 3D ISL Avatar are active.'
  );
  const [currentSubtitleHi, setCurrentSubtitleHi] = useState(
    'लाइव कक्षा से जुड़े। रीयल-टाइम उपशीर्षक और 3डी आईएसएल अवतार सक्रिय हैं।'
  );
  const [activeSignedWord, setActiveSignedWord] = useState<string>('');
  const [customTeacherSpeech, setCustomTeacherSpeech] = useState('');
  const [isSpeakingTts, setIsSpeakingTts] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);

  // ── Real-Time Chat & Participants State (NO MOCK DATA) ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Stream & WebSocket Refs ──
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);

  // ── 1. Load User Profile ──
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (prof) setUserProfile(prof);
        }
      } catch (e) {
        console.warn('Could not load profile:', e);
      }
    }
    loadProfile();
  }, []);

  // ── 2. Fetch Active Live Classes from Real Backend / Database (NO MOCK DATA) ──
  const fetchActiveClasses = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const now = Date.now();
      // 1. Try real backend endpoint
      const res = await fetch('/api/live-classes/active', { cache: 'no-store' }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data.classes && Array.isArray(data.classes)) {
          const fresh = data.classes.filter((c: any) => {
            if (!c.started_at) return true;
            return (now - new Date(c.started_at).getTime()) < 8 * 3600 * 1000;
          });
          setLiveSessions(fresh);
          setLoadingSessions(false);
          return;
        }
      }

      // 2. Fallback: Supabase direct query
      const { data: dbSessions } = await supabase
        .from('live_sessions')
        .select('*')
        .eq('status', 'live')
        .order('started_at', { ascending: false });

      if (dbSessions && dbSessions.length > 0) {
        const fresh = dbSessions.filter((c: any) => {
          if (!c.started_at) return true;
          return (now - new Date(c.started_at).getTime()) < 8 * 3600 * 1000;
        });
        setLiveSessions(fresh);
      } else {
        setLiveSessions([]);
      }
    } catch (err) {
      console.warn('Could not fetch active live classes:', err);
      setLiveSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveClasses();

    // Subscribe to Supabase real-time updates for live_sessions table
    const channel = supabase
      .channel('realtime_live_sessions_table')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => {
        fetchActiveClasses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActiveClasses]);

  // ── 3. Handle Active Room Details & Joining ──
  useEffect(() => {
    const cleanChan = sanitizeChannelId(rawChannel);
    if (!cleanChan) {
      setActiveChannel('');
      setDailyRoomUrl('');
      setActiveSession(null);
      return;
    }

    setActiveChannel(cleanChan);

    async function loadRoomDetails() {
      // Resolve Daily.co Room URL
      fetch(`/api/live?room=${encodeURIComponent(cleanChan)}`)
        .then(r => r.json())
        .then(d => {
          if (d?.url) setDailyRoomUrl(d.url);
          else setDailyRoomUrl(`https://edsign.daily.co/${cleanChan}`);
        })
        .catch(() => {
          setDailyRoomUrl(`https://edsign.daily.co/${cleanChan}`);
        });

      try {
        // Fetch session info from real backend
        const res = await fetch(`/api/live-classes/${cleanChan}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            setActiveSession(data.session);
            if (data.session.recording_url) setDailyRoomUrl(data.session.recording_url);
            return;
          }
        }

        // Direct Supabase fallback
        const { data: dbSess } = await supabase
          .from('live_sessions')
          .select('*')
          .eq('rtc_channel_id', cleanChan)
          .maybeSingle();

        if (dbSess) {
          setActiveSession(dbSess);
          if (dbSess.recording_url) setDailyRoomUrl(dbSess.recording_url);
        } else {
          // Clean title formatted from channel name
          const cleanTitle = cleanChan.replace(/^sparsh-/, '').replace(/-/g, ' ').toUpperCase();
          setActiveSession({
            id: `session-${cleanChan}`,
            rtc_channel_id: cleanChan,
            title: `Live Class: ${cleanTitle}`,
            subject: 'Inclusive Class',
            grade: '8',
            teacher_name: 'Live Instructor',
            status: 'live',
            started_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('Error loading room details:', err);
      }
    }

    loadRoomDetails();
  }, [rawChannel]);

  // ── 4. Connect to Real-Time WebSocket & Room Channels ──
  useEffect(() => {
    if (!activeChannel) return;

    // Join room on backend
    const studentId = userProfile?.id || `student-${Date.now()}`;
    const studentName = userProfile?.full_name || 'Student';

    fetch(`/api/live-classes/${activeChannel}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: studentId,
        name: studentName,
        role: 'student',
        has_audio: !micMuted,
        has_video: !camOff,
      }),
    }).catch(() => {});

    // Fetch real chat history
    fetch(`/api/live-classes/${activeChannel}/chat`)
      .then(res => res.json())
      .then(data => {
        if (data.messages && Array.isArray(data.messages)) {
          setChatMessages(data.messages);
        }
      })
      .catch(() => {});

    // Fetch real participants
    fetch(`/api/live-classes/${activeChannel}/participants`)
      .then(res => res.json())
      .then(data => {
        if (data.participants && Array.isArray(data.participants)) {
          setParticipants(data.participants);
        }
      })
      .catch(() => {});

    // 1. Universal Supabase Realtime Broadcast Channel (works across all devices over WSS)
    const rtChannel = supabase.channel(`live_room_${activeChannel}`, {
      config: { broadcast: { self: false } }
    });

    const handleRoomEvent = (payload: any) => {
      if (payload.type === 'NEW_MESSAGE' && payload.message) {
        setChatMessages(prev => {
          if (prev.some(m => m.id === payload.message.id || (m.text === payload.message.text && m.sender === payload.message.sender))) return prev;
          return [...prev, payload.message];
        });
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      } else if (payload.type === 'TEACHER_SPEECH' && payload.speech) {
        // Teacher spoke! Update subtitles & trigger 3D Avatar signs
        const s = payload.speech;
        if (s.text) {
          setCurrentSubtitleEn(s.text);
          if (s.hindi) setCurrentSubtitleHi(s.hindi);

          const tokens = s.sign_tokens && s.sign_tokens.length > 0 
            ? s.sign_tokens 
            : convertTextToSigns(s.text);

          if (tokens.length > 0) {
            setAvatarQueue(prev => [...prev, ...tokens]);
            setActiveSignedWord(tokens[0]);
          }

          // Speak aloud via TTS
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(s.text);
            utter.rate = 0.95;
            utter.lang = 'en-IN';
            window.speechSynthesis.speak(utter);
          }
        }
      } else if (payload.type === 'REACTION' && payload.reaction) {
        const rx = Math.floor(Math.random() * 60) + 20;
        setReactions(prev => [...prev, { id: String(Date.now() + Math.random()), emoji: payload.reaction.emoji, x: rx }]);
        setTimeout(() => {
          setReactions(prev => prev.slice(1));
        }, 2500);
      } else if (payload.type === 'HAND_RAISE' && payload.data) {
        setHandRaiseAlert(`✋ ${payload.data.name} ${payload.data.raised ? 'raised hand' : 'lowered hand'}`);
        setTimeout(() => setHandRaiseAlert(null), 3500);
        setParticipants(prev =>
          prev.map(p => p.id === payload.data.participant_id ? { ...p, hand_raised: payload.data.raised } : p)
        );
      } else if (payload.type === 'PARTICIPANT_JOINED' && payload.participant) {
        setParticipants(prev => {
          const exists = prev.find(p => p.id === payload.participant.id);
          return exists ? prev : [...prev, payload.participant];
        });
      } else if (payload.type === 'PARTICIPANT_LEFT') {
        setParticipants(prev => prev.filter(p => p.id !== payload.participant_id));
      } else if (payload.type === 'SESSION_ENDED') {
        alert('The teacher has ended this live session.');
        router.push('/student/live-class');
      }
    };

    rtChannel
      .on('broadcast', { event: 'LIVE_EVENT' }, ({ payload }) => {
        handleRoomEvent(payload);
      })
      .on('broadcast', { event: 'NEW_MESSAGE' }, ({ payload }) => {
        handleRoomEvent({ type: 'NEW_MESSAGE', message: payload });
      })
      .on('broadcast', { event: 'TEACHER_SPEECH' }, ({ payload }) => {
        handleRoomEvent(payload);
      })
      .on('broadcast', { event: 'REACTION' }, ({ payload }) => {
        handleRoomEvent({ type: 'REACTION', reaction: payload });
      })
      .on('broadcast', { event: 'HAND_RAISE' }, ({ payload }) => {
        handleRoomEvent({ type: 'HAND_RAISE', data: payload });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          rtChannel.send({
            type: 'broadcast',
            event: 'LIVE_EVENT',
            payload: {
              type: 'PARTICIPANT_JOINED',
              participant: {
                id: studentId,
                name: studentName,
                role: 'student',
                has_audio: !micMuted,
                has_video: !camOff
              }
            }
          });
        }
      });

    // 2. Connect to local WebSocket ONLY if on local HTTP development (never on HTTPS to prevent Mixed Content)
    let ws: WebSocket | null = null;
    const isLocal = typeof window !== 'undefined' &&
      window.location.protocol === 'http:' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (isLocal) {
      try {
        ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/live-class/${activeChannel}`);
        wsRef.current = ws;
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            handleRoomEvent(payload);
          } catch (_) {}
        };
      } catch (_) {}
    }

    // 3. Periodic chat poll as resilient fallback
    const pollInterval = setInterval(() => {
      fetch(`/api/live-classes/${activeChannel}/chat`)
        .then(res => res.json())
        .then(data => {
          if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            setChatMessages(data.messages);
          }
        })
        .catch(() => {});
    }, 4000);

    return () => {
      supabase.removeChannel(rtChannel);
      clearInterval(pollInterval);
      if (ws) ws.close();
      // Leave room on backend
      fetch(`/api/live-classes/${activeChannel}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_id: studentId, name: studentName }),
      }).catch(() => {});
    };
  }, [activeChannel, userProfile, router, micMuted, camOff]);

  // ── 5. Initialize Local Camera Preview ──
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
        setCamOff(true);
      }
    }

    startCamera();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [activeChannel]);

  // ── 6. Call Duration Timer ──
  useEffect(() => {
    if (!activeChannel) return;
    const interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [activeChannel]);

  const formattedDuration = useCallback(() => {
    const hrs = Math.floor(callDuration / 3600);
    const mins = Math.floor((callDuration % 3600) / 60);
    const secs = callDuration % 60;
    const p = (n: number) => String(n).padStart(2, '0');
    return hrs > 0 ? `${p(hrs)}:${p(mins)}:${p(secs)}` : `${p(mins)}:${p(secs)}`;
  }, [callDuration]);

  // ── 7. Speech-to-Sign & Broadcast Function ──
  const broadcastTeacherSpeech = useCallback(async (text: string, hindiTranslation?: string) => {
    if (!text.trim() || !activeChannel) return;

    setCurrentSubtitleEn(text);
    if (hindiTranslation) setCurrentSubtitleHi(hindiTranslation);

    const signTokens = convertTextToSigns(text);
    setIsProcessingCaption(true);

    if (signTokens.length > 0) {
      setAvatarQueue(prev => [...prev, ...signTokens]);
      setActiveSignedWord(signTokens[0]);
    }

    // Broadcast to backend & WebSocket so all connected peers receive speech & signs
    try {
      await fetch(`/api/live-classes/${activeChannel}/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          hindi: hindiTranslation || '',
          speaker: userProfile?.full_name || 'Instructor',
          sign_tokens: signTokens,
        }),
      });
    } catch (_) {}

    // Audio TTS playback
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.lang = 'en-IN';
      utter.onstart = () => setIsSpeakingTts(true);
      utter.onend = () => {
        setIsSpeakingTts(false);
        setIsProcessingCaption(false);
      };
      window.speechSynthesis.speak(utter);
    } else {
      setTimeout(() => setIsProcessingCaption(false), 800);
    }
  }, [activeChannel, userProfile]);

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

  // ── 8. Live Mic Speech-to-Text ──
  const toggleLiveMic = useCallback(() => {
    if (isListeningMic) {
      recognitionRef.current?.stop();
      setIsListeningMic(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Live speech recognition requires Google Chrome or Microsoft Edge.');
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-IN';

      rec.onstart = () => setIsListeningMic(true);
      rec.onresult = (ev: any) => {
        const transcript = ev.results[ev.results.length - 1][0].transcript;
        if (transcript) broadcastTeacherSpeech(transcript);
      };
      rec.onerror = () => setIsListeningMic(false);
      rec.onend = () => setIsListeningMic(false);

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      setIsListeningMic(false);
    }
  }, [isListeningMic, broadcastTeacherSpeech]);

  // ── 9. Media Toggles ──
  const toggleCam = () => {
    if (localStreamRef.current) {
      const vTrack = localStreamRef.current.getVideoTracks()[0];
      if (vTrack) vTrack.enabled = camOff;
    }
    setCamOff(!camOff);
  };

  const toggleMic = () => {
    setMicMuted(!micMuted);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = stream;
        if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
        stream.getVideoTracks()[0].onended = () => setIsScreenSharing(false);
        setIsScreenSharing(true);
      } catch (_) {}
    }
  };

  const toggleHandRaise = async () => {
    const nextState = !handRaised;
    setHandRaised(nextState);
    const pId = userProfile?.id || `student-${Date.now()}`;
    const pName = userProfile?.full_name || 'You';

    if (activeChannel) {
      try {
        const channel = supabase.channel(`live_room_${activeChannel}`);
        channel.send({
          type: 'broadcast',
          event: 'HAND_RAISE',
          payload: { participant_id: pId, name: pName, raised: nextState }
        });
      } catch (_) {}

      fetch(`/api/live-classes/${activeChannel}/hand-raise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: pId,
          name: pName,
          raised: nextState,
        }),
      }).catch(() => {});
    }
  };

  const sendReaction = async (emoji: string) => {
    setShowReactionPicker(false);
    if (!activeChannel) return;

    const rx = Math.floor(Math.random() * 60) + 20;
    setReactions(prev => [...prev, { id: String(Date.now() + Math.random()), emoji, x: rx }]);
    setTimeout(() => setReactions(prev => prev.slice(1)), 2500);

    try {
      const channel = supabase.channel(`live_room_${activeChannel}`);
      channel.send({
        type: 'broadcast',
        event: 'REACTION',
        payload: { emoji, sender: userProfile?.full_name || 'Student' }
      });
    } catch (_) {}

    fetch(`/api/live-classes/${activeChannel}/reaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji, sender: userProfile?.full_name || 'Student' }),
    }).catch(() => {});
  };

  // ── 10. Send Real Chat Message ──
  const sendChatMessage = async (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text || !activeChannel) return;

    const senderName = userProfile?.full_name || 'You';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!textToSend) setChatInput('');

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: senderName,
      role: 'student',
      text,
      time: timeStr,
    };

    setChatMessages(prev => [...prev, newMsg]);
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const channel = supabase.channel(`live_room_${activeChannel}`);
      channel.send({
        type: 'broadcast',
        event: 'NEW_MESSAGE',
        payload: newMsg
      });
    } catch (_) {}

    try {
      await fetch(`/api/live-classes/${activeChannel}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: senderName,
          role: 'student',
          text,
          time: timeStr,
        }),
      });
    } catch (_) {}
  };

  const leaveClass = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    window.speechSynthesis?.cancel();
    setActiveChannel('');
    setActiveSession(null);
    setCallDuration(0);
    setChatMessages([]);
    setParticipants([]);
    router.push('/student/live-class');
  };

  // ══════════════════════════════════════════════════════════════
  // VIEW 1: LOBBY (Real Database Live Sessions — NO MOCK DATA)
  // ══════════════════════════════════════════════════════════════
  if (!activeChannel) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        {/* Header Card */}
        <div className="glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden border border-red-500/30 bg-gradient-to-r from-red-950/40 via-[#1e1e32]/80 to-[#0f0c29]">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-3 border border-red-500/30">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                Live Student Classroom
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                Live Teacher Sessions
              </h1>
              <p className="text-white/60 text-sm mt-1 max-w-xl">
                Real-time live video classrooms with real backend synchronization, live bilingual captions, and 3D Indian Sign Language Avatar.
              </p>
            </div>

            {/* Quick Room Code Input */}
            <div className="w-full md:w-auto shrink-0 bg-black/40 border border-white/10 p-3 rounded-2xl flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={e => setJoinCodeInput(e.target.value)}
                placeholder="Enter Channel ID or Room Code..."
                className="px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder-white/30 focus:outline-none focus:border-[#6C63FF] w-full sm:w-64"
                onKeyDown={e => {
                  if (e.key === 'Enter' && joinCodeInput.trim()) {
                    const clean = sanitizeChannelId(joinCodeInput);
                    router.push(`/student/live-class?channel=${encodeURIComponent(clean)}`);
                  }
                }}
              />
              <button
                onClick={() => {
                  if (joinCodeInput.trim()) {
                    const clean = sanitizeChannelId(joinCodeInput);
                    router.push(`/student/live-class?channel=${encodeURIComponent(clean)}`);
                  }
                }}
                className="px-5 py-2.5 bg-[#6C63FF] hover:bg-[#5b54e6] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
              >
                Join Room →
              </button>
            </div>
          </div>
        </div>

        {/* Live Classes Grid (Loaded From Real Database) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-xl font-bold text-white">Active Live Teacher Classes</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                {liveSessions.length} Live
              </span>
            </div>
            <button
              onClick={fetchActiveClasses}
              className="text-xs text-white/40 hover:text-white flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loadingSessions ? (
            <div className="py-16 text-center glass-card rounded-2xl">
              <span className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin inline-block" />
              <p className="text-white/40 text-xs mt-3">Connecting to database and checking active rooms...</p>
            </div>
          ) : liveSessions.length === 0 ? (
            /* Clean Empty State When No Teacher Is Live (NO MOCK DATA) */
            <div className="glass-card rounded-2xl p-10 text-center border border-white/5 space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center text-3xl mx-auto">
                <Radio className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">No Live Classes In Session</h3>
                <p className="text-white/50 text-xs max-w-md mx-auto mt-1">
                  There are currently no active teacher classes streaming. As soon as your teacher starts a live session in the Teacher Studio, it will automatically appear here in real time.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={fetchActiveClasses}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold rounded-xl border border-white/10 transition"
                >
                  🔄 Check Again
                </button>
                <button
                  onClick={() => {
                    const practiceChannel = `sparsh-practice-classroom-${Date.now().toString().slice(-4)}`;
                    router.push(`/student/live-class?channel=${practiceChannel}`);
                  }}
                  className="px-5 py-2 bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white text-xs font-bold rounded-xl shadow-lg transition hover:opacity-90"
                >
                  Enter Practice Classroom 🤟
                </button>
              </div>
            </div>
          ) : (
            /* Real Database Live Classes */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {liveSessions.map(session => (
                <div
                  key={session.id}
                  className="glass-card rounded-2xl overflow-hidden border border-white/10 hover:border-red-500/50 transition-all duration-300 flex flex-col group hover:shadow-[0_0_25px_rgba(239,68,68,0.2)]"
                >
                  <div className="p-4 bg-gradient-to-br from-[#1e1e32] via-[#0f0c29] to-[#04060c] flex items-center justify-between border-b border-white/5">
                    <span className="px-2.5 py-1 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      LIVE
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-black/60 text-[#00C9A7] text-[10px] font-bold border border-[#00C9A7]/30">
                      Grade {session.grade} • {session.subject}
                    </span>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-white font-bold text-base group-hover:text-red-400 transition leading-snug">
                        {session.title}
                      </h3>
                      <p className="text-white/50 text-xs mt-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Host: {session.teacher_name || 'Class Instructor'}
                      </p>
                      <p className="text-white/30 text-[10px] font-mono mt-1 truncate">
                        ID: {session.rtc_channel_id}
                      </p>
                    </div>

                    <button
                      onClick={() => router.push(`/student/live-class?channel=${encodeURIComponent(session.rtc_channel_id)}`)}
                      className="w-full py-3 bg-gradient-to-r from-red-600 to-[#6C63FF] hover:from-red-500 hover:to-[#5a52e0] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 active:scale-95"
                    >
                      <span>Join Live Classroom</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // VIEW 2: ACTIVE LIVE CLASSROOM (Zoom UI with Real Realtime Data)
  // ══════════════════════════════════════════════════════════════
  const displayTitle = activeSession?.title || activeChannel.replace(/^sparsh-/, '').replace(/-/g, ' ').toUpperCase();
  const displaySubject = activeSession?.subject || 'Live Class';
  const displayGrade = activeSession?.grade || '8';
  const displayTeacher = activeSession?.teacher_name || 'Class Instructor';

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] bg-[#070913] rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
      {/* ── Top Bar with Clean Real Metadata ── */}
      <div className="px-4 py-3 bg-[#0d1021]/90 border-b border-white/10 flex items-center justify-between gap-4 shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            LIVE
          </span>
          <div className="min-w-0">
            <h2 className="text-white font-bold text-sm truncate">
              {displayTitle}
            </h2>
            <p className="text-white/40 text-[11px] truncate">
              {displayTeacher} • Grade {displayGrade} • {displaySubject} • {formattedDuration()}
            </p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSubtitleLang(l => l === 'en' ? 'hi' : 'en')}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-xs font-semibold border border-white/10 transition"
            title="Toggle English / Hindi Captions"
          >
            {subtitleLang === 'en' ? 'EN 🇬🇧' : 'HI 🇮🇳'}
          </button>

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

          <button
            onClick={() => setAvatarSize(s => s === 'normal' ? 'large' : s === 'large' ? 'hidden' : 'normal')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
              avatarSize !== 'hidden'
                ? 'bg-[#6C63FF]/20 text-[#6C63FF] border-[#6C63FF]/40'
                : 'bg-white/5 text-white/40 border-white/10'
            }`}
          >
            <span>🤟 Avatar</span>
            <span className="text-[10px] opacity-60 capitalize">({avatarSize})</span>
          </button>

          <button
            onClick={leaveClass}
            className="px-3.5 py-1.5 bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 shadow-lg active:scale-95"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* ── Main Stage Area ── */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        <div className="flex-1 flex flex-col relative overflow-hidden bg-black/60 p-3">
          {handRaiseAlert && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 bg-amber-500/95 text-black px-4 py-2 rounded-2xl font-bold text-xs shadow-xl animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
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

          {/* Main Stage: Daily.co Real-Time Multi-Party Video Grid */}
          <div className="flex-1 relative rounded-2xl overflow-hidden min-h-0 bg-[#070913] border border-white/10 shadow-2xl">
            {dailyRoomUrl ? (
              <DailyCall
                roomUrl={dailyRoomUrl}
                captionsEnabled={showSubtitles}
                islEnabled={avatarSize !== 'hidden'}
                userName={userProfile?.full_name ? `${userProfile.full_name} (Student)` : 'Student'}
                onLeave={() => {
                  setActiveChannel('');
                  router.push('/student/live-class');
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#070913] text-white gap-3">
                <span className="w-10 h-10 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
                <p className="text-white/60 text-xs font-medium">Connecting to Daily.co Live Classroom…</p>
              </div>
            )}

            {/* In-Video 3D ISL Avatar (PIP Mode) */}
            {avatarSize !== 'hidden' && (
              <div
                className={`absolute z-30 transition-all duration-300 pointer-events-auto ${
                  avatarSize === 'large'
                    ? 'bottom-4 right-4 w-72 md:w-84 h-80 md:h-96'
                    : 'bottom-4 right-4 w-52 md:w-64 h-64 md:h-80'
                }`}
              >
                <div className="w-full h-full rounded-2xl overflow-hidden border border-[#6C63FF]/50 bg-[#070913]/90 shadow-[0_0_30px_rgba(108,99,255,0.3)] backdrop-blur-md flex flex-col">
                  <div className="px-3 py-1.5 bg-black/60 border-b border-white/10 flex items-center justify-between text-[11px] text-white shrink-0">
                    <div className="flex items-center gap-1.5 font-bold text-[#6C63FF]">
                      <span>🤟</span>
                      <span>3D ISL Interpreter</span>
                    </div>
                    <button
                      onClick={() => setAvatarSize(s => s === 'normal' ? 'large' : 'normal')}
                      className="hover:text-[#00C9A7] transition"
                    >
                      {avatarSize === 'large' ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    </button>
                  </div>
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

          {/* ── Teacher Voice & Sign Controller Bar ── */}
          <div className="mt-2.5 p-2.5 bg-black/40 border border-white/5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-white/40 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 mr-1">
                <Volume2 className="w-3.5 h-3.5 text-[#6C63FF]" /> Teacher Voice & Signs:
              </span>
              {TEACHER_SPEECH_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => broadcastTeacherSpeech(preset.text, preset.hindi)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#6C63FF]/20 text-white/80 hover:text-white border border-white/10 transition text-[11px] font-medium"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Speech Input */}
            <div className="flex items-center gap-1.5 w-full md:w-auto">
              <input
                type="text"
                value={customTeacherSpeech}
                onChange={e => setCustomTeacherSpeech(e.target.value)}
                placeholder="Broadcast teacher speech..."
                className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-[11px] placeholder-white/30 focus:outline-none focus:border-[#6C63FF] w-48"
                onKeyDown={e => {
                  if (e.key === 'Enter' && customTeacherSpeech.trim()) {
                    broadcastTeacherSpeech(customTeacherSpeech);
                    setCustomTeacherSpeech('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (customTeacherSpeech.trim()) {
                    broadcastTeacherSpeech(customTeacherSpeech);
                    setCustomTeacherSpeech('');
                  }
                }}
                className="px-2.5 py-1 bg-[#6C63FF] hover:bg-[#5b54e6] text-white rounded-lg font-bold text-[11px] transition shadow"
              >
                Speak & Sign
              </button>
              <button
                onClick={toggleLiveMic}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 ${
                  isListeningMic
                    ? 'bg-red-500 text-white border-red-400 animate-pulse'
                    : 'bg-white/5 text-white/70 border-white/10 hover:text-white'
                }`}
                title="Speak into microphone to generate live ISL signs"
              >
                <Mic className="w-3 h-3" />
                <span>{isListeningMic ? 'Listening...' : 'Live Mic'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Collaboration Drawer (Real Chat & Real Participants) ── */}
        {sidebarTab && (
          <div className="w-80 md:w-88 bg-[#0d1021]/95 border-l border-white/10 flex flex-col shrink-0 z-20">
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
                  Live Chat ({chatMessages.length})
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

            {/* TAB 1: REAL CHAT */}
            {sidebarTab === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-12 text-white/30 text-xs">
                      No chat messages yet. Start the conversation!
                    </div>
                  ) : (
                    chatMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`rounded-2xl p-3 text-xs leading-relaxed ${
                          msg.sender === (userProfile?.full_name || 'You')
                            ? 'bg-[#6C63FF]/25 border border-[#6C63FF]/30 ml-4'
                            : msg.role === 'teacher'
                            ? 'bg-red-500/10 border border-red-500/20 mr-4'
                            : msg.role === 'system'
                            ? 'bg-white/5 border border-white/5 text-white/50 italic text-center'
                            : 'bg-white/5 border border-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-bold ${
                            msg.role === 'teacher' ? 'text-red-400' : 'text-[#00C9A7]'
                          }`}>
                            {msg.sender}
                          </span>
                          <span className="text-[10px] text-white/30">{msg.time}</span>
                        </div>
                        <p className="text-white/90">{msg.text}</p>
                      </div>
                    ))
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Quick Reply Chips */}
                <div className="px-3 py-1.5 border-t border-white/5 flex gap-1.5 overflow-x-auto text-[11px] shrink-0">
                  {['Understood! 👍', 'Please repeat ✋', 'Great lesson! 👏', 'Show signs 🤟'].map((chip, idx) => (
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
                    placeholder="Type a real-time message..."
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

            {/* TAB 2: REAL PARTICIPANTS */}
            {sidebarTab === 'participants' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                {participants.length === 0 ? (
                  <div className="text-center py-10 text-white/30 text-xs">
                    Connecting to participant channel...
                  </div>
                ) : (
                  participants.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          p.role === 'teacher' ? 'bg-red-500 text-white' : 'bg-[#6C63FF] text-white'
                        }`}>
                          {p.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-xs font-semibold truncate flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {p.role === 'teacher' && (
                              <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 text-[9px] font-bold">
                                Host
                              </span>
                            )}
                          </p>
                          <span className="text-[10px] text-white/40 capitalize">{p.role}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        {p.hand_raised && <span>✋</span>}
                        <span>{p.has_audio ? '🎙️' : '🔇'}</span>
                        <span>{p.has_video ? '📹' : '🚫'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Zoom Bottom Dock ── */}
      <div className="px-4 py-3 bg-[#0a0d1b] border-t border-white/10 flex items-center justify-between gap-3 shrink-0 z-30 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMic}
            className={`flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold transition ${
              micMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-emerald-400'
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="mt-0.5">{micMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            onClick={toggleCam}
            className={`flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold transition ${
              camOff ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-emerald-400'
            }`}
          >
            {camOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            <span className="mt-0.5">{camOff ? 'Start Video' : 'Stop Video'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleScreenShare}
            className={`flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold transition ${
              isScreenSharing ? 'bg-[#00C9A7]/20 text-[#00C9A7]' : 'bg-white/5 text-white/70 hover:text-white'
            }`}
          >
            <ScreenShare className="w-4 h-4" />
            <span className="mt-0.5">Share</span>
          </button>

          <button
            onClick={toggleHandRaise}
            className={`flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold transition ${
              handRaised ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50' : 'bg-white/5 text-white/70 hover:text-white'
            }`}
          >
            <Hand className="w-4 h-4" />
            <span className="mt-0.5">{handRaised ? 'Lower Hand' : 'Raise Hand'}</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold bg-white/5 text-white/70 hover:text-white transition"
            >
              <Smile className="w-4 h-4" />
              <span className="mt-0.5">React</span>
            </button>

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

          <button
            onClick={() => setSidebarTab(t => t === 'chat' ? null : 'chat')}
            className={`flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold transition relative ${
              sidebarTab === 'chat' ? 'bg-[#6C63FF]/30 text-[#6C63FF]' : 'bg-white/5 text-white/70 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="mt-0.5">Chat</span>
            {chatMessages.length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#6C63FF]" />
            )}
          </button>

          <button
            onClick={() => setSidebarTab(t => t === 'participants' ? null : 'participants')}
            className={`flex flex-col items-center justify-center w-14 py-1.5 rounded-xl text-[10px] font-semibold transition ${
              sidebarTab === 'participants' ? 'bg-[#6C63FF]/30 text-[#6C63FF]' : 'bg-white/5 text-white/70 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="mt-0.5">Peers</span>
          </button>
        </div>

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
