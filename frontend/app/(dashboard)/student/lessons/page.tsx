'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LessonsPage() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('All');
  const [grade, setGrade] = useState('All');
  const [board, setBoard] = useState('All');
  const [error, setError] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    async function fetchLessons() {
      setLoading(true);
      setError('');
      try {
        const { data, error } = await supabase
          .from('lessons')
          .select('id, title, subject, grade, board, chapter, duration_seconds, thumbnail_url, tags, processing_status, is_ncert_aligned')
          .order('grade', { ascending: true })
          .order('subject', { ascending: true });

        if (data && data.length > 0) {
          setLessons(data);
        } else {
          setLessons([]);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch lessons');
        setLessons([]);
      }
      setLoading(false);
    }
    fetchLessons();
  }, []);

  const filtered = lessons.filter(l => {
    const matchSearch = l.title?.toLowerCase().includes(search.toLowerCase()) || l.subject?.toLowerCase().includes(search.toLowerCase()) || l.chapter?.toLowerCase().includes(search.toLowerCase());
    const matchSubject = subject === 'All' || l.subject === subject;
    const matchGrade = grade === 'All' || String(l.grade) === grade;
    const matchBoard = board === 'All' || l.board === board;
    return matchSearch && matchSubject && matchGrade && matchBoard;
  });

  const dynamicSubjects = ['All', ...Array.from(new Set(lessons.map(l => l.subject).filter(Boolean)))].sort();
  const dynamicGrades = ['All', ...Array.from(new Set(lessons.map(l => String(l.grade)).filter(Boolean)))].sort((a, b) => a === 'All' ? -1 : b === 'All' ? 1 : Number(a) - Number(b));
  const dynamicBoards = ['All', ...Array.from(new Set(lessons.map(l => l.board).filter(Boolean)))].sort();

  const vibrate = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">NCERT Syllabus Lessons</h1>
        <p className="text-white/60 mt-1">NCERT-aligned interactive textbook lessons with ISL, captions & audio descriptions</p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col md:flex-row gap-4 items-center">
        <input
          type="text"
          placeholder="Search NCERT lessons (e.g. Physics, Atoms, Equations)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="glass-input flex-1 w-full"
        />
        <select value={subject} onChange={e => setSubject(e.target.value)} className="glass-input bg-transparent appearance-none">
          {dynamicSubjects.map(s => <option key={s} value={s} className="bg-[#24243e]">{s === 'All' ? 'All Subjects' : s}</option>)}
        </select>
        <select value={grade} onChange={e => setGrade(e.target.value)} className="glass-input bg-transparent appearance-none">
          {dynamicGrades.map(g => <option key={g} value={g} className="bg-[#24243e]">{g === 'All' ? 'All Grades' : `Grade ${g}`}</option>)}
        </select>
        <select value={board} onChange={e => setBoard(e.target.value)} className="glass-input bg-transparent appearance-none">
          {dynamicBoards.map(b => <option key={b} value={b} className="bg-[#24243e]">{b === 'All' ? 'All Boards' : b}</option>)}
        </select>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          <button onClick={() => setView('grid')} className={`px-3 py-1.5 rounded-md text-sm ${view === 'grid' ? 'bg-[#6C63FF] text-white' : 'text-white/60'}`}>Grid</button>
          <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-md text-sm ${view === 'list' ? 'bg-[#6C63FF] text-white' : 'text-white/60'}`}>List</button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">Error: {error}</p>}
      {loading ? (
        <div className="flex items-center gap-3 py-4">
          <span className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40">Loading NCERT syllabus lessons...</p>
        </div>
      ) : (
        <>
          {/* Results count */}
          <p className="text-white/40 text-sm">{filtered.length} NCERT lessons available</p>

          {/* Grid View */}
          {view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((lesson, idx) => {
                const colors = [
                  { border: 'border-[#1cb0f6]', bg: 'bg-[#1cb0f6]/10' },
                  { border: 'border-[#58cc02]', bg: 'bg-[#58cc02]/10' },
                  { border: 'border-[#ff9600]', bg: 'bg-[#ff9600]/10' },
                  { border: 'border-[#ce82ff]', bg: 'bg-[#ce82ff]/10' },
                ];
                const color = colors[idx % colors.length];
                const isImage = lesson.thumbnail_url && (lesson.thumbnail_url.startsWith('http') || lesson.thumbnail_url.startsWith('/'));

                return (
                  <Link key={lesson.id} href={`/student/lessons/${lesson.id}`} onClick={vibrate}>
                    <div className={`glass-card overflow-hidden group cursor-pointer transition-all rounded-2xl border-b-4 ${color.border} active:border-b-0 active:translate-y-1 hover:brightness-110 shadow-sm`}>
                      <div className={`aspect-video ${color.bg} flex items-center justify-center relative overflow-hidden`}>
                        {isImage ? (
                          <img src={lesson.thumbnail_url} alt={lesson.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <span className="text-6xl group-hover:scale-110 transition-transform bounce">{lesson.thumbnail_url || '📚'}</span>
                        )}
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-[#00C9A7] text-[9px] font-black tracking-wider uppercase border border-[#00C9A7]/40">NCERT</span>
                      </div>
                      <div className="p-4 bg-black/20">
                        <p className="text-[#00C9A7] text-[10px] font-black tracking-wider uppercase">{lesson.subject} • {lesson.chapter} • Grade {lesson.grade}</p>
                        <h3 className="text-white font-bold text-lg mt-1 group-hover:text-[#6C63FF] transition">{lesson.title}</h3>
                        <p className="text-white/50 text-sm mt-1 font-medium">{Math.floor((lesson.duration_seconds || 1800) / 60)} min • {lesson.board}</p>
                        <div className="flex gap-1.5 mt-3 flex-wrap">
                          {lesson.tags?.map((tag: string) => (
                            <span key={tag} className="px-2 py-0.5 rounded-xl bg-white/10 text-white/80 text-[10px] font-bold">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(lesson => {
                const isImage = lesson.thumbnail_url && (lesson.thumbnail_url.startsWith('http') || lesson.thumbnail_url.startsWith('/'));
                return (
                  <Link key={lesson.id} href={`/student/lessons/${lesson.id}`} onClick={vibrate}>
                    <div className="glass-card p-4 flex items-center gap-4 group cursor-pointer transition-all rounded-2xl border-b-4 border-[#1cb0f6] active:border-b-0 active:translate-y-1 hover:bg-[#1cb0f6]/5 shadow-sm">
                      <div className="w-16 h-16 bg-[#1cb0f6]/10 rounded-2xl flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform overflow-hidden">
                        {isImage ? (
                          <img src={lesson.thumbnail_url} alt={lesson.title} className="w-full h-full object-cover" />
                        ) : (
                          <span>{lesson.thumbnail_url || '📚'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#58cc02] text-[10px] font-black tracking-wider uppercase">{lesson.subject} • Grade {lesson.grade}</p>
                        <h3 className="text-white font-bold text-lg group-hover:text-[#1cb0f6] transition truncate">{lesson.title}</h3>
                        <p className="text-white/50 text-sm font-medium">{Math.floor((lesson.duration_seconds || 1800) / 60)} min • {lesson.board} • {lesson.chapter}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
