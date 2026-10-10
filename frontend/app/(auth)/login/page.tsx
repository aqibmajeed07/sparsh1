'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Minimum 6 characters'),
});

type RoleKey = 'student' | 'teacher' | 'institution_admin' | 'ngo_admin' | 'super_admin';

const ROLES: { id: RoleKey; label: string; icon: string; redirect: string }[] = [
  { id: 'student', label: 'Student', icon: '🎓', redirect: '/student' },
  { id: 'teacher', label: 'Teacher', icon: '👩‍🏫', redirect: '/teacher' },
  { id: 'institution_admin', label: 'School Admin', icon: '🏫', redirect: '/admin' },
  { id: 'ngo_admin', label: 'NGO Admin', icon: '🏢', redirect: '/admin' },
  { id: 'super_admin', label: 'Super Admin', icon: '⚡', redirect: '/super-admin' },
];

const DEMO_ACCOUNTS = [
  { role: 'student' as RoleKey, email: 'student@gmail.com', pass: 'student123', label: '🎓 Student Demo' },
  { role: 'teacher' as RoleKey, email: 'teacher@gmail.com', pass: 'teacher123', label: '👩‍🏫 Teacher Demo' },
  { role: 'institution_admin' as RoleKey, email: 'school@gmail.com', pass: 'admin123', label: '🏫 School Admin' },
  { role: 'ngo_admin' as RoleKey, email: 'ngo@gmail.com', pass: 'admin123', label: '🏢 NGO Admin' },
  { role: 'super_admin' as RoleKey, email: 'admin@gmail.com', pass: 'admin123', label: '⚡ Super Admin' },
];

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleKey>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'student@gmail.com',
      password: 'password123',
    }
  });

  const handleDemoFill = (demo: typeof DEMO_ACCOUNTS[0]) => {
    setSelectedRole(demo.role);
    setValue('email', demo.email);
    setValue('password', demo.pass);
  };

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    setLoading(true);
    setError('');

    let authUser: any = null;

    try {
      let { data: auth } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (auth && auth.user) {
        authUser = auth.user;
      }
    } catch (e) {
      console.warn('Supabase cloud auth skipped, using local role routing');
    }

    // Determine final role: explicit tab selection or email keyword detection
    let finalRole: RoleKey = selectedRole;
    const emailLower = data.email.toLowerCase();

    if (emailLower.includes('admin') || emailLower.includes('super')) {
      finalRole = 'super_admin';
    } else if (emailLower.includes('teacher') || emailLower.includes('faculty') || emailLower.includes('prof')) {
      finalRole = 'teacher';
    } else if (emailLower.includes('school') || emailLower.includes('inst') || emailLower.includes('principal')) {
      finalRole = 'institution_admin';
    } else if (emailLower.includes('ngo') || emailLower.includes('foundation') || emailLower.includes('org')) {
      finalRole = 'ngo_admin';
    } else if (emailLower.includes('student')) {
      finalRole = 'student';
    }

    const matchedRole = ROLES.find(r => r.id === finalRole) || ROLES.find(r => r.id === selectedRole) || ROLES[0];

    // Save local session for offline dashboard layouts and sidebars
    if (typeof window !== 'undefined') {
      const userProfile = {
        id: authUser?.id || ('demo-user-' + btoa(data.email).replace(/=/g, '')),
        email: data.email,
        full_name: matchedRole.label + ' User',
        role: finalRole,
      };
      localStorage.setItem('sparsh_user', JSON.stringify(userProfile));
    }

    router.push(matchedRole.redirect);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-lg p-8 rounded-3xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] flex items-center justify-center mb-3 shadow-lg">
            <span className="text-white font-black text-3xl">S</span>
          </div>
          <h1 className="text-white text-3xl font-extrabold tracking-tight">Sparsh</h1>
          <p className="text-white/60 text-sm mt-1">Accessible Education Platform for All</p>
        </div>

        {/* Role Selector Tabs */}
        <div className="mb-6">
          <label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block text-center">
            Select Your Role Dashboard
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1.5 bg-black/30 rounded-2xl border border-white/10">
            {ROLES.map(role => {
              const active = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRole(role.id)}
                  className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${active
                    ? 'bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] text-white font-bold shadow-lg scale-105'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <span className="text-lg">{role.icon}</span>
                  <span className="text-[10px] mt-0.5 truncate w-full text-center font-medium">{role.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 1-Click Demo Accounts */}
        <div className="mb-6 p-3 bg-white/5 rounded-2xl border border-white/10">
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-2 text-center">
            ⚡ 1-Click Quick Demo Login
          </p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {DEMO_ACCOUNTS.map(demo => (
              <button
                key={demo.role}
                type="button"
                onClick={() => handleDemoFill(demo)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${selectedRole === demo.role
                  ? 'bg-[#6C63FF]/30 border-[#6C63FF] text-white'
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
              >
                {demo.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-white/80 text-sm mb-1 block font-medium">Email Address</label>
            <input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              className="glass-input w-full p-3 text-sm text-white rounded-xl focus:border-[#6C63FF] focus:outline-none"
              aria-label="Email address"
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message as string}</p>}
          </div>

          <div>
            <label className="text-white/80 text-sm mb-1 block font-medium">Password</label>
            <input
              {...register('password')}
              type="password"
              placeholder="••••••••"
              className="glass-input w-full p-3 text-sm text-white rounded-xl focus:border-[#6C63FF] focus:outline-none"
              aria-label="Password"
            />
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message as string}</p>}
          </div>

          {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3 border border-red-500/20">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-bold text-base hover:opacity-90 transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span>{ROLES.find(r => r.id === selectedRole)?.icon}</span>
            <span>{loading ? 'Signing in...' : `Sign In to ${ROLES.find(r => r.id === selectedRole)?.label} Dashboard`}</span>
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <a href="/register" className="text-[#00C9A7] text-xs font-semibold hover:underline">
            New to Sparsh? Create Account
          </a>
        </div>
      </div>
    </div>
  );
}
