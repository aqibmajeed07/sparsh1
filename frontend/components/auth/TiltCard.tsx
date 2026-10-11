'use client';

import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
}

export default function TiltCard({ children, className = '' }: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for rotation
  const rotateXSpring = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), {
    stiffness: 180,
    damping: 22,
  });
  const rotateYSpring = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), {
    stiffness: 180,
    damping: 22,
  });

  // Dynamic glare coordinates
  const glareX = useTransform(mouseX, [-0.5, 0.5], ['0%', '100%']);
  const glareY = useTransform(mouseY, [-0.5, 0.5], ['0%', '100%']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      style={{ perspective: 1200 }}
      className="w-full flex justify-center"
    >
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: rotateXSpring,
          rotateY: rotateYSpring,
          transformStyle: 'preserve-3d',
        }}
        className={`relative ${className}`}
      >
        {/* Ambient 3D Spotlight Glow */}
        <div
          className="absolute -inset-1 rounded-[32px] bg-gradient-to-r from-[#6C63FF]/30 via-[#00C9A7]/25 to-[#FF6584]/20 blur-xl opacity-70 group-hover:opacity-100 transition duration-700 pointer-events-none"
          aria-hidden="true"
        />

        {/* Dynamic mouse spotlight glare on glass */}
        <motion.div
          className="absolute inset-0 rounded-3xl pointer-events-none opacity-30 mix-blend-overlay"
          style={{
            background: `radial-gradient(circle 320px at ${glareX} ${glareY}, rgba(255,255,255,0.4), transparent 70%)`,
          }}
          aria-hidden="true"
        />

        {/* Card Content with 3D Depth */}
        <div style={{ transform: 'translateZ(20px)' }} className="relative z-10">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
