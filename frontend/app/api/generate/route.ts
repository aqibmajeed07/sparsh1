import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, lesson_id } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Forward to Python backend /api/generate
    let result;
    try {
      const res = await fetch(`${BACKEND_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.substring(0, 3000), lesson_id: lesson_id || null }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      result = await res.json();
    } catch (backendErr) {
      console.warn('[Generate] Backend unavailable, using local fallback:', backendErr);
      // Local fallback — extract sentences and build summary
      const sentences = text
        .replace(/\n/g, ' ')
        .split(/[.!?]+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 20);

      const summary = sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '.' : '');
      const key_points = sentences.slice(3, 6).map((s: string) => s + '.');
      const quiz = [
        { question: 'What is the main topic of this lesson?', answer: sentences[0] || 'See lesson content.' },
        { question: 'List one important concept from this lesson.', answer: sentences[1] || 'See lesson content.' },
        { question: 'Summarize what you learned.', answer: summary || 'Review the lesson.' },
      ];
      result = { summary, key_points, quiz };
    }

    // Validate structure
    if (!result.summary) result.summary = 'Summary not available.';
    if (!Array.isArray(result.key_points)) result.key_points = [];
    if (!Array.isArray(result.quiz)) result.quiz = [];

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[/api/generate] Error:', error.message);
    return NextResponse.json({
      summary: 'Could not generate content. Please try again.',
      key_points: [],
      quiz: [],
    }, { status: 200 });
  }
}
