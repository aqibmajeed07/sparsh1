'use client';

import { useAccessibility } from '@/components/AccessibilityContext';
import { Sparkles, CheckCircle2, Volume2, Eye, Ear, BookOpen, Gamepad2, Sliders, RefreshCw } from 'lucide-react';

export default function AccessibilityProfilePage() {
    const {
        profileMode,
        setProfileMode,
        highContrast,
        largeText,
        dyslexicFont,
        voiceNav,
        toggleHighContrast,
        toggleLargeText,
        toggleDyslexicFont,
        toggleVoiceNav,
        speak
    } = useAccessibility();

    const PROFILES = [
        {
            id: 'visual',
            title: 'Visually Impaired',
            icon: '👁️',
            LucideIcon: Eye,
            color: '#1cb0f6',
            description: 'Auto-enables High Contrast, Large Text, Auto Text-to-Speech, and Voice Navigation.',
            features: ['High Contrast Theme', 'Large Font Size', 'Voice Command Navigation', 'Auto Speech Engine']
        },
        {
            id: 'hearing',
            title: 'Deaf & Hard of Hearing',
            icon: '🤟',
            LucideIcon: Ear,
            color: '#00C9A7',
            description: 'Auto-enables Camera Sign Language Lab, Live Captions, and ISL Gloss Translation.',
            features: ['Live CC Subtitles', 'Camera Gesture Detector', 'ISL Gloss Parser', 'Visual Cues']
        },
        {
            id: 'dyslexia',
            title: 'Dyslexic Learner',
            icon: '📖',
            LucideIcon: BookOpen,
            color: '#ce82ff',
            description: 'Auto-enables High Legibility Dyslexic Font, Line Spacing, and Audio Paragraph Reader.',
            features: ['Dyslexic High-Legibility Font', 'Increased Line Height', 'Highlighted Audio Reader', 'Simplified Language']
        },
        {
            id: 'motor',
            title: 'Motor / Switch Access',
            icon: '🎮',
            LucideIcon: Gamepad2,
            color: '#ff9600',
            description: 'Enables large tap targets, keyboard switch control, and high-visibility focus borders.',
            features: ['Large Touch Buttons', 'Switch Keyboard Shortcuts', 'Dwell-Click Support', 'No Precision Motions']
        }
    ];

    const handleApplyProfile = async (profId: string, title: string) => {
        setProfileMode(profId);
        speak(`Applying ${title} Accessibility Profile.`);

        // SenseBand Haptics trigger
        try {
            await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/senseband/ai-emotion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: `Accessibility profile changed to ${title}` })
            });
        } catch (e) { }
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                        <span>⚙️</span> Accessibility Profile Setup
                    </h1>
                    <p className="text-white/60 mt-1">Select your personalized learning profile to automatically configure assistive tools</p>
                </div>
                <button
                    onClick={() => {
                        setProfileMode('general');
                        speak("Standard accessibility profile active.");
                    }}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 text-xs font-bold rounded-xl border border-white/15 transition flex items-center gap-2"
                >
                    <RefreshCw className="w-3.5 h-3.5" /> Reset to Standard Profile
                </button>
            </div>

            {/* Profiles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {PROFILES.map(prof => {
                    const isActive = profileMode === prof.id;
                    const IconComponent = prof.LucideIcon;

                    return (
                        <div
                            key={prof.id}
                            onClick={() => handleApplyProfile(prof.id, prof.title)}
                            className={`glass-card p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${isActive
                                ? 'border-[#6C63FF] bg-[#6C63FF]/15 shadow-2xl scale-[1.02]'
                                : 'border-white/10 bg-[#1e1e32]/40 hover:border-white/25 hover:scale-[1.01]'
                                }`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-3xl flex items-center justify-center">
                                            {prof.icon}
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-xl flex items-center gap-2">
                                                {prof.title}
                                            </h3>
                                            {isActive && (
                                                <span className="px-2.5 py-0.5 rounded-full bg-[#00C9A7]/20 text-[#00C9A7] text-[10px] font-extrabold uppercase border border-[#00C9A7]/40 flex items-center gap-1 mt-1 inline-flex">
                                                    <CheckCircle2 className="w-3 h-3" /> ACTIVE PROFILE
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <p className="text-white/70 text-sm leading-relaxed mb-4">{prof.description}</p>

                                <div className="space-y-2">
                                    {prof.features.map((feat, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs text-white/80">
                                            <span className="text-[#00C9A7] font-bold">✓</span>
                                            <span>{feat}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleApplyProfile(prof.id, prof.title);
                                }}
                                className={`mt-6 w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isActive
                                    ? 'bg-[#6C63FF] text-white shadow-lg'
                                    : 'bg-white/5 text-white/70 hover:bg-white/15'
                                    }`}
                            >
                                {isActive ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-[#00C9A7]" /> Active Profile
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 text-pink-300" /> Apply {prof.title} Profile
                                    </>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Active Interactive Settings Status */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-[#6C63FF]" /> Active Assistive System Status (Click Any Box to Toggle):
                    </h3>
                    <span className="text-white/40 text-xs">Real-Time Interactive Controls</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <button
                        onClick={() => {
                            toggleHighContrast();
                            speak(highContrast ? "High contrast mode disabled." : "High contrast mode enabled.");
                        }}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${highContrast
                            ? 'bg-yellow-500/25 border-yellow-400 text-yellow-300 shadow-lg scale-[1.02]'
                            : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                            }`}
                    >
                        <p className="text-xs font-bold uppercase tracking-wider">High Contrast</p>
                        <p className="text-base font-extrabold mt-1">{highContrast ? '⚡ ENABLED' : 'DISABLED'}</p>
                    </button>

                    <button
                        onClick={() => {
                            toggleLargeText();
                            speak(largeText ? "Large font mode disabled." : "Large font mode enabled.");
                        }}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${largeText
                            ? 'bg-[#00C9A7]/25 border-[#00C9A7] text-[#00C9A7] shadow-lg scale-[1.02]'
                            : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                            }`}
                    >
                        <p className="text-xs font-bold uppercase tracking-wider">Large Font</p>
                        <p className="text-base font-extrabold mt-1">{largeText ? '🔍 ENABLED' : 'DISABLED'}</p>
                    </button>

                    <button
                        onClick={() => {
                            toggleDyslexicFont();
                            speak(dyslexicFont ? "Dyslexic font mode disabled." : "Dyslexic font mode enabled.");
                        }}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${dyslexicFont
                            ? 'bg-[#ce82ff]/25 border-[#ce82ff] text-[#ce82ff] shadow-lg scale-[1.02]'
                            : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                            }`}
                    >
                        <p className="text-xs font-bold uppercase tracking-wider">Dyslexic Font</p>
                        <p className="text-base font-extrabold mt-1">{dyslexicFont ? '📖 ENABLED' : 'DISABLED'}</p>
                    </button>

                    <button
                        onClick={toggleVoiceNav}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${voiceNav
                            ? 'bg-[#ff4b4b]/25 border-[#ff4b4b] text-[#ff4b4b] shadow-lg animate-pulse scale-[1.02]'
                            : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                            }`}
                    >
                        <p className="text-xs font-bold uppercase tracking-wider">Voice Nav</p>
                        <p className="text-base font-extrabold mt-1">{voiceNav ? '🎙️ LISTENING' : 'DISABLED'}</p>
                    </button>
                </div>
            </div>
        </div>
    );
}
