'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { senseBand, SenseBandStatus } from '@/lib/senseband';

const ROLE_NAV: Record<string, { label: string; href: string; icon: string }[]> = {
  student: [
    { label: 'Dashboard', href: '/student', icon: '🏠' },
    { label: 'Lessons', href: '/student/lessons', icon: '📚' },
    { label: 'Sign Lab', href: '/student/sign-lab', icon: '🤟' },
    { label: 'NCERT AI Library', href: '/student/ncert-library', icon: '📖' },
    { label: 'OCR Book Reader', href: '/student/ocr-reader', icon: '📄' },
    { label: 'Braille & Speech Lab', href: '/student/braille-lab', icon: '⠃' },
    { label: 'Smart Keyboard', href: '/student/smart-keyboard', icon: '⌨️' },
    { label: 'Homework Helper', href: '/student/homework-helper', icon: '📝' },
    { label: 'Smart Notes', href: '/student/smart-notes', icon: '🎴' },
    { label: 'AI Tutor', href: '/student/ai-tutor', icon: '🤖' },
    { label: 'RFID Smart Card', href: '/student/rfid-card', icon: '💳' },
    { label: 'Accessibility Setup', href: '/student/accessibility-profile', icon: '⚙️' },
    { label: 'Progress', href: '/student/progress', icon: '📈' },
    { label: 'Rewards', href: '/student/rewards', icon: '🏆' },
    { label: 'SenseBand', href: '/student/senseband', icon: '📳' },
  ],
  teacher: [
    { label: 'Dashboard', href: '/teacher', icon: '🏠' },
    { label: 'Lesson Studio', href: '/teacher/studio', icon: '🎬' },
    { label: 'Student Progress', href: '/teacher/students', icon: '👥' },
    { label: 'Reports & Analytics', href: '/teacher/reports', icon: '📊' },
  ],
  institution_admin: [
    { label: 'School Admin', href: '/admin', icon: '🏫' },
    { label: 'Manage Teachers', href: '/admin/teachers', icon: '👩‍🏫' },
    { label: 'Manage Students', href: '/admin/students', icon: '👨‍🎓' },
    { label: 'Access Requests', href: '/admin/requests', icon: '📋' },
  ],
  ngo_admin: [
    { label: 'NGO Overview', href: '/admin', icon: '🏢' },
    { label: 'Manage Field Educators', href: '/admin/teachers', icon: '👩‍🏫' },
    { label: 'Beneficiary Students', href: '/admin/students', icon: '👨‍🎓' },
    { label: 'Access Requests', href: '/admin/requests', icon: '📋' },
  ],
  super_admin: [
    { label: 'Super Admin', href: '/super-admin', icon: '⚡' },
    { label: 'User Directory', href: '/super-admin/users', icon: '👥' },
    { label: 'Platform Analytics', href: '/super-admin/analytics', icon: '📈' },
    { label: 'Institution Control', href: '/admin', icon: '🏫' },
  ],
};

// ─── SidebarContent is a TOP-LEVEL component, NOT inline inside Sidebar ───────
// Defining it inside Sidebar's render body causes React to create a new component
// identity every render, which breaks hooks (usePathname → useContext null crash).
interface SidebarContentProps {
  role: string;
  userName: string;
  pathname: string;
  navItems: { label: string; href: string; icon: string }[];
  onSignOut: () => void;
}

function SidebarContent({ role, userName, pathname, navItems, onSignOut }: SidebarContentProps) {
  const [sbStatus, setSbStatus] = useState<SenseBandStatus>('disconnected');
  useEffect(() => {
    const unsub = senseBand.onStatus(s => setSbStatus(s));
    return () => { unsub(); };
  }, []);
  return (
    <div className="flex flex-col h-full py-6 px-4">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] flex items-center justify-center text-white font-bold text-lg shrink-0">
          S
        </div>
        <div>
          <span className="gradient-text font-bold text-lg block leading-none">SPARSH</span>
          <span className="text-white/40 text-[10px] capitalize">{role.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/student' &&
              item.href !== '/teacher' &&
              item.href !== '/admin' &&
              item.href !== '/super-admin' &&
              pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <button
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all ${isActive
                  ? 'bg-[#6C63FF] text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
              >
                <span className="text-lg w-6 text-center shrink-0">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
                {item.label === 'Live Class' && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
                {item.label === 'SenseBand' && (
                  <span className={`ml-auto w-2 h-2 rounded-full ${sbStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
                )}
              </button>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-6 pt-6 border-t border-white/10 space-y-2">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] flex items-center justify-center text-white text-sm font-bold shrink-0">
            {userName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-white/80 text-sm font-medium truncate">{userName}</p>
            <p className="text-white/40 text-[10px] capitalize truncate">{role.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:text-red-400 hover:bg-red-500/10 transition"
        >
          <span className="text-lg">🚪</span>
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Main Sidebar wrapper ─────────────────────────────────────────────────────
interface SidebarProps {
  role?: string;
  userName?: string;
}

export default function Sidebar({ role = 'student', userName = 'User' }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = ROLE_NAV[role] || ROLE_NAV.student;

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const contentProps: SidebarContentProps = {
    role,
    userName,
    pathname,
    navItems,
    onSignOut: handleSignOut,
  };

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-xl glass-card flex items-center justify-center text-white hover:bg-white/20 transition"
        aria-label="Open menu"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect y="2" width="18" height="2" rx="1" fill="currentColor" />
          <rect y="8" width="18" height="2" rx="1" fill="currentColor" />
          <rect y="14" width="18" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 z-50 lg:hidden transform transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        style={{
          background: 'linear-gradient(180deg, rgba(30,30,50,0.98) 0%, rgba(15,12,41,0.98) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition"
        >
          ✕
        </button>
        <SidebarContent {...contentProps} />
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(30,30,50,0.8) 0%, rgba(15,12,41,0.8) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <SidebarContent {...contentProps} />
      </aside>
    </>
  );
}
