'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  Gem,
  Heart,
  Sparkles,
  Lock,
  Check,
  Star,
  Crown,
  ChevronRight,
  RefreshCw,
  Trophy,
  Volume2,
  X,
  Play,
  Gift,
  HelpCircle,
  Eye,
  Ear,
  Brain,
  Mic,
} from 'lucide-react';
import SparshyMascot, { MascotMood } from '@/components/gamification/SparshyMascot';
import BrailleCellInput from '@/components/gamification/BrailleCellInput';
import SignCameraChallenge from '@/components/gamification/SignCameraChallenge';
import DuoVoiceAssistant from '@/components/gamification/DuoVoiceAssistant';
import { duoAudio } from '@/lib/duoAudio';
import CelebrationOverlay from '@/components/ui/CelebrationOverlay';

interface LevelItem {
  id: string;
  track: 'deaf_sign' | 'blind_braille';
  unit_number: number;
  unit_title: string;
  level_number: number;
  title: string;
  description: string;
  target_char: string;
  target_sign?: string;
  target_braille_dots?: number[];
  braille_display?: string;
  xp_reward: number;
  gem_reward: number;
  hints?: string[];
  order_index: number;
  completed: boolean;
  stars: number;
  is_unlocked: boolean;
  is_current: boolean;
}

interface ProfileState {
  user_id: string;
  track: 'deaf_sign' | 'blind_braille';
  total_xp: number;
  gems: number;
  hearts: number;
  max_hearts: number;
  current_streak: number;
  last_activity_date: string;
}

