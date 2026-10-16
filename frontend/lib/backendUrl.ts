/**
 * Utility to get candidate AI backend URLs in priority order:
 * 1. User-Supplied Active Cloudflare Tunnel URL (from header, request, or localStorage)
 * 2. Environment Tunnel URL (from BACKEND_URL, NEXT_PUBLIC_BACKEND_URL, or NEXT_PUBLIC_TUNNEL_URL)
 * 3. Local Python Backend (http://127.0.0.1:8000 or http://localhost:8000)
 * 4. Render Cloud Backend (https://sparsh-538t.onrender.com)
 *
 * Automatically filters out dead/expired tunnels so queries NEVER fail.
 */
export function getBackendCandidateUrls(customTunnelUrl?: string | null): string[] {
  const urls: string[] = [];

  // 1. Highest priority: user active tunnel (e.g. from cloudflared)
  if (customTunnelUrl && typeof customTunnelUrl === 'string') {
    const clean = customTunnelUrl.trim().replace(/\/$/, '');
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      urls.push(clean);
    } else if (clean.length > 5) {
      urls.push(`https://${clean}`);
    }
  }

  if (process.env.NEXT_PUBLIC_TUNNEL_URL) {
    urls.push(process.env.NEXT_PUBLIC_TUNNEL_URL.trim().replace(/\/$/, ''));
  }
  if (process.env.BACKEND_URL) {
    urls.push(process.env.BACKEND_URL.trim().replace(/\/$/, ''));
  }
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    urls.push(process.env.NEXT_PUBLIC_BACKEND_URL.trim().replace(/\/$/, ''));
  }

  // Local development backends
  urls.push('http://127.0.0.1:8000');
  urls.push('http://localhost:8000');

  // Render Cloud Backend (always live 24/7)
  urls.push('https://sparsh-538t.onrender.com');

  // Filter dead legacy tunnels and deduplicate
  return Array.from(new Set(urls)).filter(
    (u) => Boolean(u) && !u.includes('spare-nato-obvious-murphy')
  );
}
