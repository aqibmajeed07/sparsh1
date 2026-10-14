import { NextResponse } from 'next/server';
import { getBackendCandidateUrls } from '@/lib/backendUrl';

export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id') || '';

  const candidateUrls = getBackendCandidateUrls();

  for (const baseUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const url = `${baseUrl}/api/ai-tutor/sessions${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (e: any) {
      // try next url
    }
  }

  return NextResponse.json({ sessions: [] });
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    body = {};
  }

  const candidateUrls = getBackendCandidateUrls();

  for (const baseUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${baseUrl}/api/ai-tutor/sessions`, {
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
    } catch (e: any) {
      // try next
    }
  }

  // Fallback session object
  const newId = crypto.randomUUID();
  const now = new Date().toISOString();
  return NextResponse.json({
    id: newId,
    user_id: body.user_id || null,
    title: body.title || 'New Conversation',
    language: body.language || 'en-US',
    created_at: now,
    updated_at: now,
  });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id') || '';

  const candidateUrls = getBackendCandidateUrls();

  for (const baseUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const url = `${baseUrl}/api/ai-tutor/sessions${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`;
      const res = await fetch(url, { method: 'DELETE', signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (e: any) {
      // try next
    }
  }

  return NextResponse.json({ status: 'cleared', user_id: userId });
}
