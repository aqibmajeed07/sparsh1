'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAccessibility } from '@/components/AccessibilityContext';
import { Award, Flame, Sparkles, CheckCircle2, Zap, Trophy, Calendar, Star, ShieldCheck } from 'lucide-react';

export default function RewardsPage() {
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(3);
  const [xp, setXp] = useState(450);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [badges, setBadges] = useState<any[]>([]);
  const { speak } = useAccessibility();

  useEffect(() => {
    const loadRewards = async () => {
      try {
        // Read local streak & XP cache
        const savedStreak = localStorage.getItem('sparsh_streak_days');
        const savedXp = localStorage.getItem('sparsh_xp_points');
        const lastCheckin = localStorage.getItem('sparsh_last_checkin');

        const todayStr = new Date().toDateString();
        const isToday = lastCheckin === todayStr;

        const currentStreak = savedStreak ? parseInt(savedStreak) : 3;
        const currentXp = savedXp ? parseInt(savedXp) : 450;

        setStreak(currentStreak);
        setXp(currentXp);
        setCheckedInToday(isToday);

        // Initialize 10+ Gamified Badges
        const lessons = 6;
        const signs = 52;
        const ocrScans = 8;
        const streakDays = currentStreak;

        setBadges([
          { id: 'b1', title: 'First Step', desc: 'Completed your very first lesson', icon: '🐣', color: '#1cb0f6', unlocked: true, progress: 100 },
          { id: 'b2', title: 'On Fire!', desc: 'Achieved a 3-day learning streak', icon: '🔥', color: '#ff9600', unlocked: streakDays >= 3, progress: Math.min(100, Math.round((streakDays / 3) * 100)) },
          { id: 'b3', title: 'Sign Master', desc: 'Learned 50 ISL signs in Sign Lab', icon: '🤟', color: '#00C9A7', unlocked: signs >= 50, progress: 100 },
          { id: 'b4', title: 'OCR Scholar', desc: 'Scanned 5 textbook pages with OCR Reader', icon: '📖', color: '#6C63FF', unlocked: ocrScans >= 5, progress: 100 },
          { id: 'b5', title: 'AI Pioneer', desc: 'Asked 10 questions to NCERT AI Tutor', icon: '🤖', color: '#ce82ff', unlocked: true, progress: 100 },
          { id: 'b6', title: 'Tactile Genius', desc: 'Paired SenseBand & RFID Smart Card', icon: '⚡', color: '#ff4b4b', unlocked: true, progress: 100 },
          { id: 'b7', title: 'Quiz Champion', desc: 'Scored 100% on assessment quiz', icon: '💯', color: '#ffc800', unlocked: lessons >= 5, progress: 100 },
          { id: 'b8', title: 'Bookworm', desc: 'Spent 10 hours learning this month', icon: '🐛', color: '#1cb0f6', unlocked: true, progress: 100 },
          { id: 'b9', title: 'Speed Learner', desc: 'Completed 3 lessons in a single day', icon: '⚡', color: '#ff9600', unlocked: lessons >= 3, progress: 100 },
          { id: 'b10', title: 'Accessibility Champion', desc: 'Tried 3 personalized accessibility profiles', icon: '♿', color: '#00C9A7', unlocked: true, progress: 100 },
        ]);

        // Try sync with Supabase profiles
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (profile) {
            if (profile.streak_days) setStreak(profile.streak_days);
          }
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    loadRewards();
  }, []);

  const handleClaimStreak = async () => {
    if (checkedInToday) return;

    const newStreak = streak + 1;
    const newXp = xp + 50;
    const todayStr = new Date().toDateString();

    setStreak(newStreak);
    setXp(newXp);
    setCheckedInToday(true);

    localStorage.setItem('sparsh_streak_days', newStreak.toString());
    localStorage.setItem('sparsh_xp_points', newXp.toString());
    localStorage.setItem('sparsh_last_checkin', todayStr);

    speak(`Awesome! Daily check-in complete. You earned 50 XP points and your streak is now ${newStreak} days!`);

    // Trigger SenseBand Haptics
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/senseband/ai-emotion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Streak check-in complete! Streak ${newStreak} days` })
      });
    } catch (e) { }

    // Sync to Supabase if authenticated
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ streak_days: newStreak }).eq('id', user.id);
      }
    } catch (e) { }
  };

  const unlockedCount = badges.filter(b => b.unlocked).length;
  const currentTier = xp >= 1000 ? 'Diamond Master' : xp >= 500 ? 'Gold Scholar' : xp >= 250 ? 'Silver Learner' : 'Bronze Explorer';

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Streak Badge */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <span>🏆</span> Your Rewards & Gamification
          </h1>
          <p className="text-white/60 mt-1 font-medium">Earn badges, level up your XP, and maintain your daily learning streak!</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="glass-card px-5 py-3 rounded-2xl border-b-4 border-[#ff9600]/50 bg-[#ff9600]/10 flex items-center gap-3">
            <span className="text-3xl animate-bounce">🔥</span>
            <div>
              <p className="text-white/50 text-[10px] font-black uppercase tracking-wider">Daily Streak</p>
              <p className="text-[#ff9600] font-black text-2xl leading-none">{streak} Days</p>
            </div>
          </div>

          <div className="glass-card px-5 py-3 rounded-2xl border-b-4 border-[#ce82ff]/50 bg-[#ce82ff]/10 flex items-center gap-3">
            <span className="text-3xl animate-pulse">⚡</span>
            <div>
              <p className="text-white/50 text-[10px] font-black uppercase tracking-wider">Total Experience</p>
              <p className="text-[#ce82ff] font-black text-2xl leading-none">{xp} XP</p>
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
                disabled={checkedInToday}
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
                    <Sparkles className="w-5 h-5 text-yellow-200 animate-spin" /> Claim Today's Streak (+50 XP)
                  </>
                )}
              </button>
            </div>

            {/* 7-Day Weekly Calendar Tracker */}
            <div className="grid grid-cols-7 gap-2 pt-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                const isDone = idx < (streak % 7 || 7);
                return (
                  <div
                    key={day}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${isDone
                      ? 'bg-[#ff9600]/25 border-[#ff9600] text-white shadow-md'
                      : 'bg-white/5 border-white/10 text-white/40'
                      }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest">{day}</span>
                    <span className="text-lg">{isDone ? '🔥' : '🔒'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tier Level & Badge Collection Progress */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-2xl border border-[#ce82ff]/30 bg-[#ce82ff]/10 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-[#ce82ff] font-bold text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> Scholar Rank Tier
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-[#ce82ff]/20 text-[#ce82ff] text-xs font-bold border border-[#ce82ff]/40">
                  {currentTier}
                </span>
              </div>
              <p className="text-white text-sm font-semibold">Keep completing lessons to rank up to Diamond Master status.</p>
            </div>

            <div className="md:col-span-2 glass-card p-6 rounded-2xl border border-white/10 space-y-3">
              <div className="flex justify-between items-end">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" /> Badge Collection Progress
                </h2>
                <span className="text-[#00C9A7] font-bold text-sm">{unlockedCount} / {badges.length} Unlocked</span>
              </div>
              <div className="w-full bg-black/40 rounded-full h-5 overflow-hidden border border-white/5 relative p-1">
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
          <div className="space-y-4">
            <h2 className="text-white font-extrabold text-xl flex items-center gap-2">
              <span>🎖️</span> Unlockable Achievement Badges
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  onClick={() => speak(`${badge.title} badge: ${badge.desc}`)}
                  className={`glass-card p-5 flex flex-col items-center text-center transition-all cursor-pointer rounded-2xl border-2 transform hover:-translate-y-1 ${badge.unlocked
                    ? `border-[${badge.color}] bg-[#1e1e32]/80 shadow-xl`
                    : 'border-white/10 opacity-60 grayscale-[0.6] hover:grayscale-0'
                    }`}
                  style={{
                    borderColor: badge.unlocked ? badge.color : 'rgba(255, 255, 255, 0.1)',
                    backgroundColor: badge.unlocked ? `${badge.color}15` : 'rgba(30, 30, 50, 0.4)'
                  }}
                >
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-3 shadow-inner relative ${badge.unlocked ? 'animate-bounce' : ''}`}
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
