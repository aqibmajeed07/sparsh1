'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import {
  Radio, Users, MessageSquare, Copy, Check, ExternalLink,
  Volume2, Send, ShieldCheck, Sparkles, BookOpen, Clock
} from 'lucide-react';

const DailyCall = dynamic(() => import('@/components/live/DailyCall'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#070913] text-white gap-3 rounded-2xl">
      <div className="w-10 h-10 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      <p className="text-white/60 text-xs font-medium">Initializing Daily Live Engine…</p>
    </div>
  ),
});

const QUICK_TEACHER_PROMPTS = [
  'Welcome to class! Let us begin today\'s lesson.',
  'Please focus on the screen for this important formula.',
  'Does anyone have a question on this topic? Raise your hand.',
  'Great job everyone! Let us review the key points.',
];

export default function TeacherLivePage() {
  const [isLive, setIsLive] = useState(false);
  const [dailyRoomUrl, setDailyRoomUrl] = useState('');
  const [captionEnabled, setCaptionEnabled] = useState(true);
  const [islEnabled, setIslEnabled] = useState(true);
  const [sessionTitle, setSessionTitle] = useState('Mathematics — Linear Equations');
  const [sessionGrade, setSessionGrade] = useState('8');
  const [sessionSubject, setSessionSubject] = useState('Mathematics');
  const [channelName, setChannelName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied] = useState<'link' | 'channel' | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ user: string; message: string }[]>([
    { user: 'System', message: 'Session ready. Share the student join link to start.' },
  ]);
  const [speechBroadcast, setSpeechBroadcast] = useState('');
  const [pastSessions, setPastSessions] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data);
    });

    // Load real past sessions from Supabase
    supabase
      .from('live_sessions')
      .select('*')
      .eq('status', 'ended')
      .order('started_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPastSessions(data);
        } else {
          setPastSessions([]);
        }
      });
  }, [isLive]);

  // Connect real-time chat & Universal Supabase Broadcast sync
  useEffect(() => {
    if (!isLive || !channelName) return;

    // 1. Universal Supabase Realtime Broadcast
    const rtChannel = supabase.channel(`live_room_${channelName}`, {
      config: { broadcast: { self: false } },
    });

    rtChannel
      .on('broadcast', { event: 'NEW_MESSAGE' }, ({ payload }) => {
        if (payload?.text) {
          setChatMessages(prev => {
            if (prev.some(m => m.message === payload.text && m.user === payload.sender)) return prev;
            return [...prev, { user: payload.sender || 'Student', message: payload.text }];
          });
        }
      })
      .on('broadcast', { event: 'LIVE_EVENT' }, ({ payload }) => {
        if (payload?.type === 'NEW_MESSAGE' && payload.message) {
          const msg = payload.message;
          setChatMessages(prev => {
            if (prev.some(m => m.message === msg.text && m.user === msg.sender)) return prev;
            return [...prev, { user: msg.sender || 'Student', message: msg.text }];
          });
        }
      })
      .subscribe();

    // 2. Load initial chat history from backend if available
    fetch(`/api/live-classes/${channelName}/chat`)
      .then(r => r.json())
      .then(d => {
        if (d.messages && d.messages.length > 0) {
          setChatMessages(d.messages.map((m: any) => ({ user: m.sender, message: m.text })));
        }
      })
      .catch(() => {});

    return () => {
      supabase.removeChannel(rtChannel);
    };
  }, [isLive, channelName]);

  const startLiveClass = async () => {
    setIsCreatingRoom(true);
    const cleanSubj = sessionSubject.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'general';
    const name = `sparsh-${cleanSubj}-g${sessionGrade}-${Date.now().toString().slice(-5)}`;
    setChannelName(name);

    // 1. Create real Daily room via /api/live
    let roomUrl = `https://edsign.daily.co/${name}`;
    try {
      const dailyRes = await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: name, sessionTitle }),
      });
      if (dailyRes.ok) {
        const dData = await dailyRes.json();
        if (dData.url) {
          roomUrl = dData.url;
        }
      }
    } catch (e) {
      console.warn('Daily room creation fallback to direct url:', e);
    }
    setDailyRoomUrl(roomUrl);

    // 2. Register on real Backend API
    try {
      const res = await fetch('/api/live-classes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rtc_channel_id: name,
          title: sessionTitle,
          subject: sessionSubject,
          grade: sessionGrade,
          teacher_id: profile?.id || null,
          teacher_name: profile?.full_name || 'Teacher',
          institution_id: profile?.institution_id || null,
        }),
      });
      if (res.ok) {
        const body = await res.json();
        if (body.session?.id) setSessionId(body.session.id);
      }
    } catch (e) {
      console.warn('Backend live class create fallback:', e);
    }

    // 3. Save to Supabase live_sessions table
    try {
      const sessPayload: Record<string, any> = {
        rtc_channel_id: name,
        recording_url: roomUrl,
        title: sessionTitle,
        subject: sessionSubject,
        grade: sessionGrade,
        status: 'live',
        caption_enabled: captionEnabled,
        isl_enabled: islEnabled,
        started_at: new Date().toISOString(),
      };
      if (profile?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.id)) {
        sessPayload.teacher_id = profile.id;
      }
      if (profile?.institution_id) {
        sessPayload.institution_id = profile.institution_id;
      }

      const { data, error } = await supabase.from('live_sessions').insert(sessPayload).select().single();
      if (data && !error) setSessionId(data.id);
    } catch (e) {
      console.warn('Supabase session insert fallback:', e);
    }

    setIsCreatingRoom(false);
    setIsLive(true);
  };

  const endSession = async () => {
    if (channelName) {
      try {
        await fetch(`/api/live-classes/${channelName}/end`, { method: 'POST' });
      } catch (_) {}
      try {
        const channel = supabase.channel(`live_room_${channelName}`);
        channel.send({
          type: 'broadcast',
          event: 'LIVE_EVENT',
          payload: { type: 'SESSION_ENDED', channel_id: channelName },
        });
      } catch (_) {}
    }
    if (sessionId) {
      await supabase
        .from('live_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', sessionId);
    }
    setIsLive(false);
    setDailyRoomUrl('');
    setSessionId(null);
  };

  const sendTeacherMessage = async (text: string) => {
    if (!text.trim() || !channelName) return;
    const sender = profile?.full_name ? `${profile.full_name} (Teacher)` : 'Teacher (Host)';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(m => [...m, { user: 'You', message: text }]);

    try {
      const channel = supabase.channel(`live_room_${channelName}`);
      channel.send({
        type: 'broadcast',
        event: 'NEW_MESSAGE',
        payload: {
          id: `msg-${Date.now()}`,
          sender: sender,
          role: 'teacher',
          text: text,
          time: timeStr,
        },
      });
    } catch (_) {}

    try {
      await fetch(`/api/live-classes/${channelName}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: sender,
          role: 'teacher',
          text: text,
          time: timeStr,
        }),
      });
    } catch (_) {}
  };

  const broadcastSpeech = (text: string) => {
    if (!text.trim() || !channelName) return;
    try {
      const channel = supabase.channel(`live_room_${channelName}`);
      channel.send({
        type: 'broadcast',
        event: 'LIVE_EVENT',
        payload: {
          type: 'TEACHER_SPEECH',
          speech: {
            text: text.trim(),
            speaker: profile?.full_name || 'Teacher',
            timestamp: new Date().toISOString(),
          },
        },
      });
      // Also post to chat so students have written record
      sendTeacherMessage(`🎙️ "${text.trim()}"`);
      setSpeechBroadcast('');
    } catch (e) {
      console.warn('Speech broadcast error:', e);
    }
  };

  const getJoinLink = () => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/student/live-class?channel=${encodeURIComponent(channelName)}`;
  };

  const copyLink = () => {
    navigator.clipboard.writeText(getJoinLink());
    setCopied('link');
    setTimeout(() => setCopied(null), 3000);
  };

  const copyChannel = () => {
    navigator.clipboard.writeText(channelName);
    setCopied('channel');
    setTimeout(() => setCopied(null), 3000);
  };

  // ═════════════════════════════════════════════════
  // ACTIVE LIVE STUDIO VIEW (POWERED BY DAILY.CO)
  // ═════════════════════════════════════════════════
  if (isLive && dailyRoomUrl) {
    return (
      <div className="flex flex-col h-[calc(100vh-5.5rem)] gap-3">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 bg-[#0f0c29]/70 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <h1 className="text-lg font-bold text-white tracking-tight">{sessionTitle}</h1>
            </div>
            <p className="text-white/50 text-xs mt-0.5">
              Grade {sessionGrade} • {sessionSubject} • Daily.co Video Grid
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCaptionEnabled(v => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                captionEnabled
                  ? 'bg-[#00C9A7]/20 text-[#00C9A7] border-[#00C9A7]/40'
                  : 'bg-white/5 text-white/40 border-white/10'
              }`}
            >
              CC Captions {captionEnabled ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setIslEnabled(v => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                islEnabled
                  ? 'bg-[#6C63FF]/20 text-[#6C63FF] border-[#6C63FF]/40'
                  : 'bg-white/5 text-white/40 border-white/10'
              }`}
            >
              🤟 3D ISL {islEnabled ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={endSession}
              className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-red-500/25 active:scale-95"
            >
              End Session
            </button>
          </div>
        </div>

        {/* Share Banner for Students */}
        <div className="glass-card p-3 shrink-0 border border-[#6C63FF]/30 bg-gradient-to-r from-[#6C63FF]/10 via-[#00C9A7]/5 to-transparent">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1">
                <span>📤 Student Join Link</span>
                <span className="text-white/40 font-normal">(Students on mobile or PC connect instantly)</span>
              </div>
              <div className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 font-mono text-xs text-emerald-300 truncate">
                {getJoinLink()}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={copyLink}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  copied === 'link'
                    ? 'bg-[#00C9A7] text-black'
                    : 'bg-[#6C63FF] hover:bg-[#5b54e6] text-white shadow-md'
                }`}
              >
                {copied === 'link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'link' ? 'Copied!' : 'Copy Link'}</span>
              </button>
              <button
                onClick={copyChannel}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  copied === 'channel'
                    ? 'bg-[#00C9A7] text-black'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                {copied === 'channel' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Channel Code</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Stage Grid: Daily Video on Left, Teacher Controls on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 gap-3 min-h-0">
          {/* Main Video Stage (Daily.co HD 2-Way Video Call) */}
          <div className="lg:col-span-8 xl:col-span-9 h-full min-h-[420px] rounded-2xl overflow-hidden relative shadow-2xl">
            <DailyCall
              roomUrl={dailyRoomUrl}
              captionsEnabled={captionEnabled}
              islEnabled={islEnabled}
              userName={profile?.full_name ? `${profile.full_name} (Teacher)` : 'Teacher (Host)'}
              isHost={true}
              onLeave={endSession}
            />
          </div>

          {/* Right Column: Broadcast to 3D Avatar + Live Chat */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3 h-full min-h-0">
            {/* Quick Speech / ISL Broadcaster */}
            <div className="glass-card p-3 shrink-0 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Volume2 className="w-3.5 h-3.5 text-[#00C9A7]" />
                <span>Broadcast to 3D Avatar & CC</span>
              </div>
              <p className="text-[11px] text-white/50 leading-tight">
                Any text sent here immediately signs in 3D ISL and updates captions for students.
              </p>
              <div className="flex gap-1.5">
                <input
                  value={speechBroadcast}
                  onChange={e => setSpeechBroadcast(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') broadcastSpeech(speechBroadcast);
                  }}
                  placeholder="Type speech for 3D Avatar..."
                  className="glass-input flex-1 text-xs py-1.5"
                />
                <button
                  onClick={() => broadcastSpeech(speechBroadcast)}
                  disabled={!speechBroadcast.trim()}
                  className="px-3 py-1.5 bg-[#00C9A7] hover:bg-[#00b894] disabled:opacity-40 text-black font-bold rounded-xl text-xs transition"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Prompt Pills */}
              <div className="flex flex-wrap gap-1 mt-1">
                {QUICK_TEACHER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => broadcastSpeech(prompt)}
                    className="text-[10px] bg-white/5 hover:bg-white/10 text-white/70 px-2 py-0.5 rounded-md text-left transition truncate max-w-full"
                    title={prompt}
                  >
                    💬 {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Chat Panel */}
            <div className="glass-card p-3 flex flex-col flex-1 min-h-[220px]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-2 shrink-0">
                <MessageSquare className="w-3.5 h-3.5 text-[#6C63FF]" />
                <span>Classroom Chat</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1 min-h-0 text-xs">
                {chatMessages.map((msg, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-2 border border-white/5">
                    <span className="text-[#6C63FF] font-semibold text-[11px] block">{msg.user}</span>
                    <p className="text-white/90 text-xs mt-0.5 break-words">{msg.message}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <input
                  id="teacher-chat-input"
                  placeholder="Chat with students..."
                  className="glass-input flex-1 text-xs py-1.5"
                  onKeyDown={e => {
                    const input = e.target as HTMLInputElement;
                    if (e.key === 'Enter' && input.value.trim()) {
                      sendTeacherMessage(input.value.trim());
                      input.value = '';
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('teacher-chat-input') as HTMLInputElement;
                    if (input && input.value.trim()) {
                      sendTeacherMessage(input.value.trim());
                      input.value = '';
                    }
                  }}
                  className="px-3 py-1.5 bg-[#6C63FF] hover:bg-[#5b54e6] text-white rounded-xl text-xs transition"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════
  // PRE-SESSION SETUP / DASHBOARD VIEW
  // ═════════════════════════════════════════════════
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold uppercase tracking-wider">
            Live Studio
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-[#6C63FF]/20 text-[#6C63FF] border border-[#6C63FF]/30 text-xs font-bold">
            Daily.co HD Multi-Peer
          </span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mt-2 tracking-tight">
          Live Interactive Class
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Stream two-way HD video to students on any device with integrated 3D ISL Avatar and live captions.
        </p>
      </div>

      <div className="glass-card p-6 border border-white/15">
        <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#00C9A7]" />
          <span>Classroom Setup</span>
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-white/80 text-xs font-semibold mb-1 block">Lesson Title</label>
            <input
              className="glass-input w-full text-sm"
              value={sessionTitle}
              onChange={e => setSessionTitle(e.target.value)}
              placeholder="e.g. Science — Photosynthesis & Energy"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-white/80 text-xs font-semibold mb-1 block">Subject</label>
              <select
                className="glass-input w-full bg-slate-900 text-sm"
                value={sessionSubject}
                onChange={e => setSessionSubject(e.target.value)}
              >
                {['Mathematics', 'Science', 'Social Studies', 'English', 'Hindi', 'Physics', 'Biology', 'Chemistry'].map(s => (
                  <option key={s} value={s} className="bg-slate-900 text-white">
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white/80 text-xs font-semibold mb-1 block">Grade / Standard</label>
              <select
                className="glass-input w-full bg-slate-900 text-sm"
                value={sessionGrade}
                onChange={e => setSessionGrade(e.target.value)}
              >
                {['6', '7', '8', '9', '10', '11', '12'].map(g => (
                  <option key={g} value={g} className="bg-slate-900 text-white">
                    Grade {g} (Class {g})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-6 flex-wrap pt-2">
            <label className="flex items-center gap-2 text-white/90 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={captionEnabled}
                onChange={() => setCaptionEnabled(v => !v)}
                className="w-4 h-4 accent-[#00C9A7] rounded"
              />
              <span className="font-medium">Enable Live Captions (Hindi/English)</span>
            </label>
            <label className="flex items-center gap-2 text-white/90 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={islEnabled}
                onChange={() => setIslEnabled(v => !v)}
                className="w-4 h-4 accent-[#6C63FF] rounded"
              />
              <span className="font-medium">Enable 3D ISL Avatar for Deaf Students</span>
            </label>
          </div>
        </div>

        <button
          onClick={startLiveClass}
          disabled={isCreatingRoom}
          className="mt-6 w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2.5 text-base shadow-xl shadow-red-500/25 active:scale-95 disabled:opacity-50"
        >
          {isCreatingRoom ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Creating Daily.co Room…</span>
            </>
          ) : (
            <>
              <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
              <span>Go Live Now (Start Video Class)</span>
            </>
          )}
        </button>
      </div>

      {/* Past Sessions List */}
      <div className="glass-card p-6 border border-white/10">
        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-white/50" />
          <span>Recently Concluded Sessions</span>
        </h3>
        {pastSessions.length === 0 ? (
          <div className="py-6 text-center text-white/40 text-xs">
            No completed sessions recorded yet. Completed classes will appear here automatically.
          </div>
        ) : (
          <div className="space-y-2.5">
            {pastSessions.map((s, i) => (
              <div
                key={s.id || i}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white/5 rounded-xl gap-2 border border-white/5"
              >
                <div>
                  <p className="text-white font-semibold text-sm">{s.title}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    Grade {s.grade} • {s.subject} • {s.started_at ? new Date(s.started_at).toLocaleDateString() : 'Recent'}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-white/5 text-white/50 rounded-lg text-xs self-start sm:self-center font-medium">
                  Ended
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
