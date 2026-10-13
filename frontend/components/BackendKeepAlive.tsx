'use client';

import { useEffect } from 'react';

/**
 * BackendKeepAlive
 * 
 * Periodically sends a lightweight, zero-side-effect ping to the AI backend.
 * Keeps Render free-tier instance warm while any user or student is on the app,
 * preventing cold-start delays.
 */
export default function BackendKeepAlive() {
  useEffect(() => {
    const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://sparsh-538t.onrender.com';
    const pingEndpoint = `${rawUrl.replace(/\/$/, '')}/ping`;

    const sendHeartbeat = () => {
      try {
        fetch(pingEndpoint, {
          method: 'GET',
          cache: 'no-store',
          keepalive: true,
        }).catch(() => {
          // Silent: network hiccups should never affect the UI
        });
      } catch {
        // Ignore
      }
    };

    // Fire initial ping 4s after mount
    const initTimer = setTimeout(sendHeartbeat, 4000);

    // Ping every 8 minutes (480,000ms), safely before Render's 15-minute idle cutoff
    const interval = setInterval(sendHeartbeat, 8 * 60 * 1000);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, []);

  return null;
}
