/**
 * Utility to get candidate AI backend URLs in priority order:
 * 1. User-Supplied Active Cloudflare Tunnel URL (from header, request, or localStorage)
 * 2. Active Cloudflare Tunnel for current session
 * 3. Environment Tunnel URL (from NEXT_PUBLIC_TUNNEL_URL, BACKEND_URL, NEXT_PUBLIC_BACKEND_URL)
 * 4. Local Laptop LAN IP (http://10.31.8.204:8000) for devices on the same Wi-Fi
 * 5. Local Python Backend (http://127.0.0.1:8000 or http://localhost:8000)
 * 6. Render Cloud Backend (https://sparsh-538t.onrender.com)
 *
 * Automatically filters out dead/expired legacy tunnels so queries NEVER fail.
 */

// Active Cloudflare Tunnel for this development session
export const CURRENT_ACTIVE_TUNNEL = 'https://club-recreational-worker-watches.trycloudflare.com';
export const CURRENT_LAN_BACKEND = 'http://10.31.8.204:8000';

export function getBackendCandidateUrls(customTunnelUrl?: string | null): string[] {
  const urls: string[] = [];

  // 1. Explicitly passed custom tunnel URL (from header, body, or prop)
  if (customTunnelUrl && typeof customTunnelUrl === 'string') {
    const clean = customTunnelUrl.trim().replace(/\/$/, '');
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      urls.push(clean);
    } else if (clean.length > 5) {
      urls.push(`https://${clean}`);
    }
  }

  // 2. Browser localStorage saved tunnel URL
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('sparsh_tunnel_url');
      if (saved && saved.trim()) {
        const cleanSaved = saved.trim().replace(/\/$/, '');
        if (cleanSaved.startsWith('http://') || cleanSaved.startsWith('https://')) {
          urls.push(cleanSaved);
        } else if (cleanSaved.length > 5) {
          urls.push(`https://${cleanSaved}`);
        }
      }
    } catch (_) {}
  }

  // 3. Current active Cloudflare quick-tunnel (accessible worldwide over HTTPS)
  urls.push(CURRENT_ACTIVE_TUNNEL);

  // 4. Environment variable tunnel overrides
  if (process.env.NEXT_PUBLIC_TUNNEL_URL) {
    urls.push(process.env.NEXT_PUBLIC_TUNNEL_URL.trim().replace(/\/$/, ''));
  }
  if (process.env.BACKEND_URL) {
    urls.push(process.env.BACKEND_URL.trim().replace(/\/$/, ''));
  }
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    urls.push(process.env.NEXT_PUBLIC_BACKEND_URL.trim().replace(/\/$/, ''));
  }

  // 5. Local Laptop LAN IP (allows physical devices on same Wi-Fi like ESP32 glasses or phones)
  urls.push(CURRENT_LAN_BACKEND);

  // 6. Local machine loopback addresses
  urls.push('http://127.0.0.1:8000');
  urls.push('http://localhost:8000');

  // 7. Render Cloud Backend fallback
  urls.push('https://sparsh-538t.onrender.com');

  // Deduplicate and filter dead legacy tunnels
  const deduped = Array.from(new Set(urls)).filter(
    (u) => Boolean(u) && !u.includes('spare-nato-obvious-murphy')
  );

  return deduped;
}

/**
 * Returns the best single backend URL currently available.
 */
export function getPrimaryBackendUrl(): string {
  const candidates = getBackendCandidateUrls();
  return candidates[0] || 'http://localhost:8000';
}
