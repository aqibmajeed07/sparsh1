'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Layers,
  GraduationCap,
  Users,
  CheckCircle2,
} from 'lucide-react';
import Login3DScene from '@/components/auth/Login3DScene';
import TiltCard from '@/components/auth/TiltCard';

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
  const [activeRoleTab, setActiveRoleTab] = useState<'student' | 'teacher' | 'admin'>('student');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    }
  });

  // Helper to fill demo credentials for effortless evaluation/testing
  const handleQuickDemoFill = (role: 'student' | 'teacher' | 'admin') => {
    setActiveRoleTab(role);
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
    <main className="relative min-h-screen w-full overflow-hidden bg-[#0a071b] flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8 selection:bg-[#6C63FF]/30 selection:text-white">
      {/* ── Layer 1: Cinematic Concept Art Background ── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <Image
          src="/inclusive_ai_login_bg.jpg"
          alt="Sparsh Inclusive AI Background"
          fill
          priority
          className="object-cover object-center opacity-30 scale-105 filter blur-[1px] transition-transform duration-[20000ms] ease-out hover:scale-110"
        />
        {/* Dark Vignette & Radial Ambient Light Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a071b] via-[#0a071b]/80 to-transparent" />
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#0a071b]/60 to-[#0a071b]" />
        
        {/* Glowing Ambient Neon Color Orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#6C63FF]/25 rounded-full blur-[128px] pointer-events-none animate-pulse" />
        <div className="absolute top-1/2 -right-32 w-[30rem] h-[30rem] bg-[#00C9A7]/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#ec4899]/15 rounded-full blur-[128px] pointer-events-none" />
      </div>

      {/* ── Layer 2: Interactive Three.js 3D Particles & Holograms ── */}
      <Login3DScene />

      {/* ── Layer 3: Main Foreground Layout (Responsive Two-Column Hero) ── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* ── Left Showcase Column: Brand, 3D Asset & Features (Desktop) ── */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-center space-y-8 pr-4"
        >
          {/* Sparsh Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md w-fit shadow-lg shadow-black/20">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00C9A7] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00C9A7]" />
            </span>
            <span className="text-white/90 text-xs font-semibold tracking-wide uppercase">
              Sparsh Inclusive AI Platform
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6C63FF]/30 text-[#a5b4fc] border border-[#6C63FF]/40">
              v2.2 Live
            </span>
          </div>

          {/* Hero Headline */}
          <div className="space-y-3">
            <h1 className="text-4xl xl:text-5xl 2xl:text-6xl font-black text-white tracking-tight leading-[1.15]">
              Empowering Every{' '}
              <span className="bg-gradient-to-r from-[#6C63FF] via-[#00C9A7] to-[#38bdf8] bg-clip-text text-transparent">
                Voice, Vision & Touch.
              </span>
            </h1>
            <p className="text-white/70 text-base xl:text-lg max-w-xl font-normal leading-relaxed">
              Real-time Indian Sign Language (ISL) recognition, multimodal NCERT curriculum, and tactile assistive tools designed for inclusive learning.
            </p>
          </div>

          {/* 3D Showcase Artwork & Floating Metrics */}
          <div className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-white/[0.03] backdrop-blur-xl p-5 shadow-2xl overflow-hidden group">
            {/* Background Image Spotlight */}
            <div className="relative h-60 w-full rounded-2xl overflow-hidden shadow-inner border border-white/10">
              <Image
                src="/sign_ai_avatar.jpg"
                alt="3D Sign AI Cybernetic Gesture"
                fill
                className="object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a071b] via-[#0a071b]/30 to-transparent" />
              
              {/* Floating Badge on Image */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-xs text-white font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-[#00C9A7]" />
                  <span>51+ Indian Sign Language Classes</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6C63FF]/40 backdrop-blur-md border border-[#6C63FF]/50 text-xs text-white font-semibold">
                  <span>97.8% Accuracy</span>
                </div>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                <span className="block text-lg font-black text-[#00C9A7]">51+</span>
                <span className="text-[11px] text-white/60 font-medium">ISL Signs</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                <span className="block text-lg font-black text-[#6C63FF]">13 Classes</span>
                <span className="text-[11px] text-white/60 font-medium">NCERT Books</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                <span className="block text-lg font-black text-[#38bdf8]">0.05s</span>
                <span className="text-[11px] text-white/60 font-medium">AI Latency</span>
              </div>
            </div>
          </div>

          {/* Feature Badges List */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/80">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-[#00C9A7]" />
              <span>MobileNetV3 Edge Vision</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-[#6C63FF]" />
              <span>MediaPipe 3D Landmark Tracking</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-[#38bdf8]" />
              <span>Tactile Braille & Speech AI</span>
            </div>
          </div>
        </motion.div>

        {/* ── Right Column: 3D Interactive Tilt Sign-In Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 25, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
          className="w-full lg:col-span-6 xl:col-span-5 flex justify-center"
        >
          <TiltCard className="w-full max-w-md">
            <div className="w-full p-7 sm:p-9 rounded-[28px] border border-white/15 bg-[#120f2e]/85 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] transition-all duration-300">
              
              {/* Card Header & 3D Logo */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-3 group cursor-pointer">
                  <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-[#6C63FF] via-[#00C9A7] to-[#ec4899] opacity-75 blur-md group-hover:opacity-100 transition duration-500 animate-pulse" />
                  <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1a1443] to-[#0d0926] border border-white/20 flex items-center justify-center shadow-2xl">
                    <span className="text-3xl font-black bg-gradient-to-br from-white via-[#00C9A7] to-[#6C63FF] bg-clip-text text-transparent">
                      S
                    </span>
                  </div>
                </div>

                <h2 className="text-white text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
                  <span>Sparsh</span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/30">
                    Sign In
                  </span>
                </h2>
                <p className="text-white/60 text-xs sm:text-sm mt-1 text-center font-normal">
                  Access your inclusive learning sanctuary
                </p>
              </div>

              {/* Quick Role Selection Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/10 mb-6">
                <button
                  type="button"
                  onClick={() => handleQuickDemoFill('student')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    activeRoleTab === 'student'
                      ? 'bg-gradient-to-r from-[#6C63FF] to-[#818cf8] text-white shadow-md shadow-[#6C63FF]/30'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Student</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoFill('teacher')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    activeRoleTab === 'teacher'
                      ? 'bg-gradient-to-r from-[#00C9A7] to-[#14b8a6] text-white shadow-md shadow-[#00C9A7]/30'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Teacher</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoFill('admin')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    activeRoleTab === 'admin'
                      ? 'bg-gradient-to-r from-[#ec4899] to-[#f43f5e] text-white shadow-md shadow-[#ec4899]/30'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
              </div>

              {/* Error Alert Banner */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-start gap-2.5"
                >
                  <span className="text-base leading-none mt-0.5">⚠️</span>
                  <div className="flex-1 font-medium">{error}</div>
                </motion.div>
              )}

              {/* Sign In Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Email Field */}
                <div>
                  <label className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      {...register('email')}
                      type="email"
                      autoComplete="email"
                      placeholder="name@school.edu or student@sparsh.edu"
                      className="w-full pl-10 pr-4 py-3 text-sm text-white rounded-xl border border-white/15 bg-white/[0.06] placeholder-white/35 focus:border-[#00C9A7] focus:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-[#00C9A7]/20 transition-all duration-200"
                      aria-label="Email address"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                      <span>•</span> {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-white/80 text-xs font-semibold uppercase tracking-wider">
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-[11px] text-[#00C9A7] hover:underline font-medium"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      {...register('password')}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-3 text-sm text-white rounded-xl border border-white/15 bg-white/[0.06] placeholder-white/35 focus:border-[#6C63FF] focus:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/20 transition-all duration-200"
                      aria-label="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white/80 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                      <span>•</span> {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between text-xs text-white/70 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-3.5 h-3.5 rounded bg-white/10 border-white/20 text-[#6C63FF] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span>Keep me signed in</span>
                  </label>
                  <span className="text-white/40 text-[11px]">Protected by Supabase Auth</span>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#6C63FF] via-[#00C9A7] to-[#38bdf8] hover:from-[#5b52f9] hover:via-[#00b899] hover:to-[#22aef0] text-white font-bold text-sm sm:text-base shadow-xl shadow-[#6C63FF]/25 hover:shadow-[#00C9A7]/30 active:scale-[0.99] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2 group"
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
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              {/* Demo Helper Banner */}
              <div className="mt-5 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                <span className="text-[11px] text-white/50 block mb-1.5 font-medium">
                  Quick Demo Access (Click to auto-fill)
                </span>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDemoFill('student')}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-[#6C63FF]/20 hover:bg-[#6C63FF]/30 text-[#c7d2fe] border border-[#6C63FF]/30 transition"
                  >
                    🎓 Student
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoFill('teacher')}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-[#00C9A7]/20 hover:bg-[#00C9A7]/30 text-[#a7f3d0] border border-[#00C9A7]/30 transition"
                  >
                    👨‍🏫 Teacher
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoFill('admin')}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-[#ec4899]/20 hover:bg-[#ec4899]/30 text-[#fbcfe8] border border-[#ec4899]/30 transition"
                  >
                    ⚡ Admin
                  </button>
                </div>
              </div>

              {/* Footer Links */}
              <div className="mt-6 pt-5 border-t border-white/10 text-center">
                <p className="text-white/60 text-xs sm:text-sm">
                  Don&apos;t have an account yet?{' '}
                  <Link href="/register" className="text-[#00C9A7] font-semibold hover:underline">
                    Create an Account
                  </Link>
                </p>
              </div>

            </div>
          </TiltCard>
        </motion.div>

      </div>
    </main>
  );
}
