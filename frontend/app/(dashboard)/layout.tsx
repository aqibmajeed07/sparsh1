'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import { AccessibilityProvider } from '@/components/AccessibilityContext';

const Sidebar = dynamic(() => import('@/components/layout/Sidebar'), { ssr: false });
const AccessibilityToolbar = dynamic(() => import('@/components/AccessibilityToolbar'), { ssr: false });
const AIVoiceAssistant = dynamic(() => import('@/components/AIVoiceAssistant'), { ssr: false });
const LiveClassNotification = dynamic(() => import('@/components/live/LiveClassNotification'), { ssr: false });

// Maximum time to wait for auth + profile before giving up and redirecting
const AUTH_TIMEOUT_MS = 5000;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const didRun = useRef(false); // prevent double-run in React Strict Mode

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    let cancelled = false;

    // Hard timeout — if auth+profile take longer than AUTH_TIMEOUT_MS,
    // treat the user as logged out and redirect to login.
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        cancelled = true;
        router.replace('/login');
      }
    }, AUTH_TIMEOUT_MS);

    const init = async () => {
      try {
        // ── 0. Check localStorage for saved session role ───────────────────────
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('sparsh_user');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed && parsed.role) {
                if (!cancelled) {
                  setProfile(parsed);
                  clearTimeout(timeoutId);
                  setLoading(false);
                }
                return;
              }
            } catch (e) { }
          }
        }

        // ── 1. Get session from local storage first (instant, no network) ──
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;

        if (!session?.user) {
          // No session found — fallback to Guest Student profile so app works instantly for testing
          if (!cancelled) {
            setProfile({
              id: 'guest',
              full_name: 'Student Learner',
              role: 'student',
              avatar_url: null,
            });
            clearTimeout(timeoutId);
            setLoading(false);
          }
          return;
        }

        // ── 2. Fetch profile (network call) ───────────────────────────────
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('id, full_name, role, avatar_url')  // select only what we need
          .eq('id', session.user.id)
          .single();

        if (cancelled) return;
        clearTimeout(timeoutId);

        if (error || !profileData) {
          // Profile fetch failed — build a minimal profile from session
          setProfile({
            id: session.user.id,
            full_name: session.user.user_metadata?.full_name || session.user.email || 'User',
            role: session.user.user_metadata?.role || 'student',
            avatar_url: null,
          });
        } else {
          setProfile(profileData);
        }
      } catch {
        // Any unexpected error → redirect to login
        if (!cancelled) { router.replace('/login'); }
        clearTimeout(timeoutId);
        return;
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []); // empty deps — run once on mount only

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0c29]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] mx-auto flex items-center justify-center mb-3 animate-pulse">
            <span className="text-white font-bold">S</span>
          </div>
          <p className="text-white/60 text-sm">Loading Sparsh...</p>
          <p className="text-white/30 text-xs mt-1">Signing you in</p>
        </div>
      </div>
    );
  }

  return (
    <AccessibilityProvider>
      <div className="flex min-h-screen" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
        <Sidebar role={profile?.role} userName={profile?.full_name || 'User'} />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-4 pt-16 lg:pt-6 lg:p-8">
            {children}
          </div>
        </main>
        <AIVoiceAssistant />
        <AccessibilityToolbar />
        <LiveClassNotification />
      </div>
    </AccessibilityProvider>
  );
}
