import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://spare-nato-obvious-murphy.trycloudflare.com';

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(`${BACKEND_URL}/api/smart-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err: any) {
    console.warn('[Smart Notes Proxy] Backend error or timeout:', err?.message);
  }

  const text = body.text || 'Lesson Content';
  const sentences = text.split('.').filter((s: string) => s.trim().length > 15);
  return NextResponse.json({
    summary: sentences[0] ? `${sentences[0].trim()}.` : `Summary of core lesson facts.`,
    key_points: [
      sentences[0] ? `${sentences[0].trim()}.` : 'Key takeaway point 1.',
      sentences[1] ? `${sentences[1].trim()}.` : 'Key takeaway point 2.',
      sentences[2] ? `${sentences[2].trim()}.` : 'Key takeaway point 3.'
    ],
    flashcards: [
      { front: 'What is the main concept of this section?', back: sentences[0] ? sentences[0].trim() : 'Core principle' },
      { front: 'How does this process work?', back: sentences[1] ? sentences[1].trim() : 'Step by step mechanism' },
      { front: 'What is the key takeaway?', back: sentences[2] ? sentences[2].trim() : 'Important conclusion' }
    ]
  });
}
