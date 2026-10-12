-- ==============================================================================
-- SPARSH LIVE CLASSROOM DATABASE SCHEMA
-- Real-time Video, Chat, Attendance & 3D ISL Sign Language Subtitles
-- ==============================================================================

-- 1. LIVE SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rtc_channel_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    grade TEXT NOT NULL DEFAULT '8',
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    teacher_name TEXT DEFAULT 'Teacher',
    institution_id UUID,
    status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended', 'paused')),
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast active sessions discovery
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON public.live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_channel ON public.live_sessions(rtc_channel_id);

-- 2. LIVE CLASS CHAT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.live_class_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rtc_channel_id TEXT NOT NULL,
    session_id UUID REFERENCES public.live_sessions(id) ON DELETE CASCADE,
    sender_id UUID,
    sender_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('teacher', 'student', 'system', 'you')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_class_messages_channel ON public.live_class_messages(rtc_channel_id, created_at);

-- 3. LIVE CLASS PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS public.live_class_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rtc_channel_id TEXT NOT NULL,
    session_id UUID REFERENCES public.live_sessions(id) ON DELETE CASCADE,
    participant_id TEXT NOT NULL,
    user_id UUID,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('teacher', 'student')),
    has_audio BOOLEAN DEFAULT false,
    has_video BOOLEAN DEFAULT false,
    hand_raised BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_channel_participant UNIQUE (rtc_channel_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_live_class_participants_channel ON public.live_class_participants(rtc_channel_id);

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_class_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_class_participants ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for Educational Platform Access
CREATE POLICY "Allow select live_sessions for all users"
    ON public.live_sessions FOR SELECT USING (true);

CREATE POLICY "Allow insert/update live_sessions for authenticated users"
    ON public.live_sessions FOR ALL USING (true);

CREATE POLICY "Allow all users to read chat messages"
    ON public.live_class_messages FOR SELECT USING (true);

CREATE POLICY "Allow users to post chat messages"
    ON public.live_class_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all users to read and update participants"
    ON public.live_class_participants FOR ALL USING (true);

-- 5. ENABLE SUPABASE REALTIME REPLICATION
-- Run these commands in Supabase SQL editor to stream inserts & updates live:
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.live_class_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.live_class_participants;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;
