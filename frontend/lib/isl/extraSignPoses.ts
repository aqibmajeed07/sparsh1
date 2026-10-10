import type { SignDefinition, BoneRotation } from './signPoses';
const deg = (d: number) => (d * Math.PI) / 180;
const REST: Record<string, BoneRotation> = {
  RightArm:{x:deg(4),y:0,z:deg(-8)}, RightForeArm:{x:0,y:0,z:deg(-4)}, RightHand:{x:0,y:0,z:0},
  LeftArm:{x:deg(4),y:0,z:deg(8)},   LeftForeArm:{x:0,y:0,z:deg(4)},   LeftHand:{x:0,y:0,z:0},
  Spine:{x:0,y:0,z:0}, Neck:{x:0,y:0,z:0}, Head:{x:0,y:0,z:0},
};
const kf2 = (ra:number,rfa:number,rh:number,la?:number,lfa?:number,h?:number): SignDefinition['keyframes'] => [
  { duration: 0.55, bones: {
    RightArm:{x:deg(ra),y:deg(-10),z:deg(-18)}, RightForeArm:{x:deg(rfa),y:0,z:0}, RightHand:{x:deg(rh),y:0,z:0},
    ...(la  !== undefined ? {LeftArm:{x:deg(la),y:deg(10),z:deg(18)}}  : {}),
    ...(lfa !== undefined ? {LeftForeArm:{x:deg(lfa),y:0,z:0}} : {}),
    ...(h   !== undefined ? {Head:{x:deg(h),y:0,z:0}} : {}),
  }},
  { duration: 0.3, bones: REST },
];

