/**
 * SPARSH VoiceVision - Resilient Glasses API Helper
 * Prioritizes direct connection to Cloudflare tunnel / backend for instant response,
 * and seamlessly falls back to Next.js serverless proxy if direct connection is blocked.
 */

import { getBackendCandidateUrls, getPrimaryBackendUrl } from '@/lib/backendUrl';

export function getGlassesCaptureUrl(): string {
  const t = Date.now();
  const primary = getPrimaryBackendUrl();
  if (primary) {
    return `${primary}/api/glasses/capture?t=${t}`;
  }
  return `/api/glasses/capture?t=${t}`;
}

export async function fetchGlassesApi(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const isPost = options.method === 'POST';
  const candidates = getBackendCandidateUrls();

  // Retrieve active tunnel from localStorage if present
  let activeTunnel: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      activeTunnel = localStorage.getItem('sparsh_tunnel_url');
    } catch (_) {}
  }

  const baseHeaders: Record<string, string> = {
    'Authorization': 'Bearer student-web-session',
    'bypass-tunnel-reminder': 'true',
    'User-Agent': 'SparshClient',
  };
  if (activeTunnel) {
    baseHeaders['x-tunnel-url'] = activeTunnel;
  }

  // 1. Try candidates in priority order (Cloudflare Tunnel -> LAN -> Local -> Proxy)
  for (const candidate of candidates) {
    // Skip unencrypted http:// loopback if browser is loaded over HTTPS to prevent Mixed Content Error
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && candidate.startsWith('http://localhost') || candidate.startsWith('http://127.0.0.1')) {
      continue;
    }

    try {
      const controller = new AbortController();
      const timeoutMs = isPost ? 30000 : 5000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const mergedHeaders = new Headers(options.headers || {});
      for (const [k, v] of Object.entries(baseHeaders)) {
        if (!mergedHeaders.has(k)) {
          mergedHeaders.set(k, v);
        }
      }

      const targetUrl = `${candidate}/api/glasses/${endpoint}`;
      const res = await fetch(targetUrl, {
        ...options,
        headers: mergedHeaders,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        return res;
      }
    } catch (err) {
      // Try next candidate
    }
  }

  // 2. Next.js API Proxy Fallback (/api/glasses/...)
  const fallbackHeaders = new Headers(options.headers || {});
  for (const [k, v] of Object.entries(baseHeaders)) {
    if (!fallbackHeaders.has(k)) {
      fallbackHeaders.set(k, v);
    }
  }

  return fetch(`/api/glasses/${endpoint}`, {
    ...options,
    headers: fallbackHeaders,
  });
}
