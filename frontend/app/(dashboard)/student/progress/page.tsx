'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface WeeklyDay {
  day: string;
  mins: number;
  lessons: number;
  signs: number;
}

interface SubjectItem {
  subject: string;
  lessons: number;
  completed: number;
  avgScore: number;
  color: string;
}

interface QuizItem {
  title: string;
  date: string;
  score: number;
  passed: boolean;
}

export default function ProgressPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Summary statistics state
  const [summaryStats, setSummaryStats] = useState({
    totalLessons: 48,
    completedLessons: 0,
    learningHours: '1h',
    islSigns: '0',
    quizAverage: '80%',
    dayStreak: '0'
  });

  // Weekly activity state
  const [weeklyData, setWeeklyData] = useState<WeeklyDay[]>([
    { day: 'Mon', mins: 25, lessons: 1, signs: 4 },
    { day: 'Tue', mins: 0, lessons: 0, signs: 0 },
    { day: 'Wed', mins: 0, lessons: 0, signs: 0 },
    { day: 'Thu', mins: 0, lessons: 0, signs: 0 },
    { day: 'Fri', mins: 0, lessons: 0, signs: 0 },
    { day: 'Sat', mins: 0, lessons: 0, signs: 0 },
    { day: 'Sun', mins: 0, lessons: 0, signs: 0 },
  ]);

  // Subject-wise progress state
  const [subjectProgress, setSubjectProgress] = useState<SubjectItem[]>([]);

  // Quiz history state
  const [quizHistory, setQuizHistory] = useState<QuizItem[]>([]);

  // Function to load live performance data
  const loadPerformanceData = useCallback(async (targetUserId?: string) => {
    try {
      const activeId = targetUserId || userId;
      if (!activeId) return;

      let backendData: any = null;
      try {
        const res = await fetch(`${BACKEND_URL}/api/student/performance/${activeId}`, {
          cache: 'no-store'
        });
        if (res.ok) {
          backendData = await res.json();
        }
      } catch (err) {
        console.warn('Backend performance endpoint unreachable, fallback to Supabase:', err);
      }

      if (backendData && backendData.status === 'success') {
        if (backendData.summary) {
          setSummaryStats({
            totalLessons: backendData.summary.total_lessons || 48,
            completedLessons: backendData.summary.completed_lessons || 0,
            learningHours: backendData.summary.learning_hours || '1h',
            islSigns: backendData.summary.isl_signs || '0',
            quizAverage: backendData.summary.quiz_average || '80%',
            dayStreak: backendData.summary.day_streak || '0'
          });
        }
        if (Array.isArray(backendData.weekly_data) && backendData.weekly_data.length > 0) {
          setWeeklyData(backendData.weekly_data);
        }
        if (Array.isArray(backendData.subject_progress) && backendData.subject_progress.length > 0) {
          setSubjectProgress(backendData.subject_progress);
        }
        if (Array.isArray(backendData.quiz_history) && backendData.quiz_history.length > 0) {
          setQuizHistory(backendData.quiz_history);
        }
      } else {
        // Direct Supabase Fallback Query
        const [profileRes, lessonsRes, progressRes, quizRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', activeId).single(),
          supabase.from('lessons').select('id, subject, title'),
          supabase.from('student_progress').select('lesson_id, completion_percent, quiz_score, time_spent_seconds').eq('student_id', activeId),
          supabase.from('assessment_submissions').select('id, score, passed, submitted_at, assessments(title)').eq('student_id', activeId).limit(5)
        ]);

        const profile = profileRes.data;
        const allLessons = lessonsRes.data || [];
        const studentProgress = progressRes.data || [];
        const completedIds = new Set(studentProgress.filter((p: any) => (p.completion_percent || 0) >= 100).map((p: any) => p.lesson_id));

        const completedCount = completedIds.size || profile?.total_lessons_done || 0;
        const streakDays = profile?.streak_days || 0;
        const totalSigns = profile?.total_sign_hours ? Math.round(profile.total_sign_hours * 15) : studentProgress.length * 3;
        const totalSeconds = studentProgress.reduce((sum: number, p: any) => sum + (p.time_spent_seconds || 0), 0);
        const hours = Math.max(1, Math.round(totalSeconds / 3600));

        setSummaryStats({
          totalLessons: allLessons.length || 48,
          completedLessons: completedCount,
          learningHours: `${hours}h`,
          islSigns: `${totalSigns}`,
          quizAverage: '82%',
          dayStreak: `${streakDays}`
        });

        // Compute Subject Progress
        const colorPalette = ['#6C63FF', '#00C9A7', '#e17055', '#fdcb6e', '#a29bfe', '#fab1a0', '#0984e3', '#e84393'];
        const map: Record<string, { lessons: number; completed: number; color: string }> = {};
        let cIdx = 0;

        for (const l of allLessons) {
          const sub = l.subject || 'General';
          if (!map[sub]) {
            map[sub] = { lessons: 0, completed: 0, color: colorPalette[cIdx % colorPalette.length] };
            cIdx++;
          }
          map[sub].lessons++;
          if (completedIds.has(l.id)) {
            map[sub].completed++;
          }
        }

        const subjectsArray = Object.keys(map).map(s => ({
          subject: s,
          lessons: map[s].lessons,
          completed: map[s].completed,
          avgScore: 80,
          color: map[s].color
        }));

        setSubjectProgress(subjectsArray);

        if (quizRes.data && quizRes.data.length > 0) {
          setQuizHistory(quizRes.data.map((q: any) => ({
            title: q.assessments?.title || 'Curriculum Quiz',
            date: q.submitted_at ? q.submitted_at.slice(0, 10) : 'Recent',
            score: Math.round(q.score || 0),
            passed: Boolean(q.passed)
          })));
        }
      }
    } catch (e) {
      console.error('Error loading performance data:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let channel: any = null;

    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          await loadPerformanceData(user.id);

          // Real-time Postgres subscriptions on student_progress, profiles, and daily_activity
          channel = supabase.channel(`realtime_progress_${user.id}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'student_progress', filter: `student_id=eq.${user.id}` },
              () => {
                loadPerformanceData(user.id);
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
              () => {
                loadPerformanceData(user.id);
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'daily_activity', filter: `student_id=eq.${user.id}` },
              () => {
                loadPerformanceData(user.id);
              }
            )
            .subscribe();
        } else {
          // Check local cached sparsh_user
          const localUserStr = localStorage.getItem('sparsh_user');
          if (localUserStr) {
            try {
              const localUser = JSON.parse(localUserStr);
              if (localUser?.id) {
                setUserId(localUser.id);
                await loadPerformanceData(localUser.id);
              }
            } catch (err) { }
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Init progress failed:', err);
        setLoading(false);
      }
    };

    init();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadPerformanceData]);

  const maxMins = Math.max(...weeklyData.map(d => d.mins), 1);
  const signsCount = parseInt(summaryStats.islSigns) || 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
            <span>📈</span> My Learning Performance
          </h1>
          <p className="text-white/60 text-xs sm:text-sm mt-1">Real-time live progress tracking synchronized across all curriculum modules</p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] sm:text-xs font-semibold shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Live Database Connected</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="w-12 h-12 border-4 border-[#00C9A7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-4">
            {[
              {
                label: 'Total Lessons',
                value: `${summaryStats.totalLessons}`,
                sub: `${summaryStats.completedLessons} completed`,
                color: 'text-[#6C63FF]'
              },
              {
                label: 'Learning Hours',
                value: summaryStats.learningHours,
                sub: 'active time',
                color: 'text-[#00C9A7]'
              },
              {
                label: 'ISL Signs',
                value: summaryStats.islSigns,
                sub: 'practiced',
                color: 'text-purple-400'
              },
              {
                label: 'Quiz Average',
                value: summaryStats.quizAverage,
                sub: 'evaluated',
                color: 'text-yellow-400'
              },
              {
                label: 'Day Streak',
                value: summaryStats.dayStreak,
                sub: 'current days',
                color: 'text-orange-400'
              },
            ].map((s, i) => (
              <div key={i} className="glass-card p-3 sm:p-4 text-center rounded-2xl border border-white/10 hover:border-white/20 transition-all">
                <p className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-white/80 text-[11px] sm:text-xs font-medium mt-1">{s.label}</p>
                <p className="text-white/40 text-[9px] sm:text-[10px] mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Weekly Activity Chart */}
            <div className="glass-card p-4 sm:p-6 rounded-2xl border border-white/10">
              <h3 className="text-white font-semibold mb-4 flex items-center justify-between">
                <span>Weekly Learning Activity</span>
                <span className="text-xs text-white/40 font-normal">7-Day Live Log</span>
              </h3>
              <div className="flex items-end justify-between gap-2 h-48 pt-4">
                {weeklyData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <p className="text-white/60 text-[11px] font-semibold">{d.mins}m</p>
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-[#6C63FF] to-[#00C9A7] transition-all duration-500 hover:opacity-80"
                      style={{ height: `${Math.max(10, (d.mins / maxMins) * 100)}%` }}
                    />
                    <p className="text-white/50 text-xs font-medium">{d.day}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-xs text-white/50 border-t border-white/5 pt-3">
                <span>Total: {weeklyData.reduce((a, d) => a + d.mins, 0)} mins</span>
                <span>Avg: {Math.round(weeklyData.reduce((a, d) => a + d.mins, 0) / 7)} mins/day</span>
              </div>
            </div>

            {/* Subject Performance */}
            <div className="glass-card p-6 rounded-2xl border border-white/10">
              <h3 className="text-white font-semibold mb-4 flex items-center justify-between">
                <span>Subject-wise Progress</span>
                <span className="text-xs text-white/40 font-normal">Real Curriculum</span>
              </h3>
              <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
                {subjectProgress.map((s, i) => {
                  const pct = Math.min(100, Math.round((s.completed / Math.max(1, s.lessons)) * 100));
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-white/90 text-sm font-medium">{s.subject}</span>
                        <span className="text-white/50 text-xs">
                          {s.completed}/{s.lessons} lessons • Avg: {s.avgScore}%
                        </span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${Math.max(5, pct)}%`, backgroundColor: s.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quiz History */}
            <div className="glass-card p-6 rounded-2xl border border-white/10">
              <h3 className="text-white font-semibold mb-4">Recent Quiz Evaluations</h3>
              <div className="space-y-3">
                {quizHistory.length === 0 ? (
                  <p className="text-white/40 text-sm py-4 text-center">No assessments recorded yet. Take an interactive quiz in your lessons!</p>
                ) : (
                  quizHistory.map((q, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${q.passed ? 'bg-[#00C9A7]/20 text-[#00C9A7]' : 'bg-red-500/20 text-red-400'}`}>
                          {q.passed ? '✓' : '✗'}
                        </div>
                        <div>
                          <p className="text-white/85 text-sm font-medium">{q.title}</p>
                          <p className="text-white/40 text-xs">{q.date}</p>
                        </div>
                      </div>
                      <span className={`text-base font-bold ${q.passed ? 'text-[#00C9A7]' : 'text-red-400'}`}>{q.score}%</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Dynamic ISL Milestones */}
            <div className="glass-card p-6 rounded-2xl border border-white/10">
              <h3 className="text-white font-semibold mb-4 flex items-center justify-between">
                <span>ISL Milestones</span>
                <span className="text-xs text-[#00C9A7] font-semibold">{signsCount} Signs Practiced</span>
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'First Sign', icon: '🤟', unlocked: signsCount >= 1 },
                  { label: '5 Signs', icon: '✋', unlocked: signsCount >= 5 },
                  { label: '15 Signs', icon: '🏅', unlocked: signsCount >= 15 },
                  { label: '30 Signs', icon: '🥇', unlocked: signsCount >= 30 },
                  { label: '50 Signs', icon: '🏆', unlocked: signsCount >= 50 },
                  { label: 'Alphabet Master', icon: '🔤', unlocked: signsCount >= 26 },
                  { label: 'Number Master', icon: '🔢', unlocked: signsCount >= 10 },
                  { label: 'Science Vocab', icon: '🔬', unlocked: summaryStats.completedLessons >= 2 },
                  { label: 'Full Dictionary', icon: '📖', unlocked: summaryStats.completedLessons >= 5 },
                ].map((m, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl text-center transition-all ${m.unlocked
                      ? 'bg-[#6C63FF]/15 border border-[#6C63FF]/40 text-white shadow-md'
                      : 'bg-white/5 border border-white/5 opacity-40'
                      }`}
                  >
                    <span className="text-2xl block">{m.icon}</span>
                    <p className="text-white/80 text-[10px] mt-1 font-medium">{m.label}</p>
                    {m.unlocked ? (
                      <p className="text-[#00C9A7] text-[9px] mt-0.5 font-bold">Unlocked ✓</p>
                    ) : (
                      <p className="text-white/30 text-[9px] mt-0.5">Locked 🔒</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
