import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    const isMissingBackendEnv = !process.env.BACKEND_URL && !process.env.NEXT_PUBLIC_BACKEND_URL && process.env.NODE_ENV === 'production';
    if (isMissingBackendEnv) {
      return NextResponse.json({
        sign: null,
        confidence: 0,
        is_confident: false,
        message: 'BACKEND_URL environment variable not configured in Vercel. Set your Render URL in Vercel Settings.',
        finger_tracking: null,
        model_source: 'Niral AI Model',
      });
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/predict-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`Backend error: ${res.status}`);
      }

      const result = await res.json();
      return NextResponse.json(result);
    } catch (backendErr: any) {
      console.warn('[predict-sign] Backend error or timeout:', backendErr.message);
      return NextResponse.json({
        sign: null,
        confidence: 0,
        is_confident: false,
        message: 'Connecting to Render backend (waking up or offline)...',
        finger_tracking: null,
        model_source: 'Niral AI Model',
      });
    }
  } catch (error: any) {
    console.error('[/api/predict-sign] Internal Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
