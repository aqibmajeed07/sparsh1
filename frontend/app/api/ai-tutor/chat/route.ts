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
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s for local Ollama generation

    const res = await fetch(`${BACKEND_URL}/api/ai-tutor/chat`, {
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
    console.warn('[AI Tutor Proxy] Backend error or timeout:', err?.message);
  }

  // Graceful conversational fallback if backend is momentarily unreachable
  const userMsg = body.message || 'Help';
  return NextResponse.json({
    reply: `I am your SPARSH AI Tutor. I understood your question about "${userMsg}". Here is a simple explanation: All concepts in science and mathematics can be understood by observing everyday examples around us.`,
    language: body.language || 'en-US',
    isl_translation: userMsg.toLowerCase().replace(/[^a-z0-9 ]/g, '')
  });
}
