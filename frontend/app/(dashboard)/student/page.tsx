'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function StudentDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [recentLessons, setRecentLessons] = useState<any[]>([]);
  const [liveSession, setLiveSession] = useState<any>(null);
  const [stats, setStats] = useState({ lessonsTotal: 0, streak: 0, signHours: 0, lessonsDone: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channels: any[] = [];
    let isMounted = true;

    // Hard timeout — if data takes > 8s, stop loading and show what we have
    const timeout = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 8000);

    async function load() {
      try {
        setLoading(true);

        // getSession() reads from localStorage — instant, no network needed
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (user && isMounted) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, full_name, role, total_lessons_done, streak_days, total_sign_hours')
            .eq('id', user.id)
            .single();

          if (prof && isMounted) {
            setProfile(prof);
            setStats({
              lessonsTotal: prof.total_lessons_done ?? 0,
              streak: prof.streak_days ?? 0,
              signHours: Math.round(prof.total_sign_hours ?? 0),
              lessonsDone: prof.total_lessons_done ?? 0,
            });
          }

          // Real-time profile updates
          const profileCh = supabase.channel('realtime_student_profile')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload: any) => {
              if (!isMounted) return;
              const updatedProf = payload.new;
              setProfile(updatedProf);
              setStats({
                lessonsTotal: updatedProf.total_lessons_done ?? 0,
                streak: updatedProf.streak_days ?? 0,
                signHours: Math.round(updatedProf.total_sign_hours ?? 0),
                lessonsDone: updatedProf.total_lessons_done ?? 0,
              });
            }).subscribe();
          channels.push(profileCh);
        }

        // Fetch recent lessons
        const fetchLessons = async () => {
          try {
            const { data: lessons } = await supabase
              .from('lessons')
              .select('id, title, subject, chapter, grade, board, thumbnail_url, tags, duration_seconds')
              .order('created_at', { ascending: false })
              .limit(3);
            if (lessons && lessons.length > 0 && isMounted) {
              setRecentLessons(lessons);
            } else if (isMounted) {
              setRecentLessons([]);
            }
          } catch {
            if (isMounted) setRecentLessons([]);
          }
        };
        await fetchLessons();

        const lessonsCh = supabase.channel('realtime_student_lessons')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'lessons' }, () => {
            fetchLessons();
          }).subscribe();
        channels.push(lessonsCh);

        // Check for live sessions
        try {
          const { data: session } = await supabase
            .from('live_sessions')
            .select('*')
            .eq('status', 'live')
            .limit(1)
            .maybeSingle();
          if (session && isMounted) setLiveSession(session);
        } catch { /* ignore */ }

        const liveCh = supabase.channel('realtime_student_live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, (payload: any) => {
            if (!isMounted) return;
            if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new.status === 'live') {
              setLiveSession(payload.new);
            } else if (payload.new?.status !== 'live') {
              setLiveSession(null);
            }
          }).subscribe();
        channels.push(liveCh);

      } catch (err) {
        console.error('[StudentDashboard] load error:', err);
      } finally {
        clearTimeout(timeout);
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
      clearTimeout(timeout);
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, []);


  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const vibrate = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50); // slight tap haptic
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {greeting()}, {profile?.full_name || 'Aqib Majeed'} 👋
          </h1>
          <p className="text-white/60 text-xs sm:text-sm mt-0.5">Ready to learn something new today?</p>
        </div>
        <div className="flex gap-1.5 sm:gap-2 bg-[#1e1e32]/50 p-1.5 sm:p-2 rounded-xl backdrop-blur-md border border-white/10 shrink-0">
          <button className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[#6C63FF]/20 text-[#6C63FF] text-xs sm:text-sm font-semibold">ISL</button>
          <button className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg hover:bg-white/5 text-white/70 text-xs sm:text-sm font-medium transition">Captions</button>
          <button className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg hover:bg-white/5 text-white/70 text-xs sm:text-sm font-medium transition">TTS</button>
        </div>
      </div>

      {/* Live Class in Progress Alert Banner */}
      {liveSession ? (
        <div className="glass-card p-4 rounded-2xl border border-red-500/40 bg-gradient-to-r from-red-950/40 via-red-900/20 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center text-xl shrink-0 animate-pulse">
              🔴
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Teacher Live Class in Progress</span>
              </div>
              <h3 className="text-white font-bold text-sm sm:text-base mt-0.5">{liveSession.title}</h3>
              <p className="text-white/50 text-xs">{liveSession.subject} • Grade {liveSession.grade} • 3D ISL Avatar & Captions Active</p>
            </div>
          </div>
          <Link href={`/student/live-class?channel=${encodeURIComponent(liveSession.rtc_channel_id)}`}>
            <button className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95 whitespace-nowrap">
              Join Live Class 🎥
            </button>
          </Link>
        </div>
      ) : (
        <div className="glass-card p-4 rounded-2xl border border-white/5 bg-gradient-to-r from-[#1e1e32]/40 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center text-xl shrink-0">
              📹
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Interactive Live Classroom</h3>
              <p className="text-white/50 text-xs">Join live teacher sessions with 3D ISL Avatar, live bilingual subtitles, and Zoom controls.</p>
            </div>
          </div>
          <Link href="/student/live-class">
            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs rounded-xl border border-white/10 transition active:scale-95 whitespace-nowrap">
              Open Live Classes →
            </button>
          </Link>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          { label: 'Lessons Completed', value: stats.lessonsTotal, color: 'text-[#1cb0f6]', bg: 'bg-[#1cb0f6]/10', border: 'border-[#1cb0f6]/20' },
          { label: 'Weekly Streak', value: `${stats.streak} days`, color: 'text-[#ff9600]', bg: 'bg-[#ff9600]/10', border: 'border-[#ff9600]/20', icon: '🔥' },
          { label: 'ISL Hours', value: `${stats.signHours}h`, color: 'text-[#58cc02]', bg: 'bg-[#58cc02]/10', border: 'border-[#58cc02]/20', icon: '🤟' },
          { label: 'Lessons In DB', value: recentLessons.length > 0 ? `${recentLessons.length}+` : '0', color: 'text-[#ce82ff]', bg: 'bg-[#ce82ff]/10', border: 'border-[#ce82ff]/20' },
        ].map((stat, i) => (
          <div key={i} className={`glass-card p-3.5 sm:p-5 rounded-2xl border-b-4 ${stat.border} ${stat.bg} hover:translate-y-[-2px] transition-transform cursor-pointer`} onClick={vibrate}>
            <p className="text-white/60 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
              {stat.icon && <span>{stat.icon}</span>}
              <span className="truncate">{stat.label}</span>
            </p>
            <p className={`text-2xl sm:text-3xl font-black ${stat.color}`}>{loading ? '…' : stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Lessons */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Continue Learning</h3>
          <Link href="/student/lessons" className="text-[#6C63FF] text-sm hover:underline">View all →</Link>
        </div>
        {loading ? (
          <div className="text-center py-6">
            <span className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin inline-block" />
          </div>
        ) : recentLessons.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-white/40 text-sm">No lessons yet. Your teacher will add lessons soon.</p>
            <Link href="/student/lessons">
              <button className="mt-3 px-4 py-2 bg-[#6C63FF]/20 text-[#6C63FF] rounded-xl text-sm hover:bg-[#6C63FF]/30 transition">Browse Lessons</button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentLessons.map(lesson => {
              const isImage = lesson.thumbnail_url && (lesson.thumbnail_url.startsWith('http') || lesson.thumbnail_url.startsWith('/'));
              return (
                <Link key={lesson.id} href={`/student/lessons/${lesson.id}`}>
                  <div className="bg-[#1e1e32]/60 border border-white/5 rounded-xl overflow-hidden group cursor-pointer hover:border-[#6C63FF]/50 transition-all hover:scale-[1.02]">
                    <div className="aspect-video bg-gradient-to-br from-[#1e1e32] to-[#0f0c29] flex items-center justify-center overflow-hidden relative">
                      {isImage ? (
                        <img src={lesson.thumbnail_url} alt={lesson.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <span className="text-5xl group-hover:scale-110 transition-transform">{lesson.thumbnail_url || '📚'}</span>
                      )}
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-[#00C9A7] text-[9px] font-black tracking-wider uppercase border border-[#00C9A7]/40">NCERT</span>
                    </div>
                    <div className="p-4">
                      <p className="text-[#00C9A7] text-[10px] font-semibold tracking-wider uppercase">{lesson.subject} • {lesson.chapter}</p>
                      <h4 className="text-white font-semibold mt-1 group-hover:text-[#6C63FF] transition text-sm">{lesson.title}</h4>
                      <p className="text-white/40 text-xs mt-1">Grade {lesson.grade} • {lesson.board} • {Math.floor((lesson.duration_seconds || 1800) / 60)} min</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {lesson.tags?.slice(0, 2).map((tag: string) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded-full bg-[#6C63FF]/10 text-[#6C63FF] text-[9px]">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions for Hackathon MVP */}
      <div>
        <h3 className="text-white font-bold text-base sm:text-lg mb-3">Inclusive Learning Tools</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
          <Link href="/student/live-class" onClick={vibrate}>
            <button className="w-full py-4 px-2 bg-gradient-to-b from-red-500 to-red-600 text-white font-bold rounded-2xl border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all text-xs shadow-sm flex flex-col items-center gap-1">
              <span className="text-2xl animate-pulse">🔴</span>
              <span>Live Class</span>
            </button>
          </Link>

          <Link href="/student/lessons" onClick={vibrate}>
            <button className="w-full py-4 px-2 bg-[#58cc02] text-white font-bold rounded-2xl border-b-4 border-[#58a700] active:border-b-0 active:translate-y-1 transition-all text-xs shadow-sm flex flex-col items-center gap-1">
              <span className="text-2xl">📚</span>
              <span>Lessons</span>
            </button>
          </Link>

          <Link href="/student/sign-lab" onClick={vibrate}>
            <button className="w-full py-4 px-2 bg-[#1cb0f6] text-white font-bold rounded-2xl border-b-4 border-[#1899d6] active:border-b-0 active:translate-y-1 transition-all text-xs shadow-sm flex flex-col items-center gap-1">
              <span className="text-2xl">🤟</span>
              <span>Sign Lab</span>
            </button>
          </Link>

          <Link href="/student/ocr-reader" onClick={vibrate}>
            <button className="w-full py-4 px-2 bg-[#00C9A7] text-white font-bold rounded-2xl border-b-4 border-[#009b80] active:border-b-0 active:translate-y-1 transition-all text-xs shadow-sm flex flex-col items-center gap-1">
              <span className="text-2xl">📖</span>
              <span>OCR Reader</span>
            </button>
          </Link>

          <Link href="/student/braille-lab" onClick={vibrate}>
            <button className="w-full py-4 px-2 bg-[#ff4b4b] text-white font-bold rounded-2xl border-b-4 border-[#cc3b3b] active:border-b-0 active:translate-y-1 transition-all text-xs shadow-sm flex flex-col items-center gap-1">
              <span className="text-2xl">⠃</span>
              <span>Braille Lab</span>
            </button>
          </Link>

          <Link href="/student/homework-helper" onClick={vibrate}>
            <button className="w-full py-4 px-2 bg-[#6C63FF] text-white font-bold rounded-2xl border-b-4 border-[#5046e5] active:border-b-0 active:translate-y-1 transition-all text-xs shadow-sm flex flex-col items-center gap-1">
              <span className="text-2xl">📝</span>
              <span>Homework</span>
            </button>
          </Link>

          <Link href="/student/smart-notes" onClick={vibrate}>
            <button className="w-full py-4 px-2 bg-[#ce82ff] text-white font-bold rounded-2xl border-b-4 border-[#a568cc] active:border-b-0 active:translate-y-1 transition-all text-xs shadow-sm flex flex-col items-center gap-1">
              <span className="text-2xl">🎴</span>
              <span>Smart Notes</span>
            </button>
          </Link>

          <Link href="/student/rfid-card" onClick={vibrate}>
            <button className="w-full py-4 px-2 bg-[#ff9600] text-white font-bold rounded-2xl border-b-4 border-[#d67e00] active:border-b-0 active:translate-y-1 transition-all text-xs shadow-sm flex flex-col items-center gap-1">
              <span className="text-2xl">💳</span>
              <span>RFID Card</span>
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
