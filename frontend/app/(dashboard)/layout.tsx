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
        // ── 1. Check Supabase session first ───────────────────────────────
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;

        if (!session?.user) {
          // No active session — clear any stale cache and redirect to login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('sparsh_user');
          }
          if (!cancelled) {
            clearTimeout(timeoutId);
            router.replace('/login');
          }
          return;
        }

        // ── 2. Fetch authenticated profile from database ──────────────────
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, role, avatar_url')
          .eq('id', session.user.id)
          .maybeSingle();

        if (cancelled) return;
        clearTimeout(timeoutId);

        const authenticRole = profileData?.role || session.user.user_metadata?.role || 'student';
        const authenticName = profileData?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User';

        const finalProfile = {
          id: session.user.id,
          full_name: authenticName,
          role: authenticRole,
          avatar_url: profileData?.avatar_url || null,
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem('sparsh_user', JSON.stringify(finalProfile));
        }

        setProfile(finalProfile);
      } catch (err) {
        console.error('Session initialization error:', err);
        if (!cancelled) {
          clearTimeout(timeoutId);
          router.replace('/login');
        }
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <AccessibilityProvider>
      <div className="flex min-h-screen" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
        <Sidebar 
          role={profile?.role} 
          userName={profile?.full_name || 'User'} 
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
        />
        <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
          {/* Universal Sticky Top Header with User Info and Logout Button in all tabs */}
          <header className="sticky top-0 z-30 flex items-center justify-between px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 backdrop-blur-xl border-b border-white/10 bg-[#0f0c29]/90 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Mobile Hamburger Button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 flex items-center justify-center text-white transition shrink-0"
                aria-label="Open Navigation Menu"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect y="2" width="18" height="2" rx="1" fill="currentColor" />
                  <rect y="8" width="18" height="2" rx="1" fill="currentColor" />
                  <rect y="14" width="18" height="2" rx="1" fill="currentColor" />
                </svg>
              </button>

              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] flex items-center justify-center text-white font-black text-sm lg:hidden shrink-0 shadow-sm">
                  S
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] sm:text-xs uppercase tracking-wider text-[#00C9A7] font-bold bg-[#00C9A7]/10 px-2 py-0.5 rounded-full border border-[#00C9A7]/20 truncate">
                      {profile?.role?.replace('_', ' ') || 'Student'}
                    </span>
                  </div>
                  <p className="text-white/80 text-xs sm:text-sm font-semibold truncate max-w-[130px] sm:max-w-xs mt-0.5">
                    {profile?.full_name || 'Learner'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 hover:text-rose-100 hover:border-rose-500/50 transition-all shadow-sm active:scale-95 cursor-pointer"
                title="Log out of Sparsh"
              >
                <span className="text-sm sm:text-base leading-none">🚪</span>
                <span>Log Out</span>
              </button>
            </div>
          </header>

          <div className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-32 sm:pb-12 min-w-0">
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
