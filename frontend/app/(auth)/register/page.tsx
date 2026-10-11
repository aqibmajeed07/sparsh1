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
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building,
  GraduationCap,
  ArrowRight,
  Upload,
  Award,
  CheckCircle2,
} from 'lucide-react';

const registerSchema = z.object({
  full_name:           z.string().min(2, 'Enter your full name'),
  email:               z.string().email('Enter a valid email address'),
  password:            z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password:    z.string(),
  role:                z.enum(['student', 'teacher', 'institution_admin', 'ngo_admin']),
  disability_type:     z.enum(['visual', 'hearing', 'both', 'deafblind', 'none']),
  language_preference: z.string().default('hi'),
  institution_name:    z.string().min(2, 'Enter your institution or school name'),
  grade:               z.string().optional(),
  board:               z.string().optional(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type FormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [avatarFaceBase64, setAvatarFaceBase64] = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      language_preference: 'hi',
      disability_type: 'none',
      role: 'student',
      board: 'CBSE',
    }
  });

  const role = watch('role');

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');

    try {
      const { data: auth, error: authError } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: {
          data: { full_name: data.full_name, role: data.role }
        }
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (auth?.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            role: data.role,
            full_name: data.full_name,
            disability_type: data.disability_type,
            language_preference: data.language_preference,
            grade: data.role === 'student' ? data.grade : null,
            board: data.board,
            institution_name: data.institution_name,
          })
          .eq('id', auth.user.id);

        if (profileError) {
          console.error('Profile update error:', profileError);
        }

        if (avatarFaceBase64 && typeof window !== 'undefined') {
          localStorage.setItem('avatar_face_url', avatarFaceBase64);
        }

        router.push('/login?registered=1');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err?.message || 'An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarFaceBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col lg:grid lg:grid-cols-12 font-sans selection:bg-[#6C63FF]/30 selection:text-white">
      
      {/* ── LEFT SIDE: Government-Style Classroom Visual & Institutional Badges ── */}
      <div className="relative w-full lg:col-span-5 xl:col-span-5 h-56 sm:h-72 lg:h-auto lg:min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10">
        {/* Full Image */}
        <Image
          src="/inclusive_classroom.jpg"
          alt="Inclusive Education Classroom in India"
          fill
          priority
          className="object-cover object-center filter brightness-[0.85] contrast-[1.05]"
        />

        {/* Sophisticated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/80 pointer-events-none" />

        {/* Top Header / Emblem */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] flex items-center justify-center text-white font-extrabold text-xl shadow-lg">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-lg tracking-tight">SPARSH</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  स्पर्श
                </span>
              </div>
              <p className="text-slate-300 text-[11px] font-medium tracking-wide">
                National Inclusive Education Initiative
              </p>
            </div>
          </div>

          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 text-[11px] text-slate-300 font-medium backdrop-blur-md">
            <Award className="w-3.5 h-3.5 text-[#00C9A7]" />
            <span>Govt. RPwD Aligned</span>
          </div>
        </div>

        {/* Bottom Educational Mission Panel (visible on desktop) */}
        <div className="relative z-10 hidden lg:block space-y-4 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-white/15 text-xs text-slate-200 font-semibold backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#00C9A7] animate-pulse" />
            <span>Inclusive Registration</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight">
            Join the inclusive{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
              learning movement.
            </span>
          </h2>

          <p className="text-slate-200 text-sm leading-relaxed font-normal">
            Whether you are a student, teacher, or educational institution, Sparsh bridges communication and accessibility gaps with intelligent AI tools.
          </p>

          <div className="space-y-2 pt-2 text-xs text-slate-200 font-medium">
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/70 border border-white/10 backdrop-blur-sm">
              <CheckCircle2 className="w-4 h-4 text-[#00C9A7] shrink-0" />
              <span>Multi-sensory learning tailored for your needs</span>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/70 border border-white/10 backdrop-blur-sm">
              <CheckCircle2 className="w-4 h-4 text-[#6C63FF] shrink-0" />
              <span>Free accessibility tools for certified schools & NGOs</span>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/70 border border-white/10 backdrop-blur-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Zero hardware requirement — runs in any modern browser</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── RIGHT SIDE: Registration Portal Form ── */}
      <div className="w-full lg:col-span-7 xl:col-span-7 flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-14 bg-slate-950 overflow-y-auto min-h-screen">
        
        <div className="max-w-xl w-full mx-auto my-auto py-4">
          
          {/* Header */}
          <div className="mb-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C9A7] block mb-1">
              New Member Registration
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Create an Inclusive Account
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Complete your profile to customize your accessibility learning experience
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
              <span className="text-sm mt-0.5">⚠️</span>
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Full Name */}
            <div className="md:col-span-2">
              <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                Full Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  {...register('full_name')}
                  placeholder="e.g. Arjun Sharma"
                  className="w-full pl-10 pr-4 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-900/90 placeholder-slate-500 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
                />
              </div>
              {errors.full_name && (
                <p className="text-rose-400 text-xs mt-1 font-medium">{errors.full_name.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                Email Address *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="you@school.edu"
                  className="w-full pl-10 pr-4 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-900/90 placeholder-slate-500 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
                />
              </div>
              {errors.email && (
                <p className="text-rose-400 text-xs mt-1 font-medium">{errors.email.message}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                I am a *
              </label>
              <select
                {...register('role')}
                className="w-full px-3.5 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-900/90 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
              >
                <option value="student" className="bg-slate-900 text-white">Student</option>
                <option value="teacher" className="bg-slate-900 text-white">Teacher / Educator</option>
                <option value="institution_admin" className="bg-slate-900 text-white">School / Institution Admin</option>
                <option value="ngo_admin" className="bg-slate-900 text-white">NGO Admin</option>
              </select>
            </div>

            {/* Institution / School */}
            <div className="md:col-span-2">
              <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                Institution / School / NGO Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building className="w-4 h-4" />
                </div>
                <input
                  {...register('institution_name')}
                  placeholder="e.g. Nav Disha School for the Deaf, Delhi"
                  className="w-full pl-10 pr-4 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-900/90 placeholder-slate-500 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
                />
              </div>
              {errors.institution_name && (
                <p className="text-rose-400 text-xs mt-1 font-medium">{errors.institution_name.message}</p>
              )}
            </div>

            {/* Grade & Board (conditional for student) */}
            {role === 'student' && (
              <>
                <div>
                  <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                    Class / Grade *
                  </label>
                  <select
                    {...register('grade')}
                    className="w-full px-3.5 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-900/90 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">Select Grade</option>
                    {['1','2','3','4','5','6','7','8','9','10','11','12'].map(g => (
                      <option key={g} value={g} className="bg-slate-900 text-white">Grade {g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                    Education Board
                  </label>
                  <select
                    {...register('board')}
                    className="w-full px-3.5 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-900/90 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
                  >
                    {['CBSE','ICSE','State Board','IB','NIOS'].map(b => (
                      <option key={b} value={b} className="bg-slate-900 text-white">{b}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Password */}
            <div>
              <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  className="w-full pl-10 pr-10 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-900/90 placeholder-slate-500 focus:border-[#6C63FF] focus:outline-none focus:ring-1 focus:ring-[#6C63FF] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-rose-400 text-xs mt-1 font-medium">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                Confirm Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  {...register('confirm_password')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  className="w-full pl-10 pr-10 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-900/90 placeholder-slate-500 focus:border-[#6C63FF] focus:outline-none focus:ring-1 focus:ring-[#6C63FF] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="text-rose-400 text-xs mt-1 font-medium">{errors.confirm_password.message}</p>
              )}
            </div>

            {/* Accessibility Needs */}
            <div>
              <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                Accessibility Needs
              </label>
              <select
                {...register('disability_type')}
                className="w-full px-3.5 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-900/90 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
              >
                <option value="none" className="bg-slate-900 text-white">None (Standard)</option>
                <option value="hearing" className="bg-slate-900 text-white">Hearing Impaired (Sign Language)</option>
                <option value="visual" className="bg-slate-900 text-white">Visually Impaired (Audio / Braille)</option>
                <option value="both" className="bg-slate-900 text-white">Multi-Sensory Needs</option>
                <option value="deafblind" className="bg-slate-900 text-white">Deaf-Blind (Tactile Assist)</option>
              </select>
            </div>

            {/* Language Preference */}
            <div>
              <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                Language Preference
              </label>
              <select
                {...register('language_preference')}
                className="w-full px-3.5 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-900/90 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
              >
                <option value="hi" className="bg-slate-900 text-white">Hindi (हिंदी)</option>
                <option value="en" className="bg-slate-900 text-white">English</option>
              </select>
            </div>

            {/* Caregiver Photo (Optional) */}
            <div className="md:col-span-2">
              <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1 block">
                Caregiver / Family Photo (Optional)
              </label>
              <p className="text-slate-400 text-xs mb-2">
                Upload a photo to personalize the AI companion with a familiar face.
              </p>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFaceUpload}
                    className="hidden"
                  />
                </label>
                {avatarFaceBase64 && (
                  <div className="flex items-center gap-2">
                    <img
                      src={avatarFaceBase64}
                      alt="Uploaded Preview"
                      className="w-8 h-8 rounded-full object-cover border border-[#00C9A7]"
                    />
                    <span className="text-[#00C9A7] text-xs font-medium">Photo attached</span>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="md:col-span-2 mt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] hover:from-[#5b52f9] hover:to-[#00b899] text-white font-bold text-sm shadow-md shadow-[#6C63FF]/20 active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Inclusive Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </form>

          {/* Footer Link */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <p className="text-slate-300 text-xs sm:text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-[#00C9A7] font-semibold hover:underline">
                Sign in
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
