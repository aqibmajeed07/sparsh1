import { NextResponse } from 'next/server';
import { getBackendCandidateUrls } from '@/lib/backendUrl';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, target_sign } = body;

    if (!image) {
      return NextResponse.json({ error: 'Image required' }, { status: 400 });
    }

    const candidateUrls = getBackendCandidateUrls();

    for (const baseUrl of candidateUrls) {
      try {
        const res = await fetch(`${baseUrl}/api/gamification/verify-sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, target_sign }),
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

    // Direct /api/predict-sign fallback
    for (const baseUrl of candidateUrls) {
      try {
        const res = await fetch(`${baseUrl}/api/predict-sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image }),
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const pred = await res.json();
          const detected = pred.sign || '';
          const confidence = pred.confidence || 0;
          const cleanTarget = (target_sign || '').replace(/_/g, '').toLowerCase();
          const cleanDet = detected.replace(/_/g, '').toLowerCase();
          const match = Boolean(cleanTarget && cleanDet && (cleanTarget === cleanDet || cleanDet.includes(cleanTarget) || cleanTarget.includes(cleanDet)));

          return NextResponse.json({
            match: match && confidence >= 0.20,
            confidence: Math.round(confidence * 100) / 100,
            detected: detected || 'Hand detected',
            target: target_sign,
            is_confident: pred.is_confident || false,
          });
        }
      } catch {
        continue;
      }
    }

    return NextResponse.json({
      match: false,
      confidence: 0,
      detected: 'Connecting to Sign AI...',
      target: target_sign,
      is_confident: false,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
