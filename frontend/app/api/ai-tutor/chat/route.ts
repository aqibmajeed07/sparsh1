import { NextResponse } from 'next/server';
import { getBackendCandidateUrls } from '@/lib/backendUrl';

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 });
  }

  const candidateUrls = getBackendCandidateUrls();

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

