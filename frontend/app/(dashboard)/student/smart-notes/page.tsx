'use client';

import { useState } from 'react';
import { useAccessibility } from '@/components/AccessibilityContext';
import { Sparkles, Volume2, HelpCircle, Layers, RefreshCw, BookOpen } from 'lucide-react';

const PRESET_TOPICS = [
    {
        name: '🌱 Photosynthesis',
        text: `Photosynthesis is the process used by plants, algae and certain bacteria to harness energy from sunlight and turn it into chemical energy. The main raw materials are water, carbon dioxide, and sunlight. Chlorophyll is the green pigment that absorbs light. Oxygen is produced as a byproduct.`
    },
    {
        name: '⚛️ Newton\'s 3rd Law',
        text: `Newton's Third Law states that for every action force, there is an equal and opposite reaction force. Forces always occur in pairs. When object A exerts a force on object B, object B simultaneously exerts an equal force in the opposite direction back on object A.`
    },
    {
        name: '🏛️ Indus Valley',
        text: `The Indus Valley Civilization was a Bronze Age civilization in South Asia from 3300 BCE to 1300 BCE. Cities like Harappa and Mohenjo-daro were famous for urban planning, baked brick houses, elaborate drainage systems, and maritime trade.`
    }
];

export default function SmartNotesPage() {
    const [text, setText] = useState(PRESET_TOPICS[0].text);
    const [loading, setLoading] = useState(false);
    const [notesData, setNotesData] = useState<any>({
        summary: "Plants convert sunlight, water, and carbon dioxide into chemical energy and oxygen using chlorophyll.",
        key_points: [
            "Chlorophyll absorbs light energy in plant cells.",
            "Water and Carbon Dioxide are essential raw inputs.",
            "Oxygen gas is released into the atmosphere as a byproduct."
        ],
        flashcards: [
            { front: "What is Chlorophyll?", back: "The green pigment in plants that absorbs solar energy." },
            { front: "What gas is released in Photosynthesis?", back: "Oxygen gas (O2)." },
            { front: "What are the 3 main raw inputs?", back: "Sunlight, Water (H2O), and Carbon Dioxide (CO2)." }
        ]
    });
    const [flippedIndex, setFlippedIndex] = useState<number | null>(null);
    const { speak } = useAccessibility();

    const handleGenerate = async (targetText?: string) => {
        const textToUse = targetText || text;
        if (!textToUse.trim()) return;
        setLoading(true);
        setFlippedIndex(null);

        try {
            const res = await fetch('/api/smart-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToUse })
            });
            const data = await res.json();
            if (data && (data.summary || data.key_points)) {
                setNotesData(data);
                speak("Real-time AI smart notes and flashcards generated!");
            }
        } catch (e) {
            console.error('Smart notes error:', e);
        }

        // Trigger SenseBand Haptics
        try {
            await fetch('/api/senseband/ai-emotion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: 'AI smart notes generated' })
            });
        } catch (err) { }

        setLoading(false);
    };

    return (
        <div className="space-y-6 pb-12">
            <div>
                <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                    <span>🎴</span> Smart Notes & Interactive Flashcards
                </h1>
                <p className="text-white/60 mt-1">Transform any textbook text into real-time AI bullet points & study flashcards</p>
            </div>

            {/* Input & Quick Topics */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#6C63FF]" /> Paste Lesson Text or Select Sample Topic:
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        {PRESET_TOPICS.map((preset, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    setText(preset.text);
                                    handleGenerate(preset.text);
                                }}
                                className="px-3 py-1 bg-white/5 border border-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold rounded-lg transition"
                            >
                                {preset.name}
                            </button>
                        ))}
                    </div>
                </div>

                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste textbook excerpt, lecture notes, or chapter paragraph here..."
                    className="glass-input w-full h-32 p-4 text-white text-sm resize-none rounded-xl font-sans leading-relaxed focus:outline-none focus:border-[#6C63FF]"
                />

                <div className="flex justify-between items-center">
                    <button
                        onClick={() => handleGenerate()}
                        disabled={loading}
                        className="px-6 py-2.5 bg-gradient-to-r from-[#6C63FF] to-indigo-600 text-white font-bold rounded-xl text-sm hover:opacity-90 transition shadow-lg flex items-center gap-2"
                    >
                        <Sparkles className="w-4 h-4 text-pink-300 animate-spin" />
                        <span>{loading ? 'AI Analyzing Text...' : '✨ Generate Smart Notes & Flashcards'}</span>
                    </button>
                    <span className="text-white/40 text-xs">{text.length} characters</span>
                </div>
            </div>

            {/* Summary & Bullet Points */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-6 rounded-2xl border border-[#00C9A7]/30 bg-[#00C9A7]/10 space-y-3">
                    <div className="flex justify-between items-center border-b border-[#00C9A7]/20 pb-2">
                        <h3 className="text-[#00C9A7] font-bold text-base flex items-center gap-2">
                            <span>📌</span> Executive Summary
                        </h3>
                        <button
                            onClick={() => speak(notesData.summary)}
                            className="text-xs text-[#00C9A7] font-bold hover:underline flex items-center gap-1 bg-[#00C9A7]/20 px-2.5 py-1 rounded-lg"
                        >
                            <Volume2 className="w-3.5 h-3.5" /> Listen
                        </button>
                    </div>
                    <p className="text-white text-sm leading-relaxed font-medium">{notesData.summary}</p>
                </div>

                <div className="glass-card p-6 rounded-2xl border border-[#6C63FF]/30 bg-[#6C63FF]/10 space-y-3">
                    <div className="flex justify-between items-center border-b border-[#6C63FF]/20 pb-2">
                        <h3 className="text-[#6C63FF] font-bold text-base flex items-center gap-2">
                            <span>🔑</span> Key Bullet Takeaways
                        </h3>
                        <button
                            onClick={() => speak(notesData.key_points?.join('. '))}
                            className="text-xs text-[#6C63FF] font-bold hover:underline flex items-center gap-1 bg-[#6C63FF]/20 px-2.5 py-1 rounded-lg text-indigo-300"
                        >
                            <Volume2 className="w-3.5 h-3.5" /> Listen
                        </button>
                    </div>
                    <ul className="space-y-2.5">
                        {notesData.key_points?.map((pt: string, i: number) => (
                            <li key={i} className="flex items-start gap-2.5 text-white/90 text-sm">
                                <span className="text-[#00C9A7] font-bold text-base">•</span>
                                <span className="leading-snug">{pt}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Interactive Flashcards */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-xl flex items-center gap-2">
                        <span>🎴</span> Interactive AI Study Flashcards (Click Card to Flip)
                    </h3>
                    <span className="text-white/40 text-xs">Click card to test your memory</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {notesData.flashcards?.map((card: any, i: number) => {
                        const isFlipped = flippedIndex === i;
                        return (
                            <div
                                key={i}
                                onClick={() => {
                                    setFlippedIndex(isFlipped ? null : i);
                                    speak(isFlipped ? card.front : card.back);
                                }}
                                className={`glass-card p-6 min-h-[190px] rounded-2xl border-2 cursor-pointer transition-all transform hover:-translate-y-1 flex flex-col justify-between ${isFlipped ? 'border-[#00C9A7] bg-[#00C9A7]/15 shadow-xl' : 'border-[#6C63FF]/40 bg-[#1e1e32]/60 hover:border-[#6C63FF]'
                                    }`}
                            >
                                <div>
                                    <div className="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-widest text-white/40 mb-3">
                                        <span>CARD #{i + 1}</span>
                                        <span className={isFlipped ? 'text-[#00C9A7] font-bold' : 'text-indigo-400'}>
                                            {isFlipped ? 'ANSWER (FLIPPED)' : 'QUESTION'}
                                        </span>
                                    </div>

                                    <p className="text-white font-bold text-base leading-snug">
                                        {isFlipped ? card.back : card.front}
                                    </p>
                                </div>

                                <div className="mt-4 flex items-center justify-between text-xs text-white/50 border-t border-white/10 pt-2">
                                    <span>💡 Click to {isFlipped ? 'see question' : 'flip answer'}</span>
                                    <span className="text-[#00C9A7] font-bold text-sm">↻</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
