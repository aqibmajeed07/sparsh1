'use client';
import { useAccessibility } from './AccessibilityContext';
import { useState } from 'react';

export default function AccessibilityToolbar() {
    const {
        highContrast,
        largeText,
        dyslexicFont,
        voiceNav,
        profileMode,
        toggleHighContrast,
        toggleLargeText,
        toggleDyslexicFont,
        toggleVoiceNav,
        speak
    } = useAccessibility();

    const [expanded, setExpanded] = useState(false);

    return (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
            {/* Expanded Controls Panel */}
            {expanded && (
                <div className="glass-card p-4 rounded-2xl border-2 border-[#6C63FF]/50 bg-[#1e1e32]/95 backdrop-blur-xl shadow-2xl space-y-3 w-72 mb-2 animate-in fade-in slide-in-from-bottom-5">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <h4 className="text-white font-bold text-sm flex items-center gap-2">
                            <span>♿</span> Accessibility Controls
                        </h4>
                        <button onClick={() => setExpanded(false)} className="text-white/40 hover:text-white text-xs">✕</button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => {
                                toggleHighContrast();
                                speak(highContrast ? "High contrast off" : "High contrast on");
                            }}
                            className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition ${highContrast ? 'bg-yellow-400 text-black font-bold' : 'bg-white/5 text-white/70 hover:bg-white/10'
                                }`}
                        >
                            <span className="text-lg">👁️</span>
                            <span>High Contrast</span>
                        </button>

                        <button
                            onClick={() => {
                                toggleLargeText();
                                speak(largeText ? "Large text off" : "Large text on");
                            }}
                            className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition ${largeText ? 'bg-[#00C9A7] text-white font-bold' : 'bg-white/5 text-white/70 hover:bg-white/10'
                                }`}
                        >
                            <span className="text-lg">🔍</span>
                            <span>Large Text</span>
                        </button>

                        <button
                            onClick={() => {
                                toggleDyslexicFont();
                                speak(dyslexicFont ? "Dyslexic font off" : "Dyslexic font on");
                            }}
                            className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition ${dyslexicFont ? 'bg-[#ce82ff] text-white font-bold' : 'bg-white/5 text-white/70 hover:bg-white/10'
                                }`}
                        >
                            <span className="text-lg">📖</span>
                            <span>Dyslexia Font</span>
                        </button>

                        <button
                            onClick={toggleVoiceNav}
                            className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition ${voiceNav ? 'bg-[#ff4b4b] text-white font-bold animate-pulse' : 'bg-white/5 text-white/70 hover:bg-white/10'
                                }`}
                        >
                            <span className="text-lg">🎙️</span>
                            <span>Voice Nav {voiceNav ? '(ON)' : ''}</span>
                        </button>
                    </div>

                    <div className="pt-2 border-t border-white/10 text-center">
                        <span className="text-[10px] text-white/40 font-semibold uppercase">Active Profile: {profileMode}</span>
                    </div>
                </div>
            )}

            {/* Floating Toggle Button */}
            <button
                onClick={() => setExpanded(prev => !prev)}
                className="w-14 h-14 rounded-full bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white shadow-2xl flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition-all border-2 border-white/20"
                title="Open Accessibility Controls"
            >
                ♿
            </button>
        </div>
    );
}
