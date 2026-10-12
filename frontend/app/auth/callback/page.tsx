'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Verifying your Google authentication...');

  useEffect(() => {
    let isMounted = true;

    async function handleAuth() {
      try {
        // Exchange code/session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session?.user) {
          // Listen for auth state change in case hash exchange is still resolving
          const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (event === 'SIGNED_IN' && newSession?.user) {
              await processUser(newSession.user);
            }
          });

          // Timeout fallback
          setTimeout(() => {
            if (isMounted && !errorMsg) {
              supabase.auth.getUser().then(({ data: { user } }) => {
                if (user) {
                  processUser(user);
                } else {
                  setErrorMsg('Unable to retrieve authentication session. Please try signing in again.');
                }
              });
            }
          }, 3500);

          return () => {
            authListener.subscription.unsubscribe();
          };
        } else {
          await processUser(session.user);
        }
      } catch (err: any) {
        console.error('Google Auth Callback Error:', err);
        if (isMounted) {
          setErrorMsg(err.message || 'Authentication failed. Please try again.');
        }
      }
    }

    async function processUser(user: any) {
      if (!isMounted) return;
      setStatusText('Setting up your SPARSH profile...');

      try {
        // Check if profile exists
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, role, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        let realRole = profile?.role || user.user_metadata?.role || 'student';
        let realName =
          profile?.full_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'User';
        let avatarUrl =
          profile?.avatar_url ||
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null;

        // If new Google user without a profile, upsert default student profile
        if (!profile) {
          try {
            await supabase.from('profiles').upsert({
              id: user.id,
              full_name: realName,
              role: realRole,
              avatar_url: avatarUrl,
              email: user.email,
              disability_type: 'none',
              language_preference: 'hi',
            });
          } catch (e) {
            console.warn('Profile auto-create notice:', e);
          }
        }

        const userProfile = {
          id: user.id,
          email: user.email,
          full_name: realName,
          role: realRole,
          avatar_url: avatarUrl,
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem('sparsh_user', JSON.stringify(userProfile));
        }

        // Role-based redirect
        if (realRole === 'teacher') {
          router.replace('/teacher');
        } else if (['institution_admin', 'ngo_admin', 'admin'].includes(realRole)) {
          router.replace('/admin');
        } else if (realRole === 'super_admin') {
          router.replace('/super-admin');
        } else {
          router.replace('/student');
        }
      } catch (err: any) {
        console.error('Error processing profile:', err);
        // Fallback to student dashboard
        router.replace('/student');
      }
    }

    handleAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="max-w-md w-full glass-card p-8 rounded-2xl border border-white/10 bg-slate-900/80 text-center space-y-4">
        {errorMsg ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Authentication Failed</h2>
            <p className="text-sm text-slate-300">{errorMsg}</p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-bold text-sm hover:opacity-90 transition"
              >
                <span>Return to Login</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-[#6C63FF]/20 text-[#6C63FF] flex items-center justify-center mx-auto animate-pulse">
              <Sparkles className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white">Authenticating with Google</h2>
            <p className="text-sm text-slate-400">{statusText}</p>
          </>
        )}
      </div>
    </div>
  );
}
