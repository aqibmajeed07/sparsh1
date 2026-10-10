/**
 * ═══════════════════════════════════════════════
 * ISL SIGN POSES — Slower, natural durations
 * ═══════════════════════════════════════════════
 * All keyframe durations multiplied ~2.5×
 * Added a natural "return to rest" at 0.6s per sign
 */

export interface BoneRotation { x: number; y: number; z: number; }
export interface PoseKeyframe { duration: number; bones: Record<string, BoneRotation>; }
export interface SignDefinition { name: string; keyframes: PoseKeyframe[]; }

const deg = (d: number) => (d * Math.PI) / 180;

// ── NEUTRAL REST POSE (used as final frame for every sign) ──
export const REST: Record<string, BoneRotation> = {
  RightArm:     { x: deg(4),  y: 0, z: deg(-8) },
  RightForeArm: { x: 0,       y: 0, z: deg(-4) },
  RightHand:    { x: 0,       y: 0, z: 0 },
  RightFingers: { x: 0,       y: 0, z: 0 },
  RightThumb:   { x: 0,       y: 0, z: 0 },
  LeftArm:      { x: deg(4),  y: 0, z: deg(8)  },
  LeftForeArm:  { x: 0,       y: 0, z: deg(4)  },
  LeftHand:     { x: 0,       y: 0, z: 0 },
  LeftFingers:  { x: 0,       y: 0, z: 0 },
  LeftThumb:    { x: 0,       y: 0, z: 0 },
  Spine:        { x: 0,       y: 0, z: 0 },
  Neck:         { x: 0,       y: 0, z: 0 },
  Head:         { x: 0,       y: 0, z: 0 },
};

export const IDLE_POSE: SignDefinition = {
  name: 'idle',
  keyframes: [
    { duration: 3.0, bones: { Spine: { x: deg(2), y: 0, z: 0 }, Neck: { x: deg(-3), y: deg(2), z: 0 }, Head: { x: deg(3), y: deg(-2), z: 0 }, LeftArm: { x: deg(4), y: 0, z: deg(8) }, RightArm: { x: deg(4), y: 0, z: deg(-8) } } },
    { duration: 3.0, bones: { Spine: { x: deg(-1), y: 0, z: 0 }, Neck: { x: deg(2), y: deg(-3), z: 0 }, Head: { x: deg(-2), y: deg(3), z: 0 }, LeftArm: { x: deg(3), y: 0, z: deg(10) }, RightArm: { x: deg(3), y: 0, z: deg(-10) } } },
  ],
};

