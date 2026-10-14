'use client';

import React, { useEffect, useCallback } from 'react';
import { duoAudio } from '@/lib/duoAudio';
import { Volume2, RotateCcw, Keyboard } from 'lucide-react';

interface BrailleCellInputProps {
  selectedDots: number[];
  onChange: (dots: number[]) => void;
  targetDots: number[];
  targetChar: string;
  brailleDisplay?: string;
  disabled?: boolean;
}

// Dot positions & keyboard bindings
const DOT_CONFIG = [
  { dot: 1, label: 'Dot 1 (Top Left)', key: 'F', row: 1, col: 1 },
  { dot: 4, label: 'Dot 4 (Top Right)', key: 'J', row: 1, col: 2 },
  { dot: 2, label: 'Dot 2 (Middle Left)', key: 'D', row: 2, col: 1 },
  { dot: 5, label: 'Dot 5 (Middle Right)', key: 'K', row: 2, col: 2 },
  { dot: 3, label: 'Dot 3 (Bottom Left)', key: 'S', row: 3, col: 1 },
  { dot: 6, label: 'Dot 6 (Bottom Right)', key: 'L', row: 3, col: 2 },
];

export default function BrailleCellInput({
  selectedDots,
  onChange,
  targetDots,
  targetChar,
  brailleDisplay,
  disabled = false,
}: BrailleCellInputProps) {
  const toggleDot = useCallback(
    (dot: number) => {
      if (disabled) return;
      duoAudio.playBrailleDotTone(dot);
      if (selectedDots.includes(dot)) {
        onChange(selectedDots.filter((d) => d !== dot));
      } else {
        onChange([...selectedDots, dot].sort((a, b) => a - b));
      }
    },
    [disabled, selectedDots, onChange]
  );

  const clearDots = () => {
    if (disabled) return;
    duoAudio.playTapSound();
    onChange([]);
  };

  // Listen to physical keyboard standard Braille keys (f, d, s, j, k, l)
  useEffect(() => {
    if (disabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const key = e.key.toUpperCase();
      const dotMap: Record<string, number> = {
        F: 1,
        D: 2,
        S: 3,
        J: 4,
        K: 5,
        L: 6,
      };

      if (dotMap[key]) {
        e.preventDefault();
        toggleDot(dotMap[key]);
      } else if (key === 'BACKSPACE' || key === 'ESCAPE') {
        clearDots();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, toggleDot]);

  const speakDots = () => {
    const text = `Target letter is ${targetChar}. Press dots ${targetDots.join(', ')}.`;
    duoAudio.speakPrompt(text);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      {/* Target Letter Reference Pill */}
      <div className="flex items-center justify-between w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
            {targetChar}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Target Braille
            </div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="font-mono text-2xl text-emerald-600 dark:text-emerald-400">
                {brailleDisplay || '⠿'}
              </span>
              <span>(Dots {targetDots.join(', ')})</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={speakDots}
          className="p-2.5 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-emerald-600 border border-slate-200 dark:border-slate-600 shadow-sm transition active:scale-95"
          title="Audio guide"
          aria-label="Read Braille instructions aloud"
        >
          <Volume2 className="w-5 h-5" />
        </button>
      </div>

      {/* 6-Dot Braille Cell (The Slate) */}
      <div
        className="relative bg-slate-900 border-4 border-slate-700 rounded-3xl p-6 shadow-2xl w-full flex flex-col items-center"
        role="group"
        aria-label="6-Dot Interactive Braille Cell"
      >
        <div className="grid grid-cols-2 gap-x-12 gap-y-6">
          {DOT_CONFIG.map(({ dot, label, key }) => {
            const isFilled = selectedDots.includes(dot);
            return (
              <button
                key={dot}
                type="button"
                disabled={disabled}
                onClick={() => toggleDot(dot)}
                aria-label={`${label}, Keyboard key ${key}. Currently ${isFilled ? 'raised' : 'flat'}`}
                aria-pressed={isFilled}
                className={`relative group w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-400 ${
                  isFilled
                    ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_0_24px_rgba(16,185,129,0.7)] scale-105 border-2 border-white'
                    : 'bg-slate-800 hover:bg-slate-750 border-2 border-slate-600 shadow-inner'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-90'}`}
              >
                {/* Visual Dot Pin */}
                <span
                  className={`w-6 h-6 rounded-full transition-all duration-200 ${
                    isFilled ? 'bg-white shadow-md scale-110' : 'bg-slate-700 group-hover:bg-slate-600'
                  }`}
                />
                <span
                  className={`text-[11px] font-bold mt-1 tracking-wider ${
                    isFilled ? 'text-white' : 'text-slate-400'
                  }`}
                >
                  Dot {dot}
                </span>
                {/* Physical Keyboard Indicator Badge */}
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-md bg-slate-950 text-[10px] font-mono text-slate-300 border border-slate-700 shadow">
                  {key}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Controls & Clear Button */}
        <div className="flex items-center justify-between w-full mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Keyboard className="w-4 h-4 text-emerald-400" />
            <span>Use keys: F, D, S (left) & J, K, L (right)</span>
          </div>
          <button
            type="button"
            onClick={clearDots}
            disabled={disabled || selectedDots.length === 0}
            className="flex items-center gap-1 text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>
    </div>
  );
}
