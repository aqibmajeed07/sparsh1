import { NextResponse } from 'next/server';
import { getBackendCandidateUrls } from '@/lib/backendUrl';

export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const sessionId = params.id;
  const candidateUrls = getBackendCandidateUrls();

  for (const baseUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${baseUrl}/api/ai-tutor/sessions/${encodeURIComponent(sessionId)}/messages`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (e: any) {
      // try next
    }
  }

  return NextResponse.json({ messages: [] });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const sessionId = params.id;
  const candidateUrls = getBackendCandidateUrls();

  for (const baseUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${baseUrl}/api/ai-tutor/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (e: any) {
      // try next
    }
  }

  return NextResponse.json({ status: 'ok', session_id: sessionId });
}
