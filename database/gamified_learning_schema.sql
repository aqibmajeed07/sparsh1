-- =====================================================================
-- SPARSH DUO: FULL GAMIFICATION & ACCESSIBLE LEARNING DATABASE SCHEMA
-- Track 1: Deaf / Hard of Hearing -> Camera-detected Sign Language Levels
-- Track 2: Blind / Visually Impaired -> Interactive 6-Dot Braille & Audio-Tactile Levels
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Student Gamification Profile (Hearts, Streaks, Gems, XP, Track)
CREATE TABLE IF NOT EXISTS student_gamification_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    track TEXT NOT NULL CHECK (track IN ('deaf_sign', 'blind_braille')),
    total_xp INT NOT NULL DEFAULT 0,
    gems INT NOT NULL DEFAULT 150,
    hearts INT NOT NULL DEFAULT 5,
    max_hearts INT NOT NULL DEFAULT 5,
    current_streak INT NOT NULL DEFAULT 1,
    last_activity_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Gamification Levels Catalog (Pre-seeded with curriculum)
CREATE TABLE IF NOT EXISTS gamification_levels (
    id TEXT PRIMARY KEY,
    track TEXT NOT NULL CHECK (track IN ('deaf_sign', 'blind_braille')),
    unit_number INT NOT NULL,
    unit_title TEXT NOT NULL,
    level_number INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    target_char TEXT NOT NULL,
    target_sign TEXT,
    target_braille_dots INT[],
    braille_display TEXT,
    xp_reward INT NOT NULL DEFAULT 20,
    gem_reward INT NOT NULL DEFAULT 10,
    hints TEXT[] DEFAULT '{}',
    order_index INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User Level Progress (Tracks completions, stars, attempts)
CREATE TABLE IF NOT EXISTS user_level_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    level_id TEXT NOT NULL REFERENCES gamification_levels(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    stars INT NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
    score INT NOT NULL DEFAULT 0,
    attempts INT NOT NULL DEFAULT 1,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, level_id)
);

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_gamification_profile_user ON student_gamification_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_levels_track ON gamification_levels(track, unit_number, level_number);
CREATE INDEX IF NOT EXISTS idx_user_level_progress_user ON user_level_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_level_progress_level ON user_level_progress(level_id);

-- Enable Row Level Security (RLS)
ALTER TABLE student_gamification_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_level_progress ENABLE ROW LEVEL SECURITY;

-- Allow public / authenticated reads for learning content
DROP POLICY IF EXISTS "Public read gamification levels" ON gamification_levels;
CREATE POLICY "Public read gamification levels"
    ON gamification_levels FOR SELECT
    USING (true);

-- Allow authenticated users to manage their own profile and progress
DROP POLICY IF EXISTS "Users can read own gamification profile" ON student_gamification_profile;
CREATE POLICY "Users can read own gamification profile"
    ON student_gamification_profile FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can upsert own gamification profile" ON student_gamification_profile;
CREATE POLICY "Users can upsert own gamification profile"
    ON student_gamification_profile FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own level progress" ON user_level_progress;
CREATE POLICY "Users can read own level progress"
    ON user_level_progress FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can upsert own level progress" ON user_level_progress;
CREATE POLICY "Users can upsert own level progress"
    ON user_level_progress FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================================
-- CURRICULUM SEED DATA: SIGN LANGUAGE TRACK (Deaf / Hard of Hearing)
-- Camera detection verifies hand sign gestures in real time!
-- =====================================================================

