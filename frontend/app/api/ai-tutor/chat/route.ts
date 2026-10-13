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

  // List candidate URLs to try (primary env var, then fallback default tunnel)
  const candidateUrls = [PRIMARY_URL];
  if (PRIMARY_URL !== DEFAULT_TUNNEL) {
    candidateUrls.push(DEFAULT_TUNNEL);
  }

  for (const baseUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 28000); // 28s for local Ollama generation

      const res = await fetch(`${baseUrl}/api/ai-tutor/chat`, {
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
      console.warn(`[AI Tutor Proxy] Failed fetching ${baseUrl}:`, err?.message);
    }
  }

  // Graceful conversational fallback if all backend targets are momentarily unreachable
  const userMsg = body.message || 'Help';
  return NextResponse.json({
    reply: `I am your SPARSH AI Tutor. I understood your question about "${userMsg}". Here is a simple explanation: All concepts in science and mathematics can be understood by observing everyday examples around us.`,
    language: body.language || 'en-US',
    isl_translation: userMsg.toLowerCase().replace(/[^a-z0-9 ]/g, '')
  });
}

