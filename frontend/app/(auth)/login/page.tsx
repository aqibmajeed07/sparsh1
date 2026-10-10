'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    }
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError('');

    try {
      const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password,
      });

      if (authError || !auth?.user) {
        setError(authError?.message || 'Invalid email or password. Please try again.');
        setLoading(false);
        return;
      }

      const user = auth.user;

      // ── Query the user's real profile from Supabase Database ──
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      // Retrieve actual role from database profile, falling back to auth metadata
      const realRole = profile?.role || user.user_metadata?.role || 'student';
      const realName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

      const userProfile = {
        id: user.id,
        email: user.email,
        full_name: realName,
        role: realRole,
        avatar_url: profile?.avatar_url || null,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('sparsh_user', JSON.stringify(userProfile));
      }

      // ── Route dynamically to the user's authentic dashboard ──
      if (realRole === 'teacher') {
        router.push('/teacher');
      } else if (realRole === 'institution_admin' || realRole === 'ngo_admin' || realRole === 'admin') {
        router.push('/admin');
      } else if (realRole === 'super_admin') {
        router.push('/super-admin');
      } else {
        router.push('/student');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.message || 'An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8 sm:p-10 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] flex items-center justify-center mb-4 shadow-xl shadow-[#6C63FF]/30">
            <span className="text-white font-black text-3xl">S</span>
          </div>
          <h1 className="text-white text-3xl font-extrabold tracking-tight">Sparsh</h1>
          <p className="text-white/60 text-sm mt-1 text-center">
            Sign in to your inclusive education account
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm flex items-start gap-3">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Production Sign In Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="text-white/80 text-sm mb-1.5 block font-medium">Email Address</label>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="name@school.edu or name@example.com"
              className="glass-input w-full p-3.5 text-sm text-white rounded-xl focus:border-[#6C63FF] focus:outline-none transition border border-white/10 bg-white/5"
              aria-label="Email address"
            />
            {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-white/80 text-sm font-medium">Password</label>
            </div>
            <input
              {...register('password')}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="glass-input w-full p-3.5 text-sm text-white rounded-xl focus:border-[#6C63FF] focus:outline-none transition border border-white/10 bg-white/5"
              aria-label="Password"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-bold text-base hover:opacity-95 active:scale-[0.99] transition shadow-lg shadow-[#6C63FF]/30 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Verifying credentials...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Footer Links */}
        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-white/60 text-sm">
            Don&apos;t have an account yet?{' '}
            <Link href="/register" className="text-[#00C9A7] font-semibold hover:underline">
              Create an Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
