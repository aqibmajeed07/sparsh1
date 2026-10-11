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
  Sparkles,
  ArrowRight,
  Upload,
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
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto bg-slate-950 font-sans">
      {/* ── Background: Inclusive Classroom Photograph with Professional Overlay ── */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/inclusive_classroom.jpg"
          alt="Inclusive Education Classroom"
          fill
          priority
          className="object-cover object-center filter brightness-[0.70] contrast-[1.05]"
        />
        {/* Professional deep navy vignette & frosted backdrop */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/50 backdrop-blur-[2px]" />
      </div>

      {/* ── Foreground Container ── */}
      <div className="relative z-10 w-full max-w-2xl my-8">
        
        {/* Top Header Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-md mb-3 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-[#00C9A7]" />
            <span className="text-xs font-semibold text-slate-200 tracking-wide uppercase">
              Sparsh Inclusive Education Platform
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Create an Account
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            Join thousands of students and educators in accessible learning
          </p>
        </div>

        {/* Registration Card */}
        <div className="w-full bg-slate-900/90 border border-white/15 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-black/60">
          
          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
              <span className="text-sm mt-0.5">⚠️</span>
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Full Name */}
            <div className="md:col-span-2">
              <label className="text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                Full Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  {...register('full_name')}
                  placeholder="e.g. Arjun Sharma"
                  className="w-full pl-10 pr-4 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-950/50 placeholder-slate-500 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
                />
              </div>
              {errors.full_name && (
                <p className="text-rose-400 text-xs mt-1 font-medium">{errors.full_name.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
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
                  className="w-full pl-10 pr-4 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-950/50 placeholder-slate-500 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
                />
              </div>
              {errors.email && (
                <p className="text-rose-400 text-xs mt-1 font-medium">{errors.email.message}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                I am a *
              </label>
              <select
                {...register('role')}
                className="w-full px-3.5 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-950/50 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
              >
                <option value="student" className="bg-slate-900 text-white">Student</option>
                <option value="teacher" className="bg-slate-900 text-white">Teacher / Educator</option>
                <option value="institution_admin" className="bg-slate-900 text-white">School / Institution Admin</option>
                <option value="ngo_admin" className="bg-slate-900 text-white">NGO Admin</option>
              </select>
            </div>

            {/* Institution / School */}
            <div className="md:col-span-2">
              <label className="text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                Institution / School / NGO Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building className="w-4 h-4" />
                </div>
                <input
                  {...register('institution_name')}
                  placeholder="e.g. Nav Disha School for the Deaf, Delhi"
                  className="w-full pl-10 pr-4 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-950/50 placeholder-slate-500 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
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
                  <label className="text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                    Class / Grade *
                  </label>
                  <select
                    {...register('grade')}
                    className="w-full px-3.5 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-950/50 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">Select Grade</option>
                    {['1','2','3','4','5','6','7','8','9','10','11','12'].map(g => (
                      <option key={g} value={g} className="bg-slate-900 text-white">Grade {g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                    Education Board
                  </label>
                  <select
                    {...register('board')}
                    className="w-full px-3.5 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-950/50 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
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
              <label className="text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
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
                  className="w-full pl-10 pr-10 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-950/50 placeholder-slate-500 focus:border-[#6C63FF] focus:outline-none focus:ring-1 focus:ring-[#6C63FF] transition"
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
              <label className="text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
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
                  className="w-full pl-10 pr-10 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-950/50 placeholder-slate-500 focus:border-[#6C63FF] focus:outline-none focus:ring-1 focus:ring-[#6C63FF] transition"
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
              <label className="text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                Accessibility Needs
              </label>
              <select
                {...register('disability_type')}
                className="w-full px-3.5 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-950/50 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
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
              <label className="text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                Language Preference
              </label>
              <select
                {...register('language_preference')}
                className="w-full px-3.5 py-2.5 text-sm text-white rounded-xl border border-white/15 bg-slate-950/50 focus:border-[#00C9A7] focus:outline-none focus:ring-1 focus:ring-[#00C9A7] transition"
              >
                <option value="hi" className="bg-slate-900 text-white">Hindi (हिंदी)</option>
                <option value="en" className="bg-slate-900 text-white">English</option>
              </select>
            </div>

            {/* Caregiver Photo (Optional) */}
            <div className="md:col-span-2">
              <label className="text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1 block">
                Caregiver / Family Photo (Optional)
              </label>
              <p className="text-slate-400 text-xs mb-2">
                Upload a photo to personalize the AI companion with a familiar, calming face.
              </p>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer transition">
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
            <div className="md:col-span-2 mt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] hover:from-[#5b52f9] hover:to-[#00b899] text-white font-semibold text-sm shadow-md shadow-[#6C63FF]/20 active:scale-[0.99] transition duration-150 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
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

        {/* Bottom Footer */}
        <div className="text-center mt-6 text-slate-400 text-xs">
          <span>&copy; {new Date().getFullYear()} Sparsh Inclusive Learning. All rights reserved.</span>
        </div>

      </div>
    </div>
  );
}
