import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
  const path = params.slug.join('/');
  const search = req.nextUrl.search;
  const targetUrl = `${BACKEND_URL}/api/glasses/${path}${search}`;

  const authHeader = req.headers.get('authorization') || 'Bearer student-web-session';
  const deviceToken = req.headers.get('x-device-token') || '';

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    };
    if (deviceToken) headers['X-Device-Token'] = deviceToken;

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers,
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
  
  const contentType = req.headers.get('content-type') || 'application/json';
  const authHeader = req.headers.get('authorization') || 'Bearer student-web-session';
  const deviceToken = req.headers.get('x-device-token') || '';
  const trigger = req.headers.get('x-trigger') || '';

  try {
    // Read raw buffer so both JSON requests and binary JPEG uploads from ESP32 work seamlessly
    const rawBody = await req.arrayBuffer();

    const headers: Record<string, string> = {
      'Content-Type': contentType,
    };
    if (authHeader) headers['Authorization'] = authHeader;
    if (deviceToken) headers['X-Device-Token'] = deviceToken;
    if (trigger) headers['X-Trigger'] = trigger;

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: rawBody,
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
