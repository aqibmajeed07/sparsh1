'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const registerSchema = z.object({
  full_name:           z.string().min(2, 'Enter your full name'),
  email:               z.string().email('Enter a valid email'),
  password:            z.string().min(8, 'Minimum 8 characters'),
  confirm_password:    z.string(),
  role:                z.enum(['student', 'teacher', 'institution_admin', 'ngo_admin']),
  disability_type:     z.enum(['visual', 'hearing', 'both', 'deafblind', 'none']),
  language_preference: z.string().default('hi'),
  institution_name:    z.string().min(2, 'Enter your institution / NGO name'),
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
  const [avatarFaceBase64, setAvatarFaceBase64] = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { language_preference: 'hi', disability_type: 'none', role: 'student', board: 'CBSE' }
  });

  const role = watch('role');

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');

    const { data: auth, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.full_name, role: data.role }
      }
    });

    if (authError) { setError(authError.message); setLoading(false); return; }

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

      if (profileError) console.error('Profile update error:', profileError);
      
      if (avatarFaceBase64) {
        localStorage.setItem('avatar_face_url', avatarFaceBase64);
      }
      
      router.push('/login?registered=1');
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
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-2xl p-8">
        <div className="flex flex-col items-center mb-7">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] flex items-center justify-center text-white font-bold text-xl mb-3">S</div>
          <h1 className="text-white text-2xl font-bold">Create an Account</h1>
          <p className="text-white/60 text-sm mt-1">Join the Sparsh accessible learning platform</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Full Name */}
          <div className="md:col-span-2">
            <label className="text-white/80 text-sm mb-1 block">Full Name</label>
            <input {...register('full_name')} className="glass-input w-full" placeholder="Arjun Sharma" />
            {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name.message}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="text-white/80 text-sm mb-1 block">Email</label>
            <input {...register('email')} type="email" className="glass-input w-full" placeholder="you@example.com" />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="text-white/80 text-sm mb-1 block">I am a</label>
            <select {...register('role')} className="glass-input w-full bg-transparent appearance-none">
              <option value="student" className="bg-[#24243e]">Student</option>
              <option value="teacher" className="bg-[#24243e]">Teacher / Educator</option>
              <option value="institution_admin" className="bg-[#24243e]">School / Institution Admin</option>
              <option value="ngo_admin" className="bg-[#24243e]">NGO Admin</option>
            </select>
          </div>

          {/* Institution */}
          <div className="md:col-span-2">
            <label className="text-white/80 text-sm mb-1 block">Institution / School / NGO Name *</label>
            <input {...register('institution_name')} className="glass-input w-full" placeholder="e.g. Nav Disha School for the Deaf, Delhi" />
            {errors.institution_name && <p className="text-red-400 text-xs mt-1">{errors.institution_name.message}</p>}
          </div>

          {/* Grade — only for students */}
          {role === 'student' && (
            <>
              <div>
                <label className="text-white/80 text-sm mb-1 block">Class / Grade *</label>
                <select {...register('grade')} className="glass-input w-full bg-transparent appearance-none">
                  <option value="" className="bg-[#24243e]">Select Grade</option>
                  {['1','2','3','4','5','6','7','8','9','10','11','12'].map(g => (
                    <option key={g} value={g} className="bg-[#24243e]">Grade {g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-white/80 text-sm mb-1 block">Board</label>
                <select {...register('board')} className="glass-input w-full bg-transparent appearance-none">
                  {['CBSE','ICSE','State Board','IB','NIOS'].map(b => (
                    <option key={b} value={b} className="bg-[#24243e]">{b}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Password */}
          <div>
            <label className="text-white/80 text-sm mb-1 block">Password</label>
            <input {...register('password')} type="password" className="glass-input w-full" placeholder="••••••••" />
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="text-white/80 text-sm mb-1 block">Confirm Password</label>
            <input {...register('confirm_password')} type="password" className="glass-input w-full" placeholder="••••••••" />
            {errors.confirm_password && <p className="text-red-400 text-xs mt-1">{errors.confirm_password.message}</p>}
          </div>

          {/* Accessibility */}
          <div>
            <label className="text-white/80 text-sm mb-1 block">Accessibility Needs</label>
            <select {...register('disability_type')} className="glass-input w-full bg-transparent appearance-none">
              <option value="none" className="bg-[#24243e]">None</option>
              <option value="hearing" className="bg-[#24243e]">Hearing Impaired (ISL)</option>
              <option value="visual" className="bg-[#24243e]">Visually Impaired (TTS)</option>
              <option value="both" className="bg-[#24243e]">Multi-Sensory</option>
              <option value="deafblind" className="bg-[#24243e]">DeafBlind</option>
            </select>
          </div>

          <div>
            <label className="text-white/80 text-sm mb-1 block">Language Preference</label>
            <select {...register('language_preference')} className="glass-input w-full bg-transparent appearance-none">
              <option value="hi" className="bg-[#24243e]">Hindi</option>
              <option value="en" className="bg-[#24243e]">English</option>
            </select>
          </div>

          {/* Avatar Face Photo */}
          <div className="md:col-span-2">
            <label className="text-white/80 text-sm mb-1 block">Caregiver / Family Photo (Optional)</label>
            <p className="text-white/40 text-xs mb-2">Upload a photo to give the AI avatar a familiar face.</p>
            <input type="file" accept="image/*" onChange={handleFaceUpload} className="glass-input w-full p-2 text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#6C63FF]/20 file:text-[#6C63FF] hover:file:bg-[#6C63FF]/30 transition" />
            {avatarFaceBase64 && (
              <div className="mt-3 flex items-center gap-3">
                <img src={avatarFaceBase64} alt="Avatar Face Preview" className="w-12 h-12 rounded-full object-cover border-2 border-[#00C9A7]" />
                <span className="text-[#00C9A7] text-xs font-semibold">Face captured!</span>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="md:col-span-2 mt-2">
            {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3 mb-4">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-semibold hover:opacity-90 transition disabled:opacity-50 text-base">
              {loading ? 'Creating Account...' : 'Create Account →'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <a href="/login" className="text-[#00C9A7] text-sm hover:underline">Already have an account? Sign in</a>
        </div>
      </div>
    </div>
  );
}
