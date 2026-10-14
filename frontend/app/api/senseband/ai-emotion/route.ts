import { NextResponse } from 'next/server';
import { getBackendCandidateUrls } from '@/lib/backendUrl';

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 });
  }

  // 1. Try forwarding to backend candidate URLs
  for (const baseUrl of getBackendCandidateUrls()) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${baseUrl}/api/senseband/ai-emotion`, {
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
    } catch (err) {
      // Try next candidate
    }
  }

  // 2. Built-in haptic pattern matching rule engine
  const text = (body.text || '').toLowerCase();
  if (text.includes('calm') || text.includes('breath') || text.includes('relax')) {
    return NextResponse.json({
      status: 'success',
      emotion: 'Calm & Grounding',
      sentiment: 'Neutral',
      haptic_command: 'FORWARD',
      pattern_desc: 'Slow rhythmic breathing pulse (pulse every 2s)',
      ai_message: 'Guiding your breathing with slow, rhythmic grounding haptics.',
      provider: 'Sparsh AI Emotion Engine'
    });
  } else if (text.includes('eureka') || text.includes('understand') || text.includes('idea')) {
    return NextResponse.json({
      status: 'success',
      emotion: 'AI Eureka Moment',
      sentiment: 'Positive',
      haptic_command: 'AI_READY',
      pattern_desc: 'Two short crisp insight pulses (· ·)',
      ai_message: 'Crisp insight pulses triggered for your learning breakthrough!',
      provider: 'Sparsh AI Emotion Engine'
    });
  } else if (text.includes('urgent') || text.includes('alert') || text.includes('danger')) {
    return NextResponse.json({
      status: 'success',
      emotion: 'High Alert & Emergency',
      sentiment: 'Negative',
      haptic_command: 'EMERGENCY',
      pattern_desc: 'Continuous 3-second urgent burst (██████)',
      ai_message: 'Urgent emergency alert pattern activated on SenseBand.',
      provider: 'Sparsh AI Emotion Engine'
    });
  }

  return NextResponse.json({
    status: 'success',
    emotion: 'Gentle Comfort & Focus',
    sentiment: 'Positive',
    haptic_command: 'MESSAGE',
    pattern_desc: 'Double warm pulsing pulses (·· ··)',
    ai_message: 'Sending gentle reassuring haptic pulses to soothe and support you.',
    provider: 'Sparsh AI Emotion Engine'
  });
}