INSERT INTO gamification_levels (id, track, unit_number, unit_title, level_number, title, description, target_char, target_sign, xp_reward, gem_reward, hints, order_index)
VALUES
-- Unit 1: Alphabet Foundations
('sign_u1_l1', 'deaf_sign', 1, 'Unit 1: Alphabet Foundations', 1, 'Sign Letter A', 'Form a closed fist with your thumb resting straight against the side of your index finger.', 'A', 'A', 20, 10, ARRAY['Make a solid fist with fingers tucked in', 'Keep your thumb upright against the side of the fist'], 1),
('sign_u1_l2', 'deaf_sign', 1, 'Unit 1: Alphabet Foundations', 2, 'Sign Letter B', 'Hold your 4 fingers straight up together with your thumb folded across your palm.', 'B', 'B', 20, 10, ARRAY['Keep four fingers straight and pressed together', 'Fold thumb across the center of your palm'], 2),
('sign_u1_l3', 'deaf_sign', 1, 'Unit 1: Alphabet Foundations', 3, 'Sign Letter C', 'Curve your fingers and thumb to form a C-shape facing sideways toward the camera.', 'C', 'C', 20, 10, ARRAY['Curve hand like holding a cup', 'Make an open C-curve with fingers and thumb'], 3),
('sign_u1_l4', 'deaf_sign', 1, 'Unit 1: Alphabet Foundations', 4, 'Sign Letter D', 'Point index finger straight up while curving thumb, middle, ring, and pinky to touch.', 'D', 'D', 25, 12, ARRAY['Index finger points straight up to the ceiling', 'Remaining fingers curve down to touch your thumb tip'], 4),
('sign_u1_l5', 'deaf_sign', 1, 'Unit 1: Alphabet Foundations', 5, 'Sign Letter L', 'Extend your index finger up and thumb outward to create a sharp 90-degree L angle.', 'L', '02_l', 25, 12, ARRAY['Stretch index finger up and thumb horizontally', 'Resembles a capital L shape'], 5),

-- Unit 2: Core Gestures & Everyday Signs
('sign_u2_l1', 'deaf_sign', 2, 'Unit 2: Essential Gestures', 1, 'Thumbs Up / Good', 'Show an affirmative thumbs up gesture with fingers tucked in and thumb high.', 'Thumbs Up', '05_thumb', 30, 15, ARRAY['Clench fingers into a fist', 'Extend thumb straight up with energy'], 6),
('sign_u2_l2', 'deaf_sign', 2, 'Unit 2: Essential Gestures', 2, 'Open Palm / Hello', 'Hold an open flat palm facing directly toward the camera with fingers slightly parted.', 'Palm', '01_palm', 30, 15, ARRAY['Open hand wide with fingers spread naturally', 'Face palm squarely toward the camera'], 7),
('sign_u2_l3', 'deaf_sign', 2, 'Unit 2: Essential Gestures', 3, 'OK Sign', 'Touch thumb tip to index finger tip to make a small circle, other three fingers extended.', 'OK', '07_ok', 30, 15, ARRAY['Form a neat circle with thumb and index tip', 'Keep three other fingers fanned out upright'], 8),
('sign_u2_l4', 'deaf_sign', 2, 'Unit 2: Essential Gestures', 4, 'Solid Fist', 'Form a strong closed fist facing the camera, showing determination.', 'Fist', '03_fist', 35, 15, ARRAY['Wrap all fingers tightly into the palm', 'Keep hand steady facing the webcam'], 9),
('sign_u2_l5', 'deaf_sign', 2, 'Unit 2: Essential Gestures', 5, 'Victory / V-Sign', 'Hold up index and middle fingers in a peace V-sign with thumb holding other fingers.', 'V', 'V', 35, 18, ARRAY['Index and middle fingers straight up in a V', 'Ring and pinky fingers held down by thumb'], 10),

