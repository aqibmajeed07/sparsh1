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

let cachedWorkingCandidate: { url: string; expiresAt: number } | null = null;

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

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // Sort candidates so cached working candidate is checked first
  const orderedCandidates = [...candidates];
  if (cachedWorkingCandidate && Date.now() < cachedWorkingCandidate.expiresAt) {
    const cachedUrl = cachedWorkingCandidate.url;
    const idx = orderedCandidates.indexOf(cachedUrl);
    if (idx > -1) {
      orderedCandidates.splice(idx, 1);
      orderedCandidates.unshift(cachedUrl);
    }
  }

  // 1. Try candidates in priority order (Cloudflare Tunnel -> LAN -> Local -> Proxy)
  for (const candidate of orderedCandidates) {
    // Avoid Mixed Content on HTTPS pages
    if (isHttps && (candidate.startsWith('http://localhost') || candidate.startsWith('http://127.0.0.1') || candidate.startsWith('http://10.'))) {
      continue;
    }

    try {
      const controller = new AbortController();
      // Fast timeout for quick GET polling (1800ms) to prevent browser queue congestion
      const timeoutMs = isPost ? 30000 : 1800;
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
        cachedWorkingCandidate = { url: candidate, expiresAt: Date.now() + 60000 };
        return res;
      }
    } catch (err) {
      // If cached candidate failed, invalidate it
      if (cachedWorkingCandidate?.url === candidate) {
        cachedWorkingCandidate = null;
      }
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
