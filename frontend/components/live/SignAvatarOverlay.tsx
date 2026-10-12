'use client';
/**
 * SignAvatarOverlay — Hyper-Realistic Humanized ISL 3D Avatar
 * Premium anatomical skeleton, 5-digit articulated hands with individual joint finger movement,
 * realistic eye micro-saccades, eyelid blinking, lip-sync visemes, breathing cycle, and cinematic studio lighting.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { resolveSign, resolveToken } from '@/lib/isl/signMap';
import type { BoneRotation } from '@/lib/isl/signPoses';
import {
  useAvatarMaterials, CartoonFace, Hand, Leg, AvatarHair, WristWatch
} from './AvatarBody';

export interface SignAvatarOverlayProps {
  queue: string[];
  onSignComplete: (word: string) => void;
  avatarUrl?: string;
  className?: string;
  isProcessing?: boolean;
  isSpeaking?: boolean;
  speakingText?: string;
}

// ── Smooth Anatomical Quaternion Interpolation with Easing ──
function slerp(obj: THREE.Object3D, rot: BoneRotation, alpha: number) {
  if (!obj) return;
  const t = Math.min(Math.max(alpha, 0), 1);
  const smooth = t * t * (3 - 2 * t);
  const targetQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rot.x, rot.y, rot.z, 'XYZ')
  );
  obj.quaternion.slerp(targetQuaternion, Math.min(smooth * 0.4 + 0.08, 1));
}

// ═══════════════════════════════════════════════
// HUMANIZED AVATAR COMPONENT WITH DYNAMIC FINGER MOVEMENT
// ═══════════════════════════════════════════════
function Avatar({ queue, onSignComplete, isSpeaking = false }:
  Pick<SignAvatarOverlayProps, 'queue' | 'onSignComplete' | 'isSpeaking'>) {
  const mat = useAvatarMaterials();

  // ── Anatomical Bone Refs ──
  const spineRef = useRef<THREE.Group>(null!);
  const chestRef = useRef<THREE.Group>(null!);
  const neckRef = useRef<THREE.Group>(null!);
  const headRef = useRef<THREE.Group>(null!);
  const jawRef = useRef<THREE.Group>(null!);
  const leftLidRef = useRef<THREE.Group>(null!);
  const rightLidRef = useRef<THREE.Group>(null!);

  // Left Arm, Wrist & Articulated Finger Joint Refs
  const lArmRef = useRef<THREE.Group>(null!);
  const lFARef = useRef<THREE.Group>(null!);
  const lHRef = useRef<THREE.Group>(null!);
  const lFingerRefs = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)];
  const lFingerPipRefs = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)];
  const lThumbRefs = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)];

  // Right Arm, Wrist & Articulated Finger Joint Refs
  const rArmRef = useRef<THREE.Group>(null!);
  const rFARef = useRef<THREE.Group>(null!);
  const rHRef = useRef<THREE.Group>(null!);
  const rFingerRefs = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)];
  const rFingerPipRefs = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)];
  const rThumbRefs = [useRef<THREE.Group>(null!), useRef<THREE.Group>(null!)];

  // Legs & Feet
  const lUpLegRef = useRef<THREE.Group>(null!);
  const lLegRef = useRef<THREE.Group>(null!);
  const lFootRef = useRef<THREE.Group>(null!);
  const rUpLegRef = useRef<THREE.Group>(null!);
  const rLegRef = useRef<THREE.Group>(null!);
  const rFootRef = useRef<THREE.Group>(null!);

  // Grouped refs for ISL Pose backward compatibility
  const lFingersGroupRef = useRef<THREE.Group>(null!);
  const rFingersGroupRef = useRef<THREE.Group>(null!);
  const lThumbGroupRef = useRef<THREE.Group>(null!);
  const rThumbGroupRef = useRef<THREE.Group>(null!);

  // Mouth & Expression State
  const mouthOpenRef = useRef(0);
  // Blink & Micro-saccade State
  const blinkRef = useRef({ timer: 2 + Math.random() * 3, isBlinking: false, duration: 0 });
  const gazeRef = useRef({ x: 0, y: 0, timer: 1.5 });

  const boneMap = useRef<Record<string, React.RefObject<THREE.Group>>>({});
  useEffect(() => {
    boneMap.current = {
      Spine: spineRef, Spine1: spineRef,
      Chest: chestRef, UpperChest: chestRef,
      Neck: neckRef, Head: headRef,
      LeftArm: lArmRef, LeftForeArm: lFARef, LeftHand: lHRef,
      RightArm: rArmRef, RightForeArm: rFARef, RightHand: rHRef,

      // Individual Right Hand Finger Joint Mapping
      RightIndex: rFingerRefs[0],
      RightMiddle: rFingerRefs[1],
      RightRing: rFingerRefs[2],
      RightPinky: rFingerRefs[3],
      RightThumb: rThumbRefs[0],
      RightThumbTip: rThumbRefs[1],
      RightIndexPip: rFingerPipRefs[0],
      RightMiddlePip: rFingerPipRefs[1],
      RightRingPip: rFingerPipRefs[2],
      RightPinkyPip: rFingerPipRefs[3],

      // Individual Left Hand Finger Joint Mapping
      LeftIndex: lFingerRefs[0],
      LeftMiddle: lFingerRefs[1],
      LeftRing: lFingerRefs[2],
      LeftPinky: lFingerRefs[3],
      LeftThumb: lThumbRefs[0],
      LeftThumbTip: lThumbRefs[1],
      LeftIndexPip: lFingerPipRefs[0],
      LeftMiddlePip: lFingerPipRefs[1],
      LeftRingPip: lFingerPipRefs[2],
      LeftPinkyPip: lFingerPipRefs[3],

      // Grouped Finger Fallbacks
      RightFingers: rFingersGroupRef, RightThumbGroup: rThumbGroupRef,
      LeftFingers: lFingersGroupRef, LeftThumbGroup: lThumbGroupRef,
    };
  }, []);

  // ── Animation Engine State ──
  const animState = useRef({
    sign: null as ReturnType<typeof resolveSign>,
    kf: 0,
    t: 0,
    playing: false,
    word: '',
    idleTime: 0,
    cooldown: 0,
  });
  const [isPlaying, setIsPlaying] = useState(false);

  const playToken = useCallback((token: string) => {
    const { sign } = resolveToken(token);
    if (!sign) {
      setTimeout(() => onSignComplete(token), 150);
      return;
    }
    const state = animState.current;
    state.sign = sign;
    state.kf = 0;
    state.t = 0;
    state.playing = true;
    state.word = token;
    setIsPlaying(true);
  }, [onSignComplete]);

  useEffect(() => {
    if (!isPlaying && queue.length > 0) {
      playToken(queue[0]);
    }
  }, [queue, isPlaying, playToken]);

  useFrame((_, dt) => {
    const state = animState.current;
    state.idleTime += dt;
    const time = state.idleTime;

    // ── 1. Realistic Eyelid Blinking Engine ──
    const blink = blinkRef.current;
    blink.timer -= dt;
    if (blink.timer <= 0 && !blink.isBlinking) {
      blink.isBlinking = true;
      blink.duration = 0.16; // 160ms realistic human blink
      blink.timer = 2.5 + Math.random() * 3.5;
    }
    if (blink.isBlinking) {
      blink.duration -= dt;
      const blinkProgress = Math.sin((1 - Math.max(blink.duration, 0) / 0.16) * Math.PI);
      const blinkAngle = blinkProgress * 0.65;
      if (leftLidRef.current) leftLidRef.current.rotation.x = blinkAngle;
      if (rightLidRef.current) rightLidRef.current.rotation.x = blinkAngle;

      if (blink.duration <= 0) {
        blink.isBlinking = false;
        if (leftLidRef.current) leftLidRef.current.rotation.x = 0;
        if (rightLidRef.current) rightLidRef.current.rotation.x = 0;
      }
    }

    // ── 2. Eye Micro-saccades (Natural Focus Shifts) ──
    const gaze = gazeRef.current;
    gaze.timer -= dt;
    if (gaze.timer <= 0) {
      gaze.x = (Math.random() - 0.5) * 0.05;
      gaze.y = (Math.random() - 0.5) * 0.03;
      gaze.timer = 1.2 + Math.random() * 2.5;
    }

    // ── 3. Realistic Visemes & Lip-Sync ──
    if (isSpeaking) {
      const visemePulse =
        Math.sin(time * 14) * 0.4 +
        Math.sin(time * 8.2) * 0.35 +
        Math.sin(time * 22) * 0.15;
      mouthOpenRef.current = 0.28 + Math.max(visemePulse, 0) * 0.4;
    } else {
      mouthOpenRef.current *= 0.82;
    }

    if (jawRef.current) {
      jawRef.current.rotation.x = mouthOpenRef.current * 0.22;
      jawRef.current.position.y = -0.075 - mouthOpenRef.current * 0.01;
    }

    // ── 4. Organic Human Finger Physics & Articulation Engine ──
    const fingerFreq = isSpeaking ? 3.6 : 1.8;
    const fingerAmp = isSpeaking ? 0.24 : 0.12;

    const rFingersData = [
      { ref: rFingerRefs[0], pip: rFingerPipRefs[0], phase: 0.0, mcpBase: 0.12, pipBase: 0.18 }, // Index
      { ref: rFingerRefs[1], pip: rFingerPipRefs[1], phase: 0.45, mcpBase: 0.16, pipBase: 0.22 }, // Middle
      { ref: rFingerRefs[2], pip: rFingerPipRefs[2], phase: 0.90, mcpBase: 0.22, pipBase: 0.30 }, // Ring
      { ref: rFingerRefs[3], pip: rFingerPipRefs[3], phase: 1.35, mcpBase: 0.30, pipBase: 0.40 }, // Pinky
    ];

    const lFingersData = [
      { ref: lFingerRefs[0], pip: lFingerPipRefs[0], phase: 0.25, mcpBase: 0.12, pipBase: 0.18 },
      { ref: lFingerRefs[1], pip: lFingerPipRefs[1], phase: 0.70, mcpBase: 0.16, pipBase: 0.22 },
      { ref: lFingerRefs[2], pip: lFingerPipRefs[2], phase: 1.15, mcpBase: 0.22, pipBase: 0.30 },
      { ref: lFingerRefs[3], pip: lFingerPipRefs[3], phase: 1.60, mcpBase: 0.30, pipBase: 0.40 },
    ];

    if (!state.playing) {
      // Dynamic organic finger flex & flutter during idle / speech
      rFingersData.forEach(({ ref, pip, phase, mcpBase, pipBase }) => {
        const mcpFlex = mcpBase + Math.sin(time * fingerFreq + phase) * fingerAmp;
        const pipFlex = pipBase + Math.sin(time * fingerFreq + phase + 0.3) * (fingerAmp * 1.25);
        if (ref.current) ref.current.rotation.x = mcpFlex;
        if (pip.current) pip.current.rotation.x = pipFlex;
      });

      lFingersData.forEach(({ ref, pip, phase, mcpBase, pipBase }) => {
        const mcpFlex = mcpBase + Math.sin(time * fingerFreq + phase + 0.8) * fingerAmp;
        const pipFlex = pipBase + Math.sin(time * fingerFreq + phase + 1.1) * (fingerAmp * 1.25);
        if (ref.current) ref.current.rotation.x = mcpFlex;
        if (pip.current) pip.current.rotation.x = pipFlex;
      });

      // Opponens thumb movements
      if (rThumbRefs[0].current) rThumbRefs[0].current.rotation.x = 0.12 + Math.sin(time * (fingerFreq * 0.8)) * 0.08;
      if (lThumbRefs[0].current) lThumbRefs[0].current.rotation.x = 0.12 + Math.sin(time * (fingerFreq * 0.8) + 0.5) * 0.08;
    }

    // ── 5. Sign Animation Interpolation ──
    if (state.cooldown > 0) {
      state.cooldown -= dt;
      const breath = Math.sin(time * 1.4) * 0.012;
      if (spineRef.current) slerp(spineRef.current, { x: breath, y: 0, z: 0 }, 1);
      if (headRef.current) slerp(headRef.current, { x: Math.sin(time * 0.5) * 0.01, y: gaze.x, z: gaze.y }, 1);
      return;
    }

    if (state.playing && state.sign) {
      const kf = state.sign.keyframes[state.kf];
      if (!kf) {
        state.playing = false;
        state.sign = null;
        const finishedWord = state.word;
        state.word = '';
        state.cooldown = 0.35;
        setIsPlaying(false);
        onSignComplete(finishedWord);
        return;
      }

      state.t += dt;
      const alpha = Math.min(state.t / Math.max(kf.duration, 0.01), 1);

      // Apply keyframe rotations to bone hierarchy (including finger bones)
      for (const [name, rot] of Object.entries(kf.bones)) {
        const ref = boneMap.current[name];
        if (ref?.current) {
          slerp(ref.current, rot, alpha);
        }
      }

      if (state.t >= kf.duration) {
        state.kf++;
        state.t = 0;
      }
    } else {
      // ── 6. Humanized Posture Sway & Breathing ──
      const breathTorso = Math.sin(time * 1.3) * 0.014;
      const breathChest = Math.sin(time * 1.3 + 0.2) * 0.01;
      const swayWeight = Math.sin(time * 0.4) * 0.012;
      const microHeadZ = Math.sin(time * 0.35) * 0.008;

      if (spineRef.current) slerp(spineRef.current, { x: breathTorso, y: swayWeight, z: 0 }, 1);
      if (chestRef.current) slerp(chestRef.current, { x: breathChest, y: 0, z: 0 }, 1);
      if (headRef.current) slerp(headRef.current, { x: Math.sin(time * 0.45) * 0.012 + gaze.y, y: Math.sin(time * 0.55) * 0.018 + gaze.x, z: microHeadZ }, 1);
      if (neckRef.current) slerp(neckRef.current, { x: 0, y: Math.sin(time * 0.5) * 0.01, z: 0 }, 1);

      // Rest arm posture
      if (lArmRef.current) slerp(lArmRef.current, { x: 0.02, y: 0, z: 0.09 + Math.sin(time * 0.65) * 0.006 }, 1);
      if (rArmRef.current) slerp(rArmRef.current, { x: 0.02, y: 0, z: -0.09 - Math.sin(time * 0.65 + 1) * 0.006 }, 1);

      if (lUpLegRef.current) slerp(lUpLegRef.current, { x: swayWeight * 0.5, y: 0, z: 0 }, 1);
      if (rUpLegRef.current) slerp(rUpLegRef.current, { x: -swayWeight * 0.5, y: 0, z: 0 }, 1);
    }
  });

  // ── Arm & Shoulder Girdle Assembly ──
  const Arm = ({ side }: { side: -1 | 1 }) => {
    const isL = side === -1;
    return (
      <group position={[side * 0.25, 0.44, 0]}>
        {/* Deltoid / Shoulder Cap */}
        <mesh material={mat.shirt} scale={[1.05, 0.95, 0.95]}>
          <sphereGeometry args={[0.076, 16, 16]} />
        </mesh>

        <group ref={isL ? lArmRef : rArmRef}>
          {/* Upper Arm */}
          <mesh material={mat.shirt} position={[0, -0.1, 0]}>
            <capsuleGeometry args={[0.064, 0.14, 8, 16]} />
          </mesh>

          {/* Sleeve Trim */}
          <mesh material={mat.shirtTrim} position={[0, -0.185, 0]}>
            <capsuleGeometry args={[0.061, 0.022, 6, 12]} />
          </mesh>

          {/* Upper Arm Skin / Bicep */}
          <mesh material={mat.skinLt} position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.054, 0.065, 6, 12]} />
          </mesh>

          {/* Elbow Joint */}
          <mesh material={mat.skinLt} position={[0, -0.268, 0]}>
            <sphereGeometry args={[0.052, 12, 12]} />
          </mesh>

          <group ref={isL ? lFARef : rFARef} position={[0, -0.268, 0]}>
            {/* Forearm */}
            <mesh material={mat.skinLt} position={[0, -0.125, 0]} scale={[0.96, 1, 0.92]}>
              <capsuleGeometry args={[0.047, 0.21, 8, 16]} />
            </mesh>

            {/* Wrist Watch on Left Arm */}
            {isL && <WristWatch mat={mat} />}

            {/* Wrist Joint */}
            <mesh material={mat.skinLt} position={[0, -0.25, 0]}>
              <sphereGeometry args={[0.041, 10, 10]} />
            </mesh>

            <group ref={isL ? lHRef : rHRef} position={[0, -0.265, 0]}>
              <Hand
                mat={mat}
                side={side}
                fingerRefs={isL ? lFingerRefs : rFingerRefs}
                fingerPipRefs={isL ? lFingerPipRefs : rFingerPipRefs}
                thumbRefs={isL ? lThumbRefs : rThumbRefs}
              />
            </group>
          </group>
        </group>
      </group>
    );
  };

  return (
    <group>
      {/* ── ROOT SKELETON / SPINE ── */}
      <group ref={spineRef}>
        {/* Pelvis & Trouser Waistband */}
        <mesh material={mat.pants} position={[0, -0.05, 0]} scale={[1.05, 1, 0.95]}>
          <capsuleGeometry args={[0.155, 0.08, 6, 16]} />
        </mesh>

        {/* Belt & Buckle */}
        <mesh material={mat.belt} position={[0, -0.028, 0.004]} scale={[1.03, 0.26, 1.02]}>
          <capsuleGeometry args={[0.152, 0.012, 6, 16]} />
        </mesh>
        <mesh material={mat.beltBuckle} position={[0, -0.028, 0.155]}>
          <boxGeometry args={[0.038, 0.026, 0.01]} />
        </mesh>

        {/* ── LEGS ── */}
        <Leg mat={mat} side={-1} upperLegRef={lUpLegRef} lowerLegRef={lLegRef} footRef={lFootRef} />
        <Leg mat={mat} side={1} upperLegRef={rUpLegRef} lowerLegRef={rLegRef} footRef={rFootRef} />

        {/* ── CHEST & TORSO ── */}
        <group ref={chestRef}>
          {/* Main Torso */}
          <mesh material={mat.shirt} position={[0, 0.2, 0]} scale={[1.1, 1.05, 0.88]}>
            <capsuleGeometry args={[0.165, 0.35, 12, 24]} />
          </mesh>

          {/* Executive Polo Placket & Buttons */}
          <mesh material={mat.shirtTrim} position={[0, 0.32, 0.145]}>
            <boxGeometry args={[0.028, 0.14, 0.008]} />
          </mesh>
          <mesh material={mat.shirtButton} position={[0, 0.36, 0.15]}>
            <cylinderGeometry args={[0.004, 0.004, 0.004, 8]} />
          </mesh>
          <mesh material={mat.shirtButton} position={[0, 0.3, 0.15]}>
            <cylinderGeometry args={[0.004, 0.004, 0.004, 8]} />
          </mesh>

          {/* Tailored Collar */}
          <mesh material={mat.shirtCollar} position={[0, 0.42, 0]} scale={[1.04, 0.9, 0.82]}>
            <sphereGeometry args={[0.155, 16, 16]} />
          </mesh>

          {/* Shoulder Bar */}
          <mesh material={mat.shirt} position={[0, 0.44, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.86]}>
            <capsuleGeometry args={[0.076, 0.4, 8, 16]} />
          </mesh>

          {/* ── ARMS ── */}
          <Arm side={-1} />
          <Arm side={1} />

          {/* ── NECK ── */}
          <group ref={neckRef} position={[0, 0.48, 0]}>
            <mesh material={mat.skin} position={[0, 0.062, 0]}>
              <capsuleGeometry args={[0.058, 0.095, 6, 14]} />
            </mesh>

            {/* ── HEAD & FACE ── */}
            <group ref={headRef} position={[0, 0.185, 0]}>
              <mesh material={mat.skin} position={[0, 0.11, 0]} scale={[1, 1.05, 0.98]}>
                <sphereGeometry args={[0.21, 32, 32]} />
              </mesh>

              <mesh material={mat.skin} position={[0, -0.018, 0.028]} scale={[0.82, 0.54, 0.84]}>
                <sphereGeometry args={[0.21, 24, 24]} />
              </mesh>

              <mesh material={mat.skin} position={[0, 0.19, 0.058]} scale={[0.92, 0.6, 0.72]}>
                <sphereGeometry args={[0.18, 18, 18]} />
              </mesh>

              <AvatarHair mat={mat} />

              <CartoonFace
                mat={mat}
                jawRef={jawRef}
                mouthOpenRef={mouthOpenRef}
                leftLidRef={leftLidRef}
                rightLidRef={rightLidRef}
              />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

// ═══════════════════════════════════════════════
// CAMERA LOCK & CINEMATIC VIEW
// ═══════════════════════════════════════════════
function CameraTarget() {
  useFrame(({ camera }) => {
    camera.lookAt(0, 0.25, 0);
  });
  return null;
}

// ═══════════════════════════════════════════════
// MAIN EXPORTED COMPONENT
// ═══════════════════════════════════════════════
export default function SignAvatarOverlay({
  queue,
  onSignComplete,
  className,
  isProcessing,
  isSpeaking,
}: SignAvatarOverlayProps) {
  return (
    <div
      className={`relative flex flex-col bg-gradient-to-b from-[#0B0F19] via-[#090C15] to-[#04060C] border border-white/10 rounded-2xl overflow-hidden shadow-2xl ${className ?? ''
        }`}
    >
      {/* Live ISL Badge */}
      <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none flex items-center gap-1.5 bg-[#6C63FF]/25 border border-[#6C63FF]/40 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-[#A5B4FC]">
        <span
          className={`w-1.5 h-1.5 rounded-full ${queue.length > 0 ? 'bg-[#6C63FF] animate-pulse' : 'bg-emerald-400'
            }`}
        />
        ISL Articulated Avatar
      </div>

      {/* AI Quality Badge */}
      <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
        <span className="bg-gradient-to-r from-[#4F46E5] to-[#10B981] text-white text-[9px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-lg shadow-lg">
          ✨ Hyper-Realistic AI
        </span>
      </div>

      {/* Speaking Indicator */}
      {isSpeaking && (
        <div className="absolute top-9 right-2.5 z-10 pointer-events-none flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-md border border-emerald-500/30">
          <div className="flex gap-0.5">
            {[0, 1, 2, 3].map(i => (
              <span
                key={i}
                className="w-0.5 bg-emerald-400 rounded-full animate-pulse"
                style={{
                  height: `${6 + Math.random() * 8}px`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
          <span className="text-emerald-400 text-[9px] font-bold">Speaking</span>
        </div>
      )}

      {isProcessing && (
        <div className="absolute top-8 right-2.5 z-10 pointer-events-none text-yellow-300 text-[9px] flex items-center gap-1 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
          Processing…
        </div>
      )}

      {/* 3D Canvas */}
      <div className="flex-1 w-full h-full min-h-[350px]">
        <Canvas
          shadows
          camera={{ position: [0, 0.45, 2.35], fov: 37, near: 0.05, far: 20 }}
          gl={{
            antialias: true,
            powerPreference: 'default',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.35,
          }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (event) => {
              event.preventDefault();
              console.warn('[Avatar 3D] WebGL Context lost. Auto-recovering...');
            }, false);
            gl.domElement.addEventListener('webglcontextrestored', () => {
              console.log('[Avatar 3D] WebGL Context restored.');
            }, false);
          }}
        >
          <CameraTarget />

          {/* Studio Lighting */}
          <ambientLight intensity={0.55} color="#E2E8F0" />
          <directionalLight
            position={[1.8, 4.2, 2.6]}
            intensity={2.8}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-near={0.1}
            shadow-camera-far={8}
            shadow-camera-left={-1.5}
            shadow-camera-right={1.5}
            shadow-camera-top={2}
            shadow-camera-bottom={-1}
          />
          <directionalLight position={[-2.2, 1.6, -0.6]} intensity={0.65} color="#818CF8" />
          <pointLight position={[0, 3.2, -1.2]} intensity={1.1} color="#6366F1" distance={6} />
          <pointLight position={[0.6, 2.6, 1.4]} intensity={0.8} color="#FFFFFF" distance={5} />
          <pointLight position={[-0.6, 0.6, 1.2]} intensity={0.5} color="#10B981" distance={4} />

          <Environment preset="studio" />

          <React.Suspense fallback={null}>
            <Avatar queue={queue} onSignComplete={onSignComplete} isSpeaking={isSpeaking} />
          </React.Suspense>

          <ContactShadows
            position={[0, -0.95, 0]}
            opacity={0.6}
            scale={3.2}
            blur={2.2}
            color="#1E1B4B"
          />
        </Canvas>
      </div>

      {/* Sign Queue Bar */}
      <div className="shrink-0 px-3 py-2 bg-[#04060C]/90 backdrop-blur border-t border-white/5">
        <div className="flex gap-1.5 flex-wrap min-h-[22px] items-center">
          {queue.length > 0 ? (
            <>
              <span className="text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 animate-pulse">
                🤟 &quot;{queue[0]}&quot;
              </span>
              {queue.slice(1, 4).map((w, i) => (
                <span key={i} className="text-white/35 text-xs px-2 py-0.5 rounded bg-white/5 border border-white/8">
                  {w}
                </span>
              ))}
              {queue.length > 4 && (
                <span className="text-white/20 text-[10px]">+{queue.length - 4}</span>
              )}
            </>
          ) : (
            <span className="text-white/25 text-xs italic">Waiting for speech…</span>
          )}
        </div>
      </div>
    </div>
  );
}
