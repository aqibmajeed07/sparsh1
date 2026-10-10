'use client';
import { useState } from 'react';
import { useAccessibility } from '@/components/AccessibilityContext';
import { senseBand } from '@/lib/senseband';

// Standard 6-Dot Braille Unicode Map
const TEXT_TO_BRAILLE_MAP: Record<string, string> = {
    a: '⠁', b: '⠃', c: '⠉', d: '⠙', e: '⠑', f: '⠋', g: '⠛', h: '⠠', i: '⠊', j: '⠚',
    k: '⠅', l: '⠇', m: '⠍', n: '⠝', o: '⠕', p: '⠏', q: '⠟', r: '⠗', s: '⠎', t: '⠞',
    u: '⠌', v: '⠧', w: '⠺', x: '⠭', y: '⠽', z: '⠵', ' ': ' ',
    '1': '⠁', '2': '⠃', '3': '⠉', '4': '⠙', '5': '⠑', '6': '⠋', '7': '⠛', '8': '⠠', '9': '⠊', '0': '⠚'
};

// Map from active dot pattern (array of numbers 1-6) to character
const DOTS_TO_CHAR_MAP: Record<string, string> = {
    '1': 'a',
    '1,2': 'b',
    '1,4': 'c',
    '1,4,5': 'd',
    '1,5': 'e',
    '1,2,4': 'f',
    '1,2,4,5': 'g',
    '1,2,5': 'h',
    '2,4': 'i',
    '2,4,5': 'j',
    '1,3': 'k',
    '1,2,3': 'l',
    '1,3,4': 'm',
    '1,3,4,5': 'n',
    '1,3,5': 'o',
    '1,2,3,4': 'p',
    '1,2,3,4,5': 'q',
    '1,2,3,5': 'r',
    '2,3,4': 's',
    '2,3,4,5': 't',
    '1,3,6': 'u',
    '1,2,3,6': 'v',
    '2,4,5,6': 'w',
    '1,3,4,6': 'x',
    '1,3,4,5,6': 'y',
    '1,3,5,6': 'z',
};

