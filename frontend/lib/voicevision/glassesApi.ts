/**
 * SPARSH VoiceVision - Resilient Glasses API Helper
 * Prioritizes direct connection to Cloudflare tunnel / backend for instant response,
 * and seamlessly falls back to Next.js serverless proxy if direct connection is blocked.
 */

const DIRECT_BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://spare-nato-obvious-murphy.trycloudflare.com';

export function getGlassesCaptureUrl(): string {
  const t = Date.now();
  if (DIRECT_BACKEND) {
    return `${DIRECT_BACKEND}/api/glasses/capture?t=${t}`;
  }
  return `/api/glasses/capture?t=${t}`;
}

export async function fetchGlassesApi(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const isPost = options.method === 'POST';

  // 1. Try direct tunnel first (instant, bypasses Vercel 10s serverless timeout)
  if (DIRECT_BACKEND) {
    try {
      const controller = new AbortController();
      const timeoutMs = isPost ? 28000 : 4500;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const headers = new Headers(options.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', 'Bearer student-web-session');
      }

      const res = await fetch(`${DIRECT_BACKEND}/api/glasses/${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) return res;
    } catch {
      // Fallback to Next.js API route
    }
  }

  // 2. Fallback to Next.js proxy route (/api/glasses/...)
  const headers = new Headers(options.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', 'Bearer student-web-session');
  }
  return fetch(`/api/glasses/${endpoint}`, {
    ...options,
    headers,
  });
}