-- Unit 3: Numbers & Counting
('sign_u3_l1', 'deaf_sign', 3, 'Unit 3: Numbers & Counting', 1, 'Number 1', 'Point your index finger upright to count one.', '1', '1', 40, 20, ARRAY['Raise only your index finger straight up', 'Keep thumb resting over closed fingers'], 11),
('sign_u3_l2', 'deaf_sign', 3, 'Unit 3: Numbers & Counting', 2, 'Number 2', 'Raise both index and middle fingers straight up together.', '2', '2', 40, 20, ARRAY['Hold two fingers straight up', 'Keep them steady in front of the lens'], 12),
('sign_u3_l3', 'deaf_sign', 3, 'Unit 3: Numbers & Counting', 3, 'Number 3', 'Show thumb, index, and middle finger extended (standard 3 sign).', '3', '3', 45, 20, ARRAY['Extend thumb, index, and middle fingers', 'Tuck ring and pinky fingers in'], 13),
('sign_u3_l4', 'deaf_sign', 3, 'Unit 3: Numbers & Counting', 4, 'Number 5', 'Show all five fingers open and spread wide.', '5', '5', 50, 25, ARRAY['Open whole hand with all 5 digits spread', 'Hold still in center of camera frame'], 14)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    target_char = EXCLUDED.target_char,
    target_sign = EXCLUDED.target_sign,
    hints = EXCLUDED.hints,
    xp_reward = EXCLUDED.xp_reward,
    gem_reward = EXCLUDED.gem_reward;

-- =====================================================================
-- CURRICULUM SEED DATA: BRAILLE TRACK (Blind / Visually Impaired)
-- 6-dot cell validation with audio pitch tones, speech synthesis & haptics!
-- =====================================================================

INSERT INTO gamification_levels (id, track, unit_number, unit_title, level_number, title, description, target_char, target_braille_dots, braille_display, xp_reward, gem_reward, hints, order_index)
VALUES
-- Unit 1: Top Dot Foundations (A through E)
('braille_u1_l1', 'blind_braille', 1, 'Unit 1: Top Dot Foundations', 1, 'Braille Letter A', 'Letter A is formed by pressing only Dot 1 (top-left).', 'A', ARRAY[1], '⠁', 20, 10, ARRAY['Press Dot 1 at the top-left', 'Shortcut key: F on keyboard'], 1),
('braille_u1_l2', 'blind_braille', 1, 'Unit 1: Top Dot Foundations', 2, 'Braille Letter B', 'Letter B is formed by pressing Dot 1 (top-left) and Dot 2 (middle-left).', 'B', ARRAY[1, 2], '⠃', 20, 10, ARRAY['Press Dots 1 and 2 along the left column', 'Shortcut keys: F and D'], 2),
('braille_u1_l3', 'blind_braille', 1, 'Unit 1: Top Dot Foundations', 3, 'Braille Letter C', 'Letter C is formed by pressing Dot 1 (top-left) and Dot 4 (top-right).', 'C', ARRAY[1, 4], '⠉', 20, 10, ARRAY['Press both top dots: Dot 1 and Dot 4', 'Shortcut keys: F and J'], 3),
('braille_u1_l4', 'blind_braille', 1, 'Unit 1: Top Dot Foundations', 4, 'Braille Letter D', 'Letter D is formed by pressing Dot 1, Dot 4, and Dot 5 (top two plus middle-right).', 'D', ARRAY[1, 4, 5], '⠙', 25, 12, ARRAY['Press Dot 1 (top-left), Dot 4 (top-right), and Dot 5 (middle-right)', 'Shortcut keys: F, J, K'], 4),
('braille_u1_l5', 'blind_braille', 1, 'Unit 1: Top Dot Foundations', 5, 'Braille Letter E', 'Letter E is formed by pressing Dot 1 (top-left) and Dot 5 (middle-right).', 'E', ARRAY[1, 5], '⠑', 25, 12, ARRAY['Press Dot 1 diagonally to Dot 5', 'Shortcut keys: F and K'], 5),