export default function BrailleLabPage() {
    const [mode, setMode] = useState<'textToBraille' | 'brailleToText'>('textToBraille');

    // Text to Braille State
    const [inputText, setInputText] = useState('hello sparsh');

    // 6-Dot Keypad State (Braille to Text)
    const [activeDots, setActiveDots] = useState<number[]>([]);
    const [translatedSentence, setTranslatedSentence] = useState('');

    const { speak } = useAccessibility();

    // Convert text string to Braille Unicode string
    const convertTextToBraille = (text: string) => {
        return text
            .toLowerCase()
            .split('')
            .map(char => TEXT_TO_BRAILLE_MAP[char] || char)
            .join('');
    };

    const handleSpeakText = () => {
        speak(inputText);
    };

    const toggleDot = (dotNum: number) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(60); // Haptic tap feedback for blind users
        }
        setActiveDots(prev => {
            const next = prev.includes(dotNum) ? prev.filter(d => d !== dotNum) : [...prev, dotNum].sort();
            return next;
        });
    };

    const handleCommitBrailleCell = () => {
        const key = activeDots.join(',');
        const char = DOTS_TO_CHAR_MAP[key] || '?';
        setTranslatedSentence(prev => {
            const next = prev + char;
            // Word completed (space follows) → double pulse
            if (next.endsWith(' ')) senseBand.send('MESSAGE');
            return next;
        });
        speak(char === '?' ? "Unknown cell pattern" : `Letter ${char}`);
        // Correct letter → short pulse; Unknown → long pulse
        if (char !== '?') {
            senseBand.send('CORRECT');
        } else {
            senseBand.send('WRONG');
        }
        setActiveDots([]); // Reset cell for next character
    };

    const handleSpace = () => {
        setTranslatedSentence(prev => prev + ' ');
        speak("Space");
    };

    const handleBackspace = () => {
        setTranslatedSentence(prev => prev.slice(0, -1));
        speak("Delete");
    };

    const handleSpeakTranslated = () => {
        if (!translatedSentence.trim()) {
            speak("No translated text yet. Press Braille dots to compose letters.");
            return;
        }
        speak(translatedSentence);
    };

    const handleDownloadBraillePDF = () => {
        const brailleOutput = convertTextToBraille(inputText) || '⠃⠗⠁⠊⠇⠇⠑';
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Sparsh Tactile Braille Embossing Document</title>
                    <style>
                        body { font-family: 'Courier New', monospace; padding: 40px; color: #000; background: #fff; }
                        .header { border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 30px; }
                        .title { font-size: 24px; font-weight: bold; }
                        .subtitle { font-size: 14px; color: #555; margin-top: 5px; }
                        .section { margin-bottom: 30px; }
                        .section-title { font-size: 16px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px; }
                        .original-text { font-size: 18px; font-weight: bold; line-height: 1.6; }
                        .braille-output { font-size: 54px; letter-spacing: 0.4em; font-family: monospace; line-height: 1.8; background: #f9f9f9; padding: 25px; border: 2px dashed #000; border-radius: 10px; word-break: break-all; }
                        .dot-grid { display: flex; flex-wrap: wrap; gap: 15px; margin-top: 15px; }
                        .dot-card { border: 2px solid #000; padding: 10px; border-radius: 8px; text-align: center; width: 70px; }
                        .dot-letter { font-size: 18px; font-weight: bold; text-transform: uppercase; }
                        .dot-symbol { font-size: 36px; margin: 5px 0; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="title">⠃ Sparsh Tactile Braille Printable Document</div>
                        <div class="subtitle">Designed for tactile learning, swell paper, braille embossers, & classroom touch practice</div>
                    </div>

                    <div class="section">
                        <div class="section-title">Original Text</div>
                        <div class="original-text">${inputText}</div>
                    </div>

                    <div class="section">
                        <div class="section-title">Tactile 6-Dot Braille Output (Grade 1)</div>
                        <div class="braille-output">${brailleOutput}</div>
                    </div>

                    <div class="section">
                        <div class="section-title">Tactile Letter & Dot Position Guide</div>
                        <div class="dot-grid">
                            ${inputText.toLowerCase().split('').map(char => {
            if (char === ' ') return '';
            const bChar = TEXT_TO_BRAILLE_MAP[char] || char;
            return `
                                    <div class="dot-card">
                                        <div class="dot-letter">${char}</div>
                                        <div class="dot-symbol">${bChar}</div>
                                    </div>
                                `;
        }).join('')}
                        </div>
                    </div>

                    <script>
                        window.onload = () => { window.print(); };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
        speak("Opening printable Braille PDF document view");
    };

    return (
        <div className="space-y-6 pb-12">
            <div>
                <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                    <span>⠃</span> Braille ⇄ Text ⇄ Audio Speech Lab
                </h1>
                <p className="text-white/60 mt-1">
                    Two-way real-time translator between Text, 6-Dot Tactile Braille, and Audio Text-to-Speech
                </p>
            </div>

            {/* Mode Switcher */}
            <div className="flex p-1.5 bg-[#1e1e32]/60 rounded-2xl border border-white/10 max-w-md">
                <button
                    onClick={() => {
                        setMode('textToBraille');
                        speak("Text to Braille and Speech mode");
                    }}
                    className={`flex-1 py-3 rounded-xl font-bold text-xs transition ${mode === 'textToBraille' ? 'bg-[#6C63FF] text-white shadow-lg' : 'text-white/60 hover:text-white'
                        }`}
                >
                    🔤 Text ➔ Braille & Speech
                </button>
                <button
                    onClick={() => {
                        setMode('brailleToText');
                        speak("Interactive 6-Dot Braille Keypad to Text and Speech mode");
                    }}
                    className={`flex-1 py-3 rounded-xl font-bold text-xs transition ${mode === 'brailleToText' ? 'bg-[#00C9A7] text-white shadow-lg' : 'text-white/60 hover:text-white'
                        }`}
                >
                    ⠃ 6-Dot Braille Keypad ➔ Speech
                </button>
            </div>

            {/* MODE 1: Text ➔ Braille & Speech */}
            {mode === 'textToBraille' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-white font-bold text-base">Type English or Hindi Text:</h3>
                            <button
                                onClick={handleSpeakText}
                                className="px-4 py-2 bg-[#58cc02] text-white font-bold text-xs rounded-xl hover:bg-[#46a302] transition flex items-center gap-1.5"
                            >
                                <span>🔊</span> Speak Text (TTS)
                            </button>
                        </div>

                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="e.g. Welcome to Sparsh accessible learning..."
                            className="glass-input w-full h-28 p-4 text-white text-base resize-none rounded-xl"
                        />
                    </div>

                    {/* Braille Display Output */}
                    <div className="glass-card p-6 rounded-2xl border border-[#6C63FF]/40 bg-[#6C63FF]/10 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-[#6C63FF] font-bold text-base flex items-center gap-2">
                                <span>⠃</span> Tactile 6-Dot Braille Output (Grade 1):
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleDownloadBraillePDF}
                                    className="px-4 py-2 bg-[#6C63FF] text-white font-bold text-xs rounded-xl hover:bg-[#584ee4] transition flex items-center gap-1.5 shadow-lg"
                                >
                                    <span>📄</span> Download Braille Tactile PDF
                                </button>
                                <button
                                    onClick={() => speak(`Braille translation: ${inputText}`)}
                                    className="px-3 py-2 bg-white/10 text-xs text-white font-bold rounded-xl hover:bg-white/20 transition flex items-center gap-1"
                                >
                                    <span>🔊</span> Listen
                                </button>
                            </div>
                        </div>

                        <div className="p-6 bg-black/60 rounded-xl border border-white/10 overflow-x-auto">
                            <p className="text-4xl text-yellow-300 tracking-[0.3em] font-mono leading-relaxed select-all">
                                {convertTextToBraille(inputText) || '⠃⠗⠁⠊⠇⠇⠑'}
                            </p>
                        </div>

                        {/* Visual Dot Cell Breakdown */}
                        <div className="pt-2">
                            <h4 className="text-white/70 font-bold text-xs uppercase tracking-wider mb-3">Letter Breakdown & Dot Positions:</h4>
                            <div className="flex flex-wrap gap-3">
                                {inputText.toLowerCase().split('').map((char, index) => {
                                    if (char === ' ') return <div key={index} className="w-6" />;
                                    const brailleChar = TEXT_TO_BRAILLE_MAP[char] || char;
                                    return (
                                        <div key={index} className="p-3 bg-white/5 border border-white/10 rounded-xl text-center space-y-1">
                                            <span className="text-[#00C9A7] font-bold text-sm block uppercase">{char}</span>
                                            <span className="text-2xl text-yellow-300 block">{brailleChar}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODE 2: 6-Dot Braille Keypad ➔ Text & Speech */}
            {mode === 'brailleToText' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 6-Dot Tactile Matrix Keypad */}
                        <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col items-center space-y-4">
                            <h3 className="text-white font-bold text-base text-center">
                                Interactive 6-Dot Cell Input (Haptic Touch Enabled)
                            </h3>
                            <p className="text-white/50 text-xs text-center">Tap dots to form a letter, then press "Commit Cell"</p>

                            {/* 6-Dot Matrix Display */}
                            <div className="grid grid-cols-2 gap-6 p-6 bg-black/50 border-2 border-[#00C9A7]/40 rounded-2xl">
                                {/* Column 1: Dots 1, 2, 3 */}
                                <div className="space-y-4 flex flex-col items-center">
                                    {[1, 2, 3].map(dotNum => {
                                        const isSelected = activeDots.includes(dotNum);
                                        return (
                                            <button
                                                key={dotNum}
                                                onClick={() => toggleDot(dotNum)}
                                                className={`w-14 h-14 rounded-full border-4 font-bold text-base transition-all flex items-center justify-center ${isSelected
                                                    ? 'bg-yellow-400 border-yellow-300 text-black scale-110 shadow-lg shadow-yellow-400/40'
                                                    : 'bg-white/10 border-white/20 text-white/50 hover:border-[#00C9A7]'
                                                    }`}
                                            >
                                                {dotNum}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Column 2: Dots 4, 5, 6 */}
                                <div className="space-y-4 flex flex-col items-center">
                                    {[4, 5, 6].map(dotNum => {
                                        const isSelected = activeDots.includes(dotNum);
                                        return (
                                            <button
                                                key={dotNum}
                                                onClick={() => toggleDot(dotNum)}
                                                className={`w-14 h-14 rounded-full border-4 font-bold text-base transition-all flex items-center justify-center ${isSelected
                                                    ? 'bg-yellow-400 border-yellow-300 text-black scale-110 shadow-lg shadow-yellow-400/40'
                                                    : 'bg-white/10 border-white/20 text-white/50 hover:border-[#00C9A7]'
                                                    }`}
                                            >
                                                {dotNum}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Current Cell Preview & Commit */}
                            <div className="flex gap-2 w-full pt-2">
                                <button
                                    onClick={handleCommitBrailleCell}
                                    className="flex-1 py-3 bg-[#00C9A7] text-white font-bold rounded-xl text-xs hover:bg-[#00b093] transition shadow-lg"
                                >
                                    ✓ Commit Cell ({DOTS_TO_CHAR_MAP[activeDots.join(',')] || '?'})
                                </button>
                                <button
                                    onClick={handleSpace}
                                    className="px-4 py-3 bg-white/10 text-white font-bold rounded-xl text-xs hover:bg-white/20 transition"
                                >
                                    Space
                                </button>
                                <button
                                    onClick={handleBackspace}
                                    className="px-4 py-3 bg-red-500/20 text-red-300 border border-red-500/30 font-bold rounded-xl text-xs hover:bg-red-500/30 transition"
                                >
                                    ⌫
                                </button>
                            </div>
                        </div>

                        {/* Live Translated Speech Screen */}
                        <div className="glass-card p-6 rounded-2xl border border-[#00C9A7]/40 bg-[#1e1e32]/60 space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
                                    <h3 className="text-[#00C9A7] font-bold text-base flex items-center gap-2">
                                        <span>🔊</span> Composed Text & Speech Output
                                    </h3>
                                    <button
                                        onClick={handleSpeakTranslated}
                                        className="px-3 py-1.5 bg-[#58cc02] text-white text-xs font-bold rounded-xl hover:bg-[#46a302] transition"
                                    >
                                        🔊 Read Aloud
                                    </button>
                                </div>

                                <div className="p-6 bg-black/60 rounded-xl border border-white/10 min-h-[140px]">
                                    <p className="text-2xl font-bold text-white leading-relaxed">
                                        {translatedSentence || <span className="text-white/30 italic">Target text will appear here as you tap Braille dots...</span>}
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 bg-[#6C63FF]/15 border border-[#6C63FF]/30 rounded-xl text-xs text-white/80">
                                <p className="font-bold text-[#6C63FF] mb-1">💡 Braille Guide:</p>
                                <p>• Dot 1 = "A" | Dots 1,2 = "B" | Dots 1,4 = "C" | Dots 1,4,5 = "D"</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
