import { NextResponse } from 'next/server';
import { getBackendCandidateUrls } from '@/lib/backendUrl';

export const maxDuration = 45;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { track, target_char, description, hints, student_query } = body;

    const trackName = track === 'blind_braille' ? 'Braille 6-dot tactile code' : 'Indian Sign Language (ISL)';
    const prompt = student_query
      ? `Student asked: "${student_query}" regarding learning "${target_char}" in ${trackName}. ${description}. Provide a friendly, concise 2-sentence explanation with clear practical guidance.`
      : `Teach a quick, super friendly 3-sentence lesson to a student learning "${target_char}" in ${trackName}. Description: ${description}. Include: 1) What it looks or feels like, 2) A memorable mnemonic trick, 3) An encouraging cheer. Keep response under 60 words so it sounds natural when spoken aloud.`;

    const candidateUrls = getBackendCandidateUrls();

    for (const baseUrl of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 18000);

        const res = await fetch(`${baseUrl}/api/ai-tutor/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: prompt,
            system_role: 'You are Sparshy, an adorable, enthusiastic Peacock AI Tutor in Sparsh Duo. You love teaching deaf and blind students with warmth and simplicity.',
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const reply = data.reply || '';
          if (reply && reply.length > 10) {
            return NextResponse.json({
              status: 'success',
              lesson_text: reply,
              target_char,
              track,
            });
          }
        }
      } catch (err: any) {
        console.warn(`[AI Lesson] ${baseUrl} failed:`, err?.message);
      }
    }

    // High quality tailored fallback if backend AI is offline
    let fallbackText = '';
    if (track === 'blind_braille') {
      fallbackText = `Welcome to Braille! To make letter "${target_char}", remember its dot pattern: ${description}. Feel each dot position with your fingertips and listen to each dot's pitch! You've got this!`;
    } else {
      fallbackText = `Let's master the sign for "${target_char}"! ${description}. Keep your hand centered in the camera frame with good lighting. Hold steady and let's win this level together!`;
    }

    return NextResponse.json({
      status: 'success',
      lesson_text: fallbackText,
      target_char,
      track,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
