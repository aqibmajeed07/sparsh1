'use client';

import React from 'react';
import { Volume2 } from 'lucide-react';
import { duoAudio } from '@/lib/duoAudio';

export type MascotMood = 'idle' | 'happy' | 'cheering' | 'thinking' | 'sad' | 'triumph';

interface SparshyMascotProps {
  mood?: MascotMood;
  speechText?: string;
  size?: 'sm' | 'md' | 'lg';
  showAudioButton?: boolean;
  className?: string;
}

export default function SparshyMascot({
  mood = 'idle',
  speechText,
  size = 'md',
  showAudioButton = false,
  className = '',
}: SparshyMascotProps) {
  const sizeMap = {
    sm: { width: 100, height: 110, textClass: 'text-xs' },
    md: { width: 150, height: 165, textClass: 'text-sm' },
    lg: { width: 210, height: 230, textClass: 'text-base' },
  };

  const { width, height, textClass } = sizeMap[size];

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (speechText) {
      duoAudio.speakPrompt(speechText);
    }
  };

  return (
    <div className={`relative inline-flex items-center gap-3 select-none ${className}`}>
      {/* Speech Bubble */}
      {speechText && (
        <div className="relative max-w-[260px] bg-white dark:bg-slate-800 border-2 border-emerald-400 dark:border-emerald-500 rounded-2xl px-3.5 py-2.5 shadow-lg animate-in fade-in slide-in-from-left-2 duration-300">
          <div className="flex items-start gap-2">
            <p className={`font-semibold text-slate-800 dark:text-slate-100 ${textClass} leading-snug`}>
              {speechText}
            </p>
            {showAudioButton && (
              <button
                type="button"
                onClick={handleSpeak}
                className="p-1 rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-slate-700 transition"
                title="Hear message"
                aria-label="Listen to message"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Bubble tail pointing toward mascot */}
          <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-0 h-0 border-y-8 border-y-transparent border-l-8 border-l-white dark:border-l-slate-800" />
        </div>
      )}

      {/* Mascot Graphic */}
      <div className="relative flex items-center justify-center">
        <svg
          width={width}
          height={height}
          viewBox="0 0 160 176"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transition-transform duration-300 ${
            mood === 'cheering' || mood === 'triumph'
              ? 'animate-bounce'
              : mood === 'happy'
              ? 'hover:scale-105'
              : ''
          }`}
          role="img"
          aria-label={`Sparshy the Peacock Mascot, current mood: ${mood}`}
        >
          {/* Glow / Aura for Triumph & Cheering */}
          {(mood === 'cheering' || mood === 'triumph') && (
            <circle cx="80" cy="95" r="70" fill="url(#sparkleGlow)" opacity="0.6" className="animate-pulse" />
          )}

          <defs>
            <radialGradient id="sparkleGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0EA5E9" />
              <stop offset="50%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#0369A1" />
            </linearGradient>
            <linearGradient id="bellyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="tailGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>

          {/* Peacock Tail Fan (Background) */}
          <g id="peacock-tail">
            {/* Leftmost feather */}
            <path
              d="M 45 130 C 25 105 20 65 35 45 C 45 55 48 95 50 120 Z"
              fill="url(#tailGrad)"
              stroke="#065F46"
              strokeWidth="2"
            />
            <circle cx="33" cy="55" r="6" fill="#FBBF24" />
            <circle cx="33" cy="55" r="3" fill="#0284C7" />

            {/* Mid-left feather */}
            <path
              d="M 58 120 C 45 90 45 50 60 30 C 70 42 70 85 68 115 Z"
              fill="url(#tailGrad)"
              stroke="#065F46"
              strokeWidth="2"
            />
            <circle cx="56" cy="40" r="7" fill="#FBBF24" />
            <circle cx="56" cy="40" r="3.5" fill="#0284C7" />

            {/* Center-top feather */}
            <path
              d="M 72 110 C 70 75 72 35 80 20 C 88 35 90 75 88 110 Z"
              fill="url(#tailGrad)"
              stroke="#065F46"
              strokeWidth="2"
            />
            <circle cx="80" cy="30" r="8" fill="#FBBF24" />
            <circle cx="80" cy="30" r="4" fill="#0284C7" />

            {/* Mid-right feather */}
            <path
              d="M 92 115 C 90 85 90 42 100 30 C 115 50 115 90 102 120 Z"
              fill="url(#tailGrad)"
              stroke="#065F46"
              strokeWidth="2"
            />
            <circle cx="104" cy="40" r="7" fill="#FBBF24" />
            <circle cx="104" cy="40" r="3.5" fill="#0284C7" />

            {/* Rightmost feather */}
            <path
              d="M 110 120 C 112 95 115 55 125 45 C 140 65 135 105 115 130 Z"
              fill="url(#tailGrad)"
              stroke="#065F46"
              strokeWidth="2"
            />
            <circle cx="127" cy="55" r="6" fill="#FBBF24" />
            <circle cx="127" cy="55" r="3" fill="#0284C7" />
          </g>

          {/* Peacock Feet */}
          <path d="M 62 145 L 62 160 M 55 160 L 69 160" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
          <path d="M 98 145 L 98 160 M 91 160 L 105 160" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />

          {/* Main Body */}
          <ellipse cx="80" cy="110" rx="42" ry="40" fill="url(#bodyGrad)" />
          {/* Emerald Belly Patch */}
          <ellipse cx="80" cy="118" rx="28" ry="26" fill="url(#bellyGrad)" />

          {/* Head Crest Feathers */}
          <path d="M 74 65 L 66 45" stroke="#047857" strokeWidth="3" strokeLinecap="round" />
          <circle cx="65" cy="43" r="5" fill="#10B981" />
          <circle cx="65" cy="43" r="2.5" fill="#FBBF24" />

          <path d="M 80 63 L 80 40" stroke="#047857" strokeWidth="3" strokeLinecap="round" />
          <circle cx="80" cy="38" r="6" fill="#10B981" />
          <circle cx="80" cy="38" r="3" fill="#FBBF24" />

          <path d="M 86 65 L 94 45" stroke="#047857" strokeWidth="3" strokeLinecap="round" />
          <circle cx="95" cy="43" r="5" fill="#10B981" />
          <circle cx="95" cy="43" r="2.5" fill="#FBBF24" />

          {/* Head */}
          <circle cx="80" cy="78" r="28" fill="url(#bodyGrad)" />

          {/* Eyes & Expressions */}
          {mood === 'happy' || mood === 'cheering' || mood === 'triumph' ? (
            // Smiling happy eyes (crescents)
            <g id="eyes-happy">
              <path d="M 64 78 Q 70 70 76 78" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              <path d="M 84 78 Q 90 70 96 78" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              {/* Rosy Cheeks */}
              <circle cx="62" cy="85" r="4" fill="#F43F5E" opacity="0.6" />
              <circle cx="98" cy="85" r="4" fill="#F43F5E" opacity="0.6" />
            </g>
          ) : mood === 'sad' ? (
            // Sad / concerned eyes with tear
            <g id="eyes-sad">
              <ellipse cx="70" cy="78" rx="5" ry="6" fill="#1E293B" />
              <circle cx="68" cy="76" r="2" fill="white" />
              <ellipse cx="90" cy="78" rx="5" ry="6" fill="#1E293B" />
              <circle cx="88" cy="76" r="2" fill="white" />
              {/* Teardrop */}
              <path d="M 96 85 C 96 88 93 90 91 88 C 90 86 94 82 96 85 Z" fill="#38BDF8" />
            </g>
          ) : mood === 'thinking' ? (
            // Curious tilted eyes
            <g id="eyes-thinking">
              <circle cx="70" cy="75" r="6" fill="#1E293B" />
              <circle cx="68" cy="73" r="2.5" fill="white" />
              <circle cx="90" cy="75" r="6" fill="#1E293B" />
              <circle cx="88" cy="73" r="2.5" fill="white" />
            </g>
          ) : (
            // Default wide friendly eyes
            <g id="eyes-default">
              <ellipse cx="69" cy="76" rx="6.5" ry="7.5" fill="white" stroke="#0F172A" strokeWidth="1.5" />
              <circle cx="70" cy="76" r="4" fill="#0F172A" />
              <circle cx="68" cy="74" r="1.5" fill="white" />

              <ellipse cx="91" cy="76" rx="6.5" ry="7.5" fill="white" stroke="#0F172A" strokeWidth="1.5" />
              <circle cx="90" cy="76" r="4" fill="#0F172A" />
              <circle cx="88" cy="74" r="1.5" fill="white" />
            </g>
          )}

          {/* Golden Beak */}
          <polygon points="73,83 87,83 80,95" fill="url(#goldGrad)" stroke="#B45309" strokeWidth="1.5" />

          {/* Wings */}
          {mood === 'cheering' || mood === 'triumph' ? (
            // Wings raised up in celebration
            <g id="wings-cheering">
              <path
                d="M 40 105 C 30 85 25 70 32 62 C 40 70 48 88 52 105 Z"
                fill="#0284C7"
                stroke="#0369A1"
                strokeWidth="2"
              />
              <path
                d="M 120 105 C 130 85 135 70 128 62 C 120 70 112 88 108 105 Z"
                fill="#0284C7"
                stroke="#0369A1"
                strokeWidth="2"
              />
            </g>
          ) : (
            // Relaxed / folded wings
            <g id="wings-normal">
              <path
                d="M 42 102 C 34 110 32 125 40 132 C 46 128 48 116 48 105 Z"
                fill="#0284C7"
                stroke="#0369A1"
                strokeWidth="2"
              />
              <path
                d="M 118 102 C 126 110 128 125 120 132 C 114 128 112 116 112 105 Z"
                fill="#0284C7"
                stroke="#0369A1"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Champion Crown (for Triumph / Win) */}
          {mood === 'triumph' && (
            <g id="crown" transform="translate(62, 28)">
              <polygon
                points="0,18 7,5 18,14 29,5 36,18"
                fill="url(#goldGrad)"
                stroke="#92400E"
                strokeWidth="1.5"
              />
              <circle cx="7" cy="5" r="2.5" fill="#EF4444" />
              <circle cx="18" cy="14" r="2" fill="#3B82F6" />
              <circle cx="29" cy="5" r="2.5" fill="#10B981" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
