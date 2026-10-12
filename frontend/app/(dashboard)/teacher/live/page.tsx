'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

const AgoraCall = dynamic(() => import('@/components/live/AgoraCall'), { ssr: false });

export default function TeacherLivePage() {
  const [isLive, setIsLive] = useState(false);
  const [captionEnabled, setCaptionEnabled] = useState(true);
  const [islEnabled, setIslEnabled] = useState(true);
  const [sessionTitle, setSessionTitle] = useState('Mathematics — Linear Equations');
  const [sessionGrade, setSessionGrade] = useState('8');
  const [sessionSubject, setSessionSubject] = useState('Mathematics');
  const [channelName, setChannelName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied] = useState<'link' | 'channel' | null>(null);
  const [chatMessages, setChatMessages] = useState<{ user: string; message: string }[]>([
    { user: 'System', message: 'Session started. Share the join link with your students.' },
  ]);

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

    // 1. Universal Supabase Realtime Broadcast (instant multi-device sync, zero mixed-content)
    const rtChannel = supabase.channel(`live_room_${channelName}`, {
      config: { broadcast: { self: false } }
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

    // 3. Connect to local WebSocket ONLY if running on local HTTP development (never on HTTPS to prevent Mixed Content)
    let ws: WebSocket | null = null;
    const isLocal = typeof window !== 'undefined' &&
      window.location.protocol === 'http:' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (isLocal) {
      try {
        ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/live-class/${channelName}`);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'NEW_MESSAGE' && data.message) {
              setChatMessages(prev => {
                if (prev.some(m => m.message === data.message.text && m.user === data.message.sender)) return prev;
                return [...prev, { user: data.message.sender, message: data.message.text }];
              });
            }
          } catch (_) {}
        };
      } catch (_) {}
    }

    // 4. Polling fallback every 4s
    const pollInterval = setInterval(() => {
      fetch(`/api/live-classes/${channelName}/chat`)
        .then(r => r.json())
        .then(d => {
          if (d.messages && d.messages.length > 0) {
            setChatMessages(d.messages.map((m: any) => ({ user: m.sender, message: m.text })));
          }
        })
        .catch(() => {});
    }, 4000);

    return () => {
      supabase.removeChannel(rtChannel);
      if (ws) ws.close();
      clearInterval(pollInterval);
    };
  }, [isLive, channelName]);

  const startLiveClass = async () => {
    const name = `sparsh-${sessionSubject.replace(/\s+/g, '').toLowerCase()}-g${sessionGrade}-${Date.now().toString().slice(-5)}`;
    setChannelName(name);

    // 1. Create on real Backend API
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
          institution_id: profile?.institution_id || null
        })
      });
      if (res.ok) {
        const body = await res.json();
        if (body.session?.id) setSessionId(body.session.id);
      }
    } catch (e) {
      console.warn('Backend live class create fallback:', e);
    }

    // 2. Broadcast to Supabase — only include existing columns to avoid 400 Bad Request
    try {
      const sessPayload: Record<string, any> = {
        rtc_channel_id: name,
        title: sessionTitle,
        subject: sessionSubject,
        grade: sessionGrade,
        status: 'live',
        caption_enabled: captionEnabled,
        isl_enabled: islEnabled,
        started_at: new Date().toISOString()
      };
      // Only set teacher_id if it's a valid UUID
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
          payload: { type: 'SESSION_ENDED', channel_id: channelName }
        });
      } catch (_) {}
    }
    if (sessionId) {
      await supabase.from('live_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', sessionId);
    }
    setIsLive(false);
    setSessionId(null);
  };

  const sendTeacherMessage = async (text: string) => {
    if (!text.trim() || !channelName) return;
    const sender = profile?.full_name || 'Teacher (Host)';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(m => [...m, { user: 'You', message: text }]);

    // 1. Universal Supabase Realtime broadcast (delivers to phones, tablets, and any other device instantly)
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
          time: timeStr
        }
      });
    } catch (_) {}

    // 2. Also persist to backend API
    try {
      await fetch(`/api/live-classes/${channelName}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: sender,
          role: 'teacher',
          text: text,
          time: timeStr
        })
      });
    } catch (_) {}
  };

  const getJoinLink = () => `${window.location.origin}/student/live-class?channel=${encodeURIComponent(channelName)}`;

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

  if (isLive && channelName) {
    return (
      <div className="flex flex-col h-[calc(100vh-2rem)] gap-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white">{sessionTitle}</h1>
            <p className="text-white/50 text-sm">Grade {sessionGrade} • {sessionSubject}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setCaptionEnabled(v => !v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${captionEnabled ? 'bg-[#00C9A7]/20 text-[#00C9A7]' : 'bg-white/5 text-white/40'}`}>CC</button>
            <button onClick={() => setIslEnabled(v => !v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${islEnabled ? 'bg-[#6C63FF]/20 text-[#6C63FF]' : 'bg-white/5 text-white/40'}`}>🤟</button>
            <button onClick={endSession} className="px-4 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition">End Session</button>
          </div>
        </div>

        {/* Share Banner */}
        <div className="glass-card p-4 shrink-0 border border-[#6C63FF]/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm mb-1">📤 Share with Students</p>
              <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 font-mono text-xs text-white/60 overflow-hidden">
                <span className="truncate">{typeof window !== 'undefined' ? getJoinLink() : ''}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={copyLink} className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${copied === 'link' ? 'bg-[#00C9A7] text-black' : 'bg-[#6C63FF] text-white hover:bg-[#5b54e6]'}`}>
                {copied === 'link' ? '✓ Copied!' : '🔗 Copy Link'}
              </button>
              <button onClick={copyChannel} className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${copied === 'channel' ? 'bg-[#00C9A7] text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                {copied === 'channel' ? '✓ Done!' : '📋 Channel ID'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 gap-4 min-h-0">
          <div className="glass-card overflow-hidden flex-1 min-h-[380px] lg:min-h-0">
            <AgoraCall
              channelName={channelName}
              captionsEnabled={captionEnabled}
              islEnabled={islEnabled}
              userName="Teacher"
              onLeave={() => setIsLive(false)}
            />
          </div>

          <div className="glass-card p-4 flex flex-col w-full lg:w-72 shrink-0 max-h-[320px] lg:max-h-none">
            <h3 className="text-white font-semibold text-sm mb-3 shrink-0">Live Chat</h3>
            <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-0">
              {chatMessages.map((msg, i) => (
                <div key={i} className="bg-white/5 rounded-xl p-2.5">
                  <span className="text-[#6C63FF] text-xs font-medium">{msg.user}</span>
                  <p className="text-white/80 text-xs mt-1">{msg.message}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 shrink-0">
              <input
                id="teacher-chat-input"
                placeholder="Message class..."
                className="glass-input flex-1 text-xs py-2"
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
                className="px-3 py-2 bg-[#6C63FF] hover:bg-[#5b54e6] text-white rounded-xl text-xs transition"
              >→</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Live Class</h1>
        <p className="text-white/60 mt-1">Real-time video sessions powered by Sparsh Live Engine</p>
      </div>

      <div className="glass-card p-6 max-w-2xl">
        <h3 className="text-white font-semibold mb-5">Configure Your Session</h3>
        <div className="mb-5 flex items-start gap-3 p-4 bg-[#6C63FF]/10 border border-[#6C63FF]/20 rounded-xl">
          <span className="text-2xl mt-0.5">⚡</span>
          <div>
            <p className="text-[#6C63FF] font-semibold text-sm">Sparsh Live Engine — High-performance video</p>
            <p className="text-white/50 text-xs">Ultra-low latency video • Designed for accessibility • Unlimited usage</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-white/80 text-sm mb-1 block">Session Title</label>
            <input className="glass-input w-full" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/80 text-sm mb-1 block">Subject</label>
              <select className="glass-input w-full bg-transparent appearance-none" value={sessionSubject} onChange={e => setSessionSubject(e.target.value)}>
                {['Mathematics', 'Science', 'History', 'Hindi', 'Biology', 'Physics'].map(s => (
                  <option key={s} value={s} className="bg-[#24243e]">{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white/80 text-sm mb-1 block">Grade</label>
              <select className="glass-input w-full bg-transparent appearance-none" value={sessionGrade} onChange={e => setSessionGrade(e.target.value)}>
                {['6', '7', '8', '9', '10', '11', '12'].map(g => (
                  <option key={g} value={g} className="bg-[#24243e]">Grade {g}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-white/80 text-sm cursor-pointer">
              <input type="checkbox" checked={captionEnabled} onChange={() => setCaptionEnabled(v => !v)} className="w-4 h-4 accent-[#6C63FF]" />
              Enable Live Captions
            </label>
            <label className="flex items-center gap-2 text-white/80 text-sm cursor-pointer">
              <input type="checkbox" checked={islEnabled} onChange={() => setIslEnabled(v => !v)} className="w-4 h-4 accent-[#6C63FF]" />
              Enable ISL Overlay
            </label>
          </div>
        </div>

        <button onClick={startLiveClass} className="mt-5 w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 text-lg">
          <span className="w-3 h-3 rounded-full bg-white animate-pulse" /> Go Live Now
        </button>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-white font-semibold mb-3">Past Sessions</h3>
        {pastSessions.length === 0 ? (
          <div className="py-6 text-center text-white/40 text-xs">
            No completed sessions recorded yet. Completed classes will appear here automatically.
          </div>
        ) : (
          <div className="space-y-3">
            {pastSessions.map((s, i) => (
              <div key={s.id || i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 rounded-xl gap-2">
                <div>
                  <p className="text-white font-medium text-sm">{s.title}</p>
                  <p className="text-white/40 text-xs">
                    Grade {s.grade} • {s.subject} • {s.started_at ? new Date(s.started_at).toLocaleDateString() : 'Recent'}
                  </p>
                </div>
                <span className="px-3 py-1 bg-white/5 text-white/50 rounded-lg text-xs self-start sm:self-center">Ended</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
