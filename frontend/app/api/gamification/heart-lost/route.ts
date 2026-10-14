import { NextResponse } from 'next/server';
import { getBackendCandidateUrls } from '@/lib/backendUrl';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const candidateUrls = getBackendCandidateUrls();

    for (const baseUrl of candidateUrls) {
      try {
        const res = await fetch(`${baseUrl}/api/gamification/heart-lost`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json(data);
        }
      } catch {
        continue;
      }
    }

    return NextResponse.json({
      status: 'success',
      hearts: 4,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
