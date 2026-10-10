'use client';

import { useState, useRef, useEffect } from 'react';

type TabId = 'finger-braille' | 'palm-reading' | 'vibration-lang' | 'caregiver' | 'spatial-maps' | 'quiz-response';

export default function DeafBlindAccessPage() {
  const [activeTab, setActiveTab] = useState<TabId>('finger-braille');

  // Trigger vibration helper (safely handles desktop/unsupported browsers)
  const triggerVibration = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    } else {
      console.warn('Vibration API not supported on this device');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="p-2 bg-[#6C63FF]/20 rounded-xl">📳</span>
            DeafBlind Access Lab
          </h1>
          <p className="text-white/60 mt-1">Experimental Haptic & Touch-based Learning Modalities</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-2 p-1 bg-white/5 rounded-2xl w-full">
        {([
          { id: 'finger-braille', label: '1. Finger Braille', icon: '🖐️' },
          { id: 'palm-reading', label: '2. Palm Reader', icon: '✋' },
          { id: 'vibration-lang', label: '3. Haptic Language', icon: '〰️' },
          { id: 'caregiver', label: '4. Caregiver Mode', icon: '🫂' },
          { id: 'spatial-maps', label: '5. Spatial Maps', icon: '🗺️' },
          { id: 'quiz-response', label: '6. Quiz Response', icon: '✓' },
        ] as { id: TabId; label: string; icon: string }[]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[140px] px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                ? 'bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white shadow-lg'
                : 'text-white/50 hover:bg-white/10 hover:text-white'
              }`}>
            <span className="text-lg block mb-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="mt-8">
        {activeTab === 'finger-braille' && <FingerBraille triggerVibration={triggerVibration} />}
        {activeTab === 'palm-reading' && <PalmReading triggerVibration={triggerVibration} />}
        {activeTab === 'vibration-lang' && <VibrationLanguage triggerVibration={triggerVibration} />}
        {activeTab === 'caregiver' && <CaregiverMode triggerVibration={triggerVibration} />}
        {activeTab === 'spatial-maps' && <SpatialMaps triggerVibration={triggerVibration} />}
        {activeTab === 'quiz-response' && <QuizResponse triggerVibration={triggerVibration} />}
      </div>
    </div>
  );
}

// ==========================================
// 1. FINGER BRAILLE INPUT
// ==========================================
function FingerBraille({ triggerVibration }: { triggerVibration: (p: number | number[]) => void }) {
  const [activeDots, setActiveDots] = useState<Set<number>>(new Set());
  const [output, setOutput] = useState<string>('');
  const timeoutRef = useRef<any>(null);

  // Simplified Braille Map (1-6 standard dots)
  const brailleMap: Record<string, string> = {
    '1': 'A', '1,2': 'B', '1,4': 'C', '1,4,5': 'D', '1,5': 'E',
    '1,2,4': 'F', '1,2,4,5': 'G', '1,2,5': 'H', '2,4': 'I', '2,4,5': 'J',
    '1,3': 'K', '1,2,3': 'L', '1,3,4': 'M', '1,3,4,5': 'N', '1,3,5': 'O',
    '1,2,3,4': 'P', '1,2,3,4,5': 'Q', '1,2,3,5': 'R', '2,3,4': 'S', '2,3,4,5': 'T',
    '1,3,6': 'U', '1,2,3,6': 'V', '2,4,5,6': 'W', '1,3,4,6': 'X', '1,3,4,5,6': 'Y', '1,3,5,6': 'Z',
  };

  const evaluateBraille = (dots: Set<number>) => {
    if (dots.size === 0) return;
    const sortedDots = Array.from(dots).sort().join(',');
    const char = brailleMap[sortedDots] || '?';

    if (char !== '?') {
      setOutput(prev => prev + char);
      triggerVibration([30, 50, 30]); // Success
    } else {
      triggerVibration(100); // Error
    }
    setActiveDots(new Set());
  };

  const toggleDot = (dot: number) => {
    try { triggerVibration(20); } catch (e) { }

    setActiveDots(prev => {
      const next = new Set(prev);
      if (next.has(dot)) next.delete(dot);
      else next.add(dot);

      // Auto-evaluate after 1.5 seconds of inactivity
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (next.size > 0) {
        timeoutRef.current = setTimeout(() => evaluateBraille(next), 1500);
      }
      return next;
    });
  };

  return (
    <div className="glass-card p-6 animate-in fade-in">
      <h2 className="text-2xl font-bold text-white mb-2">Finger Braille Input</h2>
      <p className="text-white/60 mb-6">Tap the screen to toggle braille dots. The app will auto-translate the combination into a letter after 1.5 seconds.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="w-full h-[400px] bg-black/40 border-2 border-[#6C63FF]/30 rounded-2xl relative overflow-hidden select-none">
            {/* Grid Interactive Zones */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-3">
              {[1, 4, 2, 5, 3, 6].map(dot => (
                <div
                  key={dot}
                  onClick={() => toggleDot(dot)}
                  className={`border border-white/10 flex items-center justify-center transition-all cursor-pointer hover:bg-white/5 active:bg-white/20 ${activeDots.has(dot) ? 'bg-[#00C9A7]/80 shadow-[inset_0_0_20px_rgba(0,201,167,0.5)]' : ''}`}
                >
                  <span className={`text-4xl transition-colors ${activeDots.has(dot) ? 'text-white font-bold' : 'text-white/20'}`}>{dot}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="p-6 bg-white/5 rounded-2xl min-h-[200px]">
            <p className="text-white/40 text-sm uppercase tracking-wider mb-2">Typed Output</p>
            <p className="text-4xl text-white font-mono tracking-widest break-all">
              {output || <span className="opacity-20">Waiting...</span>}
            </p>
          </div>
          <button onClick={() => setOutput('')} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-bold hover:bg-red-500/30">Clear Text</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. PALM READING MODE (Lorm Alphabet simulation)
// ==========================================
function PalmReading({ triggerVibration }: { triggerVibration: (p: number | number[]) => void }) {
  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [textToTrace, setTextToTrace] = useState('CABBAGE');
  const [isTracing, setIsTracing] = useState(false);

  const drawWord = async () => {
    if (isTracing || !textToTrace) return;
    setIsTracing(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/deafblind/lorm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: textToTrace, context: '' })
      });
      const data = await res.json();
      const sequence = data.sequence;

      for (const cell of sequence) {
        if (cell === -1) {
          await new Promise(r => setTimeout(r, 800)); // space
        } else if (cell === 0) {
          await new Promise(r => setTimeout(r, 400)); // between letters
          setActiveCell(null);
        } else {
          setActiveCell(cell);
          triggerVibration(60);
          await new Promise(r => setTimeout(r, 250));
        }
      }
    } catch (e) {
      console.error("Lorm backend error", e);
    }
    setActiveCell(null);
    setIsTracing(false);
  };

  return (
    <div className="glass-card p-6 animate-in fade-in">
      <h2 className="text-2xl font-bold text-white mb-2">AI Palm Reader (Lorm Alphabet)</h2>
      <p className="text-white/60 mb-6">The app translates text into physical Lorm pulses. The student places their palm flat on the screen to &quot;feel&quot; the word.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="w-full aspect-square max-w-[400px] bg-black/40 border border-white/10 rounded-full mx-auto relative overflow-hidden">
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-8 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(cell => (
                <div key={cell} className={`rounded-full transition-all duration-100 ${activeCell === cell ? 'bg-[#00C9A7] shadow-[0_0_30px_#00C9A7] scale-110' : 'bg-white/5'}`} />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
              <span className="text-9xl">✋</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center space-y-4">
          <input
            type="text"
            value={textToTrace}
            onChange={e => setTextToTrace(e.target.value)}
            placeholder="Enter a word to trace..."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 outline-none focus:border-[#6C63FF]"
          />
          <button onClick={drawWord} disabled={isTracing} className={`py-4 rounded-xl font-bold text-lg transition ${isTracing ? 'bg-white/10 text-white/40' : 'bg-[#6C63FF]/20 text-[#6C63FF] border border-[#6C63FF]/30 hover:bg-[#6C63FF]/30'}`}>
            {isTracing ? 'Tracing on Palm...' : 'Translate & Trace Word'}
          </button>
          <p className="text-white/40 text-sm">Powered by AI backend translation mapping text to semantic Lorm coordinates.</p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. VIBRATION LANGUAGE
// ==========================================
function VibrationLanguage({ triggerVibration }: { triggerVibration: (p: number | number[]) => void }) {
  const playVocabulary = (type: string) => {
    switch (type) {
      case 'math-correct': triggerVibration([50, 100, 50, 100, 400]); break; // short-short-long
      case 'math-wrong': triggerVibration([50, 100, 400, 100, 50]); break; // short-long-short
      case 'math-new': triggerVibration([300, 100, 300, 100, 300]); break; // long-long-long
      case 'sci-energy': triggerVibration([30, 30, 30, 30, 30, 30, 30, 30]); break; // fast flutter
      case 'sci-matter': triggerVibration([500, 500, 500]); break; // slow heavy
    }
  };

  return (
    <div className="glass-card p-6 animate-in fade-in">
      <h2 className="text-2xl font-bold text-white mb-2">Semantic Vibration Language</h2>
      <p className="text-white/60 mb-6">A unique NCERT-aligned haptic vocabulary. Instead of Morse code, vibrations have semantic meaning (e.g. fast flutter = energy).</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 border border-[#00C9A7]/30 bg-[#00C9A7]/5 rounded-xl">
          <h3 className="text-[#00C9A7] font-bold mb-4">Mathematics Vocabulary</h3>
          <div className="space-y-3">
            <button onClick={() => playVocabulary('math-correct')} className="w-full text-left p-3 bg-black/40 rounded-lg hover:bg-white/10 text-white flex justify-between">
              <span>Correct Answer</span> <span className="text-white/40 text-sm">short-short-LONG</span>
            </button>
            <button onClick={() => playVocabulary('math-wrong')} className="w-full text-left p-3 bg-black/40 rounded-lg hover:bg-white/10 text-white flex justify-between">
              <span>Try Again</span> <span className="text-white/40 text-sm">short-LONG-short</span>
            </button>
            <button onClick={() => playVocabulary('math-new')} className="w-full text-left p-3 bg-black/40 rounded-lg hover:bg-white/10 text-white flex justify-between">
              <span>New Concept</span> <span className="text-white/40 text-sm">LONG-LONG-LONG</span>
            </button>
          </div>
        </div>

        <div className="p-5 border border-[#6C63FF]/30 bg-[#6C63FF]/5 rounded-xl">
          <h3 className="text-[#6C63FF] font-bold mb-4">Science Vocabulary</h3>
          <div className="space-y-3">
            <button onClick={() => playVocabulary('sci-energy')} className="w-full text-left p-3 bg-black/40 rounded-lg hover:bg-white/10 text-white flex justify-between">
              <span>Energy</span> <span className="text-white/40 text-sm">fast flutter</span>
            </button>
            <button onClick={() => playVocabulary('sci-matter')} className="w-full text-left p-3 bg-black/40 rounded-lg hover:bg-white/10 text-white flex justify-between">
              <span>Matter / Solid</span> <span className="text-white/40 text-sm">slow heavy pulse</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. AI CAREGIVER GUIDE MODE
// ==========================================
function CaregiverMode({ triggerVibration }: { triggerVibration: (p: number | number[]) => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [topic, setTopic] = useState('');
  const [instruction, setInstruction] = useState("Enter a concept above and generate AI Tadoma instructions.");
  const [vibrations, setVibrations] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAI = async () => {
    if (!topic) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/deafblind/caregiver`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, context: '' })
      });
      const data = await res.json();
      setInstruction(data.instruction);
      setVibrations(data.vibrations || [200, 100, 200]);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const playLesson = () => {
    if (vibrations.length === 0) return;
    setIsPlaying(true);
    triggerVibration(vibrations);
    const duration = vibrations.reduce((a, b) => a + b, 0);
    setTimeout(() => setIsPlaying(false), duration + 500);
  };

  return (
    <div className="glass-card p-6 animate-in fade-in">
      <h2 className="text-2xl font-bold text-white mb-2">AI Caregiver Guide (Tadoma Method)</h2>
      <p className="text-white/60 mb-6">Connects directly to the AI backend to generate real-time physical instructions for parents alongside the student&apos;s haptic feedback.</p>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. Gravity, Fire, Water, Acceleration"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-white outline-none focus:border-yellow-400"
        />
        <button onClick={fetchAI} disabled={loading} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition">
          {loading ? 'Generating...' : 'Generate AI Guide'}
        </button>
      </div>

      <div className="flex flex-col border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Top: Student Device (Simulated) */}
        <div className="bg-black/60 p-6 flex flex-col items-center justify-center border-b border-white/10 relative">
          <span className={`text-6xl transition-transform duration-100 ${isPlaying ? 'scale-110 opacity-100 blur-md' : 'opacity-20'}`}>📳</span>
          <p className="text-white/30 text-sm mt-3">Student&apos;s Phone (Vibrating)</p>
        </div>

        {/* Bottom: Caregiver Device */}
        <div className="bg-[#1e1e32] p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400" />
          <h3 className="text-yellow-400 font-bold uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            Caregiver Instruction • Now
          </h3>
          <p className="text-white text-xl font-medium leading-relaxed mb-6">
            &quot;{instruction}&quot;
          </p>
          <button onClick={playLesson} disabled={vibrations.length === 0} className={`w-full py-4 font-bold rounded-xl shadow-lg transition ${vibrations.length > 0 ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}>
            {isPlaying ? 'Playing Haptic Rhythm...' : '▶ Play Lesson & Vibration'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 5. SPATIAL TOUCH MAPS
// ==========================================
function SpatialMaps({ triggerVibration }: { triggerVibration: (p: number | number[]) => void }) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const handleEnter = (region: string) => {
    setHoveredRegion(region);
    triggerVibration(50); // Boundary crossing vibration
  };

  return (
    <div className="glass-card p-6 animate-in fade-in">
      <h2 className="text-2xl font-bold text-white mb-2">Spatial Touch Maps</h2>
      <p className="text-white/60 mb-6">Drag your finger across the shape. The phone vibrates instantly when crossing boundaries, allowing mental mapping of geometry and geography.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square bg-black/50 border border-white/10 rounded-2xl relative flex items-center justify-center touch-none overflow-hidden group">
          {/* Simple abstract map / geometric shape */}
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#6C63FF" strokeWidth="2"
              onPointerEnter={() => handleEnter('Cell Wall')}
              onPointerLeave={() => handleEnter('Outside')}
              className="cursor-crosshair" />
            <circle cx="50" cy="50" r="15" fill="#00C9A7"
              onPointerEnter={() => handleEnter('Nucleus')}
              className="cursor-crosshair" />
          </svg>
          <p className="absolute bottom-4 text-white/30 text-xs text-center w-full pointer-events-none">Trace the circles</p>
        </div>

        <div className="flex flex-col justify-center">
          <h3 className="text-white/40 text-sm uppercase mb-2">Current Position</h3>
          <p className="text-4xl font-bold text-white">
            {hoveredRegion || <span className="opacity-20">Outside</span>}
          </p>
          {hoveredRegion === 'Nucleus' && <p className="text-[#00C9A7] mt-2">Vibrating twice (Center identified)</p>}
          {hoveredRegion === 'Cell Wall' && <p className="text-[#6C63FF] mt-2">Vibrated once (Boundary crossed)</p>}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 6. VIBRATION QUIZ RESPONSE
// ==========================================
function QuizResponse({ triggerVibration }: { triggerVibration: (p: number | number[]) => void }) {
  const [taps, setTaps] = useState(0);
  const tapTimeoutRef = useRef<any>(null);

  const presentQuestion = async () => {
    // 1 pulse for A, wait, 2 pulses for B...
    const pulses = [100, 400, 100, 100, 400]; // Simplification for demo
    triggerVibration(pulses);
  };

  const handleTap = () => {
    triggerVibration(30); // Feedback for tap
    setTaps(p => p + 1);

    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => {
      // Finished answering
      const ans = ['A', 'B', 'C', 'D'][taps % 4] || 'A';
      alert(`Answer submitted: Option ${ans}`);
      setTaps(0);
    }, 1500);
  };

  return (
    <div className="glass-card p-6 animate-in fade-in">
      <h2 className="text-2xl font-bold text-white mb-2">Vibration Quiz Response</h2>
      <p className="text-white/60 mb-6">A closed-loop assessment system without vision. Listen to options via vibration, then tap the screen to submit an answer.</p>

      <div className="space-y-6">
        <button onClick={presentQuestion} className="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition">
          1. Play Question Options (Vibrate)
        </button>

        <div onClick={handleTap} className="w-full h-48 bg-black/40 border-2 border-dashed border-[#00C9A7]/50 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 active:bg-[#00C9A7]/20 transition select-none">
          <span className="text-5xl mb-3">👆</span>
          <p className="text-[#00C9A7] font-bold">2. Tap here to answer</p>
          <p className="text-white/40 text-xs mt-1">Tap once for A, twice for B...</p>
        </div>

        <div className="text-center">
          <p className="text-white text-xl">Current Taps: <span className="font-bold text-[#6C63FF]">{taps}</span></p>
        </div>
      </div>
    </div>
  );
}
