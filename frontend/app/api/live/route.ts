import { NextRequest, NextResponse } from 'next/server';

function sanitizeDailyRoomName(input: string): string {
  if (!input) return `sparsh-${Date.now()}`;
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

const DAILY_DOMAIN = 'edsign.daily.co';

export async function POST(req: NextRequest) {
  try {
    const { roomName } = await req.json().catch(() => ({}));

    const DAILY_API_KEY = process.env.DAILY_API_KEY || process.env.NEXT_PUBLIC_DAILY_API_KEY;
    const name = sanitizeDailyRoomName(roomName);

    if (!DAILY_API_KEY) {
      // Fallback directly to domain url
      return NextResponse.json({ url: `https://${DAILY_DOMAIN}/${name}`, name });
    }

    // Try to create the Daily.co room via their REST API
    const res = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name,
        properties: {
          enable_screenshare: true,
          enable_chat: true,
          enable_knocking: false,
          enable_prejoin_ui: false,
          exp: Math.round(Date.now() / 1000) + 7200, // 2 hours validity
        },
      }),
    });

    if (res.ok) {
      const room = await res.json();
      return NextResponse.json({ url: room.url, name: room.name });
    }

    // If already exists, retrieve it
    const errData = await res.json().catch(() => ({}));
    if (res.status === 400 && JSON.stringify(errData).includes('already exists')) {
      const getRes = await fetch(`https://api.daily.co/v1/rooms/${name}`, {
        headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
      });
      if (getRes.ok) {
        const room = await getRes.json();
        return NextResponse.json({ url: room.url, name: room.name });
      }
    }

    // Direct domain URL fallback if API returned non-critical error
    return NextResponse.json({ url: `https://${DAILY_DOMAIN}/${name}`, name });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Daily room error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const rawName = searchParams.get('room') || '';
    const name = sanitizeDailyRoomName(rawName);

    const DAILY_API_KEY = process.env.DAILY_API_KEY || process.env.NEXT_PUBLIC_DAILY_API_KEY;
    if (!DAILY_API_KEY) {
      return NextResponse.json({ url: `https://${DAILY_DOMAIN}/${name}`, name });
    }

    const res = await fetch(`https://api.daily.co/v1/rooms/${name}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    if (res.ok) {
      const room = await res.json();
      return NextResponse.json({ url: room.url, name: room.name });
    }

    // If not found, create it on the fly
    if (res.status === 404) {
      const createRes = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name,
          properties: {
            enable_screenshare: true,
            enable_chat: true,
            enable_knocking: false,
            enable_prejoin_ui: false,
            exp: Math.round(Date.now() / 1000) + 7200,
          },
        }),
      });

      if (createRes.ok) {
        const newRoom = await createRes.json();
        return NextResponse.json({ url: newRoom.url, name: newRoom.name });
      }
    }

    return NextResponse.json({ url: `https://${DAILY_DOMAIN}/${name}`, name });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Daily room fetch error' }, { status: 500 });
  }
}
