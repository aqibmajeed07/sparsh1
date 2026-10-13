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

    const res = await fetch(`${BACKEND_URL}/api/doubt-solver`, {
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
    console.warn('[Doubt Solver Proxy] Backend error or timeout:', err?.message);
  }

  const text = body.text || '';
  return NextResponse.json({
    original: text,
    simple_explanation: `In simple terms: ${text}. It means we observe how nature and science work together in simple everyday steps!`
  });
}
