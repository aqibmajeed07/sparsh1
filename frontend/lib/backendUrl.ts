/**
 * Utility to get candidate AI backend URLs in priority order:
 * 1. Custom / Tunnel URL (from BACKEND_URL or NEXT_PUBLIC_BACKEND_URL)
 * 2. Local Python Backend (http://127.0.0.1:8000 or http://localhost:8000)
 * 3. Render Cloud Backend (https://sparsh-538t.onrender.com)
 *
 * Automatically filters out dead/expired tunnels so queries NEVER fail.
 */
export function getBackendCandidateUrls(): string[] {
  const urls: string[] = [];

  if (process.env.BACKEND_URL) {
    urls.push(process.env.BACKEND_URL.replace(/\/$/, ''));
  }
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    urls.push(process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, ''));
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
