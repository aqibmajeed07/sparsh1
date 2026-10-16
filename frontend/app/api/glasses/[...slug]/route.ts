import { NextRequest, NextResponse } from 'next/server';
import { getBackendCandidateUrls } from '@/lib/backendUrl';

export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
  const path = params.slug.join('/');
  const search = req.nextUrl.search;
  const authHeader = req.headers.get('authorization') || 'Bearer student-web-session';
  const deviceToken = req.headers.get('x-device-token') || '';
  const customTunnel = req.headers.get('x-tunnel-url') || req.nextUrl.searchParams.get('tunnel_url') || null;

  const headers: Record<string, string> = {
    'Authorization': authHeader,
    'bypass-tunnel-reminder': 'true',
    'User-Agent': 'SparshClient',
  };
  if (deviceToken) headers['X-Device-Token'] = deviceToken;

  for (const baseUrl of getBackendCandidateUrls(customTunnel)) {
    try {
      const targetUrl = `${baseUrl}/api/glasses/${path}${search}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers,
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        // If the endpoint returns JPEG (e.g., /capture), return binary response directly
        if (contentType.includes('image/')) {
          const blob = await res.arrayBuffer();
          return new NextResponse(blob, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          });
        }
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
      }
    } catch (err: any) {
      console.warn(`[Glasses Proxy GET] ${baseUrl} failed:`, err?.message);
    }
  }

  // Fallback for image capture
  if (path === 'capture') {
    return NextResponse.redirect(new URL('/glasses_demo_frame.jpg', req.url));
  }

  return NextResponse.json(
    {
      connected: false,
      configured: false,
      message: 'Glasses camera is offline or still booting up.',
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest, { params }: { params: { slug: string[] } }) {
  const path = params.slug.join('/');
  const contentType = req.headers.get('content-type') || 'application/json';
  const authHeader = req.headers.get('authorization') || 'Bearer student-web-session';
  const deviceToken = req.headers.get('x-device-token') || '';
  const trigger = req.headers.get('x-trigger') || '';
  const customTunnel = req.headers.get('x-tunnel-url') || req.nextUrl.searchParams.get('tunnel_url') || null;

  // Read raw buffer so both JSON requests and binary JPEG uploads from ESP32 work seamlessly
  const rawBody = await req.arrayBuffer();

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Authorization': authHeader,
    'bypass-tunnel-reminder': 'true',
    'User-Agent': 'SparshClient',
  };
  if (deviceToken) headers['X-Device-Token'] = deviceToken;
  if (trigger) headers['X-Trigger'] = trigger;

  for (const baseUrl of getBackendCandidateUrls(customTunnel)) {
    try {
      const targetUrl = `${baseUrl}/api/glasses/${path}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 35000); // 35s for VLM + Ollama generation

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: rawBody,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
      }
    } catch (err: any) {
      console.warn(`[Glasses Proxy POST] ${baseUrl} failed:`, err?.message);
    }
  }

  return NextResponse.json(
    {
      success: false,
      text: 'The smart glasses view is being calibrated. Looking in front of you.',
      description: 'The smart glasses view is being calibrated. Looking in front of you.',
      image_url: '/glasses_demo_frame.jpg',
      message: 'Vision service temporarily unavailable on current network.',
    },
    { status: 200 }
  );
}
