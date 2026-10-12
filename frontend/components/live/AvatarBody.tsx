'use client';
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';

// ── Ultra-Realistic Humanized Avatar Materials (Cached Globally to Prevent WebGL Leak) ──
let cachedMaterials: any = null;

function createAvatarMaterials() {
  const skin = (color: string, roughness = 0.42) =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      roughness: roughness,
      metalness: 0.02,
      clearcoat: 0.22,
      clearcoatRoughness: 0.28,
      reflectivity: 0.55,
      sheen: 0.35,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color('#FFB594'), // Warm subsurface tint
      envMapIntensity: 1.25,
    });

  const cloth = (color: string, roughness = 0.82) =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: roughness,
      metalness: 0.05,
      envMapIntensity: 0.75,
    });

  return {
    // Skin tones (Realistic warm human complexion)
    skin: skin('#D49A7A', 0.42),
    skinDark: skin('#BA7E62', 0.45),
    skinLt: skin('#E2A789', 0.38),
    skinShadow: skin('#A26B52', 0.48),

    // Clothing - Professional & Modern Studio Wear
    shirt: cloth('#254E7A', 0.82),          // Deep navy executive polo shirt
    shirtCollar: cloth('#1A3959', 0.78),
    shirtTrim: cloth('#3669A0', 0.75),
    shirtButton: new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.2, metalness: 0.8 }),
    pants: cloth('#1E293B', 0.88),          // Slate dark charcoal trousers
    pantsSeam: cloth('#0F172A', 0.92),
    belt: cloth('#18181B', 0.35),
    beltBuckle: new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.15, metalness: 0.92 }),
    shoe: cloth('#0F172A', 0.6),            // Premium leather sneakers
    shoeSole: cloth('#F8FAFC', 0.45),
    shoeAccent: cloth('#254E7A', 0.65),
    shoeLace: cloth('#FFFFFF', 0.4),

    // Anatomical Facial Features
    hair: new THREE.MeshStandardMaterial({ color: '#1C130E', roughness: 0.5, metalness: 0.12 }),
    hairHighlight: new THREE.MeshStandardMaterial({ color: '#2D1F17', roughness: 0.45, metalness: 0.18 }),
    sclera: new THREE.MeshStandardMaterial({ color: '#FAF8F5', roughness: 0.12, metalness: 0.02 }), // Eye white
    iris: new THREE.MeshStandardMaterial({ color: '#3B2314', roughness: 0.08, metalness: 0.25 }),    // Deep hazel brown iris
    irisRing: new THREE.MeshStandardMaterial({ color: '#1B0F07', roughness: 0.1, metalness: 0.35 }),
    pupil: new THREE.MeshStandardMaterial({ color: '#090503', roughness: 0.02 }),
    cornea: new THREE.MeshPhysicalMaterial({                                // Glassy specular cornea outer dome
      color: '#FFFFFF',
      transmission: 0.94,
      opacity: 1,
      transparent: true,
      roughness: 0.01,
      ior: 1.38,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
    }),
    lipUpper: skin('#A65B50', 0.36),
    lipLower: skin('#BA685A', 0.32),
    teeth: new THREE.MeshStandardMaterial({ color: '#FAF9F5', roughness: 0.18, metalness: 0.05 }),
    tongue: new THREE.MeshStandardMaterial({ color: '#B24552', roughness: 0.38, metalness: 0.01 }),
    oralCavity: new THREE.MeshStandardMaterial({ color: '#26060A', roughness: 0.85 }),
    brow: new THREE.MeshStandardMaterial({ color: '#120C09', roughness: 0.75 }),
    eyelash: new THREE.MeshStandardMaterial({ color: '#0A0604', roughness: 0.8 }),
    nail: skin('#E2B29F', 0.22),

    // Watch & Metallic Accessories
    watchStrap: cloth('#18181B', 0.35),
    watchCase: new THREE.MeshStandardMaterial({ color: '#CBD5E1', roughness: 0.15, metalness: 0.9 }),
    watchFace: new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.08, metalness: 0.85 }),
  };
}

export function useAvatarMaterials() {
  return useMemo(() => {
    if (!cachedMaterials) {
      cachedMaterials = createAvatarMaterials();
    }
    return cachedMaterials;
  }, []);
}

type M = ReturnType<typeof useAvatarMaterials>;

