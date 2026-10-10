'use client';
import { useState } from 'react';
import { useAccessibility } from '@/components/AccessibilityContext';

export default function HomeworkHelperPage() {
    const [question, setQuestion] = useState('');
    const [loading, setLoading] = useState(false);
    const [solution, setSolution] = useState<any>(null);
    const { speak } = useAccessibility();

    const handleSolve = async () => {
        if (!question.trim()) return;
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'}/api/homework-helper`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });
            const data = await res.json();
            setSolution(data);
            speak(`Solution ready. Step 1: ${data.steps?.[0] || 'Understand the question'}`);
        } catch (e) {
            setSolution({
                steps: [
                    "Step 1: Identify what is given in the question and what needs to be solved.",
                    "Step 2: Use the primary scientific or mathematical principle.",
                    "Step 3: Calculate carefully to reach the final answer."
                ],
                summary: "Break complex homework problems into small simple logical steps.",
                practice_tip: "Try re-reading the question out loud using Text-to-Speech!"
            });
        }
        setLoading(false);
    };

    const SAMPLE_QUESTIONS = [
        "Why do leaves change color in autumn?",
        "If a train travels 120 km in 2 hours, what is its average speed?",
        "What is the difference between a physical and a chemical change?"
    ];

    return (
        <div className="space-y-6 pb-12">
            <div>
                <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                    <span>📝</span> AI Homework Helper
                </h1>
                <p className="text-white/60 mt-1">Ask any homework question to get simple, step-by-step AI explanations</p>
            </div>

            {/* Input Form */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                <h3 className="text-white font-bold text-base">Type or paste your homework question:</h3>
                <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g. Explain how plants absorb water from the soil..."
                    className="glass-input w-full h-32 p-4 text-white text-sm resize-none rounded-xl"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2 flex-wrap">
                        {SAMPLE_QUESTIONS.map((q, i) => (
                            <button
                                key={i}
                                onClick={() => setQuestion(q)}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 text-xs rounded-xl border border-white/10 transition"
                            >
                                Sample: {q.substring(0, 30)}...
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleSolve}
                        disabled={loading || !question.trim()}
                        className="px-6 py-3 bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition disabled:opacity-50"
                    >
                        {loading ? 'Solving with AI...' : '💡 Explain Homework Step-by-Step'}
                    </button>
                </div>
            </div>

            {/* AI Solution Result */}
            {solution && (
                <div className="glass-card p-6 rounded-2xl border border-[#00C9A7]/40 bg-[#1e1e32]/60 space-y-6 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <h3 className="text-[#00C9A7] font-bold text-lg flex items-center gap-2">
                            <span>✨</span> AI Step-by-Step Explanation
                        </h3>
                        <button
                            onClick={() => speak(solution.steps?.join('. '))}
                            className="px-3 py-1.5 bg-[#58cc02] text-white rounded-xl text-xs font-bold hover:bg-[#46a302] transition flex items-center gap-1"
                        >
                            <span>🔊</span> Listen
                        </button>
                    </div>

                    {/* Core Concept Summary */}
                    <div className="p-4 bg-[#6C63FF]/15 border border-[#6C63FF]/30 rounded-xl">
                        <p className="text-xs font-extrabold text-[#6C63FF] uppercase tracking-wider mb-1">Core Concept Summary</p>
                        <p className="text-white text-sm font-medium">{solution.summary}</p>
                    </div>

                    {/* Steps */}
                    <div className="space-y-3">
                        <h4 className="text-white font-bold text-sm">Step-by-Step Breakdown:</h4>
                        {solution.steps?.map((step: string, index: number) => (
                            <div key={index} className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-start gap-3">
                                <span className="w-7 h-7 rounded-full bg-[#00C9A7] text-black font-extrabold text-sm flex items-center justify-center shrink-0">
                                    {index + 1}
                                </span>
                                <p className="text-white/90 text-sm leading-relaxed mt-0.5">{step}</p>
                            </div>
                        ))}
                    </div>

                    {/* Practice Tip */}
                    {solution.practice_tip && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-2 text-xs text-yellow-300">
                            <span>💡</span>
                            <span className="font-semibold">{solution.practice_tip}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
