'use client';
import { useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type CelebrationVariant =
  | 'sign_mastered'   // learnt a single sign in Sign Lab
  | 'lesson_complete' // finished a full lesson
  | 'streak'          // daily streak milestone
  | 'xp_boost';       // generic XP reward

interface CelebrationOverlayProps {
  show: boolean;
  variant?: CelebrationVariant;
  title?: string;
  subtitle?: string;
  xp?: number;
  onClose?: () => void;
  autoCloseSec?: number; // 0 = no auto-close
}

// ─── Confetti particle ────────────────────────────────────────────────────────
interface Particle {
  id: number;
  x: number;
  vy: number;
  vx: number;
  color: string;
  size: number;
  shape: 'rect' | 'circle' | 'star';
  rotation: number;
  rotSpeed: number;
  opacity: number;
}

const COLORS = [
  '#6C63FF', '#00C9A7', '#FFD700', '#FF6B6B',
  '#4ECDC4', '#A29BFE', '#FD79A8', '#FDCB6E',
  '#55EFC4', '#74B9FF', '#E17055', '#81ECEC',
];

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function makeParticle(id: number): Particle {
  return {
    id,
    x: randomBetween(5, 95),          // % across screen
    vy: randomBetween(2, 6),           // fall speed
    vx: randomBetween(-1.5, 1.5),      // drift
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: randomBetween(7, 16),
    shape: (['rect', 'circle', 'star'] as const)[Math.floor(Math.random() * 3)],
    rotation: randomBetween(0, 360),
    rotSpeed: randomBetween(-4, 4),
    opacity: 1,
  };
}

// ─── Variant configs ──────────────────────────────────────────────────────────
const VARIANTS: Record<CelebrationVariant, { emoji: string; defaultTitle: string; defaultSub: string; defaultXp: number; color: string }> = {
  sign_mastered:   { emoji: '🤟', defaultTitle: 'Sign Mastered!',      defaultSub: 'You nailed that ISL sign!',        defaultXp: 15,  color: '#6C63FF' },
  lesson_complete: { emoji: '🎓', defaultTitle: 'Lesson Complete!',    defaultSub: 'Amazing work — keep it up!',       defaultXp: 50,  color: '#00C9A7' },
  streak:          { emoji: '🔥', defaultTitle: 'Streak Milestone!',   defaultSub: "You're on fire — don't stop now!", defaultXp: 30,  color: '#FFD700' },
  xp_boost:        { emoji: '⭐', defaultTitle: 'XP Earned!',          defaultSub: 'Great job, keep learning!',        defaultXp: 20,  color: '#A29BFE' },
};

// ─── Star SVG ─────────────────────────────────────────────────────────────────
function StarShape({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  );
}

// ─── Confetti Canvas ──────────────────────────────────────────────────────────
function ConfettiCanvas({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [tops, setTops] = useState<Record<number, number>>({});
  const frameRef = useRef<number>(0);
  const startedRef = useRef(false);
  const speedMapRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (!active) {
      setParticles([]);
      setTops({});
      speedMapRef.current.clear();
      startedRef.current = false;
      cancelAnimationFrame(frameRef.current);
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;

    // Spawn burst
    const initial = Array.from({ length: 60 }, (_, i) => makeParticle(i));
    setParticles(initial);
    const topState: Record<number, number> = {};
    speedMapRef.current.clear();
    initial.forEach(p => {
      topState[p.id] = -10;
      speedMapRef.current.set(p.id, p.vy);
    });
    setTops({ ...topState });

    let frame = 0;
    const tick = () => {
      frame++;
      setTops(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          const id = Number(key);
          const speed = speedMapRef.current.get(id) ?? 3;
          next[id] = (next[id] ?? -10) + speed * 0.5;
        });
        return next;
      });
      // Spawn a few more every 8 frames for first 120 frames
      if (frame % 8 === 0 && frame < 120) {
        setParticles(prev => {
          const newPs = Array.from({ length: 5 }, (_, i) => makeParticle(Date.now() + i));
          setTops(t => {
            const n = { ...t };
            newPs.forEach(p => {
              n[p.id] = -10;
              speedMapRef.current.set(p.id, p.vy);
            });
            return n;
          });
          return [...prev, ...newPs];
        });
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map(p => {
        const top = tops[p.id] ?? -10;
        if (top > 110) return null;
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${top}%`,
              opacity: top > 85 ? 1 - (top - 85) / 25 : 1,
              transform: `rotate(${p.rotation + (tops[p.id] ?? 0) * p.rotSpeed}deg)`,
              transition: 'none',
              willChange: 'transform, top',
            }}
          >
            {p.shape === 'circle' ? (
              <div style={{ width: p.size, height: p.size, borderRadius: '50%', background: p.color }} />
            ) : p.shape === 'star' ? (
              <StarShape size={p.size} color={p.color} />
            ) : (
              <div style={{ width: p.size * 0.6, height: p.size, background: p.color, borderRadius: 2 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── XP Counter ───────────────────────────────────────────────────────────────
function XPCounter({ target, color }: { target: number; color: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let v = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const t = setInterval(() => {
      v = Math.min(v + step, target);
      setVal(v);
      if (v >= target) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [target]);

  return (
    <span style={{ color }} className="font-black text-5xl tabular-nums drop-shadow-lg">
      +{val}
    </span>
  );
}

// ─── Ripple ring ─────────────────────────────────────────────────────────────
function RippleRings({ color }: { color: string }) {
  return (
    <>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `3px solid ${color}`,
            opacity: 0,
            animation: `sparsh-ripple 1.6s ease-out ${i * 0.4}s infinite`,
          }}
        />
      ))}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CelebrationOverlay({
  show,
  variant = 'sign_mastered',
  title,
  subtitle,
  xp,
  onClose,
  autoCloseSec = 4,
}: CelebrationOverlayProps) {
  const cfg = VARIANTS[variant];
  const displayTitle = title ?? cfg.defaultTitle;
  const displaySub   = subtitle ?? cfg.defaultSub;
  const displayXp    = xp ?? cfg.defaultXp;
  const color        = cfg.color;

  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (show) {
      setExiting(false);
      setVisible(true);
    } else if (visible) {
      handleClose();
    }
  }, [show]);

  useEffect(() => {
    if (!visible || autoCloseSec === 0) return;
    const t = setTimeout(handleClose, autoCloseSec * 1000);
    return () => clearTimeout(t);
  }, [visible, autoCloseSec]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      onClose?.();
    }, 400);
  };

  if (!visible) return null;

  return (
    <>
      {/* ── Keyframes injected once ── */}
      <style>{`
        @keyframes sparsh-ripple {
          0%   { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes sparsh-pop-in {
          0%   { opacity: 0; transform: scale(0.5) translateY(40px); }
          70%  { transform: scale(1.06) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes sparsh-pop-out {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.85) translateY(20px); }
        }
        @keyframes sparsh-float {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50%       { transform: translateY(-12px) rotate(2deg); }
        }
        @keyframes sparsh-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes sparsh-bounce-in {
          0%   { transform: scale(0); }
          50%  { transform: scale(1.25); }
          75%  { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
        @keyframes sparsh-slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sparsh-glow-pulse {
          0%, 100% { box-shadow: 0 0 20px ${color}66, 0 0 60px ${color}33; }
          50%       { box-shadow: 0 0 40px ${color}99, 0 0 100px ${color}55; }
        }
      `}</style>

      {/* ── Backdrop ── */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: exiting ? 'sparsh-pop-out 0.4s forwards' : 'none',
          opacity: exiting ? undefined : 1,
          transition: 'opacity 0.4s',
        }}
      >
        {/* ── Confetti ── */}
        <ConfettiCanvas active={visible && !exiting} />

        {/* ── Card ── */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'relative',
            zIndex: 1,
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            border: `1.5px solid ${color}55`,
            borderRadius: 28,
            padding: '48px 40px 36px',
            maxWidth: 420,
            width: '90vw',
            textAlign: 'center',
            animation: exiting
              ? 'sparsh-pop-out 0.4s forwards'
              : 'sparsh-pop-in 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards',
            animationName: exiting ? 'sparsh-pop-out' : 'sparsh-glow-pulse, sparsh-pop-in',
            animationDuration: exiting ? '0.4s' : '2s, 0.55s',
            animationIterationCount: exiting ? '1' : 'infinite, 1',
            animationTimingFunction: exiting ? 'forwards' : 'ease-in-out, cubic-bezier(0.34,1.56,0.64,1)',
            animationFillMode: 'both',
            overflow: 'hidden',
          }}
        >
          {/* Shimmer streak */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 28, pointerEvents: 'none', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
              background: `linear-gradient(90deg, transparent 0%, ${color}15 50%, transparent 100%)`,
              backgroundSize: '200% 100%',
              animation: 'sparsh-shimmer 2.5s linear infinite',
            }} />
          </div>

          {/* Emoji / mascot */}
          <div style={{
            position: 'relative',
            width: 96, height: 96, margin: '0 auto 24px',
          }}>
            <RippleRings color={color} />
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: `radial-gradient(circle at 35% 35%, ${color}cc, ${color}44)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 44,
              animation: 'sparsh-float 2.4s ease-in-out infinite',
              boxShadow: `0 8px 32px ${color}55`,
              position: 'relative',
            }}>
              {cfg.emoji}
            </div>
          </div>

          {/* XP badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: `${color}22`, border: `1px solid ${color}44`,
            borderRadius: 999, padding: '6px 18px', marginBottom: 20,
            animation: 'sparsh-bounce-in 0.5s 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <span style={{ color, fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>XP</span>
            <XPCounter target={displayXp} color={color} />
          </div>

          {/* Title */}
          <h2 style={{
            color: '#fff', fontSize: 28, fontWeight: 900, margin: '0 0 8px',
            textShadow: `0 0 20px ${color}88`,
            animation: 'sparsh-slide-up 0.45s 0.25s both',
          }}>
            {displayTitle}
          </h2>

          {/* Subtitle */}
          <p style={{
            color: 'rgba(255,255,255,0.65)', fontSize: 15, margin: '0 0 28px',
            animation: 'sparsh-slide-up 0.45s 0.35s both',
          }}>
            {displaySub}
          </p>

          {/* Streak dots */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28,
            animation: 'sparsh-slide-up 0.45s 0.45s both',
          }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{
                width: 12, height: 12, borderRadius: '50%',
                background: i < 4 ? color : 'rgba(255,255,255,0.1)',
                boxShadow: i < 4 ? `0 0 8px ${color}` : 'none',
                transform: i < 4 ? 'scale(1)' : 'scale(0.75)',
                animation: i < 4 ? `sparsh-bounce-in 0.4s ${0.5 + i * 0.08}s both` : 'none',
              }} />
            ))}
          </div>

          {/* CTA button */}
          <button
            onClick={handleClose}
            style={{
              width: '100%', padding: '14px 0',
              borderRadius: 14, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              color: '#fff', fontSize: 16, fontWeight: 800,
              letterSpacing: 0.3,
              boxShadow: `0 4px 24px ${color}66`,
              animation: 'sparsh-slide-up 0.45s 0.55s both',
              transition: 'transform 0.15s, opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {variant === 'lesson_complete' ? '🚀 Continue Learning' : '✨ Keep Going!'}
          </button>

          {/* Auto-close hint */}
          {autoCloseSec > 0 && (
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 12 }}>
              Auto-closing in {autoCloseSec}s · tap anywhere to dismiss
            </p>
          )}
        </div>
      </div>
    </>
  );
}
