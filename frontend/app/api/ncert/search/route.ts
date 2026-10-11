import { NextResponse } from 'next/server';
import { NCERT_CBSE_LESSONS } from '@/lib/ncert-syllabus';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 });
  }

  const { query = '', top_k = 5, class_filter = null } = body;

  // 1. Try forwarding to backend
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${BACKEND_URL}/api/ncert/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k, class_filter }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    console.warn('[NCERT Search Proxy] Backend unreachable, using fallback search');
  }

  // 2. Fallback search against NCERT_CBSE_LESSONS
  const qLower = query.toLowerCase();
  const matched = NCERT_CBSE_LESSONS.filter(l => {
    if (class_filter && `Class ${l.grade}` !== class_filter && l.grade !== class_filter) {
      return false;
    }
    return (
      l.title.toLowerCase().includes(qLower) ||
      l.subject.toLowerCase().includes(qLower) ||
      l.description.toLowerCase().includes(qLower) ||
      l.accessible_summary.toLowerCase().includes(qLower) ||
      l.transcript_text.toLowerCase().includes(qLower)
    );
  }).slice(0, top_k).map(l => ({
    title: `${l.chapter}: ${l.title}`,
    class: `Class ${l.grade}`,
    subject: l.subject,
    snippet: l.accessible_summary,
    score: 0.95
  }));

  return NextResponse.json({
    status: 'success',
    results: matched,
  });
}