export const SIGN_POSES: Record<string, SignDefinition> = {

  // ── HELLO / NAMASTE — both palms together, gentle bow ──
  hello: {
    name: 'hello',
    keyframes: [
      {
        duration: 0.8,
        bones: {
          RightArm:     { x: deg(-40), y: deg(-20), z: deg(-30) },
          RightForeArm: { x: deg(-60), y: deg(40),  z: 0 },
          RightHand:    { x: deg(10),  y: 0,        z: deg(10) },
          LeftArm:      { x: deg(-40), y: deg(20),  z: deg(30) },
          LeftForeArm:  { x: deg(-60), y: deg(-40), z: 0 },
          LeftHand:     { x: deg(10),  y: 0,        z: deg(-10) },
          Spine:        { x: deg(5),   y: 0,        z: 0 },
          Neck:         { x: deg(10),  y: 0,        z: 0 },
        },
      },
      {
        duration: 1.2,  // hold at peak bow
        bones: {
          RightArm:     { x: deg(-50), y: deg(-15), z: deg(-25) },
          RightForeArm: { x: deg(-70), y: deg(50),  z: 0 },
          RightHand:    { x: deg(15),  y: 0,        z: deg(15) },
          LeftArm:      { x: deg(-50), y: deg(15),  z: deg(25) },
          LeftForeArm:  { x: deg(-70), y: deg(-50), z: 0 },
          LeftHand:     { x: deg(15),  y: 0,        z: deg(-15) },
          Spine:        { x: deg(10),  y: 0,        z: 0 },
          Neck:         { x: deg(15),  y: 0,        z: 0 },
        },
      },
      { duration: 0.7, bones: REST },
    ],
  },

  // ── WELCOME — arms open wide ──
  welcome: {
    name: 'welcome',
    keyframes: [
      {
        duration: 0.8,
        bones: {
          RightArm:     { x: deg(-30), y: 0, z: deg(-45) },
          RightForeArm: { x: deg(-20), y: 0, z: 0 },
          LeftArm:      { x: deg(-30), y: 0, z: deg(45) },
          LeftForeArm:  { x: deg(-20), y: 0, z: 0 },
          Spine:        { x: deg(3),   y: 0, z: 0 },
        },
      },
      {
        duration: 1.4,  // hold open arms
        bones: {
          RightArm:     { x: deg(-60), y: 0,       z: deg(-70) },
          RightForeArm: { x: deg(-10), y: 0,       z: 0 },
          RightHand:    { x: 0,        y: deg(-20), z: 0 },
          LeftArm:      { x: deg(-60), y: 0,       z: deg(70) },
          LeftForeArm:  { x: deg(-10), y: 0,       z: 0 },
          LeftHand:     { x: 0,        y: deg(20),  z: 0 },
          Spine:        { x: deg(-3),  y: 0,       z: 0 },
          Head:         { x: deg(-5),  y: 0,       z: 0 },
        },
      },
      { duration: 0.7, bones: REST },
    ],
  },

  // ── YES — slow deliberate head nod ──
  yes: {
    name: 'yes',
    keyframes: [
      { duration: 0.5, bones: { Head: { x: deg(-18), y: 0, z: 0 }, Neck: { x: deg(-6), y: 0, z: 0 } } },
      { duration: 0.5, bones: { Head: { x: deg(12),  y: 0, z: 0 }, Neck: { x: deg(6),  y: 0, z: 0 } } },
      { duration: 0.45, bones: { Head: { x: deg(-14), y: 0, z: 0 }, Neck: { x: deg(-4), y: 0, z: 0 } } },
      { duration: 0.45, bones: { Head: { x: deg(8),   y: 0, z: 0 }, Neck: { x: deg(4),  y: 0, z: 0 } } },
      { duration: 0.5, bones: REST },
    ],
  },

  // ── NO — deliberate head shake ──
  no: {
    name: 'no',
    keyframes: [
      { duration: 0.45, bones: { Head: { x: 0, y: deg(-22), z: 0 }, Neck: { x: 0, y: deg(-6), z: 0 } } },
      { duration: 0.45, bones: { Head: { x: 0, y: deg(22),  z: 0 }, Neck: { x: 0, y: deg(6),  z: 0 } } },
      { duration: 0.40, bones: { Head: { x: 0, y: deg(-18), z: 0 }, Neck: { x: 0, y: deg(-4), z: 0 } } },
      { duration: 0.40, bones: { Head: { x: 0, y: deg(18),  z: 0 }, Neck: { x: 0, y: deg(4),  z: 0 } } },
      { duration: 0.5, bones: REST },
    ],
  },

  // ── THANK YOU — hand from chin forward ──
  thank: {
    name: 'thank',
    keyframes: [
      {
        duration: 0.9,
        bones: {
          RightArm:     { x: deg(-70), y: deg(-10), z: deg(-20) },
          RightForeArm: { x: deg(-90), y: 0,        z: 0 },
          RightHand:    { x: deg(-20), y: 0,        z: 0 },
          Head:         { x: deg(5),   y: 0,        z: 0 },
        },
      },
      {
        duration: 1.0,
        bones: {
          RightArm:     { x: deg(-50), y: deg(-10), z: deg(-30) },
          RightForeArm: { x: deg(-40), y: 0,        z: 0 },
          RightHand:    { x: deg(10),  y: 0,        z: 0 },
          Head:         { x: deg(8),   y: 0,        z: 0 },
          Spine:        { x: deg(5),   y: 0,        z: 0 },
        },
      },
      { duration: 0.7, bones: REST },
    ],
  },

  // ── YOU — index finger point ──
  you: {
    name: 'you',
    keyframes: [
      {
        duration: 0.75,
        bones: {
          RightArm:     { x: deg(-50), y: 0,       z: deg(-30) },
          RightForeArm: { x: deg(-20), y: 0,       z: 0 },
          RightHand:    { x: deg(-10), y: 0,       z: 0 },
        },
      },
      {
        duration: 1.2,  // hold point
        bones: {
          RightArm:     { x: deg(-60), y: 0,       z: deg(-20) },
          RightForeArm: { x: deg(-10), y: 0,       z: 0 },
          RightHand:    { x: deg(-5),  y: 0,       z: 0 },
        },
      },
      { duration: 0.65, bones: REST },
    ],
  },

  // ── BOOK — palms open like a book ──
  book: {
    name: 'book',
    keyframes: [
      {
        duration: 0.9,
        bones: {
          RightArm:     { x: deg(-30), y: deg(-15), z: deg(-20) },
          RightForeArm: { x: deg(-70), y: deg(20),  z: 0 },
          RightHand:    { x: 0,        y: deg(-40), z: 0 },
          LeftArm:      { x: deg(-30), y: deg(15),  z: deg(20) },
          LeftForeArm:  { x: deg(-70), y: deg(-20), z: 0 },
          LeftHand:     { x: 0,        y: deg(40),  z: 0 },
        },
      },
      {
        duration: 1.3,  // hold book open
        bones: {
          RightArm:     { x: deg(-30), y: deg(-15), z: deg(-35) },
          RightForeArm: { x: deg(-70), y: deg(20),  z: 0 },
          RightHand:    { x: deg(10),  y: deg(-60), z: 0 },
          LeftArm:      { x: deg(-30), y: deg(15),  z: deg(35) },
          LeftForeArm:  { x: deg(-70), y: deg(-20), z: 0 },
          LeftHand:     { x: deg(10),  y: deg(60),  z: 0 },
          Head:         { x: deg(10),  y: 0,        z: 0 },
        },
      },
      { duration: 0.65, bones: REST },
    ],
  },

  // ── STUDENT ──
  student: {
    name: 'student',
    keyframes: [
      {
        duration: 0.9,
        bones: {
          RightArm:     { x: deg(-90), y: 0,        z: deg(-30) },
          RightForeArm: { x: deg(-90), y: 0,        z: 0 },
          RightHand:    { x: deg(-10), y: 0,        z: 0 },
          Head:         { x: deg(5),   y: deg(10),  z: 0 },
        },
      },
      {
        duration: 1.1,
        bones: {
          RightArm:     { x: deg(-70), y: deg(-10), z: deg(-20) },
          RightForeArm: { x: deg(-50), y: 0,        z: 0 },
          RightHand:    { x: 0,        y: 0,        z: 0 },
          LeftArm:      { x: deg(-30), y: 0,        z: deg(20) },
          LeftForeArm:  { x: deg(-40), y: 0,        z: 0 },
          Head:         { x: deg(8),   y: 0,        z: 0 },
        },
      },
      { duration: 0.65, bones: REST },
    ],
  },

  // ── TEACHER ──
  teacher: {
    name: 'teacher',
    keyframes: [
      {
        duration: 0.85,
        bones: {
          RightArm:     { x: deg(-60), y: 0,       z: deg(-20) },
          RightForeArm: { x: deg(-30), y: 0,       z: 0 },
          RightHand:    { x: deg(-15), y: 0,       z: 0 },
          Head:         { x: deg(-5),  y: deg(-5), z: 0 },
        },
      },
      {
        duration: 1.0,
        bones: {
          RightArm:     { x: deg(-50), y: deg(10), z: deg(-30) },
          RightForeArm: { x: deg(-20), y: deg(10), z: 0 },
          LeftArm:      { x: deg(-60), y: 0,       z: deg(20) },
          LeftForeArm:  { x: deg(-30), y: 0,       z: 0 },
          Head:         { x: deg(-3),  y: deg(5),  z: 0 },
        },
      },
      { duration: 0.65, bones: REST },
    ],
  },

  // ── PLEASE — palm circles on chest ──
  please: {
    name: 'please',
    keyframes: [
      {
        duration: 0.75,
        bones: {
          RightArm:     { x: deg(-30), y: deg(-20), z: deg(-15) },
          RightForeArm: { x: deg(-80), y: deg(10),  z: 0 },
          RightHand:    { x: deg(5),   y: 0,        z: deg(10) },
          Spine:        { x: deg(3),   y: 0,        z: 0 },
        },
      },
      {
        duration: 0.75,
        bones: {
          RightArm:     { x: deg(-35), y: deg(-15), z: deg(-20) },
          RightForeArm: { x: deg(-75), y: deg(15),  z: 0 },
          RightHand:    { x: deg(5),   y: 0,        z: deg(-10) },
          Spine:        { x: deg(5),   y: 0,        z: 0 },
        },
      },
      {
        duration: 0.70,
        bones: {
          RightArm:     { x: deg(-30), y: deg(-20), z: deg(-15) },
          RightForeArm: { x: deg(-80), y: deg(10),  z: 0 },
          RightHand:    { x: deg(5),   y: 0,        z: deg(10) },
        },
      },
      { duration: 0.65, bones: REST },
    ],
  },

  // ── QUESTION ──
  question: {
    name: 'question',
    keyframes: [
      {
        duration: 0.7,
        bones: {
          RightArm:     { x: deg(-80), y: 0,       z: deg(-20) },
          RightForeArm: { x: deg(-60), y: 0,       z: 0 },
          RightHand:    { x: deg(-15), y: deg(-10), z: 0 },
          Head:         { x: 0,        y: 0,       z: deg(5) },
        },
      },
      {
        duration: 0.7,
        bones: {
          RightArm:     { x: deg(-85), y: deg(10), z: deg(-15) },
          RightForeArm: { x: deg(-50), y: deg(15), z: 0 },
          RightHand:    { x: deg(-10), y: deg(10), z: 0 },
          Head:         { x: 0,        y: 0,       z: deg(-5) },
        },
      },
      {
        duration: 0.7,
        bones: {
          RightArm:     { x: deg(-70), y: deg(-5), z: deg(-25) },
          RightForeArm: { x: deg(-70), y: deg(5),  z: 0 },
          RightHand:    { x: deg(-5),  y: 0,       z: 0 },
          Head:         { x: deg(3),   y: 0,       z: 0 },
        },
      },
      { duration: 0.65, bones: REST },
    ],
  },

  // ── ANSWER ──
  answer: {
    name: 'answer',
    keyframes: [
      {
        duration: 0.9,
        bones: {
          RightArm:     { x: deg(-60), y: deg(-10), z: deg(-15) },
          RightForeArm: { x: deg(-80), y: deg(10),  z: 0 },
          LeftArm:      { x: deg(-60), y: deg(10),  z: deg(15) },
          LeftForeArm:  { x: deg(-80), y: deg(-10), z: 0 },
          Head:         { x: deg(5),   y: 0,        z: 0 },
        },
      },
      {
        duration: 1.0,
        bones: {
          RightArm:     { x: deg(-50), y: deg(-5), z: deg(-25) },
          RightForeArm: { x: deg(-40), y: 0,       z: 0 },
          LeftArm:      { x: deg(-50), y: deg(5),  z: deg(25) },
          LeftForeArm:  { x: deg(-40), y: 0,       z: 0 },
          Head:         { x: deg(-3),  y: 0,       z: 0 },
        },
      },
      { duration: 0.65, bones: REST },
    ],
  },

  // ── UNDERSTAND — fist at forehead → open ──
  understand: {
    name: 'understand',
    keyframes: [
      {
        duration: 0.9,
        bones: {
          RightArm:     { x: deg(-90), y: deg(-10), z: deg(-15) },
          RightForeArm: { x: deg(-100), y: 0,       z: 0 },
          RightHand:    { x: deg(-20),  y: 0,       z: 0 },
          Head:         { x: deg(5),    y: 0,       z: 0 },
        },
      },
      {
        duration: 1.0,
        bones: {
          RightArm:     { x: deg(-80), y: deg(-5),  z: deg(-25) },
          RightForeArm: { x: deg(-70), y: deg(10),  z: 0 },
          RightHand:    { x: deg(10),  y: deg(-20), z: 0 },
          Head:         { x: deg(-5),  y: 0,        z: 0 },
        },
      },
      { duration: 0.65, bones: REST },
    ],
  },

  // ── ATTENTION — wave near face ──
  attention: {
    name: 'attention',
    keyframes: [
      { duration: 0.60, bones: { RightArm: { x: deg(-80), y: 0, z: deg(-25) }, RightForeArm: { x: deg(-80), y: deg(-15), z: 0 }, RightHand: { x: 0, y: deg(-20), z: 0 } } },
      { duration: 0.55, bones: { RightArm: { x: deg(-80), y: 0, z: deg(-25) }, RightForeArm: { x: deg(-80), y: deg(15),  z: 0 }, RightHand: { x: 0, y: deg(20),  z: 0 } } },
      { duration: 0.55, bones: { RightArm: { x: deg(-80), y: 0, z: deg(-25) }, RightForeArm: { x: deg(-80), y: deg(-15), z: 0 }, RightHand: { x: 0, y: deg(-20), z: 0 } } },
      { duration: 0.65, bones: REST },
    ],
  },

  // ── CLASS ──
  class: {
    name: 'class',
    keyframes: [
      {
        duration: 0.9,
        bones: {
          RightArm:     { x: deg(-50), y: 0, z: deg(-35) },
          RightForeArm: { x: deg(-40), y: deg(15), z: 0 },
          LeftArm:      { x: deg(-50), y: 0, z: deg(35) },
          LeftForeArm:  { x: deg(-40), y: deg(-15), z: 0 },
        },
      },
      {
        duration: 1.2,
        bones: {
          RightArm:     { x: deg(-40), y: 0, z: deg(-55) },
          RightForeArm: { x: deg(-20), y: deg(10), z: 0 },
          LeftArm:      { x: deg(-40), y: 0, z: deg(55) },
          LeftForeArm:  { x: deg(-20), y: deg(-10), z: 0 },
          Spine:        { x: deg(-3),  y: 0, z: 0 },
        },
      },
      { duration: 0.65, bones: REST },
    ],
  },

  // ── OPEN ──
  open: {
    name: 'open',
    keyframes: [
      {
        duration: 0.9,
        bones: {
          RightArm:     { x: deg(-40), y: 0, z: deg(-25) },
          RightForeArm: { x: deg(-50), y: deg(10),  z: 0 },
          RightHand:    { x: deg(30),  y: 0,        z: 0 },
          LeftArm:      { x: deg(-40), y: 0, z: deg(25) },
          LeftForeArm:  { x: deg(-50), y: deg(-10), z: 0 },
          LeftHand:     { x: deg(30),  y: 0,        z: 0 },
        },
      },
      {
        duration: 1.2,
        bones: {
          RightArm:     { x: deg(-45), y: 0, z: deg(-35) },
          RightForeArm: { x: deg(-50), y: deg(10),  z: 0 },
          RightHand:    { x: deg(-30), y: deg(-30), z: 0 },
          LeftArm:      { x: deg(-45), y: 0, z: deg(35) },
          LeftForeArm:  { x: deg(-50), y: deg(-10), z: 0 },
          LeftHand:     { x: deg(-30), y: deg(30),  z: 0 },
        },
      },
      { duration: 0.65, bones: REST },
    ],
  },

  water:   { name: 'water',   keyframes: [{ duration: 0.7, bones: { RightArm: { x: deg(-60), y: deg(-10), z: deg(-20) }, RightForeArm: { x: deg(-80), y: 0, z: 0 }, RightHand: { x: deg(20), y: 0, z: 0 } } }, { duration: 0.9, bones: { RightArm: { x: deg(-90), y: deg(-10), z: deg(-15) }, RightForeArm: { x: deg(-100), y: 0, z: 0 }, Head: { x: deg(10), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
  eat:     { name: 'eat',     keyframes: [{ duration: 0.6, bones: { RightArm: { x: deg(-80), y: 0, z: deg(-15) }, RightForeArm: { x: deg(-100), y: 0, z: 0 } } }, { duration: 0.6, bones: { RightArm: { x: deg(-70), y: 0, z: deg(-15) }, RightForeArm: { x: deg(-90), y: 0, z: 0 }, Head: { x: deg(10), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
  food:    { name: 'food',    keyframes: [{ duration: 0.6, bones: { RightArm: { x: deg(-80), y: 0, z: deg(-15) }, RightForeArm: { x: deg(-100), y: 0, z: 0 } } }, { duration: 0.6, bones: { RightArm: { x: deg(-70), y: 0, z: deg(-15) }, RightForeArm: { x: deg(-90), y: 0, z: 0 }, Head: { x: deg(8), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
  learn:   { name: 'learn',   keyframes: [{ duration: 0.8, bones: { RightArm: { x: deg(-90), y: 0, z: deg(-15) }, RightForeArm: { x: deg(-110), y: 0, z: 0 }, RightHand: { x: deg(-20), y: 0, z: 0 } } }, { duration: 0.9, bones: { RightArm: { x: deg(-60), y: 0, z: deg(-25) }, RightForeArm: { x: deg(-40), y: 0, z: 0 }, RightHand: { x: deg(10), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
  science: { name: 'science', keyframes: [{ duration: 0.8, bones: { RightArm: { x: deg(-60), y: deg(-10), z: deg(-20) }, RightForeArm: { x: deg(-60), y: deg(20), z: 0 }, LeftArm: { x: deg(-60), y: deg(10), z: deg(20) }, LeftForeArm: { x: deg(-60), y: deg(-20), z: 0 } } }, { duration: 0.8, bones: { RightArm: { x: deg(-60), y: deg(10), z: deg(-20) }, RightForeArm: { x: deg(-60), y: deg(-20), z: 0 }, LeftArm: { x: deg(-60), y: deg(-10), z: deg(20) }, LeftForeArm: { x: deg(-60), y: deg(20), z: 0 } } }, { duration: 0.5, bones: REST }] },
  math:    { name: 'math',    keyframes: [{ duration: 0.7, bones: { RightArm: { x: deg(-50), y: 0, z: deg(-25) }, RightForeArm: { x: deg(-30), y: 0, z: 0 } } }, { duration: 0.9, bones: { RightArm: { x: deg(-60), y: 0, z: deg(-20) }, RightForeArm: { x: deg(-20), y: deg(20), z: 0 } } }, { duration: 0.5, bones: REST }] },
  school:  { name: 'school',  keyframes: [{ duration: 0.7, bones: { RightArm: { x: deg(-40), y: deg(-10), z: deg(-20) }, RightForeArm: { x: deg(-60), y: deg(10), z: 0 }, LeftArm: { x: deg(-40), y: deg(10), z: deg(20) }, LeftForeArm: { x: deg(-60), y: deg(-10), z: 0 } } }, { duration: 0.9, bones: { RightArm: { x: deg(-50), y: 0, z: deg(-25) }, RightForeArm: { x: deg(-70), y: 0, z: 0 }, LeftArm: { x: deg(-50), y: 0, z: deg(25) }, LeftForeArm: { x: deg(-70), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
  good:    { name: 'good',    keyframes: [{ duration: 0.6, bones: { RightArm: { x: deg(-50), y: 0, z: deg(-20) }, RightForeArm: { x: deg(-30), y: 0, z: 0 } } }, { duration: 1.0, bones: { RightArm: { x: deg(-60), y: 0, z: deg(-25) }, RightForeArm: { x: deg(-20), y: 0, z: 0 }, Head: { x: deg(-5), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
  bad:     { name: 'bad',     keyframes: [{ duration: 0.7, bones: { RightArm: { x: deg(-30), y: 0, z: deg(-30) }, RightForeArm: { x: deg(10), y: 0, z: 0 }, Head: { x: deg(5), y: 0, z: 0 } } }, { duration: 0.8, bones: { RightArm: { x: deg(-20), y: 0, z: deg(-35) }, RightForeArm: { x: deg(20), y: 0, z: 0 }, Head: { x: deg(8), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
  come:    { name: 'come',    keyframes: [{ duration: 0.7, bones: { RightArm: { x: deg(-60), y: 0, z: deg(-30) }, RightForeArm: { x: deg(-20), y: 0, z: 0 }, RightHand: { x: 0, y: deg(-30), z: 0 } } }, { duration: 0.8, bones: { RightArm: { x: deg(-60), y: 0, z: deg(-20) }, RightForeArm: { x: deg(-30), y: 0, z: 0 }, RightHand: { x: 0, y: deg(20), z: 0 } } }, { duration: 0.5, bones: REST }] },
  go:      { name: 'go',      keyframes: [{ duration: 0.6, bones: { RightArm: { x: deg(-40), y: deg(20), z: deg(-20) }, RightForeArm: { x: deg(-10), y: deg(20), z: 0 } } }, { duration: 0.9, bones: { RightArm: { x: deg(-35), y: deg(30), z: deg(-15) }, Head: { x: 0, y: deg(10), z: 0 } } }, { duration: 0.5, bones: REST }] },
  help:    { name: 'help',    keyframes: [{ duration: 0.8, bones: { RightArm: { x: deg(-40), y: deg(-10), z: deg(-20) }, RightForeArm: { x: deg(-50), y: 0, z: 0 }, LeftArm: { x: deg(-30), y: deg(10), z: deg(20) }, LeftForeArm: { x: deg(-40), y: 0, z: 0 } } }, { duration: 0.9, bones: { RightArm: { x: deg(-50), y: 0, z: deg(-25) }, RightForeArm: { x: deg(-60), y: 0, z: 0 }, LeftArm: { x: deg(-50), y: 0, z: deg(25) }, LeftForeArm: { x: deg(-60), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
  stop:    { name: 'stop',    keyframes: [{ duration: 0.5, bones: { RightArm: { x: deg(-50), y: deg(-10), z: deg(-20) }, RightForeArm: { x: deg(-30), y: 0, z: 0 }, RightHand: { x: deg(-30), y: 0, z: 0 } } }, { duration: 0.9, bones: { RightArm: { x: deg(-55), y: 0, z: deg(-25) }, RightForeArm: { x: deg(-20), y: 0, z: 0 }, RightHand: { x: deg(-40), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
  love:    { name: 'love',    keyframes: [{ duration: 0.8, bones: { RightArm: { x: deg(-30), y: deg(20), z: deg(-30) }, RightForeArm: { x: deg(-70), y: 0, z: 0 }, LeftArm: { x: deg(-30), y: deg(-20), z: deg(30) }, LeftForeArm: { x: deg(-70), y: 0, z: 0 } } }, { duration: 1.0, bones: { RightArm: { x: deg(-25), y: deg(25), z: deg(-25) }, RightForeArm: { x: deg(-75), y: 0, z: 0 }, LeftArm: { x: deg(-25), y: deg(-25), z: deg(25) }, LeftForeArm: { x: deg(-75), y: 0, z: 0 } } }, { duration: 0.6, bones: REST }] },
  think:   { name: 'think',   keyframes: [{ duration: 0.8, bones: { RightArm: { x: deg(-90), y: deg(-15), z: deg(-20) }, RightForeArm: { x: deg(-100), y: 0, z: 0 }, Head: { x: deg(3), y: deg(-5), z: 0 } } }, { duration: 0.9, bones: { RightArm: { x: deg(-95), y: deg(-10), z: deg(-15) }, RightForeArm: { x: deg(-95), y: 0, z: 0 }, Head: { x: deg(5), y: deg(-5), z: 0 } } }, { duration: 0.5, bones: REST }] },
  hear:    { name: 'hear',    keyframes: [{ duration: 0.8, bones: { RightArm: { x: deg(-80), y: deg(-25), z: deg(-15) }, RightForeArm: { x: deg(-90), y: deg(10), z: 0 }, Head: { x: 0, y: deg(10), z: 0 } } }, { duration: 0.9, bones: { RightArm: { x: deg(-85), y: deg(-20), z: deg(-10) }, RightForeArm: { x: deg(-85), y: deg(15), z: 0 } } }, { duration: 0.5, bones: REST }] },
  see:     { name: 'see',     keyframes: [{ duration: 0.7, bones: { RightArm: { x: deg(-90), y: deg(-10), z: deg(-15) }, RightForeArm: { x: deg(-80), y: 0, z: 0 } } }, { duration: 0.9, bones: { RightArm: { x: deg(-60), y: deg(20), z: deg(-20) }, RightForeArm: { x: deg(-30), y: deg(15), z: 0 }, Head: { x: 0, y: deg(10), z: 0 } } }, { duration: 0.5, bones: REST }] },
  work:    { name: 'work',    keyframes: [{ duration: 0.6, bones: { RightArm: { x: deg(-50), y: deg(-10), z: deg(-20) }, RightForeArm: { x: deg(-60), y: 0, z: 0 }, LeftArm: { x: deg(-40), y: deg(10), z: deg(20) }, LeftForeArm: { x: deg(-50), y: 0, z: 0 } } }, { duration: 0.6, bones: { RightArm: { x: deg(-40), y: deg(-10), z: deg(-20) }, RightForeArm: { x: deg(-50), y: 0, z: 0 }, LeftArm: { x: deg(-50), y: deg(10), z: deg(20) }, LeftForeArm: { x: deg(-60), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
  happy:   { name: 'happy',   keyframes: [{ duration: 0.7, bones: { RightArm: { x: deg(-30), y: deg(-10), z: deg(-15) }, RightForeArm: { x: deg(-70), y: 0, z: 0 }, LeftArm: { x: deg(-30), y: deg(10), z: deg(15) }, LeftForeArm: { x: deg(-70), y: 0, z: 0 }, Head: { x: deg(-5), y: 0, z: 0 } } }, { duration: 0.8, bones: { RightArm: { x: deg(-50), y: 0, z: deg(-25) }, RightForeArm: { x: deg(-60), y: 0, z: 0 }, LeftArm: { x: deg(-50), y: 0, z: deg(25) }, LeftForeArm: { x: deg(-60), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
  sorry:   { name: 'sorry',   keyframes: [{ duration: 0.7, bones: { RightArm: { x: deg(-25), y: deg(-15), z: deg(-15) }, RightForeArm: { x: deg(-80), y: deg(10), z: 0 }, Spine: { x: deg(3), y: 0, z: 0 } } }, { duration: 0.7, bones: { RightArm: { x: deg(-30), y: deg(-10), z: deg(-20) }, RightForeArm: { x: deg(-75), y: deg(-10), z: 0 }, Head: { x: deg(5), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
  write:   { name: 'write',   keyframes: [{ duration: 0.7, bones: { RightArm: { x: deg(-30), y: deg(-20), z: deg(-15) }, RightForeArm: { x: deg(-60), y: deg(10), z: 0 }, Head: { x: deg(10), y: 0, z: 0 } } }, { duration: 0.9, bones: { RightArm: { x: deg(-30), y: deg(-25), z: deg(-20) }, RightForeArm: { x: deg(-65), y: deg(15), z: 0 }, Head: { x: deg(10), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
  read:    { name: 'read',    keyframes: [{ duration: 0.8, bones: { RightArm: { x: deg(-30), y: deg(-10), z: deg(-15) }, RightForeArm: { x: deg(-60), y: deg(10), z: 0 }, LeftArm: { x: deg(-30), y: deg(10), z: deg(15) }, LeftForeArm: { x: deg(-60), y: deg(-10), z: 0 }, Head: { x: deg(12), y: 0, z: 0 } } }, { duration: 0.9, bones: { RightArm: { x: deg(-35), y: deg(-5), z: deg(-20) }, RightForeArm: { x: deg(-55), y: deg(5), z: 0 }, LeftArm: { x: deg(-35), y: deg(5), z: deg(20) }, LeftForeArm: { x: deg(-55), y: deg(-5), z: 0 } } }, { duration: 0.5, bones: REST }] },
  family:  { name: 'family',  keyframes: [{ duration: 0.8, bones: { RightArm: { x: deg(-40), y: deg(-15), z: deg(-30) }, RightForeArm: { x: deg(-20), y: 0, z: 0 }, LeftArm: { x: deg(-40), y: deg(15), z: deg(30) }, LeftForeArm: { x: deg(-20), y: 0, z: 0 } } }, { duration: 1.0, bones: { RightArm: { x: deg(-45), y: deg(5), z: deg(-35) }, LeftArm: { x: deg(-45), y: deg(-5), z: deg(35) }, Head: { x: deg(-3), y: 0, z: 0 } } }, { duration: 0.6, bones: REST }] },
  more:    { name: 'more',    keyframes: [{ duration: 0.7, bones: { RightArm: { x: deg(-40), y: deg(-15), z: deg(-20) }, RightForeArm: { x: deg(-50), y: deg(10), z: 0 }, LeftArm: { x: deg(-40), y: deg(15), z: deg(20) }, LeftForeArm: { x: deg(-50), y: deg(-10), z: 0 } } }, { duration: 0.8, bones: { RightArm: { x: deg(-45), y: deg(-5), z: deg(-25) }, RightForeArm: { x: deg(-55), y: 0, z: 0 }, LeftArm: { x: deg(-45), y: deg(5), z: deg(25) }, LeftForeArm: { x: deg(-55), y: 0, z: 0 } } }, { duration: 0.5, bones: REST }] },
};

// A-Z FINGERSPELLING
const LA: Record<string, [number, number, number]> = {
  a:[-70,-90,-15], b:[-80,-100,20], c:[-65,-80,0],  d:[-75,-95,10],
  e:[-70,-85,-20], f:[-60,-70,15], g:[-55,-40,-20], h:[-55,-30,5],
  i:[-80,-90,30],  j:[-80,-90,30], k:[-75,-80,0],   l:[-60,-30,-25],
  m:[-70,-90,-10], n:[-70,-90,-5], o:[-65,-75,0],   p:[-55,-30,-30],
  q:[-55,-35,-30], r:[-75,-85,5],  s:[-70,-90,-20], t:[-70,-90,-10],
  u:[-80,-95,10],  v:[-80,-90,15], w:[-75,-85,20],  x:[-70,-75,-15],
  y:[-65,-70,25],  z:[-60,-50,-20],
};
export const LETTER_POSES: Record<string, SignDefinition> = {};
for (const [letter, [ra, rfa, rh]] of Object.entries(LA)) {
  LETTER_POSES[letter] = {
    name: letter,
    keyframes: [
      { duration: 0.28, bones: { RightArm: { x: deg(ra), y: deg(-10), z: deg(-18) }, RightForeArm: { x: deg(rfa), y: 0, z: 0 }, RightHand: { x: deg(rh), y: 0, z: 0 } } },
      { duration: 0.18, bones: REST },
    ],
  };
}

export const ALL_SIGN_NAMES = Object.keys(SIGN_POSES);
