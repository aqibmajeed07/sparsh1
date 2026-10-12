'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface SparshLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showTagline?: boolean;
  subtitle?: React.ReactNode;
  className?: string;
  href?: string;
}

const SIZE_MAP = {
  xs: { img: 24, text: 'text-sm', badge: 'text-[9px]' },
  sm: { img: 32, text: 'text-base', badge: 'text-[10px]' },
  md: { img: 40, text: 'text-lg', badge: 'text-[10px]' },
  lg: { img: 48, text: 'text-xl', badge: 'text-xs' },
  xl: { img: 60, text: 'text-2xl', badge: 'text-xs' },
};

export default function SparshLogo({
  size = 'md',
  showText = true,
  showTagline = false,
  subtitle,
  className = '',
  href,
}: SparshLogoProps) {
  const { img, text, badge } = SIZE_MAP[size];

  const content = (
    <div className={`inline-flex items-center gap-3 select-none group ${className}`}>
      {/* 3D Glassmorphic App Emblem */}
      <div
        className="relative shrink-0 rounded-2xl overflow-hidden p-0.5 bg-gradient-to-br from-[#6C63FF]/50 via-white/10 to-[#00C9A7]/50 shadow-lg shadow-[#6C63FF]/25 group-hover:scale-105 group-hover:shadow-[#6C63FF]/45 transition-all duration-300"
        style={{ width: img, height: img }}
      >
        <Image
          src="/sparsh-logo.png"
          alt="SPARSH Logo"
          width={img}
          height={img}
          className="w-full h-full object-cover rounded-xl"
          priority
        />
      </div>

      {showText && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={`font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-[#00C9A7] ${text}`}
            >
              SPARSH
            </span>
            <span
              className={`px-1.5 py-0.5 rounded font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 ${badge}`}
            >
              स्पर्श
            </span>
          </div>
          {subtitle ? (
            <div className="mt-0.5">{subtitle}</div>
          ) : showTagline ? (
            <span className="text-[10px] text-white/50 tracking-wider font-medium mt-0.5">
              Inclusive AI Learning
            </span>
          ) : null}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block focus:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}
