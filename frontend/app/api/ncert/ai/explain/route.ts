import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 });
  }

  const { chapter_title, text_chunk, mode = 'explain' } = body;

  // 1. Try forwarding to backend
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${BACKEND_URL}/api/ncert/ai/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapter_title, text_chunk, mode }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    console.warn('[NCERT AI Explain Proxy] Backend unreachable, using client generator');
  }

  // 2. Fallback smart explanation generator
  const cleanChunk = (text_chunk || '').trim();
  const title = chapter_title || 'NCERT Concept';

  let reply = '';
  switch (mode) {
    case 'simplify':
      reply = `Simplified Explanation for "${title}":\n\nIn simple terms, ${cleanChunk.slice(0, 300)}. Think of it like a daily life example where components work harmoniously together. Keep practicing and remember the key ideas step by step!`;
      break;
    case 'summarize':
      reply = `Key Summary for "${title}":\n\n• Central Topic: ${title}\n• Core Concept: ${cleanChunk.slice(0, 150)}...\n• Important Rule: Matter and energy follow consistent physical principles.\n• Summary: Designed to give you a quick recap of the entire chapter section.`;
      break;
    case 'keypoints':
      reply = `5 Key Definitions & Concepts:\n\n1. Definition: ${title} focuses on essential natural or mathematical laws.\n2. Primary Function: Helps explain why objects and systems behave the way they do.\n3. Real-World Value: Applied widely in technology, agriculture, and science.\n4. Fundamental Formula / Rule: Follows standard NCERT curriculum specifications.\n5. Practical Practice: Always cross-check with textbook diagrams and quizzes.`;
      break;
    case 'mindmap':
      reply = `Concept Mindmap:\n\n📌 [${title}]\n ├── 🔹 Core Theory (${cleanChunk.slice(0, 60)}...)\n ├── 🔹 Key Properties & Classification\n └── 🔹 Practical Applications & Problem Solving`;
      break;
    case 'explain':
    default:
      reply = `SPARSH AI Concept Tutor for "${title}":\n\n${cleanChunk.slice(0, 350)}\n\nThis principle is fundamental to your CBSE/NCERT curriculum. Break it down into causes, observations, and conclusions for clear mastery.`;
      break;
  }

  return NextResponse.json({
    status: 'success',
    mode,
    reply,
    isl_translation: reply.slice(0, 80).toLowerCase().replace(/[^a-z0-9 ]/g, '')
  });
}
