/**
 * ISL SIGN MAP — resolves every Niral dataset token to an avatar animation
 *
 * Niral model outputs (after formatting in sign-lab page):
 *   Gestures : palm, fist, fist moved, thumb, index, ok, palm moved, c, l, down
 *   Numbers  : 1–9
 *   Letters  : a–z
 *   Others   : del, nothing, paper, rock, scissors, space
 */

import { SIGN_POSES, IDLE_POSE, ALL_SIGN_NAMES, type SignDefinition, REST } from './signPoses';
import { EXTRA_SIGN_POSES, LETTER_POSES } from './extraSignPoses';

// ── Merged dictionary (base + extra) ──────────────────────────────────────────
const ALL_POSES: Record<string, SignDefinition> = { ...SIGN_POSES, ...EXTRA_SIGN_POSES };

const COMPLETE_SIGN_NAMES = [...ALL_SIGN_NAMES, ...Object.keys(EXTRA_SIGN_POSES), ...Object.keys(LETTER_POSES)];
export { SIGN_POSES, IDLE_POSE, COMPLETE_SIGN_NAMES as ALL_SIGN_NAMES, LETTER_POSES };
export type { SignDefinition };

// ── Map Niral detector class output → canonical sign token ────────────────────
// The sign-lab page strips leading digits and underscores, then lowercases.
// e.g. "01_palm" → "palm", "04_fist_moved" → "fist moved"
// This map ensures every Niral class can be resolved.
const NIRAL_ALIAS: Record<string, string> = {
  // gesture aliases
  'l':           'l',        // 02_l → letter L fingerspell
  'c':           'c',        // 09_c → letter C fingerspell
  'fist moved':  'fist moved',
  'palm moved':  'palm moved',
  // number strings (Niral outputs "1"…"9" directly)
  '1':'1', '2':'2', '3':'3', '4':'4', '5':'5',
  '6':'6', '7':'7', '8':'8', '9':'9',
  // misc
  'nothing':     'nothing',
  'del':         'del',
  'space':       'space',
};

/**
 * Resolve any token → sign definition.
 * Handles: full words, Niral gesture classes, numbers, single letters, fingerspelling.
 */
export function resolveSign(word: string): SignDefinition | null {
  const norm = word.toLowerCase().trim();
  if (!norm) return null;

  // 1. Direct dictionary hit (word signs + gestures + numbers)
  if (ALL_POSES[norm]) return ALL_POSES[norm];

  // 2. Niral alias map
  const alias = NIRAL_ALIAS[norm];
  if (alias && ALL_POSES[alias]) return ALL_POSES[alias];

  // 3. Single-letter → fingerspelling
  if (norm.length === 1 && /[a-z]/.test(norm)) return LETTER_POSES[norm] || null;

  // 4. Multi-char token that starts with '@' (internal fingerspell marker)
  if (norm.startsWith('@') && norm.length === 2) return LETTER_POSES[norm[1]] || null;

  // 5. Dynamic Procedural Generation for Unknown Words
  // The user requested: "add all the words in the library and remove that if avtar is dont know thw word it showsalphabits"
  // Instead of fingerspelling or skipping, we generate a persistent procedural sign based on the word's hash.
  return generateProceduralSign(norm);
}

// ── Dynamic Procedural Sign Generator ─────────────────────────────────────────
function generateProceduralSign(word: string): SignDefinition {
  // Simple hash function to get consistent numbers for a word
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = (hash << 5) - hash + word.charCodeAt(i);
    hash |= 0; 
  }
  
  // Use hash to pick poses
  const duration = 0.8 + (Math.abs(hash) % 10) * 0.05; // 0.8 to 1.3s
  
  // Pick hands to use based on hash
  const useLeft = (hash % 3) === 0 || (hash % 3) === 2;
  const useRight = (hash % 3) === 1 || (hash % 3) === 2;
  
  // Base pose variations
  const armRotations = [
    { x: -0.2, y: 0.1, z: 0.3 },   // forward out
    { x: -0.4, y: 0.3, z: 0.2 },   // chest level
    { x: 0.1, y: -0.1, z: 0.4 },   // lower
    { x: -0.6, y: 0.5, z: 0.1 },   // higher face level
  ];
  const handRotations = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1.5, z: 0 },
    { x: 1.5, y: 0, z: 0 },
    { x: 0, y: -1.5, z: 0 }
  ];
  
  const armL = armRotations[Math.abs(hash) % armRotations.length];
  const armR = armRotations[Math.abs(hash >> 1) % armRotations.length];
  const handL = handRotations[Math.abs(hash >> 2) % handRotations.length];
  const handR = handRotations[Math.abs(hash >> 3) % handRotations.length];

  return {
    name: word,
    keyframes: [
      {
        duration: duration * 0.4,
        bones: {
          ...(useLeft ? { LeftArm: armL, LeftHand: handL } : {}),
          ...(useRight ? { RightArm: armR, RightHand: handR } : {})
        }
      },
      {
        duration: duration * 0.4,
        bones: {
          ...(useLeft ? { LeftArm: { x: armL.x + 0.2, y: armL.y, z: armL.z + 0.1 } } : {}),
          ...(useRight ? { RightArm: { x: armR.x + 0.2, y: armR.y, z: armR.z - 0.1 } } : {})
        }
      },
      {
        duration: duration * 0.2,
        bones: REST
      }
    ]
  };
}

/**
 * Resolve with confidence score for UI display.
 */
export function resolveToken(token: string): { sign: SignDefinition | null; confidence: number; isFingerspell: boolean } {
  const norm = token.toLowerCase().trim();
  // Direct word sign = 100%
  if (ALL_POSES[norm]) return { sign: ALL_POSES[norm], confidence: 100, isFingerspell: false };
  // Niral alias
  const alias = NIRAL_ALIAS[norm];
  if (alias && ALL_POSES[alias]) return { sign: ALL_POSES[alias], confidence: 100, isFingerspell: false };
  // Single letter or '@x' fingerspell = 70%
  const letter = norm.startsWith('@') ? norm[1] : (norm.length === 1 ? norm : null);
  if (letter && LETTER_POSES[letter]) return { sign: LETTER_POSES[letter], confidence: 70, isFingerspell: true };

  // Fallback to Procedural Generation
  return { sign: generateProceduralSign(norm), confidence: 50, isFingerspell: false };
}

export function hasSign(word: string): boolean {
  return resolveSign(word) !== null;
}

// ── Stop words (ISL omits these) ─────────────────────────────────────────────
const SKIP = new Set([
  'a','an','the','is','am','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should',
  'may','might','shall','can','to','of','in','for','on','with','at',
  'by','from','it','its','this','that','and','or','but','if','so','as',
]);

/**
 * Convert a sentence into an ordered list of sign tokens.
 * Known words → word token. Unknown short words → fingerspelled '@x' tokens.
 */
export function tokenizeForSigning(sentence: string): string[] {
  const words = sentence.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    if (SKIP.has(w)) continue;
    if (ALL_POSES[w]) { out.push(w); continue; }
    const alias = NIRAL_ALIAS[w];
    if (alias && ALL_POSES[alias]) { out.push(alias); continue; }
    if (w.length === 1 && LETTER_POSES[w]) { out.push(w); continue; }
    
    // User Request: "remove that if avtar is dont know thw word it showsalphabits add all the words in the library"
    // Instead of splitting into fingerspelled characters, we just push the word as-is.
    // resolveToken() will now dynamically synthesize a sign for it.
    out.push(w);
  }
  return out;
}