export const EXTRA_SIGN_POSES: Record<string, SignDefinition> = {
  // ── Niral dataset gesture classes ────────────────────────────────────
  palm:        { name:'palm',        keyframes: kf2(-40,-20, 30,-40,-20) },
  fist:        { name:'fist',        keyframes: kf2(-60,-80,-20) },
  'fist moved':{ name:'fist moved',  keyframes: [{ duration:0.4, bones:{RightArm:{x:deg(-60),y:deg(-20),z:deg(-20)},RightForeArm:{x:deg(-80),y:0,z:0}}},{duration:0.4,bones:{RightArm:{x:deg(-60),y:deg(20),z:deg(-20)},RightForeArm:{x:deg(-80),y:0,z:0}}},{duration:0.3,bones:REST}]},
  thumb:       { name:'thumb',       keyframes: [{ duration:0.6, bones:{RightArm:{x:deg(-50),y:0,z:deg(-25)},RightForeArm:{x:deg(-20),y:0,z:0},RightHand:{x:0,y:deg(-20),z:0}}},{duration:0.8,bones:{RightArm:{x:deg(-60),y:0,z:deg(-30)},RightForeArm:{x:deg(-15),y:0,z:0},Head:{x:deg(-5),y:0,z:0}}},{duration:0.3,bones:REST}]},
  index:       { name:'index',       keyframes: kf2(-70,-50,-10) },
  ok:          { name:'ok',          keyframes: [{ duration:0.6, bones:{RightArm:{x:deg(-50),y:0,z:deg(-20)},RightForeArm:{x:deg(-30),y:0,z:0},RightHand:{x:0,y:0,z:0}}},{duration:0.9,bones:{RightArm:{x:deg(-55),y:0,z:deg(-25)},RightForeArm:{x:deg(-25),y:0,z:0},Head:{x:deg(-4),y:0,z:0}}},{duration:0.3,bones:REST}]},
  'palm moved':{ name:'palm moved',  keyframes: [{ duration:0.4, bones:{RightArm:{x:deg(-40),y:deg(-20),z:deg(-20)},RightForeArm:{x:deg(-20),y:0,z:0}}},{duration:0.4,bones:{RightArm:{x:deg(-40),y:deg(20),z:deg(-20)},RightForeArm:{x:deg(-20),y:0,z:0}}},{duration:0.3,bones:REST}]},
  down:        { name:'down',        keyframes: kf2(-20, 30, 15, undefined, undefined, 8) },
  rock:        { name:'rock',        keyframes: kf2(-60,-80,-25) },
  paper:       { name:'paper',       keyframes: kf2(-40,-20, 30,-40,-20) },
  scissors:    { name:'scissors',    keyframes: kf2(-70,-60, 15) },
  space:       { name:'space',       keyframes: [{ duration:0.3,bones:{RightArm:{x:deg(-50),y:deg(20),z:deg(-20)},RightForeArm:{x:deg(-30),y:0,z:0}}},{duration:0.3,bones:REST}]},
  del:         { name:'del',         keyframes: [{ duration:0.4,bones:{RightArm:{x:deg(-60),y:deg(-10),z:deg(-20)},RightForeArm:{x:deg(-40),y:deg(-20),z:0}}},{duration:0.3,bones:REST}]},
  nothing:     { name:'nothing',     keyframes: [{ duration:0.5,bones:{Spine:{x:0,y:0,z:0},Head:{x:deg(2),y:0,z:0}}},{duration:0.3,bones:REST}]},

  // ── Numbers 1-9 (ISL hand count signs) ─────────────────────────────
  '1': { name:'1', keyframes: kf2(-70,-50,-10) },
  '2': { name:'2', keyframes: kf2(-75,-60, 15) },
  '3': { name:'3', keyframes: kf2(-70,-55, 20) },
  '4': { name:'4', keyframes: kf2(-65,-50, 25) },
  '5': { name:'5', keyframes: kf2(-50,-30, 30,-50,-30) },
  '6': { name:'6', keyframes: kf2(-60,-45, 25) },
  '7': { name:'7', keyframes: kf2(-65,-50, 20) },
  '8': { name:'8', keyframes: kf2(-70,-55, 15) },
  '9': { name:'9', keyframes: kf2(-75,-70,-15) },

  // ── Common vocabulary ────────────────────────────────────────────────
  water:    { name:'water',   keyframes:[{ duration:0.7,bones:{RightArm:{x:deg(-60),y:deg(-10),z:deg(-20)},RightForeArm:{x:deg(-80),y:0,z:0},RightHand:{x:deg(20),y:0,z:0}}},{duration:0.9,bones:{RightArm:{x:deg(-90),y:deg(-10),z:deg(-15)},RightForeArm:{x:deg(-100),y:0,z:0},Head:{x:deg(10),y:0,z:0}}},{duration:0.5,bones:REST}]},
  eat:      { name:'eat',     keyframes:[{ duration:0.6,bones:{RightArm:{x:deg(-80),y:0,z:deg(-15)},RightForeArm:{x:deg(-100),y:0,z:0}}},{duration:0.6,bones:{RightArm:{x:deg(-70),y:0,z:deg(-15)},RightForeArm:{x:deg(-90),y:0,z:0},Head:{x:deg(10),y:0,z:0}}},{duration:0.5,bones:REST}]},
  food:     { name:'food',    keyframes:[{ duration:0.6,bones:{RightArm:{x:deg(-80),y:0,z:deg(-15)},RightForeArm:{x:deg(-100),y:0,z:0}}},{duration:0.6,bones:{RightArm:{x:deg(-70),y:0,z:deg(-15)},RightForeArm:{x:deg(-90),y:0,z:0},Head:{x:deg(8),y:0,z:0}}},{duration:0.5,bones:REST}]},
  learn:    { name:'learn',   keyframes:[{ duration:0.8,bones:{RightArm:{x:deg(-90),y:0,z:deg(-15)},RightForeArm:{x:deg(-110),y:0,z:0},RightHand:{x:deg(-20),y:0,z:0}}},{duration:0.9,bones:{RightArm:{x:deg(-60),y:0,z:deg(-25)},RightForeArm:{x:deg(-40),y:0,z:0},RightHand:{x:deg(10),y:0,z:0}}},{duration:0.5,bones:REST}]},
  science:  { name:'science', keyframes:[{ duration:0.8,bones:{RightArm:{x:deg(-60),y:deg(-10),z:deg(-20)},RightForeArm:{x:deg(-60),y:deg(20),z:0},LeftArm:{x:deg(-60),y:deg(10),z:deg(20)},LeftForeArm:{x:deg(-60),y:deg(-20),z:0}}},{duration:0.8,bones:{RightArm:{x:deg(-60),y:deg(10),z:deg(-20)},RightForeArm:{x:deg(-60),y:deg(-20),z:0},LeftArm:{x:deg(-60),y:deg(-10),z:deg(20)},LeftForeArm:{x:deg(-60),y:deg(20),z:0}}},{duration:0.5,bones:REST}]},
  math:     { name:'math',    keyframes:kf2(-50,-30,  0) },
  school:   { name:'school',  keyframes:[{ duration:0.7,bones:{RightArm:{x:deg(-40),y:deg(-10),z:deg(-20)},RightForeArm:{x:deg(-60),y:deg(10),z:0},LeftArm:{x:deg(-40),y:deg(10),z:deg(20)},LeftForeArm:{x:deg(-60),y:deg(-10),z:0}}},{duration:0.9,bones:{RightArm:{x:deg(-50),y:0,z:deg(-25)},RightForeArm:{x:deg(-70),y:0,z:0},LeftArm:{x:deg(-50),y:0,z:deg(25)},LeftForeArm:{x:deg(-70),y:0,z:0}}},{duration:0.5,bones:REST}]},
  good:     { name:'good',    keyframes:[{ duration:0.6,bones:{RightArm:{x:deg(-50),y:0,z:deg(-20)},RightForeArm:{x:deg(-30),y:0,z:0}}},{duration:1.0,bones:{RightArm:{x:deg(-60),y:0,z:deg(-25)},RightForeArm:{x:deg(-20),y:0,z:0},Head:{x:deg(-5),y:0,z:0}}},{duration:0.5,bones:REST}]},
  bad:      { name:'bad',     keyframes:[{ duration:0.7,bones:{RightArm:{x:deg(-30),y:0,z:deg(-30)},RightForeArm:{x:deg(10),y:0,z:0},Head:{x:deg(5),y:0,z:0}}},{duration:0.8,bones:{RightArm:{x:deg(-20),y:0,z:deg(-35)},RightForeArm:{x:deg(20),y:0,z:0},Head:{x:deg(8),y:0,z:0}}},{duration:0.5,bones:REST}]},
  come:     { name:'come',    keyframes:[{ duration:0.7,bones:{RightArm:{x:deg(-60),y:0,z:deg(-30)},RightForeArm:{x:deg(-20),y:0,z:0},RightHand:{x:0,y:deg(-30),z:0}}},{duration:0.8,bones:{RightArm:{x:deg(-60),y:0,z:deg(-20)},RightForeArm:{x:deg(-30),y:0,z:0},RightHand:{x:0,y:deg(20),z:0}}},{duration:0.5,bones:REST}]},
  go:       { name:'go',      keyframes:[{ duration:0.6,bones:{RightArm:{x:deg(-40),y:deg(20),z:deg(-20)},RightForeArm:{x:deg(-10),y:deg(20),z:0}}},{duration:0.9,bones:{RightArm:{x:deg(-35),y:deg(30),z:deg(-15)},Head:{x:0,y:deg(10),z:0}}},{duration:0.5,bones:REST}]},
  help:     { name:'help',    keyframes:[{ duration:0.8,bones:{RightArm:{x:deg(-40),y:deg(-10),z:deg(-20)},RightForeArm:{x:deg(-50),y:0,z:0},LeftArm:{x:deg(-30),y:deg(10),z:deg(20)},LeftForeArm:{x:deg(-40),y:0,z:0}}},{duration:0.9,bones:{RightArm:{x:deg(-50),y:0,z:deg(-25)},RightForeArm:{x:deg(-60),y:0,z:0},LeftArm:{x:deg(-50),y:0,z:deg(25)},LeftForeArm:{x:deg(-60),y:0,z:0}}},{duration:0.5,bones:REST}]},
  stop:     { name:'stop',    keyframes:kf2(-50,-30,-30) },
  love:     { name:'love',    keyframes:[{ duration:0.8,bones:{RightArm:{x:deg(-30),y:deg(20),z:deg(-30)},RightForeArm:{x:deg(-70),y:0,z:0},LeftArm:{x:deg(-30),y:deg(-20),z:deg(30)},LeftForeArm:{x:deg(-70),y:0,z:0}}},{duration:1.0,bones:{RightArm:{x:deg(-25),y:deg(25),z:deg(-25)},RightForeArm:{x:deg(-75),y:0,z:0},LeftArm:{x:deg(-25),y:deg(-25),z:deg(25)},LeftForeArm:{x:deg(-75),y:0,z:0}}},{duration:0.6,bones:REST}]},
  think:    { name:'think',   keyframes:kf2(-90,-100,0,undefined,undefined,3) },
  hear:     { name:'hear',    keyframes:[{ duration:0.8,bones:{RightArm:{x:deg(-80),y:deg(-25),z:deg(-15)},RightForeArm:{x:deg(-90),y:deg(10),z:0},Head:{x:0,y:deg(10),z:0}}},{duration:0.9,bones:{RightArm:{x:deg(-85),y:deg(-20),z:deg(-10)},RightForeArm:{x:deg(-85),y:deg(15),z:0}}},{duration:0.5,bones:REST}]},
  see:      { name:'see',     keyframes:[{ duration:0.7,bones:{RightArm:{x:deg(-90),y:deg(-10),z:deg(-15)},RightForeArm:{x:deg(-80),y:0,z:0}}},{duration:0.9,bones:{RightArm:{x:deg(-60),y:deg(20),z:deg(-20)},RightForeArm:{x:deg(-30),y:deg(15),z:0},Head:{x:0,y:deg(10),z:0}}},{duration:0.5,bones:REST}]},
  work:     { name:'work',    keyframes:[{ duration:0.6,bones:{RightArm:{x:deg(-50),y:deg(-10),z:deg(-20)},RightForeArm:{x:deg(-60),y:0,z:0},LeftArm:{x:deg(-40),y:deg(10),z:deg(20)},LeftForeArm:{x:deg(-50),y:0,z:0}}},{duration:0.6,bones:{RightArm:{x:deg(-40),y:deg(-10),z:deg(-20)},RightForeArm:{x:deg(-50),y:0,z:0},LeftArm:{x:deg(-50),y:deg(10),z:deg(20)},LeftForeArm:{x:deg(-60),y:0,z:0}}},{duration:0.5,bones:REST}]},
  happy:    { name:'happy',   keyframes:[{ duration:0.7,bones:{RightArm:{x:deg(-30),y:deg(-10),z:deg(-15)},RightForeArm:{x:deg(-70),y:0,z:0},LeftArm:{x:deg(-30),y:deg(10),z:deg(15)},LeftForeArm:{x:deg(-70),y:0,z:0},Head:{x:deg(-5),y:0,z:0}}},{duration:0.8,bones:{RightArm:{x:deg(-50),y:0,z:deg(-25)},RightForeArm:{x:deg(-60),y:0,z:0},LeftArm:{x:deg(-50),y:0,z:deg(25)},LeftForeArm:{x:deg(-60),y:0,z:0}}},{duration:0.5,bones:REST}]},
  sorry:    { name:'sorry',   keyframes:[{ duration:0.7,bones:{RightArm:{x:deg(-25),y:deg(-15),z:deg(-15)},RightForeArm:{x:deg(-80),y:deg(10),z:0},Spine:{x:deg(3),y:0,z:0}}},{duration:0.7,bones:{RightArm:{x:deg(-30),y:deg(-10),z:deg(-20)},RightForeArm:{x:deg(-75),y:deg(-10),z:0},Head:{x:deg(5),y:0,z:0}}},{duration:0.5,bones:REST}]},
  write:    { name:'write',   keyframes:[{ duration:0.7,bones:{RightArm:{x:deg(-30),y:deg(-20),z:deg(-15)},RightForeArm:{x:deg(-60),y:deg(10),z:0},Head:{x:deg(10),y:0,z:0}}},{duration:0.9,bones:{RightArm:{x:deg(-30),y:deg(-25),z:deg(-20)},RightForeArm:{x:deg(-65),y:deg(15),z:0},Head:{x:deg(10),y:0,z:0}}},{duration:0.5,bones:REST}]},
  read:     { name:'read',    keyframes:[{ duration:0.8,bones:{RightArm:{x:deg(-30),y:deg(-10),z:deg(-15)},RightForeArm:{x:deg(-60),y:deg(10),z:0},LeftArm:{x:deg(-30),y:deg(10),z:deg(15)},LeftForeArm:{x:deg(-60),y:deg(-10),z:0},Head:{x:deg(12),y:0,z:0}}},{duration:0.9,bones:{RightArm:{x:deg(-35),y:deg(-5),z:deg(-20)},RightForeArm:{x:deg(-55),y:deg(5),z:0},LeftArm:{x:deg(-35),y:deg(5),z:deg(20)},LeftForeArm:{x:deg(-55),y:deg(-5),z:0}}},{duration:0.5,bones:REST}]},
  family:   { name:'family',  keyframes:[{ duration:0.8,bones:{RightArm:{x:deg(-40),y:deg(-15),z:deg(-30)},RightForeArm:{x:deg(-20),y:0,z:0},LeftArm:{x:deg(-40),y:deg(15),z:deg(30)},LeftForeArm:{x:deg(-20),y:0,z:0}}},{duration:1.0,bones:{RightArm:{x:deg(-45),y:deg(5),z:deg(-35)},LeftArm:{x:deg(-45),y:deg(-5),z:deg(35)},Head:{x:deg(-3),y:0,z:0}}},{duration:0.6,bones:REST}]},
  more:     { name:'more',    keyframes:[{ duration:0.7,bones:{RightArm:{x:deg(-40),y:deg(-15),z:deg(-20)},RightForeArm:{x:deg(-50),y:deg(10),z:0},LeftArm:{x:deg(-40),y:deg(15),z:deg(20)},LeftForeArm:{x:deg(-50),y:deg(-10),z:0}}},{duration:0.8,bones:{RightArm:{x:deg(-45),y:deg(-5),z:deg(-25)},RightForeArm:{x:deg(-55),y:0,z:0},LeftArm:{x:deg(-45),y:deg(5),z:deg(25)},LeftForeArm:{x:deg(-55),y:0,z:0}}},{duration:0.5,bones:REST}]},
  difficult:{ name:'difficult', keyframes:[{ duration:0.6,bones:{RightArm:{x:deg(-70),y:deg(-20),z:deg(-30)},RightForeArm:{x:deg(-80),y:deg(20),z:0},LeftArm:{x:deg(-70),y:deg(20),z:deg(30)},LeftForeArm:{x:deg(-80),y:deg(-20),z:0},RightFingers:{x:deg(50),y:0,z:0},LeftFingers:{x:deg(50),y:0,z:0}}},{duration:0.6,bones:{RightArm:{x:deg(-50),y:deg(-30),z:deg(-40)},RightForeArm:{x:deg(-60),y:0,z:0},LeftArm:{x:deg(-50),y:deg(30),z:deg(40)},LeftForeArm:{x:deg(-60),y:0,z:0},RightFingers:{x:deg(80),y:0,z:0},LeftFingers:{x:deg(80),y:0,z:0}}},{duration:0.5,bones:REST}]},
  related:  { name:'related',   keyframes:[{ duration:0.7,bones:{RightArm:{x:deg(-40),y:deg(20),z:deg(-20)},RightForeArm:{x:deg(-20),y:0,z:0},LeftArm:{x:deg(-40),y:deg(-20),z:deg(20)},LeftForeArm:{x:deg(-20),y:0,z:0}}},{duration:0.8,bones:{RightArm:{x:deg(-50),y:deg(30),z:deg(-15)},LeftArm:{x:deg(-50),y:deg(-30),z:deg(15)}}},{duration:0.5,bones:REST}]},
  student:  { name:'student',   keyframes:[{ duration:0.7,bones:{RightArm:{x:deg(-50),y:deg(-20),z:deg(-20)},RightForeArm:{x:deg(-60),y:0,z:0},LeftArm:{x:deg(-50),y:deg(20),z:deg(20)},LeftForeArm:{x:deg(-60),y:0,z:0}}},{duration:0.6,bones:{RightArm:{x:deg(-30),y:deg(-10),z:deg(-10)},RightForeArm:{x:deg(-40),y:0,z:0},LeftArm:{x:deg(-30),y:deg(10),z:deg(10)},LeftForeArm:{x:deg(-40),y:0,z:0}}},{duration:0.5,bones:REST}]},
  teacher:  { name:'teacher',   keyframes:[{ duration:0.6,bones:{RightArm:{x:deg(-70),y:deg(-30),z:deg(-20)},RightForeArm:{x:deg(-80),y:0,z:0},LeftArm:{x:deg(-70),y:deg(30),z:deg(20)},LeftForeArm:{x:deg(-80),y:0,z:0}}},{duration:0.8,bones:{RightArm:{x:deg(-50),y:deg(-10),z:deg(-10)},RightForeArm:{x:deg(-60),y:0,z:0},LeftArm:{x:deg(-50),y:deg(10),z:deg(10)},LeftForeArm:{x:deg(-60),y:0,z:0}}},{duration:0.5,bones:REST}]},
  book:     { name:'book',      keyframes:[{ duration:0.6,bones:{RightArm:{x:deg(-40),y:deg(-10),z:deg(-10)},RightForeArm:{x:deg(-30),y:0,z:0},LeftArm:{x:deg(-40),y:deg(10),z:deg(10)},LeftForeArm:{x:deg(-30),y:0,z:0}}},{duration:0.6,bones:{RightArm:{x:deg(-40),y:deg(-40),z:deg(-20)},LeftArm:{x:deg(-40),y:deg(40),z:deg(20)}}},{duration:0.5,bones:REST}]},
  lesson:   { name:'lesson',    keyframes:[{ duration:0.7,bones:{RightArm:{x:deg(-60),y:deg(-20),z:deg(-20)},RightForeArm:{x:deg(-80),y:0,z:0},LeftArm:{x:deg(-40),y:deg(20),z:deg(20)},LeftForeArm:{x:deg(-40),y:0,z:0}}},{duration:0.6,bones:{RightArm:{x:deg(-40),y:deg(-20),z:deg(-20)},RightForeArm:{x:deg(-60),y:0,z:0},LeftArm:{x:deg(-60),y:deg(20),z:deg(20)},LeftForeArm:{x:deg(-80),y:0,z:0}}},{duration:0.5,bones:REST}]},
};

