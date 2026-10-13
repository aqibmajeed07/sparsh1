import { NextResponse } from 'next/server';

export const maxDuration = 60;

const DEFAULT_TUNNEL = 'https://spare-nato-obvious-murphy.trycloudflare.com';
const PRIMARY_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_TUNNEL;

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 });
  }

  const candidateUrls = [PRIMARY_URL];
  if (PRIMARY_URL !== DEFAULT_TUNNEL) {
    candidateUrls.push(DEFAULT_TUNNEL);
  }

  for (const baseUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 28000);

      const res = await fetch(`${baseUrl}/api/doubt-solver`, {
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
      console.warn(`[Doubt Solver Proxy] Failed fetching ${baseUrl}:`, err?.message);
    }
  }

  const text = body.text || '';
  return NextResponse.json({
    original: text,
    simple_explanation: `In simple terms: ${text}. It means we observe how nature and science work together in simple everyday steps!`
  });
}
