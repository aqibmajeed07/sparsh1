import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, lang } = body;

    if (!text) {
      return NextResponse.json({ isl_text: [] });
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/isl-grammar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang: lang || 'en-IN' }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) throw new Error(`Backend status ${res.status}`);
      const data = await res.json();
      return NextResponse.json(data);
    } catch (backendErr: any) {
      // Local fallback ISL tokenizer if backend is temporarily unreachable
      const stopWords = new Set([
        'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'a', 'an', 'the',
        'will', 'shall', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with'
      ]);

      const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 0 && !stopWords.has(w));

      return NextResponse.json({ isl_text: words });
    }
  } catch (error: any) {
    return NextResponse.json({ isl_text: [] });
  }
}
