import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://spare-nato-obvious-murphy.trycloudflare.com';

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s for local Ollama generation

    const res = await fetch(`${BACKEND_URL}/api/homework-helper`, {
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
  } catch (err: any) {
    console.warn('[Homework Helper Proxy] Backend error or timeout:', err?.message);
  }

  const q = body.question || 'Homework Problem';
  return NextResponse.json({
    summary: `Core Principle breakdown for: ${q}`,
    steps: [
      `Step 1: Identify given facts in the problem.`,
      `Step 2: Apply the fundamental science/math principle step by step.`,
      `Step 3: State the final verified conclusion clearly.`
    ],
    practice_tip: `Break complex problems into smaller, numbered chunks and review each part!`
  });
}