// A–Z fingerspelling
const LA: Record<string, [number,number,number]> = {
  a:[-70,-90,-15], b:[-80,-100,20],  c:[-65,-80,0],   d:[-75,-95,10],
  e:[-70,-85,-20], f:[-60,-70,15],   g:[-55,-40,-20],  h:[-55,-30,5],
  i:[-80,-90,30],  j:[-80,-90,30],   k:[-75,-80,0],    l:[-60,-30,-25],
  m:[-70,-90,-10], n:[-70,-90,-5],   o:[-65,-75,0],    p:[-55,-30,-30],
  q:[-55,-35,-30], r:[-75,-85,5],    s:[-70,-90,-20],  t:[-70,-90,-10],
  u:[-80,-95,10],  v:[-80,-90,15],   w:[-75,-85,20],   x:[-70,-75,-15],
  y:[-65,-70,25],  z:[-60,-50,-20],
};
export const LETTER_POSES: Record<string, SignDefinition> = {};
for (const [letter, [ra,rfa,rh]] of Object.entries(LA)) {
  LETTER_POSES[letter] = {
    name: letter,
    keyframes: [
      { duration:0.28, bones:{ RightArm:{x:deg(ra),y:deg(-10),z:deg(-18)}, RightForeArm:{x:deg(rfa),y:0,z:0}, RightHand:{x:deg(rh),y:0,z:0} }},
      { duration:0.18, bones:REST },
    ],
  };
}
