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

  const handleSignOut = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sparsh_user');
        sessionStorage.clear();
      }
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Sign out error', e);
    }
    router.replace('/login');
  };

  return (
    <AccessibilityProvider>
      <div className="flex min-h-screen" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
        <Sidebar role={profile?.role} userName={profile?.full_name || 'User'} />
        <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
          {/* Universal Sticky Top Header with User Info and Logout Button in all tabs */}
          <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-3.5 backdrop-blur-xl border-b border-white/10 bg-[#0f0c29]/85 shrink-0">
            <div className="flex items-center gap-3">
              {/* Spacer on mobile to accommodate the hamburger button */}
              <div className="w-10 lg:hidden" />
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block text-xs uppercase tracking-wider text-[#00C9A7] font-semibold bg-[#00C9A7]/10 px-2.5 py-0.5 rounded-full border border-[#00C9A7]/20">
                  {profile?.role?.replace('_', ' ') || 'Student'}
                </span>
                <span className="text-white/30 hidden sm:inline">•</span>
                <span className="text-white/80 text-sm font-medium truncate max-w-[160px] sm:max-w-xs">
                  {profile?.full_name || 'Learner'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 hover:text-rose-100 hover:border-rose-500/50 transition-all shadow-sm active:scale-95 cursor-pointer"
                title="Log out of Sparsh"
              >
                <span className="text-base leading-none">🚪</span>
                <span>Log Out</span>
              </button>
            </div>
          </header>

          <div className="flex-1 p-4 lg:p-8">
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
