import { NextResponse } from 'next/server';
import { getBackendCandidateUrls } from '@/lib/backendUrl';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get('track') || 'deaf_sign';
  const userId = searchParams.get('user_id') || 'guest_student';

  const candidateUrls = getBackendCandidateUrls();

  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/gamification/levels?track=${encodeURIComponent(track)}&user_id=${encodeURIComponent(userId)}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      continue;
    }
  }

  // Built-in fallback levels if backend is offline
  const fallbackSignLevels = [
    {
      id: 'sign_u1_l1', track: 'deaf_sign', unit_number: 1, unit_title: 'Unit 1: Alphabet Foundations',
      level_number: 1, title: 'Sign Letter A', description: 'Form a closed fist with thumb upright along index finger.',
      target_char: 'A', target_sign: 'A', xp_reward: 20, gem_reward: 10,
      hints: ['Make a solid fist', 'Keep thumb upright along the side'], order_index: 1,
      completed: true, stars: 3, is_unlocked: true, is_current: false
    },
    {
      id: 'sign_u1_l2', track: 'deaf_sign', unit_number: 1, unit_title: 'Unit 1: Alphabet Foundations',
      level_number: 2, title: 'Sign Letter B', description: 'Four fingers straight up together, thumb folded across palm.',
      target_char: 'B', target_sign: 'B', xp_reward: 20, gem_reward: 10,
      hints: ['Keep four fingers pressed straight', 'Thumb across palm'], order_index: 2,
      completed: false, stars: 0, is_unlocked: true, is_current: true
    },
    {
      id: 'sign_u1_l3', track: 'deaf_sign', unit_number: 1, unit_title: 'Unit 1: Alphabet Foundations',
      level_number: 3, title: 'Sign Letter C', description: 'Curve fingers and thumb into a C-shape facing sideways.',
      target_char: 'C', target_sign: 'C', xp_reward: 20, gem_reward: 10,
      hints: ['Curve hand like gripping a cup', 'Show C-profile to camera'], order_index: 3,
      completed: false, stars: 0, is_unlocked: false, is_current: false
    },
    {
      id: 'sign_u1_l4', track: 'deaf_sign', unit_number: 1, unit_title: 'Unit 1: Alphabet Foundations',
      level_number: 4, title: 'Sign Letter D', description: 'Index finger points straight up, other fingers touch thumb tip.',
      target_char: 'D', target_sign: 'D', xp_reward: 25, gem_reward: 12,
      hints: ['Index points up', 'Other fingers touch thumb'], order_index: 4,
      completed: false, stars: 0, is_unlocked: false, is_current: false
    },
    {
      id: 'sign_u1_l5', track: 'deaf_sign', unit_number: 1, unit_title: 'Unit 1: Alphabet Foundations',
      level_number: 5, title: 'Sign Letter L', description: 'Index finger up and thumb outward to form an L shape.',
      target_char: 'L', target_sign: '02_l', xp_reward: 25, gem_reward: 12,
      hints: ['Index up, thumb out horizontally', 'Resembles letter L'], order_index: 5,
      completed: false, stars: 0, is_unlocked: false, is_current: false
    },
    {
      id: 'sign_u2_l1', track: 'deaf_sign', unit_number: 2, unit_title: 'Unit 2: Essential Gestures',
      level_number: 1, title: 'Thumbs Up / Good', description: 'Show an affirmative thumbs up gesture to celebrate.',
      target_char: 'Thumbs Up', target_sign: '05_thumb', xp_reward: 30, gem_reward: 15,
      hints: ['Fist closed', 'Thumb pointing high'], order_index: 6,
      completed: false, stars: 0, is_unlocked: false, is_current: false
    },
    {
      id: 'sign_u2_l2', track: 'deaf_sign', unit_number: 2, unit_title: 'Unit 2: Essential Gestures',
      level_number: 2, title: 'Open Palm / Hello', description: 'Open flat palm facing camera with fingers slightly parted.',
      target_char: 'Palm', target_sign: '01_palm', xp_reward: 30, gem_reward: 15,
      hints: ['Flat palm facing camera', 'Fingers straight'], order_index: 7,
      completed: false, stars: 0, is_unlocked: false, is_current: false
    },
    {
      id: 'sign_u2_l3', track: 'deaf_sign', unit_number: 2, unit_title: 'Unit 2: Essential Gestures',
      level_number: 3, title: 'OK Sign', description: 'Touch thumb to index finger making a circle, other 3 fingers up.',
      target_char: 'OK', target_sign: '07_ok', xp_reward: 30, gem_reward: 15,
      hints: ['Circle with thumb and index', '3 other fingers extended'], order_index: 8,
      completed: false, stars: 0, is_unlocked: false, is_current: false
    }
  ];

  const fallbackBrailleLevels = [
    {
      id: 'braille_u1_l1', track: 'blind_braille', unit_number: 1, unit_title: 'Unit 1: Top Dot Foundations',
      level_number: 1, title: 'Braille Letter A', description: 'Letter A is formed by pressing only Dot 1 (top-left).',
      target_char: 'A', target_braille_dots: [1], braille_display: '⠁', xp_reward: 20, gem_reward: 10,
      hints: ['Dot 1 is top-left', 'Keyboard key: F'], order_index: 1,
      completed: true, stars: 3, is_unlocked: true, is_current: false
    },
    {
      id: 'braille_u1_l2', track: 'blind_braille', unit_number: 1, unit_title: 'Unit 1: Top Dot Foundations',
      level_number: 2, title: 'Braille Letter B', description: 'Letter B is formed by pressing Dot 1 (top-left) and Dot 2 (mid-left).',
      target_char: 'B', target_braille_dots: [1, 2], braille_display: '⠃', xp_reward: 20, gem_reward: 10,
      hints: ['Dots 1 and 2 in left column', 'Keyboard keys: F and D'], order_index: 2,
      completed: false, stars: 0, is_unlocked: true, is_current: true
    },
    {
      id: 'braille_u1_l3', track: 'blind_braille', unit_number: 1, unit_title: 'Unit 1: Top Dot Foundations',
      level_number: 3, title: 'Braille Letter C', description: 'Letter C is formed by pressing both top dots: Dot 1 and Dot 4.',
      target_char: 'C', target_braille_dots: [1, 4], braille_display: '⠉', xp_reward: 20, gem_reward: 10,
      hints: ['Dot 1 (top-left) and Dot 4 (top-right)', 'Keyboard keys: F and J'], order_index: 3,
      completed: false, stars: 0, is_unlocked: false, is_current: false
    },
    {
      id: 'braille_u1_l4', track: 'blind_braille', unit_number: 1, unit_title: 'Unit 1: Top Dot Foundations',
      level_number: 4, title: 'Braille Letter D', description: 'Letter D is formed by pressing Dot 1, Dot 4, and Dot 5.',
      target_char: 'D', target_braille_dots: [1, 4, 5], braille_display: '⠙', xp_reward: 25, gem_reward: 12,
      hints: ['Dots 1, 4 on top, plus Dot 5 on mid-right', 'Keyboard keys: F, J, K'], order_index: 4,
      completed: false, stars: 0, is_unlocked: false, is_current: false
    },
    {
      id: 'braille_u1_l5', track: 'blind_braille', unit_number: 1, unit_title: 'Unit 1: Top Dot Foundations',
      level_number: 5, title: 'Braille Letter E', description: 'Letter E is formed by pressing Dot 1 (top-left) and Dot 5 (mid-right).',
      target_char: 'E', target_braille_dots: [1, 5], braille_display: '⠑', xp_reward: 25, gem_reward: 12,
      hints: ['Dot 1 and diagonal Dot 5', 'Keyboard keys: F and K'], order_index: 5,
      completed: false, stars: 0, is_unlocked: false, is_current: false
    },
    {
      id: 'braille_u2_l1', track: 'blind_braille', unit_number: 2, unit_title: 'Unit 2: Mid-Cell Combinations',
      level_number: 1, title: 'Braille Letter F', description: 'Letter F is formed by pressing Dot 1, Dot 2, and Dot 4.',
      target_char: 'F', target_braille_dots: [1, 2, 4], braille_display: '⠋', xp_reward: 30, gem_reward: 15,
      hints: ['Dots 1, 2 on left, Dot 4 on top-right', 'Keyboard keys: F, D, J'], order_index: 6,
      completed: false, stars: 0, is_unlocked: false, is_current: false
    }
  ];

  return NextResponse.json({
    status: 'success',
    track,
    levels: track === 'blind_braille' ? fallbackBrailleLevels : fallbackSignLevels,
  });
}
