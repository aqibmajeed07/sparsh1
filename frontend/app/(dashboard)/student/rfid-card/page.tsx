'use client';
import { useState, useEffect } from 'react';
import { useAccessibility } from '@/components/AccessibilityContext';
import { supabase } from '@/lib/supabase';
import { Radio, Cpu, Plus, Sparkles, CheckCircle, Volume2, Key, Zap, RefreshCw } from 'lucide-react';

export default function RFIDCardPage() {
    const [activeCard, setActiveCard] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
    const [quizScore, setQuizScore] = useState<number | null>(null);
    const [customTagInput, setCustomTagInput] = useState('');
    const [readerConnected, setReaderConnected] = useState(false);
    const [lastScannedUid, setLastScannedUid] = useState<string | null>(null);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [cards, setCards] = useState<any[]>([]);

    // Register Form State
    const [regCardId, setRegCardId] = useState('');
    const [regTitle, setRegTitle] = useState('');
    const [regSubject, setRegSubject] = useState('Science');
    const [regGrade, setRegGrade] = useState('8');
    const [regDescription, setRegDescription] = useState('');
    const [registering, setRegistering] = useState(false);

    const { speak } = useAccessibility();

    // Fetch real lessons from database to populate physical card deck
    useEffect(() => {
        async function loadDbCards() {
            try {
                const { data } = await supabase.from('lessons').select('id, title, subject, grade, thumbnail_url').limit(8);
                if (data && data.length > 0) {
                    const colorList = [
                        'from-emerald-500 to-teal-600',
                        'from-amber-500 to-orange-600',
                        'from-pink-500 to-rose-600',
                        'from-indigo-500 to-purple-600',
                        'from-blue-500 to-cyan-600',
                        'from-purple-600 to-pink-600',
                        'from-emerald-600 to-blue-600',
                        'from-cyan-500 to-blue-500',
                    ];
                    setCards(data.map((l, i) => ({
                        id: `CARD-${(i + 1) * 1024}`,
                        name: l.title,
                        subject: l.subject,
                        icon: l.thumbnail_url || '📖',
                        color: colorList[i % colorList.length],
                        uid: `CARD-${(i + 1) * 1024}`
                    })));
                }
            } catch (e) {
                console.error(e);
            }
        }
        loadDbCards();
    }, []);

    const handleTapCard = async (cardId: string) => {
        setLoading(true);
        setQuizScore(null);
        setSelectedAnswers({});
        setLastScannedUid(cardId.toUpperCase());

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/rfid/tap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ card_id: cardId })
            });
            const data = await res.json();
            setActiveCard(data.card);
            speak(`RFID card detected. Loading ${data.card.title}. ${data.card.summary}`);

            // Trigger SenseBand Haptic Pulse if API available
            try {
                await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/senseband/ai-emotion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: `Card scanned: ${data.card.title}` })
                });
            } catch (e) { }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleRegisterNewCard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regCardId.trim() || !regTitle.trim()) return;

        setRegistering(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/rfid/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    card_id: regCardId,
                    title: regTitle,
                    subject: regSubject,
                    grade: regGrade,
                    topic_description: regDescription
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setShowRegisterModal(false);
                handleTapCard(regCardId);
            }
        } catch (e) {
            console.error(e);
        }
        setRegistering(false);
    };

    // Hardware Serial Reader Listener Integration
    const connectHardwareSerialReader = async () => {
        if ('serial' in navigator) {
            try {
                const port = await (navigator as any).serial.requestPort();
                await port.open({ baudRate: 115200 });
                setReaderConnected(true);

                const textDecoder = new TextDecoderStream();
                const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
                const reader = textDecoder.readable.getReader();

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (value) {
                        const trimmed = value.trim();
                        if (trimmed.startsWith('CARD:') || trimmed.length >= 4) {
                            const uid = trimmed.replace('CARD:', '').trim();
                            handleTapCard(uid);
                        }
                    }
                }
            } catch (err) {
                console.log('Serial connection note:', err);
            }
        } else {
            alert('Web Serial API is available in Chrome / Edge. You can also manually type or scan any hardware RFID UID below!');
        }
    };

    const handleCheckQuiz = () => {
        if (!activeCard || !activeCard.quiz) return;
        let correct = 0;
        activeCard.quiz.forEach((q: any, i: number) => {
            if (selectedAnswers[i] === q.answer) correct++;
        });
        setQuizScore(correct);
        speak(`Quiz completed. You scored ${correct} out of ${activeCard.quiz.length}`);
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                        <span>💳</span> Hardware RFID Smart Learning Card Reader
                    </h1>
                    <p className="text-white/60 mt-1">ESP32 + RC522 Hardware Reader integration — Tap physical card to open lesson & instant AI quiz</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={connectHardwareSerialReader}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${readerConnected ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-white/10 text-white hover:bg-white/20 border-white/15'}`}
                    >
                        <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
                        {readerConnected ? '🟢 Hardware ESP32 Reader Active' : '🔌 Connect ESP32 Hardware Reader'}
                    </button>
                    <button
                        onClick={() => setShowRegisterModal(true)}
                        className="px-4 py-2 bg-gradient-to-r from-[#6C63FF] to-pink-600 text-white font-bold text-xs rounded-xl shadow-lg hover:opacity-90 transition flex items-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" /> Register Physical RFID Tag
                    </button>
                </div>
            </div>

            {/* Hardware RFID Scanner & Live Input Bar */}
            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-white/5 space-y-3">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-[#00C9A7]" />
                        <div>
                            <h4 className="text-white font-semibold text-sm">Scan or Type Any Physical RFID Tag UID</h4>
                            <p className="text-white/40 text-xs">Supports RC522, PN532, NFC 13.56MHz, or Barcode Cards (e.g. CARD-4012, E2801192, 04A2B3C4)</p>
                        </div>
                    </div>
                    {lastScannedUid && (
                        <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-full text-xs font-mono">
                            Last Tag Scanned: {lastScannedUid}
                        </span>
                    )}
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={customTagInput}
                        onChange={e => setCustomTagInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && customTagInput.trim()) {
                                handleTapCard(customTagInput);
                                setCustomTagInput('');
                            }
                        }}
                        placeholder="Scan RFID tag with USB/BLE reader or enter UID (e.g. CARD-4012, E2801192)..."
                        className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-[#00C9A7]"
                    />
                    <button
                        onClick={() => {
                            if (customTagInput.trim()) {
                                handleTapCard(customTagInput);
                                setCustomTagInput('');
                            }
                        }}
                        disabled={loading || !customTagInput.trim()}
                        className="px-5 py-2.5 bg-[#00C9A7] text-white font-bold text-xs rounded-xl hover:opacity-90 transition shadow-lg disabled:opacity-50"
                    >
                        Tap Card →
                    </button>
                </div>
            </div>

            {/* Tap Physical Card Deck */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                        <span>📻</span> Hardware RFID Learning Card Collection ({cards.length} Cards):
                    </h3>
                    <span className="text-xs text-white/40 font-mono">Tap any card below to simulate physical RFID swipe</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {cards.map(c => (
                        <button
                            key={c.id}
                            onClick={() => handleTapCard(c.id)}
                            disabled={loading}
                            className={`p-4 rounded-2xl bg-gradient-to-br ${c.color} text-white text-left font-bold shadow-xl hover:scale-[1.03] transition-all cursor-pointer border border-white/20 flex flex-col justify-between min-h-[140px]`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-3xl">{c.icon}</span>
                                    <span className="text-[10px] bg-black/30 backdrop-blur px-2 py-0.5 rounded-full text-white/90 font-mono">
                                        {c.subject}
                                    </span>
                                </div>
                                <h4 className="text-sm font-extrabold leading-snug">{c.name}</h4>
                            </div>
                            <div className="mt-3 pt-2 border-t border-white/20 flex items-center justify-between text-[10px] text-white/80 font-mono">
                                <span>UID: {c.uid}</span>
                                <span>NFC 13.56MHz</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Reader Output Screen */}
            {loading ? (
                <div className="glass-card p-12 text-center rounded-2xl border border-[#00C9A7]/40">
                    <span className="w-10 h-10 border-4 border-[#00C9A7] border-t-transparent rounded-full animate-spin inline-block mb-3" />
                    <p className="text-white font-bold">Scanning Hardware RFID Chip via ESP32 & AI Backend...</p>
                </div>
            ) : activeCard ? (
                <div className="glass-card p-6 rounded-2xl border border-[#00C9A7]/40 bg-[#1e1e32]/60 space-y-6 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-[#00C9A7]/20 text-[#00C9A7] rounded-full text-xs font-extrabold uppercase border border-[#00C9A7]/40 font-mono">
                                    Card Active: {activeCard.card_id}
                                </span>
                                <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-xs font-semibold">
                                    {activeCard.subject} • Grade {activeCard.grade}
                                </span>
                            </div>
                            <h2 className="text-2xl font-extrabold text-white mt-2">{activeCard.title}</h2>
                        </div>
                        <button
                            onClick={() => speak(activeCard.summary)}
                            className="px-4 py-2 bg-[#58cc02] text-white rounded-xl text-xs font-bold hover:bg-[#46a302] transition flex items-center gap-1.5 shrink-0"
                        >
                            <Volume2 className="w-4 h-4" /> Listen AI Audio Summary
                        </button>
                    </div>

                    {/* AI Summary */}
                    <div className="p-4 bg-[#6C63FF]/15 border border-[#6C63FF]/30 rounded-xl space-y-1">
                        <h4 className="text-[#6C63FF] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Instant AI Lesson Summary
                        </h4>
                        <p className="text-white text-sm font-medium leading-relaxed">{activeCard.summary}</p>
                    </div>

                    {/* Auto Quiz */}
                    <div className="space-y-4">
                        <h3 className="text-white font-bold text-base flex items-center gap-2">
                            <span>📝</span> Card Assessment Quiz:
                        </h3>

                        {activeCard.quiz?.map((q: any, qi: number) => (
                            <div key={qi} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                                <p className="text-white font-bold text-sm">Q{qi + 1}: {q.question}</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    {q.options.map((opt: string) => (
                                        <button
                                            key={opt}
                                            onClick={() => setSelectedAnswers(prev => ({ ...prev, [qi]: opt }))}
                                            className={`p-2.5 rounded-xl text-xs font-semibold text-left border transition ${selectedAnswers[qi] === opt
                                                ? 'bg-[#6C63FF] border-[#6C63FF] text-white'
                                                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                                                }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={handleCheckQuiz}
                            className="w-full py-3 bg-[#00C9A7] text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition text-sm flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-4 h-4" /> Check Quiz Score
                        </button>

                        {quizScore !== null && (
                            <div className="p-4 bg-[#58cc02]/20 border border-[#58cc02] rounded-xl text-center">
                                <p className="text-[#58cc02] font-black text-xl">Score: {quizScore} / {activeCard.quiz.length} Correct 🎉</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            {/* Custom Physical RFID Tag Registration Modal */}
            {showRegisterModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="glass-card max-w-md w-full p-6 border border-white/20 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="text-white font-bold text-base flex items-center gap-2">
                                <Plus className="w-5 h-5 text-[#00C9A7]" /> Register Physical Hardware RFID Card
                            </h3>
                            <button onClick={() => setShowRegisterModal(false)} className="text-white/40 hover:text-white text-sm">✕</button>
                        </div>

                        <form onSubmit={handleRegisterNewCard} className="space-y-3">
                            <div>
                                <label className="text-white/70 text-xs font-bold block mb-1">Hardware Card UID Tag ID</label>
                                <input
                                    type="text"
                                    required
                                    value={regCardId}
                                    onChange={e => setRegCardId(e.target.value)}
                                    placeholder="Scan tag or type UID (e.g. CARD-9900, E2801192)"
                                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#6C63FF]"
                                />
                            </div>

                            <div>
                                <label className="text-white/70 text-xs font-bold block mb-1">Lesson / Topic Title</label>
                                <input
                                    type="text"
                                    required
                                    value={regTitle}
                                    onChange={e => setRegTitle(e.target.value)}
                                    placeholder="e.g. Magnetism & Magnetic Fields"
                                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6C63FF]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-white/70 text-xs font-bold block mb-1">Subject</label>
                                    <select
                                        value={regSubject}
                                        onChange={e => setRegSubject(e.target.value)}
                                        className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6C63FF]"
                                    >
                                        {['Science', 'Physics', 'Biology', 'Chemistry', 'Maths', 'History', 'Civics', 'Geography', 'Accessibility'].map(s => (
                                            <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-white/70 text-xs font-bold block mb-1">Grade</label>
                                    <select
                                        value={regGrade}
                                        onChange={e => setRegGrade(e.target.value)}
                                        className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6C63FF]"
                                    >
                                        {['6', '7', '8', '9', '10', '11', '12', 'All'].map(g => (
                                            <option key={g} value={g} className="bg-slate-900 text-white">Grade {g}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-white/70 text-xs font-bold block mb-1">Topic Summary Description (Optional)</label>
                                <textarea
                                    rows={2}
                                    value={regDescription}
                                    onChange={e => setRegDescription(e.target.value)}
                                    placeholder="Brief overview of the lesson..."
                                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6C63FF]"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRegisterModal(false)}
                                    className="flex-1 py-2.5 bg-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/20 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={registering}
                                    className="flex-1 py-2.5 bg-[#6C63FF] text-white font-bold text-xs rounded-xl hover:bg-[#5b54e6] transition shadow-lg"
                                >
                                    {registering ? 'Registering...' : 'Save & Register Tag'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
