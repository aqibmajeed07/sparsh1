'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { hasSign, SIGN_POSES, tokenizeForSigning } from '@/lib/isl/signMap';
import CelebrationOverlay from '@/components/ui/CelebrationOverlay';
import { senseBand } from '@/lib/senseband';

const SignAvatarOverlay = dynamic(
  () => import('@/components/live/SignAvatarOverlay'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0f0c29]/60 rounded-xl border border-white/10">
        <span className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

export default function LessonPlayerPage() {
  const { id } = useParams();
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [islOn, setIslOn] = useState(true);
  const [ttsOn, setTtsOn] = useState(false);
  const [activeTab, setActiveTab] = useState<'transcript' | 'vocabulary' | 'notes' | 'summary' | 'key points' | 'quiz'>('summary');
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lessonDone, setLessonDone] = useState(false);
  const [avatarQueue, setAvatarQueue] = useState<string[]>([]);
  const [currentSign, setCurrentSign] = useState('');
  const [signConfidence, setSignConfidence] = useState(100);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Sign resolution uses tokenizeForSigning (handles fingerspelling for unknown words)

  // ── TTS helper — must always be called from inside a user gesture ──
  const startTTS = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = 0.88;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;
    utterance.onstart = () => setTtsPlaying(true);
    utterance.onend = () => setTtsPlaying(false);
    utterance.onerror = () => setTtsPlaying(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopTTS = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setTtsPlaying(false);
  }, []);

  useEffect(() => {
    if (isPlaying && lesson && islOn) {
      const textToSign = lesson.accessible_summary || lesson.transcript_text || lesson.description || '';
      if (!textToSign) return;

      // Fetch ISL grammar tokens from backend
      fetch('/api/isl-grammar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSign, lang: 'en-IN' })
      })
        .then(res => res.json())
        .then(data => {
          const rawText: string = data?.isl_text?.join(' ') || textToSign;
          // tokenizeForSigning handles BOTH known words and fingerspelling of unknown words
          const tokens = tokenizeForSigning(rawText);
          const final = tokens.length > 0 ? tokens : tokenizeForSigning('hello welcome student teacher book');
          setAvatarQueue(final);
          setCurrentSign(final[0] || '');
        })
        .catch(() => {
          const demo = tokenizeForSigning('hello welcome student teacher book');
          setAvatarQueue(demo);
          setCurrentSign(demo[0] || '');
        });

    } else {
      setAvatarQueue([]);
      setCurrentSign('');
    }
  }, [isPlaying, lesson, islOn]);

  const handleSignComplete = useCallback((word: string) => {
    setAvatarQueue(prev => {
      const next = prev.slice(1);
      setCurrentSign(next[0] || '');
      return next;
    });
  }, []);

  useEffect(() => {
    async function fetchLesson() {
      setLoading(true);
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        setLesson(data);
      }
      setLoading(false);
    }
    if (id) fetchLesson();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <span className="w-12 h-12 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin block mx-auto mb-4" />
          <p className="text-white/50">Loading lesson...</p>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="text-center py-20">
        <p className="text-white/50 text-lg">Lesson not found.</p>
        <Link href="/student/lessons" className="text-[#6C63FF] hover:underline mt-4 inline-block">← Back to Lessons</Link>
      </div>
    );
  }

  // Parse key_vocabulary from JSONB
  const vocab: { word: string; hindi: string }[] = Array.isArray(lesson.key_vocabulary) ? lesson.key_vocabulary : [];
  const durationMin = lesson.duration_seconds ? Math.floor(lesson.duration_seconds / 60) : 0;

  return (
    <div className="space-y-6">
      {/* Lesson completion celebration */}
      <CelebrationOverlay
        show={lessonDone}
        variant="lesson_complete"
        title={`${lesson?.title ?? 'Lesson'} Done!`}
        subtitle="You completed the lesson. Great work! 🎓"
        xp={50}
        onClose={() => setLessonDone(false)}
        autoCloseSec={6}
      />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/student/lessons" className="text-white/40 hover:text-white/60 transition">Lessons</Link>
        <span className="text-white/20">/</span>
        <span className="text-white/80">{lesson.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player Area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card overflow-hidden">
            {/* Video Container */}
            <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
              {lesson.video_url ? (
                <>
                  <video
                    src={lesson.video_url}
                    className="w-full h-full object-cover"
                    controls={false}
                    id="lesson-video"
                  />
                  {/* ISL Avatar Overlay when video IS available */}
                  {islOn && (
                    <div className="absolute bottom-4 right-4 w-48 h-64 rounded-xl overflow-hidden shadow-2xl border-2 border-[#6C63FF]/40 z-20">
                      <SignAvatarOverlay queue={avatarQueue} onSignComplete={handleSignComplete} />
                      {currentSign && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 py-1 px-2 text-center">
                          <span className="text-[#00C9A7] font-bold text-sm capitalize">{currentSign}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* No video → Avatar takes full screen */
                islOn ? (
                  <div className="w-full h-full relative flex flex-col">
                    <SignAvatarOverlay queue={avatarQueue} onSignComplete={handleSignComplete} className="w-full flex-1 rounded-none border-none" />
                    {/* Current sign word display */}
                    {currentSign && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur px-6 py-2 rounded-full border border-[#6C63FF]/40 z-30">
                        <span className="text-[#6C63FF] text-xs uppercase tracking-widest font-bold mr-2">Signing:</span>
                        <span className="text-white font-bold text-lg capitalize">{currentSign}</span>
                      </div>
                    )}
                    {/* Sign queue progress */}
                    {avatarQueue.length > 0 && (
                      <div className="absolute top-3 left-3 right-3 z-30">
                        <div className="flex flex-wrap gap-1">
                          {avatarQueue.slice(0, 8).map((w, i) => (
                            <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-bold ${i === 0 ? 'bg-[#6C63FF] text-white' : 'bg-white/10 text-white/40'
                              }`}>{w}</span>
                          ))}
                          {avatarQueue.length > 8 && <span className="text-white/30 text-[10px]">+{avatarQueue.length - 8}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="text-6xl block mb-4">{lesson.thumbnail_url || '📚'}</span>
                    <p className="text-white/40 text-sm">Video not available yet</p>
                    <p className="text-white/20 text-xs mt-1">Turn on ISL to see the AI Avatar sign the summary</p>
                  </div>
                )
              )}

              {/* Captions */}
              {captionsOn && lesson.transcript_text && (
                <div className="absolute bottom-4 left-4 right-40 bg-black/80 backdrop-blur-sm rounded-lg p-3 z-10 pointer-events-none">
                  <p className="text-white text-sm text-center line-clamp-2">
                    {lesson.transcript_text.substring(0, 120)}...
                  </p>
                </div>
              )}

              {/* Play button overlay */}
              {!isPlaying && (
                <button
                  onClick={() => {
                    setIsPlaying(true);
                    senseBand.send('CONNECTED');
                    // TTS starts here — inside user click = browser allows audio
                    if (ttsOn) {
                      const text = lesson.accessible_summary || lesson.transcript_text || lesson.description || '';
                      if (text) startTTS(text);
                    }
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition group z-30"
                >
                  <div className="w-20 h-20 rounded-full bg-[#6C63FF]/80 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition shadow-2xl">
                    <span className="text-white text-3xl ml-1">▶</span>
                  </div>
                  <p className="absolute bottom-8 text-white/70 text-sm font-medium">Click to Play with AI Voice</p>
                </button>
              )}
            </div>

            <div className="px-4 py-2 bg-[#1e1e32]/50">
              <div className="w-full bg-white/10 rounded-full h-1.5 cursor-pointer group" onClick={() => {
                const next = Math.min(100, progress + 5);
                setProgress(next);
                if (next === 100) {
                  setLessonDone(true);
                  senseBand.send('LESSON_COMPLETE');
                }
              }}>
                <div className="h-full bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] rounded-full transition-all relative" style={{ width: `${progress}%` }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition" />
                </div>
              </div>
              <div className="flex justify-between text-xs text-white/40 mt-1">
                <span>0:00</span>
                <span>{durationMin}:00</span>
              </div>
            </div>

            {/* Controls */}
            <div className="px-4 py-3 flex items-center justify-between border-t border-white/5">
              <div className="flex items-center gap-4">
                <button className="text-white/60 hover:text-white transition text-sm">⏮ 10s</button>
                <button
                  onClick={() => {
                    const next = !isPlaying;
                    setIsPlaying(next);
                    if (!next) {
                      // Pausing — stop TTS
                      stopTTS();
                    } else if (ttsOn) {
                      // Resuming — restart TTS from beginning
                      const text = lesson.accessible_summary || lesson.transcript_text || lesson.description || '';
                      if (text) startTTS(text);
                    }
                  }}
                  className="w-10 h-10 rounded-full bg-[#6C63FF] flex items-center justify-center text-white hover:bg-[#5b54e6] transition"
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button className="text-white/60 hover:text-white transition text-sm">10s ⏭</button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIslOn(!islOn)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${islOn ? 'bg-[#6C63FF]/20 text-[#6C63FF]' : 'bg-white/5 text-white/40'}`}>
                  🤟 ISL
                </button>
                <button onClick={() => setCaptionsOn(!captionsOn)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${captionsOn ? 'bg-[#00C9A7]/20 text-[#00C9A7]' : 'bg-white/5 text-white/40'}`}>
                  CC Captions
                </button>
                <button
                  onClick={() => {
                    const next = !ttsOn;
                    setTtsOn(next);
                    if (next && isPlaying) {
                      // Turning TTS ON while lesson is playing → speak immediately
                      const text = lesson.accessible_summary || lesson.transcript_text || lesson.description || '';
                      if (text) startTTS(text);
                    } else {
                      stopTTS();
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${ttsOn
                    ? 'bg-orange-500/30 text-orange-400 border border-orange-500/50'
                    : 'bg-white/5 text-white/40'
                    }`}
                >
                  {ttsPlaying ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />Speaking...</>
                  ) : (
                    <>🔊 TTS</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Title & Info */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{lesson.title}</h1>
              {lesson.is_ncert_aligned && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white text-[10px] font-bold uppercase rounded flex items-center gap-1">✨ NCERT</span>
              )}
            </div>
            <p className="text-[#00C9A7] text-sm mt-1">{lesson.subject} • {lesson.chapter} • Grade {lesson.grade} • {lesson.board}</p>
            <p className="text-white/60 text-sm mt-3">{lesson.description}</p>
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Tab switcher */}
          <div className="glass-card p-1 flex flex-wrap gap-1">
            {(['summary', 'key points', 'quiz', 'transcript', 'vocabulary', 'notes'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition ${activeTab === tab ? 'bg-[#6C63FF] text-white' : 'text-white/50 hover:text-white/80'}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="glass-card p-5 min-h-[400px] max-h-[600px] overflow-y-auto">
            {activeTab === 'summary' && (
              <div className="space-y-4">
                <h3 className="text-[#00C9A7] font-semibold text-sm flex items-center gap-2"><span>✨</span> AI Summary</h3>
                {lesson.accessible_summary ? (
                  <p className="text-white/80 text-sm leading-relaxed p-4 bg-[#6C63FF]/5 rounded-xl border border-[#6C63FF]/20 shadow-inner">
                    {lesson.accessible_summary}
                  </p>
                ) : (
                  <p className="text-white/40 text-sm">No summary available yet. AI is processing...</p>
                )}

                {/* AI Doubt Solver Box */}
                <div className="p-4 bg-gradient-to-r from-[#6C63FF]/15 to-[#00C9A7]/15 rounded-xl border border-[#00C9A7]/30 space-y-2">
                  <h4 className="text-white font-bold text-xs flex items-center gap-1.5">
                    <span>💡</span> Have a Doubt? AI Simplified Explanation
                  </h4>
                  <p className="text-white/70 text-xs">
                    Need a simpler explanation? Highlight or type any tricky concept to explain simply:
                  </p>
                  <button
                    onClick={async () => {
                      const textToExplain = lesson.accessible_summary || lesson.title;
                      try {
                        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'}/api/doubt-solver`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ text: textToExplain })
                        });
                        const data = await res.json();
                        alert(`💡 Simplified Explanation:\n\n${data.simple_explanation}`);
                      } catch (e) {
                        alert(`💡 Simplified Explanation:\n\n${textToExplain} means understanding how nature works around us in simple everyday steps!`);
                      }
                    }}
                    className="w-full py-2 bg-[#00C9A7] text-white font-bold text-xs rounded-lg hover:opacity-90 transition shadow"
                  >
                    ✨ Explain Simply with AI
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'key points' && (
              <div className="space-y-4">
                <h3 className="text-[#00C9A7] font-semibold text-sm flex items-center gap-2"><span>✨</span> Key Takeaways</h3>
                {lesson.tags && lesson.tags.length > 0 ? (
                  <ul className="space-y-3">
                    {lesson.tags.map((tag: string, i: number) => (
                      <li key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                        <span className="text-[#6C63FF] shrink-0 font-bold">•</span>
                        <span className="text-white/80 text-sm">{tag}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-white/40 text-sm">Key points not available yet.</p>
                )}
              </div>
            )}

            {activeTab === 'quiz' && (
              <div className="space-y-4">
                <h3 className="text-[#00C9A7] font-semibold text-sm flex items-center gap-2"><span>✨</span> Quiz</h3>
                <p className="text-white/40 text-sm">Take the full assessment to test your knowledge.</p>
                <Link href={`/student/assessments`}>
                  <button className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-semibold hover:opacity-90 transition mt-2">
                    Go to Assessments →
                  </button>
                </Link>
              </div>
            )}

            {activeTab === 'transcript' && (
              <div className="space-y-4">
                <h3 className="text-white font-semibold text-sm">Full Transcript</h3>
                {lesson.transcript_text ? (
                  lesson.transcript_text.split('\n\n').map((para: string, i: number) => (
                    <p key={i} className="text-white/70 text-sm leading-relaxed hover:text-white/90 cursor-pointer transition">{para}</p>
                  ))
                ) : (
                  <p className="text-white/40 text-sm">Transcript not available yet. Processing in progress...</p>
                )}
              </div>
            )}

            {activeTab === 'vocabulary' && (
              <div className="space-y-3">
                <h3 className="text-white font-semibold text-sm">Key Vocabulary</h3>
                {vocab.length > 0 ? (
                  vocab.map((v, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-[#6C63FF]/10 transition cursor-pointer">
                      <div>
                        <p className="text-white font-medium text-sm">{v.word}</p>
                        <p className="text-white/40 text-xs">{v.hindi}</p>
                      </div>
                      <button className="text-[#6C63FF] text-xs hover:underline">Practice ISL →</button>
                    </div>
                  ))
                ) : (
                  <p className="text-white/40 text-sm">No vocabulary data available.</p>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-3">
                <h3 className="text-white font-semibold text-sm">My Notes</h3>
                <textarea className="glass-input w-full h-48 resize-none text-sm" placeholder="Type your notes here..." />
                <button className="w-full py-2 bg-[#6C63FF]/20 text-[#6C63FF] rounded-xl text-sm font-medium hover:bg-[#6C63FF]/30 transition">Save Notes</button>
              </div>
            )}
          </div>

          {/* Lesson Actions */}
          <div className="glass-card p-4 space-y-3">
            <Link href="/student/assessments">
              <button className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-semibold hover:opacity-90 transition">
                Take Quiz →
              </button>
            </Link>
            <button className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 font-medium hover:bg-white/10 transition">
              ↓ Download for Offline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