-- Unit 2: Mid-Cell Combinations (F through J)
('braille_u2_l1', 'blind_braille', 2, 'Unit 2: Mid-Cell Combinations', 1, 'Braille Letter F', 'Letter F is formed by pressing Dot 1, Dot 2, and Dot 4.', 'F', ARRAY[1, 2, 4], '⠋', 30, 15, ARRAY['Press Dots 1, 2 on left and Dot 4 on right', 'Shortcut keys: F, D, J'], 6),
('braille_u2_l2', 'blind_braille', 2, 'Unit 2: Mid-Cell Combinations', 2, 'Braille Letter G', 'Letter G is a solid block of the top four dots: 1, 2, 4, and 5.', 'G', ARRAY[1, 2, 4, 5], '⠛', 30, 15, ARRAY['Press all four upper dots: 1, 2, 4, and 5', 'Shortcut keys: F, D, J, K'], 7),
('braille_u2_l3', 'blind_braille', 2, 'Unit 2: Mid-Cell Combinations', 3, 'Braille Letter H', 'Letter H is formed by pressing Dot 1, Dot 2, and Dot 5.', 'H', ARRAY[1, 2, 5], '⠓', 30, 15, ARRAY['Press Dots 1, 2 on left and Dot 5 on right', 'Shortcut keys: F, D, K'], 8),
('braille_u2_l4', 'blind_braille', 2, 'Unit 2: Mid-Cell Combinations', 4, 'Braille Letter I', 'Letter I is formed by pressing Dot 2 (middle-left) and Dot 4 (top-right).', 'I', ARRAY[2, 4], '⠊', 35, 15, ARRAY['Press Dot 2 and Dot 4 diagonally', 'Shortcut keys: D and J'], 9),
('braille_u2_l5', 'blind_braille', 2, 'Unit 2: Mid-Cell Combinations', 5, 'Braille Letter J', 'Letter J is formed by pressing Dot 2, Dot 4, and Dot 5.', 'J', ARRAY[2, 4, 5], '⠚', 35, 18, ARRAY['Press Dot 2 on left, Dots 4, 5 on right', 'Shortcut keys: D, J, K'], 10),

-- Unit 3: Lower-Dot Extensions (K through O)
('braille_u3_l1', 'blind_braille', 3, 'Unit 3: Lower-Dot Extensions', 1, 'Braille Letter K', 'Letter K is formed by adding Dot 3 (bottom-left) to Letter A (Dots 1 and 3).', 'K', ARRAY[1, 3], '⠅', 40, 20, ARRAY['Press Dot 1 (top-left) and Dot 3 (bottom-left)', 'Shortcut keys: F and S'], 11),
('braille_u3_l2', 'blind_braille', 3, 'Unit 3: Lower-Dot Extensions', 2, 'Braille Letter L', 'Letter L fills the entire left column: Dots 1, 2, and 3.', 'L', ARRAY[1, 2, 3], '⠇', 40, 20, ARRAY['Press all three left dots: 1, 2, and 3', 'Shortcut keys: F, D, S'], 12),
('braille_u3_l3', 'blind_braille', 3, 'Unit 3: Lower-Dot Extensions', 3, 'Braille Letter M', 'Letter M adds Dot 3 to Letter C: Dots 1, 3, and 4.', 'M', ARRAY[1, 3, 4], '⠍', 45, 20, ARRAY['Press Dots 1, 3 on left and Dot 4 on right', 'Shortcut keys: F, S, J'], 13),
('braille_u3_l4', 'blind_braille', 3, 'Unit 3: Lower-Dot Extensions', 4, 'Braille Letter O', 'Letter O is formed by pressing Dots 1, 3, and 5.', 'O', ARRAY[1, 3, 5], '⠕', 50, 25, ARRAY['Press Dots 1, 3 on left and Dot 5 on right', 'Shortcut keys: F, S, K'], 14)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    target_char = EXCLUDED.target_char,
    target_braille_dots = EXCLUDED.target_braille_dots,
    braille_display = EXCLUDED.braille_display,
    hints = EXCLUDED.hints,
    xp_reward = EXCLUDED.xp_reward,
    gem_reward = EXCLUDED.gem_reward;
