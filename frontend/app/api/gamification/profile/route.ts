import { NextResponse } from 'next/server';
import { getBackendCandidateUrls } from '@/lib/backendUrl';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id') || 'guest_student';

  const candidateUrls = getBackendCandidateUrls();

  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/gamification/profile?user_id=${encodeURIComponent(userId)}`, {
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

  // Graceful fallback profile
  return NextResponse.json({
    status: 'success',
    profile: {
      user_id: userId,
      track: 'deaf_sign',
      total_xp: 120,
      gems: 180,
      hearts: 5,
      max_hearts: 5,
      current_streak: 2,
      last_activity_date: new Date().toISOString().split('T')[0],
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const candidateUrls = getBackendCandidateUrls();

    for (const baseUrl of candidateUrls) {
      try {
        const res = await fetch(`${baseUrl}/api/gamification/profile`, {
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
      profile: {
        user_id: body.user_id || 'guest_student',
        track: body.track || 'deaf_sign',
        total_xp: 120,
        gems: Math.max(0, 180 + (body.gems_delta || 0)),
        hearts: Math.min(5, Math.max(0, 5 + (body.hearts_delta || 0))),
        max_hearts: 5,
        current_streak: 2,
        last_activity_date: new Date().toISOString().split('T')[0],
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
