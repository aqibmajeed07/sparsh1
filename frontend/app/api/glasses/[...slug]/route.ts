import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
  const path = params.slug.join('/');
  const search = req.nextUrl.search;
  const targetUrl = `${BACKEND_URL}/api/glasses/${path}${search}`;

  const authHeader = req.headers.get('authorization') || 'Bearer student-web-session';

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      {
        connected: false,
        configured: false,
        message: 'Glasses are unreachable or backend service is offline.',
        error: err?.message,
      },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: { slug: string[] } }) {
  const path = params.slug.join('/');
  const targetUrl = `${BACKEND_URL}/api/glasses/${path}`;
  const authHeader = req.headers.get('authorization') || 'Bearer student-web-session';

  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: 'Vision service is not reachable on backend.',
        error: err?.message,
      },
      { status: 502 }
    );
  }
}
