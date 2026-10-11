'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccessibility } from '@/components/AccessibilityContext';
import { sparshKeyboard } from '@/lib/sparshKeyboard';
import type { KeyboardEvent as KBEvent, KeyboardStatus, KeyboardConnectionType } from '@/lib/sparshKeyboard';

// ─── Braille Lookup ──────────────────────────────────────────────────────────
const BRAILLE: Record<string, string> = {
    A: '⠁', B: '⠃', C: '⠉', D: '⠙', E: '⠑', F: '⠋', G: '⠛', H: '⠓',
    I: '⠊', J: '⠚', K: '⠅', L: '⠇', M: '⠍', N: '⠝', O: '⠕', P: '⠏',
    Q: '⠟', R: '⠗', S: '⠎', T: '⠞', U: '⠥', V: '⠧', W: '⠺', X: '⠭',
    Y: '⠽', Z: '⠵',
};

type AppMode = 'typing' | 'learning' | 'word' | 'quiz';

export default function SmartKeyboardPage() {
    const { speak } = useAccessibility();

    // Connection State
    const [status, setStatus] = useState<KeyboardStatus>('disconnected');
    const [connType, setConnType] = useState<KeyboardConnectionType>('none');
    const [logs, setLogs] = useState<string[]>([]);

    // Typing State
    const [typedText, setTypedText] = useState('');
    const [lastKey, setLastKey] = useState('');
    const [keyHistory, setKeyHistory] = useState<KBEvent[]>([]);

    // Mode State
    const [mode, setMode] = useState<AppMode>('typing');

    // Quiz State
    const [quizTarget, setQuizTarget] = useState('');
    const [quizScore, setQuizScore] = useState(0);
    const [quizTotal, setQuizTotal] = useState(0);
    const [quizFeedback, setQuizFeedback] = useState<'correct' | 'wrong' | null>(null);

    const logsEndRef = useRef<HTMLDivElement>(null);

    // ── Subscribe to keyboard events ─────────────────────────────────────────
    useEffect(() => {
        sparshKeyboard.initPhysicalKeyboardListener();

        const unsub1 = sparshKeyboard.onStatus((s) => {
            setStatus(s);
            setConnType(sparshKeyboard.connectionType);
        });
        const unsub2 = sparshKeyboard.onLog((msg) => {
            setLogs(prev => [...prev.slice(-100), msg]);
        });
        const unsub3 = sparshKeyboard.onText((text) => {
            setTypedText(text);
        });
        const unsub4 = sparshKeyboard.onKey((ev) => {
            setKeyHistory(prev => [ev, ...prev].slice(0, 50));
            setLastKey(ev.value);

            // Mode-specific handling
            if (ev.type === 'KEY') {
                handleKeyForMode(ev.value);
            }
        });

        return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
    }, [mode, quizTarget]);

    // Scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // ── Mode-specific key handler ────────────────────────────────────────────
    const handleKeyForMode = useCallback((key: string) => {
        // Learning Mode: Speak each letter + show Braille
        if (mode === 'learning') {
            if (key === 'SPACE') {
                speak('Space');
            } else if (key === 'ENTER') {
                speak('Enter');
            } else {
                const braille = BRAILLE[key.toUpperCase()] || '';
                speak(`${key}. Braille: ${braille}`);
            }
        }

        // Word Mode: Handled by WORD events (auto-speak on word complete)
        if (mode === 'word' && key === 'SPACE') {
            const words = sparshKeyboard.typedText.trim().split(/\s+/);
            const lastWord = words[words.length - 1];
            if (lastWord) {
                speak(lastWord);
            }
        }

        // Quiz Mode: Check answer
        if (mode === 'quiz' && quizTarget) {
            setQuizTotal(prev => prev + 1);
            if (key.toUpperCase() === quizTarget.toUpperCase()) {
                setQuizScore(prev => prev + 1);
                setQuizFeedback('correct');
                speak('Correct!');
                // Next question after delay
                setTimeout(() => {
                    generateQuizQuestion();
                    setQuizFeedback(null);
                }, 1200);
            } else {
                setQuizFeedback('wrong');
                speak(`Wrong. That was ${key}. The correct answer is ${quizTarget}.`);
                setTimeout(() => setQuizFeedback(null), 1500);
            }
        }
    }, [mode, quizTarget, speak]);

    // ── Quiz question generator ──────────────────────────────────────────────
    const generateQuizQuestion = useCallback(() => {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const target = letters[Math.floor(Math.random() * 26)];
        setQuizTarget(target);
        speak(`Press the letter ${target}`);
    }, [speak]);

    // ── Connection handlers ──────────────────────────────────────────────────
    const handleConnectBLE = async () => {
        await sparshKeyboard.connectBLE();
    };
    const handleConnectUSB = async () => {
        await sparshKeyboard.connectUSB();
    };
    const handleDisconnect = async () => {
        await sparshKeyboard.disconnect();
    };
    const handleClear = () => {
        sparshKeyboard.clearText();
        setTypedText('');
    };

    // ── Status indicator ─────────────────────────────────────────────────────
    const statusColor = {
        disconnected: 'bg-red-500',
        connecting: 'bg-yellow-500 animate-pulse',
        connected: 'bg-emerald-500',
        error: 'bg-red-600',
    }[status];

    const statusLabel = {
        disconnected: 'Disconnected',
        connecting: 'Connecting...',
        connected: `Connected (${connType.toUpperCase()})`,
        error: 'Error',
    }[status];

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                        <span>⌨️</span> SPARSH Smart Keyboard
                    </h1>
                    <p className="text-white/60 mt-1">
                        Portable accessibility keyboard — BLE + USB dual-mode
                    </p>
                </div>

                {/* Connection Status Badge */}
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border ${status === 'connected'
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-white/10 bg-white/5'
                        }`}>
                        <span className={`w-3 h-3 rounded-full ${statusColor}`} />
                        <span className={`text-sm font-bold ${status === 'connected' ? 'text-emerald-400' : 'text-white/70'}`}>
                            {statusLabel}
                        </span>
                    </div>
                </div>
            </div>

            {/* Connection Panel */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                    <span>🔗</span> Connection
                </h3>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleConnectBLE}
                        disabled={status === 'connected' || status === 'connecting'}
                        className="px-5 py-3 bg-gradient-to-r from-[#6C63FF] to-[#4F46E5] text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition disabled:opacity-40 flex items-center gap-2"
                    >
                        <span>📶</span> Connect via Bluetooth (BLE)
                    </button>
                    <button
                        onClick={handleConnectUSB}
                        disabled={status === 'connected' || status === 'connecting'}
                        className="px-5 py-3 bg-gradient-to-r from-[#00C9A7] to-[#00A389] text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition disabled:opacity-40 flex items-center gap-2"
                    >
                        <span>🔌</span> Connect via USB Serial
                    </button>
                    {status === 'connected' && (
                        <button
                            onClick={handleDisconnect}
                            className="px-5 py-3 bg-red-500/20 text-red-300 border border-red-500/30 font-bold rounded-xl hover:bg-red-500/30 transition flex items-center gap-2"
                        >
                            <span>⏏</span> Disconnect
                        </button>
                    )}
                </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex p-1.5 bg-[#1e1e32]/60 rounded-2xl border border-white/10">
                {([
                    { key: 'typing', label: '📝 Typing', color: 'bg-[#6C63FF]' },
                    { key: 'learning', label: '📖 Learning', color: 'bg-[#00C9A7]' },
                    { key: 'word', label: '📚 Word Mode', color: 'bg-amber-500' },
                    { key: 'quiz', label: '🎯 Quiz', color: 'bg-pink-500' },
                ] as { key: AppMode; label: string; color: string }[]).map(m => (
                    <button
                        key={m.key}
                        onClick={() => {
                            setMode(m.key);
                            speak(`${m.label} mode activated`);
                            if (m.key === 'quiz') generateQuizQuestion();
                        }}
                        className={`flex-1 py-3 rounded-xl font-bold text-xs transition ${mode === m.key ? `${m.color} text-white shadow-lg` : 'text-white/60 hover:text-white'
                            }`}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left: Live Input Display */}
                <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">

                    {/* Last Key Pressed */}
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#6C63FF]/30 to-[#00C9A7]/30 border-2 border-[#6C63FF]/50 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                            <span className="text-4xl font-black text-white select-none">
                                {lastKey === 'SPACE' ? '⎵' : lastKey === 'ENTER' ? '⏎' : lastKey === 'BACKSPACE' ? '⌫' : lastKey || '—'}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider">Last Key</h3>
                            <p className="text-white font-bold text-lg truncate">
                                {lastKey === 'BACKSPACE' ? 'Backspace (⌫)' : lastKey === 'SPACE' ? 'Space (⎵)' : lastKey === 'ENTER' ? 'Enter (⏎)' : lastKey || 'Waiting...'}
                            </p>
                            {lastKey && lastKey !== 'BACKSPACE' && BRAILLE[lastKey.toUpperCase()] && (
                                <p className="text-yellow-300 text-2xl mt-1">{BRAILLE[lastKey.toUpperCase()]}</p>
                            )}
                            {lastKey === 'BACKSPACE' && (
                                <p className="text-emerald-400 text-xs font-medium mt-1">Character Deleted</p>
                            )}
                        </div>
                    </div>

                    {/* Typed Text Display */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-white font-bold text-sm">Composed Text</h3>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Active Editor
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => speak(typedText || 'No text typed yet')}
                                    className="px-3 py-1.5 bg-[#58cc02] text-white text-xs font-bold rounded-xl hover:bg-[#46a302] transition"
                                >
                                    🔊 Speak
                                </button>
                                <button
                                    onClick={handleClear}
                                    className="px-3 py-1.5 bg-white/10 text-white/70 text-xs font-bold rounded-xl hover:bg-white/20 transition"
                                >
                                    🗑 Clear
                                </button>
                            </div>
                        </div>

                        {/* Composed text area with realistic typing blinker */}
                        <div className="p-4 bg-black/50 rounded-xl border border-white/10 min-h-[130px] flex flex-col justify-between transition focus-within:border-[#00C9A7]/50">
                            <div className="text-white text-lg font-medium leading-relaxed whitespace-pre-wrap break-words font-mono">
                                {typedText ? (
                                    <span>
                                        {typedText}
                                        {/* Typing Blinker / Caret */}
                                        <span 
                                            className="inline-block w-[3px] h-5 bg-[#00C9A7] ml-0.5 align-middle rounded-full animate-pulse shadow-[0_0_8px_#00C9A7]" 
                                            aria-hidden="true"
                                        />
                                    </span>
                                ) : (
                                    <span className="text-white/30 italic flex items-center gap-1.5 font-sans text-base">
                                        <span>Start typing on the SPARSH Keyboard...</span>
                                        {/* Idle typing blinker */}
                                        <span 
                                            className="inline-block w-[3px] h-5 bg-[#00C9A7]/70 ml-0.5 align-middle rounded-full animate-pulse shadow-[0_0_6px_#00C9A7]" 
                                            aria-hidden="true"
                                        />
                                    </span>
                                )}
                            </div>

                            {/* Quick On-Screen Key Controls for Backspace, Space, and Enter */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-white/5 text-xs select-none">
                                <span className="text-white/40">
                                    Length: <strong className="text-white/70 font-mono">{typedText.length}</strong> chars • Words: <strong className="text-white/70 font-mono">{typedText.trim() ? typedText.trim().split(/\s+/).length : 0}</strong>
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => sparshKeyboard.backspace()}
                                        className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 active:bg-red-500/35 border border-red-500/30 text-red-200 rounded-lg font-bold transition flex items-center gap-1.5 text-xs shadow-sm"
                                        title="Delete previous character"
                                    >
                                        <span className="text-sm">⌫</span> Backspace
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => sparshKeyboard.typeKey('SPACE')}
                                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/10 text-white rounded-lg font-bold transition flex items-center gap-1.5 text-xs shadow-sm"
                                        title="Insert space"
                                    >
                                        <span className="text-sm">⎵</span> Space
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => sparshKeyboard.typeKey('ENTER')}
                                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/10 text-white rounded-lg font-bold transition flex items-center gap-1.5 text-xs shadow-sm"
                                        title="Insert new line"
                                    >
                                        <span className="text-sm">⏎</span> Enter
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Braille Translation */}
                    {typedText && (
                        <div className="p-4 bg-[#6C63FF]/10 border border-[#6C63FF]/30 rounded-xl">
                            <h4 className="text-[#6C63FF] text-xs font-bold uppercase tracking-wider mb-2">Braille Translation</h4>
                            <p className="text-yellow-300 text-2xl tracking-[0.2em] font-mono">
                                {typedText.split('').map(c => BRAILLE[c.toUpperCase()] || c).join('')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Right: Mode-specific panel */}
                <div className="space-y-4">

                    {/* ── LEARNING MODE ── */}
                    {mode === 'learning' && (
                        <div className="glass-card p-6 rounded-2xl border border-[#00C9A7]/40 bg-[#00C9A7]/5 space-y-4 animate-in fade-in">
                            <h3 className="text-[#00C9A7] font-bold text-lg flex items-center gap-2">
                                <span>📖</span> Learning Mode
                            </h3>
                            <p className="text-white/70 text-sm">
                                Press any key on the SPARSH Keyboard. The app will speak the letter name, display it large, and show its Braille representation.
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-black/50 rounded-xl border border-white/10 text-center">
                                    <h4 className="text-white/50 text-xs font-bold uppercase mb-2">Letter</h4>
                                    <p className="text-6xl font-black text-white">
                                        {lastKey === 'SPACE' ? '⎵' : lastKey === 'ENTER' ? '⏎' : lastKey === 'BACKSPACE' ? '⌫' : lastKey || '?'}
                                    </p>
                                </div>
                                <div className="p-6 bg-black/50 rounded-xl border border-white/10 text-center">
                                    <h4 className="text-white/50 text-xs font-bold uppercase mb-2">Braille</h4>
                                    <p className="text-6xl text-yellow-300">
                                        {lastKey === 'BACKSPACE' ? '⌫' : lastKey ? (BRAILLE[lastKey.toUpperCase()] || '?') : '⠀'}
                                    </p>
                                </div>
                            </div>

                            {/* Full Alphabet Reference */}
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                <h4 className="text-white/60 text-xs font-bold uppercase mb-3">Alphabet Reference</h4>
                                <div className="grid grid-cols-13 gap-1.5">
                                    {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => (
                                        <div
                                            key={letter}
                                            className={`p-2 rounded-lg text-center transition ${lastKey?.toUpperCase() === letter
                                                ? 'bg-[#00C9A7] text-black scale-110 shadow-lg'
                                                : 'bg-white/5 text-white/60'
                                                }`}
                                        >
                                            <span className="text-xs font-bold block">{letter}</span>
                                            <span className="text-sm block">{BRAILLE[letter]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── WORD MODE ── */}
                    {mode === 'word' && (
                        <div className="glass-card p-6 rounded-2xl border border-amber-500/40 bg-amber-500/5 space-y-4 animate-in fade-in">
                            <h3 className="text-amber-400 font-bold text-lg flex items-center gap-2">
                                <span>📚</span> Word Mode
                            </h3>
                            <p className="text-white/70 text-sm">
                                Type a word and press SPACE or ENTER. The app will display the complete word, speak it aloud, and show its Braille representation.
                            </p>

                            {/* Current word display */}
                            <div className="p-6 bg-black/50 rounded-xl border border-amber-500/30 text-center">
                                <h4 className="text-amber-400/60 text-xs font-bold uppercase mb-2">Current Word</h4>
                                <p className="text-4xl font-black text-white tracking-widest">
                                    {typedText.trim().split(/\s+/).pop()?.toUpperCase() || '—'}
                                </p>
                                <p className="text-2xl text-yellow-300 mt-2 tracking-[0.15em]">
                                    {(typedText.trim().split(/\s+/).pop() || '').split('').map(c => BRAILLE[c.toUpperCase()] || c).join('')}
                                </p>
                            </div>

                            {/* Word History */}
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                <h4 className="text-white/60 text-xs font-bold uppercase mb-2">Word History</h4>
                                <div className="flex flex-wrap gap-2">
                                    {typedText.trim().split(/\s+/).filter(Boolean).map((word, i) => (
                                        <button
                                            key={i}
                                            onClick={() => speak(word)}
                                            className="px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm font-bold rounded-xl hover:bg-amber-500/25 transition"
                                        >
                                            {word}
                                        </button>
                                    ))}
                                    {!typedText.trim() && (
                                        <span className="text-white/30 text-sm italic">Type words on the keyboard...</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── QUIZ MODE ── */}
                    {mode === 'quiz' && (
                        <div className="glass-card p-6 rounded-2xl border border-pink-500/40 bg-pink-500/5 space-y-4 animate-in fade-in">
                            <h3 className="text-pink-400 font-bold text-lg flex items-center gap-2">
                                <span>🎯</span> Quiz Mode
                            </h3>

                            {/* Score */}
                            <div className="flex gap-4">
                                <div className="flex-1 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
                                    <span className="text-xs font-bold text-emerald-400 uppercase">Score</span>
                                    <p className="text-3xl font-black text-emerald-400">{quizScore}</p>
                                </div>
                                <div className="flex-1 p-4 bg-white/5 border border-white/10 rounded-xl text-center">
                                    <span className="text-xs font-bold text-white/50 uppercase">Total</span>
                                    <p className="text-3xl font-black text-white/70">{quizTotal}</p>
                                </div>
                                <div className="flex-1 p-4 bg-[#6C63FF]/10 border border-[#6C63FF]/30 rounded-xl text-center">
                                    <span className="text-xs font-bold text-[#6C63FF] uppercase">Accuracy</span>
                                    <p className="text-3xl font-black text-[#6C63FF]">
                                        {quizTotal > 0 ? Math.round((quizScore / quizTotal) * 100) : 0}%
                                    </p>
                                </div>
                            </div>

                            {/* Target Letter */}
                            <div className={`p-8 rounded-2xl text-center transition-all ${quizFeedback === 'correct'
                                ? 'bg-emerald-500/20 border-2 border-emerald-500'
                                : quizFeedback === 'wrong'
                                    ? 'bg-red-500/20 border-2 border-red-500 animate-pulse'
                                    : 'bg-black/50 border-2 border-pink-500/30'
                                }`}>
                                <h4 className="text-white/50 text-xs font-bold uppercase mb-3">Press this letter:</h4>
                                <p className="text-8xl font-black text-white">{quizTarget || '?'}</p>
                                <p className="text-4xl text-yellow-300 mt-3">{BRAILLE[quizTarget] || ''}</p>

                                {quizFeedback === 'correct' && (
                                    <p className="text-emerald-400 font-bold text-lg mt-3">✅ Correct!</p>
                                )}
                                {quizFeedback === 'wrong' && (
                                    <p className="text-red-400 font-bold text-lg mt-3">❌ Wrong — Try again!</p>
                                )}
                            </div>

                            {/* Controls */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { generateQuizQuestion(); }}
                                    className="flex-1 py-3 bg-pink-500 text-white font-bold rounded-xl hover:bg-pink-600 transition"
                                >
                                    🔄 Next Question
                                </button>
                                <button
                                    onClick={() => { setQuizScore(0); setQuizTotal(0); generateQuizQuestion(); }}
                                    className="px-4 py-3 bg-white/10 text-white/70 font-bold rounded-xl hover:bg-white/20 transition text-sm"
                                >
                                    Reset Score
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── TYPING MODE (default) ── */}
                    {mode === 'typing' && (
                        <div className="glass-card p-6 rounded-2xl border border-[#6C63FF]/40 bg-[#6C63FF]/5 space-y-4 animate-in fade-in">
                            <h3 className="text-[#6C63FF] font-bold text-lg flex items-center gap-2">
                                <span>📝</span> Typing Mode
                            </h3>
                            <p className="text-white/70 text-sm">
                                All key presses are displayed live. Words are automatically detected. Press SPACE to complete a word. Press ENTER for a new line.
                            </p>

                            {/* Key event history */}
                            <div className="p-4 bg-black/50 rounded-xl border border-white/10 max-h-[300px] overflow-y-auto">
                                <h4 className="text-white/50 text-xs font-bold uppercase mb-2">Key Event Log</h4>
                                {keyHistory.length === 0 ? (
                                    <p className="text-white/30 text-sm italic">Waiting for key presses...</p>
                                ) : (
                                    <div className="space-y-1">
                                        {keyHistory.slice(0, 20).map((ev, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs">
                                                <span className={`px-2 py-0.5 rounded font-bold ${ev.type === 'KEY' ? 'bg-[#6C63FF]/20 text-[#6C63FF]'
                                                    : ev.type === 'WORD' ? 'bg-amber-500/20 text-amber-400'
                                                        : 'bg-white/10 text-white/50'
                                                    }`}>
                                                    {ev.type}
                                                </span>
                                                <span className="text-white font-medium">{ev.value}</span>
                                                <span className="text-white/30 ml-auto">
                                                    {new Date(ev.timestamp).toLocaleTimeString()}
                                                </span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${ev.connection === 'ble' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                                                    }`}>
                                                    {ev.connection.toUpperCase()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Connection Log */}
                    <div className="glass-card p-4 rounded-2xl border border-white/10">
                        <h4 className="text-white/50 text-xs font-bold uppercase mb-2">System Log</h4>
                        <div className="p-3 bg-black/50 rounded-xl max-h-[160px] overflow-y-auto font-mono text-xs text-white/50 space-y-0.5">
                            {logs.length === 0 ? (
                                <p className="italic">No events yet...</p>
                            ) : (
                                logs.slice(-20).map((log, i) => (
                                    <p key={i}>{log}</p>
                                ))
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