// ── Humanized Face & Head Anatomy ──
export function CartoonFace({
  mat,
  jawRef,
  mouthOpenRef,
  leftLidRef,
  rightLidRef,
}: {
  mat: M;
  jawRef: React.RefObject<THREE.Group>;
  mouthOpenRef: React.MutableRefObject<number>;
  leftLidRef?: React.RefObject<THREE.Group>;
  rightLidRef?: React.RefObject<THREE.Group>;
}) {
  return (
    <>
      {/* Eye Assemblies (Left & Right) */}
      {([-1, 1] as const).map(side => (
        <group key={`eye_${side}`} position={[side * 0.072, 0.045, 0.155]}>
          {/* Eye Socket Shadow Backdrop */}
          <mesh material={mat.skinShadow} position={[0, 0, -0.01]} scale={[1.2, 1.05, 0.5]}>
            <sphereGeometry args={[0.038, 16, 16]} />
          </mesh>

          {/* Eyeball / Sclera */}
          <mesh material={mat.sclera} scale={[1.15, 1.0, 0.7]}>
            <sphereGeometry args={[0.034, 24, 24]} />
          </mesh>

          {/* Outer Iris Ring */}
          <mesh material={mat.irisRing} position={[0, 0, 0.021]} scale={[1.05, 1.05, 0.3]}>
            <sphereGeometry args={[0.019, 20, 20]} />
          </mesh>

          {/* Inner Iris */}
          <mesh material={mat.iris} position={[0, 0, 0.0225]} scale={[1, 1, 0.28]}>
            <sphereGeometry args={[0.0175, 20, 20]} />
          </mesh>

          {/* Pupil */}
          <mesh material={mat.pupil} position={[0, 0, 0.024]} scale={[1, 1, 0.2]}>
            <sphereGeometry args={[0.009, 14, 14]} />
          </mesh>

          {/* Specular Catchlight (Eye sparkle highlight) */}
          <mesh material={mat.cornea} position={[side * -0.006, 0.008, 0.027]}>
            <sphereGeometry args={[0.0045, 8, 8]} />
          </mesh>
          <mesh material={mat.cornea} position={[side * 0.005, -0.005, 0.026]}>
            <sphereGeometry args={[0.0025, 6, 6]} />
          </mesh>

          {/* Upper Eyelid for Realistic Blinking */}
          <group ref={side === -1 ? leftLidRef : rightLidRef} position={[0, 0.012, 0.005]}>
            <mesh material={mat.skin} position={[0, 0.014, 0.012]} rotation={[0.1, 0, side * -0.05]} scale={[1.22, 0.65, 0.65]}>
              <sphereGeometry args={[0.031, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            </mesh>
            {/* Eyelashes */}
            <mesh material={mat.eyelash} position={[0, 0.002, 0.024]} rotation={[0.2, 0, side * -0.08]}>
              <boxGeometry args={[0.062, 0.004, 0.008]} />
            </mesh>
          </group>

          {/* Eyebrow with Natural Arch */}
          <group position={[0, 0.052, 0.014]} rotation={[0.05, side * 0.05, side * -0.08]}>
            <mesh material={mat.brow}>
              <capsuleGeometry args={[0.0065, 0.056, 4, 8]} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Nose Structure (Nasal Bridge, Septum & Nostrils) */}
      <group position={[0, -0.005, 0.175]}>
        {/* Nasal Bridge */}
        <mesh material={mat.skinLt} position={[0, 0.012, 0.01]} rotation={[-0.2, 0, 0]}>
          <capsuleGeometry args={[0.0065, 0.038, 4, 8]} />
        </mesh>
        {/* Nose Tip */}
        <mesh material={mat.skinLt} position={[0, -0.022, 0.022]} scale={[1.0, 0.85, 0.85]}>
          <sphereGeometry args={[0.013, 16, 16]} />
        </mesh>
        {/* Nostril Wings */}
        {([-1, 1] as const).map(s => (
          <mesh key={`nostril_${s}`} material={mat.skin} position={[s * 0.012, -0.026, 0.016]} scale={[0.6, 0.5, 0.5]}>
            <sphereGeometry args={[0.01, 10, 10]} />
          </mesh>
        ))}
      </group>

      {/* Anatomical Cheekbones (Zygomatic Arch) */}
      {([-1, 1] as const).map(s => (
        <mesh key={`cheek_${s}`} material={mat.skinLt} position={[s * 0.095, -0.02, 0.145]} scale={[0.75, 0.6, 0.55]}>
          <sphereGeometry args={[0.034, 12, 12]} />
        </mesh>
      ))}

      {/* Mouth & Jaw Hinge Assembly */}
      <group ref={jawRef} position={[0, -0.075, 0.155]}>
        {/* Oral Cavity Interior */}
        <mesh material={mat.oralCavity} position={[0, -0.005, 0.012]} scale={[0.65, 0.4, 0.4]}>
          <sphereGeometry args={[0.032, 12, 12]} />
        </mesh>

        {/* Upper Teeth Row */}
        <mesh material={mat.teeth} position={[0, 0.004, 0.024]} scale={[0.8, 0.3, 0.35]}>
          <boxGeometry args={[0.042, 0.009, 0.009]} />
        </mesh>

        {/* Lower Teeth Row */}
        <mesh material={mat.teeth} position={[0, -0.012, 0.022]} scale={[0.75, 0.3, 0.35]}>
          <boxGeometry args={[0.038, 0.008, 0.008]} />
        </mesh>

        {/* Tongue */}
        <mesh material={mat.tongue} position={[0, -0.014, 0.015]} scale={[0.65, 0.35, 0.5]}>
          <sphereGeometry args={[0.018, 10, 10]} />
        </mesh>

        {/* Upper Lip (Horizontal Cupid's Bow) */}
        <group position={[0, 0.004, 0.028]}>
          <mesh material={mat.lipUpper} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.0055, 0.044, 4, 10]} />
          </mesh>
        </group>

        {/* Lower Lip (Horizontal Fuller Natural Curve) */}
        <group position={[0, -0.012, 0.027]}>
          <mesh material={mat.lipLower} rotation={[0, 0, Math.PI / 2]} scale={[1.0, 1.1, 1.0]}>
            <capsuleGeometry args={[0.0065, 0.042, 4, 10]} />
          </mesh>
        </group>

        {/* Mandible Chin Structure */}
        <mesh material={mat.skin} position={[0, -0.038, 0.018]} scale={[0.68, 0.55, 0.58]}>
          <sphereGeometry args={[0.032, 14, 14]} />
        </mesh>
      </group>

      {/* Anatomical Ears (Left & Right with Helix & Earlobe) */}
      {([-1, 1] as const).map(s => (
        <group key={`ear_${s}`} position={[s * 0.175, 0.015, 0.02]} rotation={[0.1, s * -0.2, s * -0.08]}>
          {/* Helix / Main Outer Ear */}
          <mesh material={mat.skinLt} scale={[0.32, 0.68, 0.42]}>
            <sphereGeometry args={[0.055, 14, 14]} />
          </mesh>
          {/* Inner Concha Depression */}
          <mesh material={mat.skinShadow} position={[s * -0.008, 0.005, 0.012]} scale={[0.26, 0.52, 0.32]}>
            <sphereGeometry args={[0.04, 10, 10]} />
          </mesh>
          {/* Earlobe */}
          <mesh material={mat.skin} position={[s * -0.002, -0.035, 0.005]} scale={[0.28, 0.32, 0.28]}>
            <sphereGeometry args={[0.03, 10, 10]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ── Anatomically Articulated Hand (5 Individual Digits with Multi-Joint Articulation) ──
export function Hand({
  mat,
  side,
  fingerRefs,
  fingerPipRefs,
  thumbRefs,
}: {
  mat: M;
  side: -1 | 1;
  fingerRefs: React.RefObject<THREE.Group>[];
  fingerPipRefs?: React.RefObject<THREE.Group>[];
  thumbRefs: React.RefObject<THREE.Group>[];
}) {
  const fingerNames = ['index', 'middle', 'ring', 'pinky'];
  const fingerLengths = [0.044, 0.048, 0.044, 0.036];
  const fingerThicknesses = [0.0085, 0.009, 0.0085, 0.0075];

  return (
    <group>
      {/* Palm Base (Carpa/Metacarpals) */}
      <mesh material={mat.skin} position={[0, -0.012, 0]} scale={[1.05, 0.9, 0.52]}>
        <sphereGeometry args={[0.052, 18, 18]} />
      </mesh>

      {/* Thenar Eminence (Thumb Muscle Pad) */}
      <mesh material={mat.skinLt} position={[side * 0.022, -0.01, 0.015]} scale={[0.65, 0.8, 0.6]}>
        <sphereGeometry args={[0.032, 12, 12]} />
      </mesh>

      {/* Hypothenar Muscle Pad (Outer Palm Edge) */}
      <mesh material={mat.skinLt} position={[side * -0.025, -0.02, 0.008]} scale={[0.55, 0.75, 0.5]}>
        <sphereGeometry args={[0.028, 10, 10]} />
      </mesh>

      {/* 4 Articulated Fingers (MCP Knuckle -> Proximal -> PIP Knuckle -> Intermediate -> DIP -> Distal) */}
      {fingerNames.map((name, fi) => (
        <group key={name} ref={fingerRefs[fi]} position={[(fi - 1.5) * 0.021, -0.042, 0.01]}>
          {/* MCP Knuckle Joint */}
          <mesh material={mat.skinLt} position={[0, 0, 0]}>
            <sphereGeometry args={[fingerThicknesses[fi] * 1.15, 8, 8]} />
          </mesh>

          {/* Proximal Phalanx */}
          <mesh material={mat.skin} position={[0, -fingerLengths[fi] * 0.25, 0]} rotation={[0.08, 0, 0]}>
            <capsuleGeometry args={[fingerThicknesses[fi], fingerLengths[fi] * 0.42, 4, 8]} />
          </mesh>

          {/* PIP Joint & Secondary Finger Flex Hinge */}
          <group ref={fingerPipRefs ? fingerPipRefs[fi] : undefined} position={[0, -fingerLengths[fi] * 0.5, 0.002]}>
            <mesh material={mat.skinLt} position={[0, 0, 0]}>
              <sphereGeometry args={[fingerThicknesses[fi] * 1.05, 8, 8]} />
            </mesh>

            {/* Intermediate Phalanx */}
            <mesh material={mat.skin} position={[0, -fingerLengths[fi] * 0.18, 0]} rotation={[0.06, 0, 0]}>
              <capsuleGeometry args={[fingerThicknesses[fi] * 0.9, fingerLengths[fi] * 0.3, 4, 8]} />
            </mesh>

            {/* DIP Joint & Distal Phalanx */}
            <group position={[0, -fingerLengths[fi] * 0.36, 0.002]}>
              <mesh material={mat.skin} position={[0, -fingerLengths[fi] * 0.12, 0]}>
                <capsuleGeometry args={[fingerThicknesses[fi] * 0.8, fingerLengths[fi] * 0.2, 4, 8]} />
              </mesh>

              {/* Anatomical Fingernail */}
              <mesh material={mat.nail} position={[0, -fingerLengths[fi] * 0.18, 0.004]} scale={[0.75, 0.55, 0.3]}>
                <sphereGeometry args={[0.007, 8, 8]} />
              </mesh>
            </group>
          </group>
        </group>
      ))}

      {/* Opponens Thumb Assembly (Metacarpal Hinge + Proximal + Distal) */}
      <group ref={thumbRefs[0]} position={[side * 0.042, -0.008, 0.022]}>
        {/* Thumb Metacarpal Joint */}
        <mesh material={mat.skinLt} position={[0, 0, 0]}>
          <sphereGeometry args={[0.011, 8, 8]} />
        </mesh>
        <mesh material={mat.skin} position={[0, -0.014, 0]} rotation={[0.12, 0, side * 0.45]}>
          <capsuleGeometry args={[0.01, 0.026, 4, 8]} />
        </mesh>

        {/* Thumb IP Joint & Distal Phalanx */}
        <group ref={thumbRefs[1]} position={[side * 0.012, -0.028, 0.006]}>
          <mesh material={mat.skin} position={[0, -0.01, 0]} rotation={[0.08, 0, side * 0.25]}>
            <capsuleGeometry args={[0.009, 0.02, 4, 8]} />
          </mesh>
          {/* Thumb Fingernail */}
          <mesh material={mat.nail} position={[0, -0.02, 0.005]} scale={[0.8, 0.55, 0.32]}>
            <sphereGeometry args={[0.0075, 8, 8]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ── Anatomically Sculpted Leg & Foot Assembly ──
export function Leg({
  mat,
  side,
  upperLegRef,
  lowerLegRef,
  footRef,
}: {
  mat: M;
  side: -1 | 1;
  upperLegRef: React.RefObject<THREE.Group>;
  lowerLegRef: React.RefObject<THREE.Group>;
  footRef: React.RefObject<THREE.Group>;
}) {
  return (
    <group position={[side * 0.092, -0.2, 0]}>
      <group ref={upperLegRef}>
        {/* Femur / Thigh (Quadriceps Definition) */}
        <mesh material={mat.pants} position={[0, -0.19, 0]} scale={[1.02, 1, 1.05]}>
          <capsuleGeometry args={[0.068, 0.26, 8, 16]} />
        </mesh>

        {/* Patella (Kneecap Hinge) */}
        <mesh material={mat.pants} position={[0, -0.36, 0.012]}>
          <sphereGeometry args={[0.058, 14, 14]} />
        </mesh>

        {/* Lower Leg Assembly (Tibialis & Gastrocnemius / Calf) */}
        <group ref={lowerLegRef} position={[0, -0.36, 0]}>
          <mesh material={mat.pants} position={[0, -0.17, 0]} scale={[0.95, 1, 0.98]}>
            <capsuleGeometry args={[0.054, 0.23, 8, 16]} />
          </mesh>

          {/* Ankle Malleolus (Inner & Outer Ankle Bones) */}
          <group position={[0, -0.32, 0]}>
            {([-1, 1] as const).map(m => (
              <mesh key={`malleolus_${m}`} material={mat.skin} position={[m * 0.038, 0, 0]}>
                <sphereGeometry args={[0.015, 8, 8]} />
              </mesh>
            ))}
          </group>

          {/* Foot & Executive Sneaker */}
          <group ref={footRef} position={[0, -0.34, 0.032]}>
            {/* Sneaker Upper Body */}
            <mesh material={mat.shoe} position={[0, -0.008, 0.028]} scale={[1.0, 0.58, 1.38]}>
              <sphereGeometry args={[0.055, 14, 14]} />
            </mesh>
            {/* Rubber Outsole */}
            <mesh material={mat.shoeSole} position={[0, -0.032, 0.03]} scale={[1.06, 0.24, 1.48]}>
              <boxGeometry args={[0.094, 0.02, 0.125]} />
            </mesh>
            {/* Toe Box Cap */}
            <mesh material={mat.shoeAccent} position={[0, -0.012, 0.082]} scale={[0.85, 0.52, 0.58]}>
              <sphereGeometry args={[0.038, 10, 10]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

// ── Realistic Layered Hairstyle ──
export function AvatarHair({ mat }: { mat: M }) {
  return (
    <>
      {/* Main Top Skull Volume */}
      <mesh material={mat.hair} position={[0, 0.21, -0.01]} scale={[1.1, 1.02, 1.02]}>
        <sphereGeometry args={[0.205, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
      </mesh>

      {/* Sculpted Locks / Strands for Natural Texture */}
      {[
        [0, 0.3, 0.04, 0.09, 0],
        [-0.075, 0.28, 0.01, 0.078, -0.15],
        [0.08, 0.27, 0.02, 0.074, 0.15],
        [-0.035, 0.31, 0.05, 0.065, -0.05],
        [0.045, 0.3, -0.02, 0.07, 0.08],
        [-0.12, 0.22, 0.06, 0.06, -0.3],
        [0.125, 0.21, 0.055, 0.058, 0.3],
      ].map(([x, y, z, r, rotZ], i) => (
        <mesh key={`strand_${i}`} material={i % 2 === 0 ? mat.hair : mat.hairHighlight} position={[x, y, z]} rotation={[0, 0, rotZ]}>
          <sphereGeometry args={[r, 12, 12]} />
        </mesh>
      ))}

      {/* Sideburns & Temple Hairline */}
      {([-1, 1] as const).map(s => (
        <group key={`sideburn_${s}`} position={[s * 0.17, 0.08, 0.04]}>
          <mesh material={mat.hair} rotation={[0, 0, s * -0.15]} scale={[0.3, 0.68, 0.4]}>
            <sphereGeometry args={[0.14, 12, 12]} />
          </mesh>
        </group>
      ))}

      {/* Back Neck Hair Tapering */}
      <mesh material={mat.hair} position={[0, 0.06, -0.18]} scale={[0.92, 0.68, 0.38]}>
        <sphereGeometry args={[0.205, 16, 16]} />
      </mesh>
    </>
  );
}

// ── Realistic Wristwatch & Metallic Accessories ──
export function WristWatch({ mat }: { mat: M }) {
  return (
    <group position={[0, -0.22, 0]} rotation={[0, 0, 0]}>
      {/* Leather/Silicone Strap */}
      <mesh material={mat.watchStrap}>
        <torusGeometry args={[0.036, 0.0075, 10, 24]} />
      </mesh>
      {/* Metallic Case */}
      <mesh material={mat.watchCase} position={[0, 0, 0.004]}>
        <cylinderGeometry args={[0.026, 0.026, 0.009, 16]} />
      </mesh>
      {/* Dial Face */}
      <mesh material={mat.watchFace} position={[0, 0, 0.009]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.022, 16]} />
      </mesh>
    </group>
  );
}
