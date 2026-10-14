'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, Sparkles, Brain, Loader2 } from 'lucide-react';
import { duoAudio } from '@/lib/duoAudio';

interface DuoVoiceAssistantProps {
  track: 'deaf_sign' | 'blind_braille';
  targetChar: string;
  description: string;
  selectedDots?: number[];
  onToggleDot?: (dot: number) => void;
  onSetDots?: (dots: number[]) => void;
  onClearDots?: () => void;
  onCheckAnswer?: () => void;
  onContinue?: () => void;
  onAiLessonReceived?: (lessonText: string) => void;
}

export default function DuoVoiceAssistant({
  track,
  targetChar,
  description,
  selectedDots = [],
  onToggleDot,
  onSetDots,
  onClearDots,
  onCheckAnswer,
  onContinue,
  onAiLessonReceived,
}: DuoVoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [lastHeardCommand, setLastHeardCommand] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // Request AI Lesson
  const requestAiLesson = useCallback(
    async (studentQuery?: string) => {
      setIsAiLoading(true);
      try {
        const res = await fetch('/api/gamification/ai-lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            track,
            target_char: targetChar,
            description,
            student_query: studentQuery,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.lesson_text || '';
          if (text) {
            duoAudio.speakPrompt(text);
            if (onAiLessonReceived) {
              onAiLessonReceived(text);
            }
          }
        }
      } catch (err) {
        console.warn('[DuoVoice] AI lesson fetch failed:', err);
      } finally {
        setIsAiLoading(false);
      }
    },
    [track, targetChar, description, onAiLessonReceived]
  );

  // Process voice commands
  const processCommand = useCallback(
    (rawTranscript: string) => {
      const heard = rawTranscript.trim().toLowerCase();
      setTranscript(rawTranscript);
      setLastHeardCommand(rawTranscript);

      // 1. General commands
      if (heard.includes('check') || heard.includes('submit') || heard.includes('verify') || heard.includes('done')) {
        duoAudio.playTapSound();
        if (onCheckAnswer) onCheckAnswer();
        return;
      }

      if (heard.includes('continue') || heard.includes('next level') || heard.includes('next')) {
        duoAudio.playTapSound();
        if (onContinue) onContinue();
        return;
      }

      if (heard.includes('clear') || heard.includes('reset') || heard.includes('erase')) {
        duoAudio.playTapSound();
        if (onClearDots) onClearDots();
        return;
      }

      if (heard.includes('teach me') || heard.includes('explain') || heard.includes('help') || heard.includes('lesson')) {
        duoAudio.speakPrompt('Asking Sparshy AI Tutor...');
        requestAiLesson();
        return;
      }

      if (heard.includes('read') || heard.includes('speak') || heard.includes('repeat')) {
        duoAudio.speakPrompt(`Target is ${targetChar}. ${description}`);
        return;
      }

      // 2. Specific questions for AI (e.g. "how do I...", "why...")
      if (
        heard.startsWith('why') ||
        heard.startsWith('how') ||
        heard.startsWith('what') ||
        heard.startsWith('tell me') ||
        heard.includes('?')
      ) {
        duoAudio.speakPrompt('Great question! Let me check with Sparshy AI...');
        requestAiLesson(rawTranscript);
        return;
      }

      // 3. Braille Dot commands (e.g. "dot one", "dot 1", "dots 1 and 2", "dot 4")
      if (track === 'blind_braille') {
        const dotWords: Record<string, number> = {
          '1': 1, one: 1, first: 1,
          '2': 2, two: 2, second: 2,
          '3': 3, three: 3, third: 3,
          '4': 4, four: 4, fourth: 4,
          '5': 5, five: 5, fifth: 5,
          '6': 6, six: 6, sixth: 6,
        };

        const matchedDots: number[] = [];
        Object.entries(dotWords).forEach(([word, num]) => {
          if (heard.includes(`dot ${word}`) || heard.includes(`dots ${word}`) || heard.includes(word)) {
            if (!matchedDots.includes(num)) {
              matchedDots.push(num);
            }
          }
        });

        if (matchedDots.length > 0) {
          if (matchedDots.length === 1 && onToggleDot) {
            onToggleDot(matchedDots[0]);
          } else if (onSetDots) {
            onSetDots(matchedDots.sort((a, b) => a - b));
          }
          return;
        }
      }
    },
    [track, targetChar, description, onCheckAnswer, onContinue, onClearDots, onToggleDot, onSetDots, requestAiLesson]
  );

  // Initialize Speech Recognition
  const toggleListening = () => {
    if (typeof window === 'undefined') return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setIsSupported(false);
      duoAudio.speakPrompt('Voice recognition not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      duoAudio.playTapSound();
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        duoAudio.playTapSound();
        duoAudio.speakPrompt('Listening! Say "Teach me", "Check", or call out dots.');
      };

      recognition.onresult = (event: any) => {
        const lastIdx = event.results.length - 1;
        const heard = event.results[lastIdx][0].transcript;
        processCommand(heard);
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          setIsListening(false);
          duoAudio.speakPrompt('Microphone permission blocked. Please allow mic access in your browser.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn('[DuoVoice] Failed starting speech recognition:', e);
      setIsListening(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Voice Recognition Microphone Button */}
      <button
        type="button"
        onClick={toggleListening}
        aria-label={isListening ? 'Stop voice recognition' : 'Start voice recognition commands'}
        className={`relative p-2.5 rounded-2xl flex items-center gap-2 font-bold text-xs transition-all active:scale-95 shadow-md ${
          isListening
            ? 'bg-rose-500 text-white ring-4 ring-rose-300 animate-pulse'
            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
        }`}
        title="Voice Control (Hands-Free / Voice recognition)"
      >
        {isListening ? (
          <>
            <Mic className="w-4 h-4 fill-current animate-bounce" />
            <span className="hidden sm:inline">Listening...</span>
          </>
        ) : (
          <>
            <Mic className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Voice Control</span>
          </>
        )}
      </button>

      {/* AI Teach Me Button */}
      <button
        type="button"
        onClick={() => requestAiLesson()}
        disabled={isAiLoading}
        aria-label="Ask Sparshy AI Tutor to teach this lesson"
        className="p-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition disabled:opacity-50"
        title="AI Interactive Lesson"
      >
        {isAiLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="hidden sm:inline">AI Teaching...</span>
          </>
        ) : (
          <>
            <Brain className="w-4 h-4" />
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">AI Lesson</span>
          </>
        )}
      </button>

      {/* Transcript Toast when speech is heard */}
      {lastHeardCommand && (
        <div className="hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] shadow animate-in fade-in slide-in-from-top-1">
          <span className="text-slate-400">Heard:</span>
          <span className="font-bold">"{lastHeardCommand}"</span>
        </div>
      )}
    </div>
  );
}
