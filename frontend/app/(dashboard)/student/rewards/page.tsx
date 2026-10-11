'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAccessibility } from '@/components/AccessibilityContext';
import { Flame, Sparkles, CheckCircle2, Trophy, ShieldCheck } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function RewardsPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [tier, setTier] = useState('Bronze Explorer');
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [badges, setBadges] = useState<any[]>([]);
  const [claiming, setClaiming] = useState(false);
  const { speak } = useAccessibility();

  // Function to load live rewards data from backend & database
  const loadRewardsData = useCallback(async (targetUserId?: string) => {
    try {
      const activeId = targetUserId || userId;
      if (!activeId) return;

      // 1. Try calling the FastAPI real-time rewards endpoint
      let backendData: any = null;
      try {
        const res = await fetch(`${BACKEND_URL}/api/student/rewards/${activeId}`, {
          cache: 'no-store'
        });
        if (res.ok) {
          backendData = await res.json();
        }
      } catch (err) {
        console.warn('Backend rewards endpoint unreachable, using Supabase direct query:', err);
      }

      if (backendData && backendData.status === 'success') {
        setStreak(backendData.streak_days || 0);
        setXp(backendData.xp || 50);
        setTier(backendData.tier || 'Bronze Explorer');
        setCheckedInToday(Boolean(backendData.checked_in_today));
        if (Array.isArray(backendData.badges) && backendData.badges.length > 0) {
          setBadges(backendData.badges);
        }
      } else {
        // Fallback: Direct Supabase query
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', activeId)
          .single();

        const { data: progressList } = await supabase
          .from('student_progress')
          .select('lesson_id, completion_percent, time_spent_seconds')
          .eq('student_id', activeId);

        const currentStreak = profile?.streak_days || 0;
        const totalLessons = progressList?.filter((p: any) => (p.completion_percent || 0) >= 100).length || profile?.total_lessons_done || 0;
        const totalSign = profile?.total_sign_hours || 0;

        const calculatedXp = 50 + (totalLessons * 100) + (currentStreak * 50) + Math.round(totalSign * 75);
        const calculatedTier = calculatedXp >= 1000 ? 'Diamond Master' : calculatedXp >= 500 ? 'Gold Scholar' : calculatedXp >= 250 ? 'Silver Learner' : 'Bronze Explorer';

        const todayStr = new Date().toISOString().slice(0, 10);
        const isToday = profile?.last_active ? profile.last_active.startsWith(todayStr) : false;

        setStreak(currentStreak);
        setXp(calculatedXp);
        setTier(calculatedTier);
        setCheckedInToday(isToday);

        setBadges([
          { id: 'b1', title: 'First Step', desc: 'Completed your very first lesson', icon: '🐣', color: '#1cb0f6', unlocked: totalLessons >= 1, progress: totalLessons >= 1 ? 100 : 0 },
          { id: 'b2', title: 'On Fire!', desc: 'Achieved a 3-day learning streak', icon: '🔥', color: '#ff9600', unlocked: currentStreak >= 3, progress: Math.min(100, Math.round((currentStreak / 3) * 100)) },
          { id: 'b3', title: 'Sign Master', desc: 'Learned ISL signs in Sign Lab', icon: '🤟', color: '#00C9A7', unlocked: totalSign >= 1, progress: Math.min(100, Math.round(totalSign * 100)) },
          { id: 'b4', title: 'Curriculum Scholar', desc: 'Completed 5 textbook curriculum lessons', icon: '📖', color: '#6C63FF', unlocked: totalLessons >= 5, progress: Math.min(100, Math.round((totalLessons / 5) * 100)) },
          { id: 'b5', title: 'AI Pioneer', desc: 'Maintained an active 5-day streak', icon: '🤖', color: '#ce82ff', unlocked: currentStreak >= 5, progress: Math.min(100, Math.round((currentStreak / 5) * 100)) },
          { id: 'b6', title: 'Tactile Genius', desc: 'Paired SenseBand or custom accessibility preferences', icon: '⚡', color: '#ff4b4b', unlocked: Boolean(profile?.accessibility_prefs || profile?.disability_type), progress: 100 },
          { id: 'b7', title: 'Quiz Champion', desc: 'Passed assessment quiz evaluation', icon: '💯', color: '#ffc800', unlocked: totalLessons >= 4, progress: Math.min(100, Math.round((totalLessons / 4) * 100)) },
          { id: 'b8', title: 'Bookworm', desc: 'Invested dedicated study hours on Sparsh', icon: '🐛', color: '#1cb0f6', unlocked: totalLessons >= 3, progress: Math.min(100, Math.round((totalLessons / 3) * 100)) },
          { id: 'b9', title: 'Speed Learner', desc: 'Completed 3 curriculum lessons', icon: '⚡', color: '#ff9600', unlocked: totalLessons >= 3, progress: Math.min(100, Math.round((totalLessons / 3) * 100)) },
          { id: 'b10', title: 'Accessibility Champion', desc: 'Enrolled with inclusive learning profile', icon: '♿', color: '#00C9A7', unlocked: Boolean(profile?.disability_type), progress: 100 },
        ]);
      }
    } catch (e) {
      console.error('Error loading rewards:', e);
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
          await loadRewardsData(user.id);

          // Real-time Postgres subscription on profiles and student_progress
          channel = supabase.channel(`realtime_rewards_${user.id}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
              () => {
                loadRewardsData(user.id);
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'student_progress', filter: `student_id=eq.${user.id}` },
              () => {
                loadRewardsData(user.id);
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
                await loadRewardsData(localUser.id);
              }
            } catch (err) { }
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to init rewards:', err);
        setLoading(false);
      }
    };

    init();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadRewardsData]);

  const handleClaimStreak = async () => {
    if (checkedInToday || claiming) return;

    setClaiming(true);
    const newStreak = streak + 1;
    const newXp = xp + 50;

    // Optimistic UI update
    setStreak(newStreak);
    setXp(newXp);
    setCheckedInToday(true);

    speak(`Awesome! Daily check-in complete. You earned 50 XP points and your streak is now ${newStreak} days!`);

    try {
      // 1. Post to backend endpoint
      if (userId) {
        await fetch(`${BACKEND_URL}/api/student/rewards/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: userId }),
        });
      }

      // 2. Direct Supabase update for immediate consistency
      if (userId) {
        await supabase
          .from('profiles')
          .update({
            streak_days: newStreak,
            last_active: new Date().toISOString()
          })
          .eq('id', userId);
      }

      // 3. Trigger SenseBand Haptic Emotion Feedback
      try {
        await fetch(`${BACKEND_URL}/api/senseband/ai-emotion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `Streak check-in complete! Streak ${newStreak} days` }),
        });
      } catch (e) { }

      // Reload full state to sync any newly unlocked badges
      if (userId) {
        await loadRewardsData(userId);
      }
    } catch (e) {
      console.error('Checkin claim error:', e);
    } finally {
      setClaiming(false);
    }
  };

  const unlockedCount = badges.filter(b => b.unlocked).length;

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Streak Badge */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5 sm:gap-3">
            <span>🏆</span> Your Rewards & Gamification
          </h1>
          <p className="text-white/60 text-xs sm:text-sm mt-1 font-medium">Earn badges, level up your XP, and maintain your daily learning streak!</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full md:w-auto shrink-0">
          <div className="glass-card px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-b-4 border-[#ff9600]/50 bg-[#ff9600]/10 flex items-center gap-2.5 sm:gap-3">
            <span className="text-2xl sm:text-3xl animate-bounce">🔥</span>
            <div>
              <p className="text-white/50 text-[9px] sm:text-[10px] font-black uppercase tracking-wider">Daily Streak</p>
              <p className="text-[#ff9600] font-black text-xl sm:text-2xl leading-none mt-0.5">{streak} Days</p>
            </div>
          </div>

          <div className="glass-card px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-b-4 border-[#ce82ff]/50 bg-[#ce82ff]/10 flex items-center gap-2.5 sm:gap-3">
            <span className="text-2xl sm:text-3xl animate-pulse">⚡</span>
            <div>
              <p className="text-white/50 text-[9px] sm:text-[10px] font-black uppercase tracking-wider">Total Experience</p>
              <p className="text-[#ce82ff] font-black text-xl sm:text-2xl leading-none mt-0.5">{xp} XP</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="w-12 h-12 border-4 border-[#00C9A7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Daily Check-In & Streak Calendar Card */}
          <div className="glass-card p-6 rounded-2xl border-2 border-[#ff9600]/40 bg-gradient-to-r from-[#ff9600]/15 to-[#6C63FF]/15 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="w-6 h-6 text-[#ff9600]" />
                  <h2 className="text-white font-extrabold text-xl">Daily Streak Check-In</h2>
                </div>
                <p className="text-white/70 text-sm mt-1">Check in daily to keep your fire burning and unlock extra XP rewards!</p>
              </div>

              <button
                onClick={handleClaimStreak}
                disabled={checkedInToday || claiming}
                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-xl flex items-center gap-2 ${checkedInToday
                  ? 'bg-[#00C9A7]/20 border border-[#00C9A7]/50 text-[#00C9A7] cursor-default'
                  : 'bg-gradient-to-r from-[#ff9600] to-amber-500 text-white hover:scale-105 active:scale-95'
                  }`}
              >
                {checkedInToday ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> Checked In Today (+50 XP)
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-yellow-200 animate-spin" /> {claiming ? 'Checking In...' : "Claim Today's Streak (+50 XP)"}
                  </>
                )}
              </button>
            </div>

            {/* 7-Day Weekly Calendar Tracker */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2.5 pt-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                const isDone = idx < (streak % 7 || (streak > 0 ? 7 : 0));
                return (
                  <div
                    key={day}
                    className={`p-1.5 sm:p-3 rounded-lg sm:rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 sm:gap-1 ${isDone
                      ? 'bg-[#ff9600]/25 border-[#ff9600] text-white shadow-md'
                      : 'bg-white/5 border-white/10 text-white/40'
                      }`}
                  >
                    <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider">{day}</span>
                    <span className="text-sm sm:text-lg">{isDone ? '🔥' : '🔒'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tier Level & Badge Collection Progress */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="glass-card p-4 sm:p-6 rounded-2xl border border-[#ce82ff]/30 bg-[#ce82ff]/10 space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-[#ce82ff] font-bold text-sm sm:text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" /> Scholar Rank Tier
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-[#ce82ff]/20 text-[#ce82ff] text-xs font-bold border border-[#ce82ff]/40">
                  {tier}
                </span>
              </div>
              <p className="text-white text-xs sm:text-sm font-semibold">Keep completing lessons to rank up to Diamond Master status.</p>
            </div>

            <div className="md:col-span-2 glass-card p-4 sm:p-6 rounded-2xl border border-white/10 space-y-2 sm:space-y-3">
              <div className="flex justify-between items-end">
                <h2 className="text-white font-bold text-base sm:text-lg flex items-center gap-2">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" /> Badge Collection Progress
                </h2>
                <span className="text-[#00C9A7] font-bold text-xs sm:text-sm">{unlockedCount} / {badges.length} Unlocked</span>
              </div>
              <div className="w-full bg-black/40 rounded-full h-4 sm:h-5 overflow-hidden border border-white/5 relative p-0.5 sm:p-1">
                <div
                  className="h-full bg-gradient-to-r from-[#6C63FF] via-[#ce82ff] to-[#00C9A7] rounded-full transition-all duration-1000 ease-out relative"
                  style={{ width: `${badges.length ? (unlockedCount / badges.length) * 100 : 0}%` }}
                >
                  <div className="absolute top-0.5 left-0 right-0 h-1 bg-white/30 rounded-full mx-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Badges Grid */}
          <div className="space-y-3 sm:space-y-4">
            <h2 className="text-white font-extrabold text-lg sm:text-xl flex items-center gap-2">
              <span>🎖️</span> Unlockable Achievement Badges
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  onClick={() => speak(`${badge.title} badge: ${badge.desc}. Status: ${badge.unlocked ? 'Unlocked' : 'In progress'}`)}
                  className={`glass-card p-4 sm:p-5 flex flex-col items-center text-center transition-all cursor-pointer rounded-2xl border-2 transform hover:-translate-y-1 ${badge.unlocked
                    ? 'border-[#00C9A7]/40 bg-[#1e1e32]/80 shadow-xl'
                    : 'border-white/10 opacity-70 grayscale-[0.5] hover:grayscale-0'
                    }`}
                  style={{
                    borderColor: badge.unlocked ? badge.color : 'rgba(255, 255, 255, 0.1)',
                    backgroundColor: badge.unlocked ? `${badge.color}15` : 'rgba(30, 30, 50, 0.4)'
                  }}
                >
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-2xl sm:text-3xl mb-2 sm:mb-3 shadow-inner relative ${badge.unlocked ? 'animate-bounce' : ''}`}
                    style={{ backgroundColor: badge.unlocked ? `${badge.color}30` : '#222' }}
                  >
                    {badge.icon}
                    {badge.unlocked && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#00C9A7] rounded-full border-2 border-[#1e1e32] flex items-center justify-center text-[9px] text-white font-bold">
                        ✓
                      </div>
                    )}
                  </div>

                  <h3 className={`font-bold text-base mb-1 ${badge.unlocked ? 'text-white' : 'text-white/60'}`}>
                    {badge.title}
                  </h3>
                  <p className="text-white/50 text-xs font-medium leading-tight mb-3">
                    {badge.desc}
                  </p>

                  {badge.unlocked ? (
                    <div className="mt-auto px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm" style={{ backgroundColor: `${badge.color}30`, color: badge.color }}>
                      UNLOCKED ✓
                    </div>
                  ) : (
                    <div className="w-full mt-auto space-y-1">
                      <div className="flex justify-between text-[9px] font-bold text-white/40">
                        <span>PROGRESS</span>
                        <span>{badge.progress}%</span>
                      </div>
                      <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${badge.progress}%`, backgroundColor: badge.color }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
