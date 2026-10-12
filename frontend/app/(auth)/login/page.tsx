'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import Image from 'next/image';
import SparshLogo from '@/components/ui/SparshLogo';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  Users,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Award,
  BookOpen,
} from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeRole, setActiveRole] = useState<'student' | 'teacher' | 'admin'>('student');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    }
  });

  const handleRoleSelect = (role: 'student' | 'teacher' | 'admin') => {
    setActiveRole(role);
    setError('');
  };

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

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col lg:grid lg:grid-cols-12 font-sans selection:bg-[#6C63FF]/30 selection:text-white">
      
      {/* ── LEFT SIDE: Government-Style Classroom Visual & Mission (Visible on lg, banner on mobile) ── */}
      <div className="relative w-full lg:col-span-6 xl:col-span-7 h-44 sm:h-64 lg:h-auto lg:min-h-screen flex flex-col justify-between p-4 sm:p-8 lg:p-12 overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10">
        {/* Full Image */}
        <Image
          src="/inclusive_classroom.jpg"
          alt="Inclusive Education Classroom in India"
          fill
          priority
          className="object-cover object-center filter brightness-[0.85] contrast-[1.05]"
        />

        {/* Sophisticated gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/80 pointer-events-none" />

        {/* Top Header / Emblem */}
        <div className="relative z-10 flex items-center justify-between">
          <SparshLogo
            size="lg"
            href="/"
            subtitle={
              <p className="text-slate-300 text-[11px] font-medium tracking-wide">
                National Inclusive Education Initiative
              </p>
            }
          />

          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-[11px] text-slate-300 font-medium backdrop-blur-md">
            <Award className="w-3.5 h-3.5 text-[#00C9A7]" />
            <span>NEP 2020 & RPwD Act Aligned</span>
          </div>
        </div>

        {/* Bottom Educational Mission Panel (visible on desktop) */}
        <div className="relative z-10 hidden lg:block space-y-4 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-white/15 text-xs text-slate-200 font-semibold backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#00C9A7] animate-pulse" />
            <span>Inclusive Learning Sanctuary</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight">
            Empowering every student with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
              barrier-free education.
            </span>
          </h2>

          <p className="text-slate-200 text-sm xl:text-base leading-relaxed font-normal">
            Accessible Indian Sign Language (ISL) recognition, multimodal NCERT curriculum, and tactile audio tools built for schools, NGOs, and special educators across India.
          </p>

          {/* Pillars Checklist */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 text-xs text-slate-200 font-medium">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/70 border border-white/10 backdrop-blur-sm">
              <CheckCircle2 className="w-4 h-4 text-[#00C9A7] shrink-0" />
              <span>51+ Indian Sign Language Classes</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/70 border border-white/10 backdrop-blur-sm">
              <CheckCircle2 className="w-4 h-4 text-[#6C63FF] shrink-0" />
              <span>Grades 1–12 NCERT Accessible Books</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/70 border border-white/10 backdrop-blur-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Real-Time Edge Vision AI</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/70 border border-white/10 backdrop-blur-sm">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Deaf-Blind Tactile & Speech Assist</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── RIGHT SIDE: Professional Authentication Portal ── */}
      <div className="w-full lg:col-span-6 xl:col-span-5 flex flex-col justify-between p-4 sm:p-8 lg:p-12 xl:p-14 bg-slate-950 overflow-y-auto">
        
        <div className="max-w-md w-full mx-auto my-auto py-4">
          
          {/* Form Header */}
          <div className="mb-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C9A7] block mb-1">
              Authorized Portal Access
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Sign In to Your Account
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Select your role and enter your institutional credentials
            </p>
          </div>

          {/* Role Selection Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-900 border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => handleRoleSelect('student')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition ${
                activeRole === 'student'
                  ? 'bg-[#6C63FF] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Student</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleSelect('teacher')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition ${
                activeRole === 'teacher'
                  ? 'bg-[#00C9A7] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Teacher</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleSelect('admin')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition ${
                activeRole === 'admin'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
              <span className="text-sm mt-0.5">⚠️</span>
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Email Address */}
            <div>
              <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="name@institution.edu"
                  className="w-full pl-10 pr-4 py-3 text-sm text-white rounded-xl border border-white/15 bg-slate-900/90 placeholder-slate-500 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
                  aria-label="Email address"
                />
              </div>
              {errors.email && (
                <p className="text-rose-400 text-xs mt-1.5 font-medium">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[#00C9A7] hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 text-sm text-white rounded-xl border border-white/15 bg-slate-900/90 placeholder-slate-500 focus:border-[#6C63FF] focus:outline-none focus:ring-1 focus:ring-[#6C63FF] transition"
                  aria-label="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-rose-400 text-xs mt-1.5 font-medium">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-3.5 h-3.5 rounded bg-slate-900 border-white/20 text-[#6C63FF] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span>Remember this workstation</span>
              </label>
              <span className="text-slate-500 text-[11px]">TLS 1.3 Secure</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] hover:from-[#5b52f9] hover:to-[#00b899] text-white font-bold text-sm sm:text-base shadow-lg shadow-[#6C63FF]/20 active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* OAuth Divider */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative bg-slate-950 px-3 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Or continue with
              </div>
            </div>

            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-semibold text-xs sm:text-sm transition active:scale-[0.99] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-slate-300 text-xs sm:text-sm">
              Don&apos;t have an institutional account?{' '}
              <Link href="/register" className="text-[#00C9A7] font-semibold hover:underline">
                Create an Account
              </Link>
            </p>
          </div>

        </div>

        {/* Institutional Footer */}
        <div className="text-center text-slate-500 text-xs pt-4 border-t border-white/5">
          <span>&copy; {new Date().getFullYear()} Sparsh Inclusive Learning Initiative • Government of India Standards Compliant</span>
        </div>

      </div>

    </div>
  );
}
