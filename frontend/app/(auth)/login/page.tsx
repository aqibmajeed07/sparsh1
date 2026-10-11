'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import Image from 'next/image';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  Users,
  ShieldCheck,
  ArrowRight,
  Sparkles,
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

  // Quick fill demo credentials for testing & presentation
  const handleRoleSelect = (role: 'student' | 'teacher' | 'admin') => {
    setActiveRole(role);
    setError('');
    if (role === 'student') {
      setValue('email', 'student@sparsh.edu');
      setValue('password', 'student123');
    } else if (role === 'teacher') {
      setValue('email', 'teacher@sparsh.edu');
      setValue('password', 'teacher123');
    } else {
      setValue('email', 'admin@sparsh.edu');
      setValue('password', 'admin123');
    }
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

      // Query the user's authentic profile from database
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

      // Dynamic dashboard routing
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
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden bg-slate-950 font-sans">
      {/* ── Background: Inclusive Classroom Photograph with Professional Overlay ── */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/inclusive_classroom.jpg"
          alt="Inclusive Education Classroom"
          fill
          priority
          className="object-cover object-center filter brightness-[0.72] contrast-[1.05]"
        />
        {/* Professional deep navy vignette & frosted backdrop */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/50 backdrop-blur-[2px]" />
      </div>

      {/* ── Foreground Professional Card Container ── */}
      <div className="relative z-10 w-full max-w-md">
        
        {/* Top Header Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-md mb-3 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-[#00C9A7]" />
            <span className="text-xs font-semibold text-slate-200 tracking-wide uppercase">
              Sparsh Inclusive Education Platform
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Sign In to Sparsh
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-sm mx-auto">
            Empowering students with disabilities through AI-assisted inclusive learning
          </p>
        </div>

        {/* Professional Sign-In Card */}
        <div className="w-full bg-slate-900/90 border border-white/15 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-black/60">
          
          {/* Role Selection Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => handleRoleSelect('student')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
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
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
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
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
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
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
              <span className="text-sm mt-0.5">⚠️</span>
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Email Address */}
            <div>
              <label className="text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
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
                  placeholder="name@school.edu"
                  className="w-full pl-10 pr-4 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-950/50 placeholder-slate-500 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
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
                <label className="text-slate-200 text-xs font-semibold uppercase tracking-wider">
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
                  className="w-full pl-10 pr-11 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-950/50 placeholder-slate-500 focus:border-[#6C63FF] focus:outline-none focus:ring-1 focus:ring-[#6C63FF] transition"
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
                  className="w-3.5 h-3.5 rounded bg-slate-950 border-white/20 text-[#6C63FF] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span>Remember this device</span>
              </label>
              <span className="text-slate-500 text-[11px]">256-bit SSL Encrypted</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] hover:from-[#5b52f9] hover:to-[#00b899] text-white font-semibold text-sm shadow-md shadow-[#6C63FF]/20 active:scale-[0.99] transition duration-150 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Pre-fill Bar */}
          <div className="mt-5 pt-4 border-t border-white/10 text-center">
            <span className="text-[11px] text-slate-400 block mb-2 font-medium">
              Quick Demo Logins (Click to autofill)
            </span>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleRoleSelect('student')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700 transition"
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => handleRoleSelect('teacher')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700 transition"
              >
                Teacher
              </button>
              <button
                type="button"
                onClick={() => handleRoleSelect('admin')}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-white/10 hover:bg-slate-700 transition"
              >
                Admin
              </button>
            </div>
          </div>

          {/* Footer Link */}
          <div className="mt-5 pt-4 border-t border-white/10 text-center">
            <p className="text-slate-300 text-xs sm:text-sm">
              Don&apos;t have an account yet?{' '}
              <Link href="/register" className="text-[#00C9A7] font-semibold hover:underline">
                Create an Account
              </Link>
            </p>
          </div>

        </div>

        {/* Bottom Institutional Footer */}
        <div className="text-center mt-6 text-slate-400 text-xs">
          <span>&copy; {new Date().getFullYear()} Sparsh Inclusive Learning. All rights reserved.</span>
        </div>

      </div>
    </div>
  );
}
