import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/predict-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
        signal: AbortSignal.timeout(6000),
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
        message: 'AI backend offline or connecting...',
        finger_tracking: null,
        model_source: 'Niral AI Model',
      });
    }
  } catch (error: any) {
    console.error('[/api/predict-sign] Internal Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