export default function SparshDuoPage() {
  // Profile & Wallet state
  const [profile, setProfile] = useState<ProfileState>({
    user_id: 'guest_student',
    track: 'deaf_sign',
    total_xp: 120,
    gems: 180,
    hearts: 5,
    max_hearts: 5,
    current_streak: 2,
    last_activity_date: new Date().toISOString().split('T')[0],
  });

  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showRefillModal, setShowRefillModal] = useState(false);

  // Active Challenge modal state
  const [activeLevel, setActiveLevel] = useState<LevelItem | null>(null);
  const [selectedDots, setSelectedDots] = useState<number[]>([]);
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [mascotMood, setMascotMood] = useState<MascotMood>('idle');
  const [mascotSpeech, setMascotSpeech] = useState<string>('Ready to learn? Let’s do this!');
  const [mistakesCount, setMistakesCount] = useState<number>(0);
  const [isLevelFinished, setIsLevelFinished] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [aiLessonText, setAiLessonText] = useState<string | null>(null);

  // Fetch Profile & Levels from API
  const loadData = useCallback(async (trackToLoad?: 'deaf_sign' | 'blind_braille') => {
    setIsLoading(true);
    try {
      // 1. Fetch Profile
      const profRes = await fetch('/api/gamification/profile?user_id=guest_student');
      let currTrack = trackToLoad || profile.track;
      if (profRes.ok) {
        const pData = await profRes.json();
        if (pData.profile) {
          setProfile(pData.profile);
          if (!trackToLoad) {
            currTrack = pData.profile.track || 'deaf_sign';
          }
        }
      }

      // 2. Fetch Levels for Track
      const lvlRes = await fetch(`/api/gamification/levels?track=${currTrack}&user_id=guest_student`);
      if (lvlRes.ok) {
        const lData = await lvlRes.json();
        if (lData.levels) {
          setLevels(lData.levels);
        }
      }
    } catch (err) {
      console.warn('[SparshDuo] Error loading gamification data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profile.track]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Track switcher
  const handleSelectTrack = async (track: 'deaf_sign' | 'blind_braille') => {
    setShowTrackModal(false);
    duoAudio.playTapSound();
    setProfile((prev) => ({ ...prev, track }));
    try {
      await fetch('/api/gamification/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.user_id, track }),
      });
    } catch {
      // handled
    }
    loadData(track);
  };

  // Launch a level
  const handleStartLevel = (level: LevelItem) => {
    if (!level.is_unlocked) {
      duoAudio.playErrorBuzz();
      return;
    }
    if (profile.hearts <= 0) {
      duoAudio.playErrorBuzz();
      setShowRefillModal(true);
      return;
    }

    duoAudio.playTapSound();
    setActiveLevel(level);
    setSelectedDots([]);
    setFeedbackStatus('idle');
    setMistakesCount(0);
    setIsLevelFinished(false);
    setMascotMood('idle');

    if (level.track === 'deaf_sign') {
      const prompt = `Show hand sign for "${level.target_char}" to the camera!`;
      setMascotSpeech(prompt);
      duoAudio.speakPrompt(prompt);
    } else {
      const prompt = `Form letter "${level.target_char}" in Braille. Use Dots ${level.target_braille_dots?.join(', ')}.`;
      setMascotSpeech(prompt);
      duoAudio.speakPrompt(prompt);
    }
  };

  // Check Braille answer
  const handleCheckBraille = () => {
    if (!activeLevel) return;

    const targetDots = [...(activeLevel.target_braille_dots || [])].sort((a, b) => a - b);
    const userDots = [...selectedDots].sort((a, b) => a - b);
    const isCorrect = JSON.stringify(targetDots) === JSON.stringify(userDots);

    if (isCorrect) {
      handleAnswerSuccess();
    } else {
      handleAnswerMistake(`Almost! Letter ${activeLevel.target_char} is Dots [${targetDots.join(', ')}].`);
    }
  };

  // Camera Sign success handler
  const handleSignCameraSuccess = () => {
    handleAnswerSuccess();
  };

  // Success flow
  const handleAnswerSuccess = async () => {
    if (!activeLevel) return;

    duoAudio.playSuccessChime();
    setFeedbackStatus('correct');
    setFeedbackMessage(`Spot on! +${activeLevel.xp_reward} XP & +${activeLevel.gem_reward} Gems!`);
    setMascotMood('cheering');
    setMascotSpeech('Spectacular job! You mastered this level!');

    try {
      const res = await fetch('/api/gamification/complete-level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profile.user_id,
          level_id: activeLevel.id,
          track: activeLevel.track,
          mistakes_count: mistakesCount,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
        }
      }
    } catch {
      // handled
    }

    setShowConfetti(true);
    setIsLevelFinished(true);
  };

  // Mistake flow
  const handleAnswerMistake = async (explanation: string) => {
    duoAudio.playErrorBuzz();
    setFeedbackStatus('incorrect');
    setFeedbackMessage(explanation);
    setMascotMood('sad');
    setMascotSpeech('Don’t worry! Mistakes help you learn. Try again!');
    setMistakesCount((prev) => prev + 1);

    // Lose a heart
    setProfile((prev) => ({
      ...prev,
      hearts: Math.max(0, prev.hearts - 1),
    }));

    try {
      await fetch('/api/gamification/heart-lost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.user_id }),
      });
    } catch {
      // handled
    }
  };

  // Refill hearts with gems
  const handleRefillHearts = async () => {
    if (profile.gems < 50) return;
    duoAudio.playTapSound();
    try {
      const res = await fetch('/api/gamification/refill-hearts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.user_id, cost: 50 }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile((prev) => ({
          ...prev,
          hearts: data.hearts,
          gems: data.gems,
        }));
        duoAudio.playSuccessChime();
        setShowRefillModal(false);
      }
    } catch {
      // handled
    }
  };

  // Close active challenge
  const handleCloseChallenge = () => {
    duoAudio.stopSpeaking();
    setActiveLevel(null);
    setShowConfetti(false);
    loadData();
  };

  // Group levels into units
  const unitsMap = levels.reduce<Record<number, { title: string; levels: LevelItem[] }>>((acc, lvl) => {
    if (!acc[lvl.unit_number]) {
      acc[lvl.unit_number] = {
        title: lvl.unit_title,
        levels: [],
      };
    }
    acc[lvl.unit_number].levels.push(lvl);
    return acc;
  }, {});

  const unitNumbers = Object.keys(unitsMap).map(Number).sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-[#F7F9FA] dark:bg-[#0F172A] text-slate-800 dark:text-slate-100 flex flex-col items-center">
      {/* ── TOP STICKY DUOLINGO HEADER ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 px-4 py-2.5 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Track Selector Pill */}
          <button
            type="button"
            onClick={() => setShowTrackModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-sm font-bold transition active:scale-95"
            title="Change accessibility learning track"
          >
            {profile.track === 'deaf_sign' ? (
              <>
                <span className="text-xl">🤟</span>
                <span className="hidden sm:inline">Sign Language</span>
                <span className="text-xs text-sky-500 font-extrabold uppercase">(Deaf)</span>
              </>
            ) : (
              <>
                <span className="text-xl">⠃</span>
                <span className="hidden sm:inline">Braille & Audio</span>
                <span className="text-xs text-emerald-500 font-extrabold uppercase">(Blind)</span>
              </>
            )}
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Duolingo Stats Bar (Streak, Gems, Hearts, XP) */}
          <div className="flex items-center gap-2 sm:gap-4 font-extrabold text-sm">
            {/* Streak */}
            <div
              className="flex items-center gap-1 text-orange-500 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded-xl border border-orange-200 dark:border-orange-900/50"
              title="Daily Streak"
            >
              <Flame className="w-5 h-5 fill-orange-500 animate-pulse" />
              <span>{profile.current_streak}</span>
            </div>

            {/* Gems */}
            <button
              type="button"
              onClick={() => setShowRefillModal(true)}
              className="flex items-center gap-1 text-sky-500 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-xl border border-sky-200 dark:border-sky-900/50 hover:bg-sky-100 transition active:scale-95"
              title="Gems / Lingots"
            >
              <Gem className="w-4 h-4 fill-sky-500" />
              <span>{profile.gems}</span>
            </button>

            {/* Hearts */}
            <button
              type="button"
              onClick={() => setShowRefillModal(true)}
              className="flex items-center gap-1 text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 transition active:scale-95"
              title="Hearts / Lives (Click to refill)"
            >
              <Heart className="w-4 h-4 fill-rose-500" />
              <span>{profile.hearts}</span>
            </button>

            {/* Total XP */}
            <div
              className="hidden md:flex items-center gap-1 text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-900/50"
              title="Experience Points"
            >
              <Sparkles className="w-4 h-4 fill-amber-500" />
              <span>{profile.total_xp} XP</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ─────────────────────────────────────────── */}
      <main className="w-full max-w-2xl px-4 py-8 flex flex-col items-center">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center gap-4">
            <SparshyMascot mood="thinking" size="md" speechText="Loading your learning journey..." />
            <span className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-12">
            {unitNumbers.map((unitNum) => {
              const unit = unitsMap[unitNum];
              const unitCompletedCount = unit.levels.filter((l) => l.completed).length;
              const unitTotal = unit.levels.length;
              const unitPercent = Math.round((unitCompletedCount / unitTotal) * 100);

              return (
                <section key={unitNum} className="w-full flex flex-col items-center">
                  {/* Unit Banner */}
                  <div className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-3xl p-5 shadow-lg mb-8 border-b-4 border-emerald-700 flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase font-extrabold tracking-wider text-emerald-100">
                        {unit.title}
                      </div>
                      <h2 className="text-xl font-black mt-0.5">
                        {profile.track === 'deaf_sign' ? 'Sign Language Foundations' : 'Tactile Braille Cell Reading'}
                      </h2>
                      <div className="mt-2 flex items-center gap-2 text-xs font-bold text-emerald-100">
                        <div className="w-32 bg-emerald-800/60 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-white h-full rounded-full transition-all duration-500"
                            style={{ width: `${unitPercent}%` }}
                          />
                        </div>
                        <span>{unitCompletedCount}/{unitTotal} Done</span>
                      </div>
                    </div>

                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center font-extrabold text-2xl shadow-inner">
                      {unitNum}
                    </div>
                  </div>

                  {/* Sinuous Stepping-Stone Progression Path (Duolingo Snake) */}
                  <div className="flex flex-col items-center gap-6 relative w-full py-2">
                    {unit.levels.map((lvl, idx) => {
                      // Snake offsets pattern: Center -> Left -> Center -> Right -> Far Right -> Center -> Left
                      const offsets = [
                        'translate-x-0',
                        '-translate-x-12 sm:-translate-x-16',
                        'translate-x-0',
                        'translate-x-12 sm:translate-x-16',
                        'translate-x-16 sm:translate-x-20',
                        'translate-x-0',
                        '-translate-x-14 sm:-translate-x-18',
                      ];
                      const offsetClass = offsets[idx % offsets.length];

                      return (
                        <div
                          key={lvl.id}
                          className={`relative flex items-center justify-center ${offsetClass} transition-transform duration-300`}
                        >
                          {/* Sparshy Mascot standing next to the Current Active Node */}
                          {lvl.is_current && (
                            <div className="absolute -left-36 -top-6 hidden sm:block animate-in fade-in zoom-in-75 duration-300">
                              <SparshyMascot
                                mood="happy"
                                size="sm"
                                speechText="Start here!"
                                className="filter drop-shadow-md"
                              />
                            </div>
                          )}

                          {/* Level Node 3D Button */}
                          <div className="relative group">
                            <button
                              type="button"
                              onClick={() => handleStartLevel(lvl)}
                              disabled={!lvl.is_unlocked}
                              aria-label={`${lvl.title}, Level ${lvl.level_number}. Status: ${
                                lvl.completed ? 'Completed' : lvl.is_unlocked ? 'Unlocked' : 'Locked'
                              }`}
                              className={`relative w-20 h-20 rounded-full flex flex-col items-center justify-center font-black text-2xl transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-emerald-400 ${
                                lvl.completed
                                  ? 'bg-[#FFC800] text-[#9A6700] border-b-8 border-[#CC9A00] active:border-b-0 active:translate-y-2 shadow-lg'
                                  : lvl.is_unlocked
                                  ? 'bg-[#58CC02] text-white border-b-8 border-[#46A302] active:border-b-0 active:translate-y-2 shadow-xl ring-4 ring-emerald-300/60 ring-offset-2'
                                  : 'bg-slate-300 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-b-8 border-slate-400 dark:border-slate-800 cursor-not-allowed opacity-80'
                              }`}
                            >
                              {/* Inner Node Icon */}
                              {lvl.completed ? (
                                <Crown className="w-8 h-8 fill-current drop-shadow" />
                              ) : lvl.is_unlocked ? (
                                <Star className="w-8 h-8 fill-current drop-shadow" />
                              ) : (
                                <Lock className="w-6 h-6" />
                              )}

                              {/* Star Badges for completed levels */}
                              {lvl.completed && (
                                <div className="absolute -bottom-2 flex items-center gap-0.5 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-full shadow border border-amber-300">
                                  {[1, 2, 3].map((s) => (
                                    <Star
                                      key={s}
                                      className={`w-2.5 h-2.5 ${
                                        s <= lvl.stars ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                              )}
                            </button>

                            {/* Tooltip Hover Pill */}
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs font-bold py-1 px-3 rounded-xl whitespace-nowrap pointer-events-none z-20 shadow-md">
                              {lvl.title} {lvl.completed && '✓'}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Unit Chest Checkpoint */}
                    <div className="relative mt-4 group">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 border-b-4 border-amber-600 shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 transition active:scale-95">
                        <Gift className="w-8 h-8 text-amber-900 animate-bounce" />
                      </div>
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider whitespace-nowrap">
                        Unit {unitNum} Bonus
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* ── TRACK SELECTOR MODAL (Deaf vs Blind) ─────────────────────────────── */}
      {showTrackModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                <span>Choose Learning Track</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowTrackModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 mb-5">
              Select your personalized accessibility path. The curriculum adjusts with full camera recognition or tactile Braille audio.
            </p>

            <div className="flex flex-col gap-3.5">
              {/* Deaf / Hard of Hearing Track */}
              <button
                type="button"
                onClick={() => handleSelectTrack('deaf_sign')}
                className={`p-4 rounded-2xl border-2 text-left transition flex items-center gap-4 ${
                  profile.track === 'deaf_sign'
                    ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 shadow-md ring-2 ring-sky-400'
                    : 'border-slate-200 dark:border-slate-700 hover:border-sky-300'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-sky-500 text-white flex items-center justify-center text-3xl shadow">
                  🤟
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-slate-800 dark:text-slate-100">
                      Deaf / Hard-of-Hearing
                    </span>
                    <Ear className="w-4 h-4 text-sky-500" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Indian Sign Language (ISL) practice verified live with your camera AI!
                  </p>
                </div>
                {profile.track === 'deaf_sign' && <Check className="w-6 h-6 text-sky-600" />}
              </button>

              {/* Blind / Low Vision Track */}
              <button
                type="button"
                onClick={() => handleSelectTrack('blind_braille')}
                className={`p-4 rounded-2xl border-2 text-left transition flex items-center gap-4 ${
                  profile.track === 'blind_braille'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-md ring-2 ring-emerald-400'
                    : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-3xl shadow font-mono">
                  ⠃
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-slate-800 dark:text-slate-100">
                      Blind / Visually Impaired
                    </span>
                    <Eye className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Tactile 6-dot Braille cells with audio tones, haptics & keyboard hotkeys!
                  </p>
                </div>
                {profile.track === 'blind_braille' && <Check className="w-6 h-6 text-emerald-600" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REFILL HEARTS MODAL ─────────────────────────────────────────────── */}
      {showRefillModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <Heart className="w-16 h-16 fill-rose-500 text-rose-500 mx-auto animate-bounce" />
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-3">
              Need More Hearts?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Hearts give you energy to practice. Refill instantly with your hard-earned gems!
            </p>

            <div className="my-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl flex items-center justify-between">
              <div className="text-left">
                <div className="font-bold text-sm text-slate-800 dark:text-slate-200">Refill 5 Hearts</div>
                <div className="text-xs text-slate-400">Back to full energy</div>
              </div>
              <div className="flex items-center gap-1 font-black text-sky-500">
                <Gem className="w-4 h-4 fill-sky-500" />
                <span>50</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleRefillHearts}
                disabled={profile.gems < 50}
                className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm uppercase tracking-wider shadow-lg disabled:opacity-40 transition active:scale-95"
              >
                {profile.gems >= 50 ? 'Refill Now (50 Gems)' : 'Not Enough Gems'}
              </button>
              <button
                type="button"
                onClick={() => setShowRefillModal(false)}
                className="w-full py-2.5 rounded-2xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE LESSON ARENA MODAL (Full Duolingo Exercise Screen) ────────── */}
      {activeLevel && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col justify-between overflow-y-auto">
          {/* Header Progress & Exit */}
          <div className="w-full max-w-3xl mx-auto px-4 pt-6 pb-2 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleCloseChallenge}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Exit lesson"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Progress Bar */}
            <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-4 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: isLevelFinished ? '100%' : '50%' }}
              />
            </div>

            {/* Hearts remaining */}
            <div className="flex items-center gap-1 text-rose-500 font-extrabold text-sm">
              <Heart className="w-5 h-5 fill-rose-500" />
              <span>{profile.hearts}</span>
            </div>
          </div>

          {/* Interactive Challenge Body */}
          <div className="flex-1 w-full max-w-xl mx-auto px-4 py-2 flex flex-col items-center justify-center">
            {/* Top Assistant & Voice Bar */}
            <div className="w-full flex items-center justify-between bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 mb-3 shadow-sm">
              <DuoVoiceAssistant
                track={activeLevel.track}
                targetChar={activeLevel.target_char}
                description={activeLevel.description}
                selectedDots={selectedDots}
                onToggleDot={(dot) => {
                  setSelectedDots((prev) =>
                    prev.includes(dot) ? prev.filter((d) => d !== dot) : [...prev, dot].sort((a, b) => a - b)
                  );
                }}
                onSetDots={(dots) => setSelectedDots(dots)}
                onClearDots={() => setSelectedDots([])}
                onCheckAnswer={activeLevel.track === 'blind_braille' ? handleCheckBraille : undefined}
                onContinue={handleCloseChallenge}
                onAiLessonReceived={(lessonText) => {
                  setAiLessonText(lessonText);
                  setMascotSpeech(lessonText);
                  setMascotMood('happy');
                }}
              />

              {/* Speak Audio Button */}
              <button
                type="button"
                onClick={() => {
                  const prompt =
                    activeLevel.track === 'blind_braille'
                      ? `Form letter "${activeLevel.target_char}" in Braille. ${activeLevel.description}`
                      : `Show hand sign for "${activeLevel.target_char}". ${activeLevel.description}`;
                  duoAudio.speakPrompt(prompt);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-sm transition active:scale-95"
                title="Speak Instructions Aloud"
              >
                <Volume2 className="w-4 h-4 text-emerald-500" />
                <span className="hidden sm:inline">Speak</span>
              </button>
            </div>

            {/* AI Interactive Lesson Card (when generated by AI) */}
            {aiLessonText && (
              <div className="w-full bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl p-3.5 mb-3 shadow animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-indigo-950 dark:text-indigo-200">
                        Sparshy AI Lesson: {activeLevel.target_char}
                      </h4>
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-300">
                        Live Lesson from AI Tutor
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiLessonText(null)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 mt-2 leading-relaxed font-medium">
                  {aiLessonText}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => duoAudio.speakPrompt(aiLessonText)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition active:scale-95"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Listen Again</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mascot Coach with animated reactions */}
            <div className="mb-3">
              <SparshyMascot
                mood={mascotMood}
                size="md"
                speechText={mascotSpeech}
                showAudioButton={true}
              />
            </div>

            {/* Track-Specific Challenge */}
            {activeLevel.track === 'deaf_sign' ? (
              <SignCameraChallenge
                targetSign={activeLevel.target_sign || activeLevel.target_char}
                targetChar={activeLevel.target_char}
                description={activeLevel.description}
                hints={activeLevel.hints || []}
                onSuccess={handleSignCameraSuccess}
                disabled={isLevelFinished}
              />
            ) : (
              <BrailleCellInput
                selectedDots={selectedDots}
                onChange={setSelectedDots}
                targetDots={activeLevel.target_braille_dots || []}
                targetChar={activeLevel.target_char}
                brailleDisplay={activeLevel.braille_display}
                disabled={isLevelFinished}
              />
            )}
          </div>

          {/* ── BOTTOM SLIDING DUOLINGO FEEDBACK DRAWER ─────────────────────── */}
          <div
            className={`w-full border-t-2 py-4 px-6 transition-all duration-300 ${
              feedbackStatus === 'correct'
                ? 'bg-[#D7FFB8] dark:bg-[#1E3A1A] border-[#58CC02]'
                : feedbackStatus === 'incorrect'
                ? 'bg-[#FFDFE0] dark:bg-[#3D1A1E] border-[#EA2B2B]'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
              {/* Feedback text */}
              <div className="flex-1">
                {feedbackStatus === 'correct' ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#58CC02] text-white flex items-center justify-center shadow">
                      <Check className="w-6 h-6 stroke-[3]" />
                    </div>
                    <div>
                      <h4 className="font-black text-lg text-[#58CC02]">Nicely Done!</h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{feedbackMessage}</p>
                    </div>
                  </div>
                ) : feedbackStatus === 'incorrect' ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#EA2B2B] text-white flex items-center justify-center shadow">
                      <X className="w-6 h-6 stroke-[3]" />
                    </div>
                    <div>
                      <h4 className="font-black text-lg text-[#EA2B2B]">Incorrect</h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{feedbackMessage}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-slate-500">
                    {activeLevel.track === 'blind_braille'
                      ? 'Press the active dots and click Check.'
                      : 'Hold hand sign steady in front of the camera.'}
                  </p>
                )}
              </div>

              {/* Action Button */}
              {isLevelFinished ? (
                <button
                  type="button"
                  onClick={handleCloseChallenge}
                  className="px-8 py-3.5 rounded-2xl bg-[#58CC02] hover:bg-[#46A302] text-white font-extrabold text-sm uppercase tracking-wider shadow-lg active:scale-95 transition"
                >
                  Continue
                </button>
              ) : activeLevel.track === 'blind_braille' ? (
                <button
                  type="button"
                  onClick={handleCheckBraille}
                  disabled={selectedDots.length === 0}
                  className="px-8 py-3.5 rounded-2xl bg-[#58CC02] hover:bg-[#46A302] text-white font-extrabold text-sm uppercase tracking-wider shadow-lg disabled:opacity-40 active:scale-95 transition"
                >
                  Check
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Celebration Confetti Overlay on Level Win */}
      <CelebrationOverlay
        show={showConfetti}
        variant="lesson_complete"
        title="Level Complete!"
        subtitle="Awesome job mastering this skill!"
        xp={activeLevel?.xp_reward || 25}
        onClose={() => setShowConfetti(false)}
      />
    </div>
  );
}
