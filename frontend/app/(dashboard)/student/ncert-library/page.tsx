'use client';

import { useState, useEffect } from 'react';
import { useAccessibility } from '@/components/AccessibilityContext';
import { BookOpen, Search, Sparkles, Volume2, Download, HelpCircle, CheckCircle, Brain, Moon, Sun, ArrowLeft, RefreshCw } from 'lucide-react';
import { senseBand } from '@/lib/senseband';

const TEXT_TO_BRAILLE_MAP: Record<string, string> = {
    a: '⠁', b: '⠃', c: '⠉', d: '⠙', e: '⠑', f: '⠋', g: '⠛', h: '⠓', i: '⠊', j: '⠚',
    k: '⠅', l: '⠇', m: '⠍', n: '⠝', o: '⠕', p: '⠏', q: '⠟', r: '⠗', s: '⠎', t: '⠞',
    u: '⠥', v: '⠧', w: '⠺', x: '⠭', y: '⠽', z: '⠵', ' ': ' '
};

export default function NCERTLearningLibraryPage() {
    const { speak } = useAccessibility();

    // Catalog State
    const [catalog, setCatalog] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState<string>('Class 10');
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [selectedBook, setSelectedBook] = useState<string>('');
    const [selectedChapter, setSelectedChapter] = useState<any>(null);

    // Chapter Content & Reader State
    const [chapterData, setChapterData] = useState<any>(null);
    const [readingPage, setReadingPage] = useState(1);
    const [loadingChapter, setLoadingChapter] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

    // AI & Interactive State
    const [aiMode, setAiMode] = useState<'explain' | 'simplify' | 'summarize' | 'keypoints' | 'mindmap'>('explain');
    const [aiResponse, setAiResponse] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    // Quiz State
    const [quizList, setQuizList] = useState<any[]>([]);
    const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
    const [quizScore, setQuizScore] = useState<number | null>(null);

    // Accessibility State
    const [highContrast, setHighContrast] = useState(false);
    const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('large');

    // Load NCERT Catalog on Mount
    useEffect(() => {
        fetchCatalog();
    }, []);

    const fetchCatalog = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:8000/api/ncert/catalog');
            const data = await res.json();
            if (data.status === 'success') {
                setCatalog(data.catalog);
                const classes = Object.keys(data.catalog);
                if (classes.length > 0) {
                    const firstClass = classes.find(c => c.includes('10')) || classes[0];
                    setSelectedClass(firstClass);
                    const subjs = Object.keys(data.catalog[firstClass] || {});
                    if (subjs.length > 0) {
                        setSelectedSubject(subjs[0]);
                        const bks = Object.keys(data.catalog[firstClass][subjs[0]] || {});
                        if (bks.length > 0) setSelectedBook(bks[0]);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to load NCERT catalog:", err);
        } finally {
            setLoading(false);
        }
    };

    const openChapter = async (chap: any) => {
        setSelectedChapter(chap);
        setLoadingChapter(true);
        setAiResponse('');
        setQuizList([]);
        setQuizScore(null);
        speak(`Opening NCERT Chapter ${chap.title}`);

        try {
            const res = await fetch(`http://localhost:8000/api/ncert/chapter?path=${encodeURIComponent(chap.path)}`);
            const data = await res.json();
            if (data.status === 'success') {
                setChapterData(data.data);
                setReadingPage(1);
                // Save to offline storage
                try {
                    localStorage.setItem(`ncert_offline_${chap.id}`, JSON.stringify(data.data));
                } catch (_) { }
            }
        } catch (err) {
            // Fallback to offline storage if network fails
            const offline = localStorage.getItem(`ncert_offline_${chap.id}`);
            if (offline) {
                setChapterData(JSON.parse(offline));
                speak("Loaded chapter from offline cache");
            }
        } finally {
            setLoadingChapter(false);
        }
    };

    const handleAIAction = async (mode: 'explain' | 'simplify' | 'summarize' | 'keypoints' | 'mindmap') => {
        if (!chapterData || !chapterData.pages) return;
        setAiMode(mode);
        setAiLoading(true);

        const currentPageText = chapterData.pages[readingPage - 1]?.text || chapterData.full_text.slice(0, 1000);

        try {
            const res = await fetch('http://localhost:8000/api/ncert/ai/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chapter_title: selectedChapter?.title || 'NCERT Chapter',
                    text_chunk: currentPageText,
                    mode: mode
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setAiResponse(data.reply);
                speak(data.reply);
                senseBand.send('AI_READY');
            }
        } catch (err) {
            setAiResponse("AI Tutor unavailable. " + currentPageText.slice(0, 300));
        } finally {
            setAiLoading(false);
        }
    };

    const handleGenerateQuiz = async () => {
        if (!chapterData || !chapterData.pages) return;
        setAiLoading(true);
        const textChunk = chapterData.pages[readingPage - 1]?.text || chapterData.full_text.slice(0, 1000);

        try {
            const res = await fetch('http://localhost:8000/api/ncert/ai/quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text_chunk: textChunk, num_questions: 3 })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setQuizList(data.quiz);
                setQuizAnswers({});
                setQuizScore(null);
                speak("Interactive NCERT Quiz Generated!");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setAiLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        try {
            const res = await fetch('http://localhost:8000/api/ncert/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery, class_filter: selectedClass, top_k: 5 })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setSearchResults(data.results);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const convertTextToBraille = (str: string) => {
        return str.toLowerCase().split('').map(c => TEXT_TO_BRAILLE_MAP[c] || c).join('');
    };

    const fontClass = {
        normal: 'text-base',
        large: 'text-xl',
        xlarge: 'text-2xl font-bold'
    }[fontSize];

    return (
        <div className={`space-y-6 pb-12 ${highContrast ? 'bg-black text-yellow-400' : 'text-white'}`}>

            {/* Header Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                    <h1 className="text-3xl font-extrabold flex items-center gap-3">
                        <BookOpen className="w-8 h-8 text-[#6C63FF]" />
                        NCERT AI Inclusive Learning System
                    </h1>
                    <p className="text-white/60 text-sm mt-1">
                        Dynamic NCERT Curriculum (Class 1–12) with Grounded AI RAG, TTS, Braille & Offline Mode
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Font Size Toggle */}
                    <div className="flex bg-white/10 rounded-xl p-1">
                        <button onClick={() => setFontSize('normal')} className={`px-2 py-1 text-xs font-bold rounded-lg ${fontSize === 'normal' ? 'bg-[#6C63FF] text-white' : 'text-white/60'}`}>A</button>
                        <button onClick={() => setFontSize('large')} className={`px-2 py-1 text-sm font-bold rounded-lg ${fontSize === 'large' ? 'bg-[#6C63FF] text-white' : 'text-white/60'}`}>A+</button>
                        <button onClick={() => setFontSize('xlarge')} className={`px-2 py-1 text-base font-bold rounded-lg ${fontSize === 'xlarge' ? 'bg-[#6C63FF] text-white' : 'text-white/60'}`}>A++</button>
                    </div>

                    {/* High Contrast Toggle */}
                    <button
                        onClick={() => setHighContrast(!highContrast)}
                        className={`p-2 rounded-xl border transition ${highContrast ? 'bg-yellow-400 text-black border-yellow-300' : 'bg-white/10 border-white/20 text-white'}`}
                    >
                        {highContrast ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* RAG Search Bar */}
            <div className="glass-card p-4 rounded-2xl border border-white/10 flex gap-3">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search NCERT across all classes & subjects (e.g. Photosynthesis, Newton's Laws)..."
                        className="w-full bg-black/40 border border-white/20 rounded-xl py-3 pl-10 pr-4 text-white placeholder-white/40 focus:outline-none focus:border-[#00C9A7]"
                    />
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                </div>
                <button onClick={handleSearch} className="px-5 py-3 bg-[#00C9A7] text-white font-bold rounded-xl hover:bg-[#00b093] transition flex items-center gap-2">
                    RAG Search
                </button>
            </div>

            {/* RAG Search Results */}
            {searchResults.length > 0 && (
                <div className="glass-card p-6 rounded-2xl border border-[#00C9A7]/40 bg-[#00C9A7]/5 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-[#00C9A7] font-bold text-base">🔍 NCERT Search Results</h3>
                        <button onClick={() => setSearchResults([])} className="text-white/40 text-xs hover:text-white">Clear</button>
                    </div>
                    <div className="space-y-3">
                        {searchResults.map((res, idx) => (
                            <div key={idx} className="p-4 bg-black/50 border border-white/10 rounded-xl space-y-1">
                                <span className="text-xs font-bold text-yellow-300 uppercase">{res.class} • {res.subject} • {res.book} • Page {res.page}</span>
                                <h4 className="text-white font-bold text-sm">{res.chapter_title}</h4>
                                <p className="text-white/80 text-sm leading-relaxed">{res.text}</p>
                                <button onClick={() => speak(res.text)} className="mt-2 text-xs text-[#00C9A7] font-bold flex items-center gap-1 hover:underline">
                                    <Volume2 className="w-4 h-4" /> Listen
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main View: Browser vs Reader */}
            {!selectedChapter ? (
                /* Dynamic Catalog Browser */
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>📚</span> NCERT Curriculum Explorer
                    </h2>

                    {/* Class Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {Object.keys(catalog).length === 0 ? (
                            <div className="text-white/50 text-sm flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin" /> Loading NCERT Repository...
                            </div>
                        ) : (
                            Object.keys(catalog).map((cls) => (
                                <button
                                    key={cls}
                                    onClick={() => {
                                        setSelectedClass(cls);
                                        const subjs = Object.keys(catalog[cls] || {});
                                        if (subjs.length > 0) {
                                            setSelectedSubject(subjs[0]);
                                            const bks = Object.keys(catalog[cls][subjs[0]] || {});
                                            if (bks.length > 0) setSelectedBook(bks[0]);
                                        }
                                    }}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap ${selectedClass === cls ? 'bg-[#6C63FF] text-white shadow-lg' : 'bg-white/10 text-white/60 hover:bg-white/20'
                                        }`}
                                >
                                    {cls}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Subject & Book Selector */}
                    {selectedClass && catalog[selectedClass] && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                            {/* Subjects */}
                            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-3">
                                <h3 className="text-white/60 text-xs font-bold uppercase tracking-wider">Subjects</h3>
                                <div className="space-y-2">
                                    {Object.keys(catalog[selectedClass]).map((subj) => (
                                        <button
                                            key={subj}
                                            onClick={() => {
                                                setSelectedSubject(subj);
                                                const bks = Object.keys(catalog[selectedClass][subj] || {});
                                                if (bks.length > 0) setSelectedBook(bks[0]);
                                            }}
                                            className={`w-full text-left p-3 rounded-xl font-bold text-sm transition ${selectedSubject === subj ? 'bg-[#00C9A7] text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                                                }`}
                                        >
                                            {subj}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Books & Chapters */}
                            <div className="md:col-span-2 glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                                <h3 className="text-white/60 text-xs font-bold uppercase tracking-wider">
                                    Chapters in {selectedSubject} ({selectedClass})
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {selectedSubject && catalog[selectedClass]?.[selectedSubject] &&
                                        Object.entries(catalog[selectedClass][selectedSubject]).flatMap(([bkName, chaps]: [string, any]) =>
                                            chaps.map((chap: any, idx: number) => (
                                                <div
                                                    key={chap.id}
                                                    onClick={() => openChapter(chap)}
                                                    className="p-4 bg-white/5 hover:bg-[#6C63FF]/20 border border-white/10 rounded-xl cursor-pointer transition space-y-2 group"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] font-bold text-[#00C9A7] uppercase">Chapter {idx + 1}</span>
                                                        <BookOpen className="w-4 h-4 text-white/40 group-hover:text-[#6C63FF]" />
                                                    </div>
                                                    <h4 className="text-white font-bold text-base leading-tight group-hover:text-[#6C63FF] transition">
                                                        {chap.title}
                                                    </h4>
                                                    <p className="text-white/40 text-xs">{bkName}</p>
                                                </div>
                                            ))
                                        )
                                    }
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Interactive NCERT Reader */
                <div className="space-y-6 animate-in fade-in">
                    {/* Top Control Bar */}
                    <div className="flex items-center justify-between gap-4">
                        <button
                            onClick={() => setSelectedChapter(null)}
                            className="px-4 py-2 bg-white/10 text-white font-bold text-sm rounded-xl hover:bg-white/20 transition flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to NCERT Catalog
                        </button>

                        <span className="text-white/60 text-sm font-bold">
                            {selectedChapter.class} • {selectedChapter.subject} • {selectedChapter.title}
                        </span>
                    </div>

                    {loadingChapter ? (
                        <div className="p-12 text-center text-white/50 flex flex-col items-center gap-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-[#6C63FF]" />
                            <p className="font-bold">Extracting PDF Chapter & Generating Grounded RAG Data...</p>
                        </div>
                    ) : chapterData && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Left 2 Cols: Main Reader Panel */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                                    <div className="flex justify-between items-center border-b border-white/10 pb-3">
                                        <h3 className="text-white font-bold text-lg">
                                            Page {readingPage} of {chapterData.num_pages}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => speak(chapterData.pages[readingPage - 1]?.text || '')}
                                                className="px-3 py-1.5 bg-[#58cc02] text-white text-xs font-bold rounded-xl hover:bg-[#46a302] transition flex items-center gap-1.5"
                                            >
                                                <Volume2 className="w-4 h-4" /> Read Aloud (TTS)
                                            </button>
                                            <button
                                                onClick={() => setReadingPage(p => Math.max(1, p - 1))}
                                                disabled={readingPage <= 1}
                                                className="px-3 py-1.5 bg-white/10 text-white text-xs font-bold rounded-xl hover:bg-white/20 disabled:opacity-40"
                                            >
                                                Prev Page
                                            </button>
                                            <button
                                                onClick={() => setReadingPage(p => Math.min(chapterData.num_pages, p + 1))}
                                                disabled={readingPage >= chapterData.num_pages}
                                                className="px-3 py-1.5 bg-white/10 text-white text-xs font-bold rounded-xl hover:bg-white/20 disabled:opacity-40"
                                            >
                                                Next Page
                                            </button>
                                        </div>
                                    </div>

                                    {/* Page Paragraphs */}
                                    <div className="space-y-4 min-h-[300px]">
                                        {chapterData.pages[readingPage - 1]?.paragraphs?.map((para: string, idx: number) => (
                                            <p key={idx} className={`leading-relaxed text-white/90 ${fontClass}`}>
                                                {para}
                                            </p>
                                        ))}
                                    </div>

                                    {/* Braille Translation Preview */}
                                    <div className="p-4 bg-black/60 rounded-xl border border-white/10">
                                        <h4 className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-2">⠃ Tactile Braille Preview (Page Text):</h4>
                                        <p className="text-yellow-300 text-xl tracking-[0.25em] font-mono line-clamp-3">
                                            {convertTextToBraille((chapterData.pages[readingPage - 1]?.text || '').slice(0, 200))}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Right Col: AI Tutor & Quiz Engine */}
                            <div className="space-y-4">
                                <div className="glass-card p-6 rounded-2xl border border-[#6C63FF]/40 bg-[#6C63FF]/5 space-y-4">
                                    <h3 className="text-[#6C63FF] font-bold text-base flex items-center gap-2">
                                        <Sparkles className="w-5 h-5" /> Grounded NCERT AI Tutor
                                    </h3>

                                    {/* AI Feature Buttons */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => handleAIAction('explain')} className="p-2.5 bg-white/10 hover:bg-[#6C63FF] text-white text-xs font-bold rounded-xl transition text-left">
                                            💡 Explain Concept
                                        </button>
                                        <button onClick={() => handleAIAction('simplify')} className="p-2.5 bg-white/10 hover:bg-[#00C9A7] text-white text-xs font-bold rounded-xl transition text-left">
                                            🌱 Simplify
                                        </button>
                                        <button onClick={() => handleAIAction('summarize')} className="p-2.5 bg-white/10 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition text-left">
                                            📝 Bullet Summary
                                        </button>
                                        <button onClick={() => handleAIAction('mindmap')} className="p-2.5 bg-white/10 hover:bg-pink-500 text-white text-xs font-bold rounded-xl transition text-left">
                                            🧠 Mind Map
                                        </button>
                                    </div>

                                    {/* AI Response Display */}
                                    {aiLoading ? (
                                        <div className="p-4 text-center text-white/50 text-xs flex items-center justify-center gap-2">
                                            <RefreshCw className="w-4 h-4 animate-spin text-[#6C63FF]" /> RAG Model Thinking...
                                        </div>
                                    ) : aiResponse && (
                                        <div className="p-4 bg-black/60 border border-white/10 rounded-xl space-y-2">
                                            <h4 className="text-[#00C9A7] text-xs font-bold uppercase">{aiMode} Output:</h4>
                                            <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
                                        </div>
                                    )}

                                    {/* Quiz Generator */}
                                    <button
                                        onClick={handleGenerateQuiz}
                                        className="w-full py-3 bg-gradient-to-r from-[#00C9A7] to-[#00A389] text-white font-bold text-xs rounded-xl shadow-lg hover:opacity-90 transition flex items-center justify-center gap-2"
                                    >
                                        <Brain className="w-4 h-4" /> Generate Practice Quiz from Page
                                    </button>

                                    {/* Quiz Output */}
                                    {quizList.length > 0 && (
                                        <div className="space-y-3 pt-2">
                                            <h4 className="text-white font-bold text-sm">Interactive Quiz:</h4>
                                            {quizList.map((q, qIdx) => (
                                                <div key={qIdx} className="p-3 bg-black/50 border border-white/10 rounded-xl space-y-2">
                                                    <p className="text-white text-xs font-bold">{qIdx + 1}. {q.question}</p>
                                                    <div className="space-y-1">
                                                        {q.options?.map((opt: string, optIdx: number) => (
                                                            <button
                                                                key={optIdx}
                                                                onClick={() => {
                                                                    setQuizAnswers(prev => ({ ...prev, [qIdx]: opt }));
                                                                    if (opt === q.answer) {
                                                                        speak("Correct answer!");
                                                                        senseBand.send('CORRECT');
                                                                    } else {
                                                                        speak(`Wrong. Correct is ${q.answer}`);
                                                                        senseBand.send('WRONG');
                                                                    }
                                                                }}
                                                                className={`w-full text-left p-2 rounded-lg text-xs font-medium transition ${quizAnswers[qIdx] === opt
                                                                        ? opt === q.answer ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                                                                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                                                                    }`}
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
