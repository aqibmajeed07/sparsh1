-- =========================================
-- SPARSH SUPABASE REAL-TIME SCHEMA
-- Run this in your Supabase SQL Editor
-- =========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CLEANUP (Remove predefined data tables if needed, adjust foreign keys cautiously)
-- DROP TABLE IF EXISTS analytics_events CASCADE;
-- DROP TABLE IF EXISTS system_config CASCADE;
-- DROP TABLE IF EXISTS performance_reports CASCADE;

-- 2. CREATE core analytics metric table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin', 'super_admin')),
    event_type TEXT NOT NULL, -- e.g., 'lesson_completed', 'live_class_held', 'system_error'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CREATE system configuration table (for App Config)
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    maintenance_mode BOOLEAN DEFAULT FALSE,
    stripe_sandbox BOOLEAN DEFAULT TRUE,
    openai_api_key TEXT,
    agora_app_id TEXT,
    brand_primary_color TEXT DEFAULT '#6C63FF',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert a default config row if none exists
INSERT INTO system_config (maintenance_mode, stripe_sandbox, openai_api_key, agora_app_id)
SELECT FALSE, TRUE, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM system_config);

-- 4. CREATE performance reports table for students and teachers
CREATE TABLE IF NOT EXISTS performance_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES auth.users(id),
    teacher_id UUID REFERENCES auth.users(id),
    subject TEXT NOT NULL,
    attendance_rate FLOAT NOT NULL,
    average_score FLOAT NOT NULL,
    teacher_remarks TEXT,
    pdf_url TEXT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ENABLE Row Level Security (RLS)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reports ENABLE ROW LEVEL SECURITY;

-- Analytics Policies
CREATE POLICY "Super Admins can read all analytics" ON analytics_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
);
CREATE POLICY "Users can read their own analytics" ON analytics_events FOR SELECT USING (
    user_id = auth.uid()
);
CREATE POLICY "System can insert analytics" ON analytics_events FOR INSERT WITH CHECK (true);

-- System Config Policies
CREATE POLICY "Super Admins can read config" ON system_config FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
);
CREATE POLICY "Super Admins can update config" ON system_config FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
);

-- Reports Policies
CREATE POLICY "Teachers can create and read reports" ON performance_reports FOR ALL USING (
    teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin', 'institution_admin'))
);
CREATE POLICY "Students can read their own reports" ON performance_reports FOR SELECT USING (
    student_id = auth.uid()
);

-- 6. ENABLE REALTIME PUBLICATION
-- Allows the NextJS frontend to `supabase.channel()` and listen to changes
ALTER PUBLICATION supabase_realtime ADD TABLE analytics_events;
ALTER PUBLICATION supabase_realtime ADD TABLE system_config;
ALTER PUBLICATION supabase_realtime ADD TABLE performance_reports;

-- 7. AI Tutor Multi-Session Chat & History System
CREATE TABLE IF NOT EXISTS ai_tutor_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    language TEXT NOT NULL DEFAULT 'en-US',
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_tutor_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES ai_tutor_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'ai', 'system')),
    text TEXT NOT NULL,
    isl_translation TEXT,
    language TEXT NOT NULL DEFAULT 'en-US',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backward compatibility for existing ai_tutor_chats
CREATE TABLE IF NOT EXISTS ai_tutor_chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES ai_tutor_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
    text TEXT NOT NULL,
    isl_translation TEXT,
    language TEXT NOT NULL DEFAULT 'en-US',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_tutor_sessions_user ON ai_tutor_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_messages_session ON ai_tutor_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_messages_user ON ai_tutor_messages(user_id);

-- Row Level Security (RLS)
ALTER TABLE ai_tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tutor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tutor_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions" ON ai_tutor_sessions FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can insert own sessions" ON ai_tutor_sessions FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can update own sessions" ON ai_tutor_sessions FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can delete own sessions" ON ai_tutor_sessions FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can read own messages" ON ai_tutor_messages FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can insert own messages" ON ai_tutor_messages FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can delete own messages" ON ai_tutor_messages FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can read own chats" ON ai_tutor_chats FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can insert own chats" ON ai_tutor_chats FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can delete own chats" ON ai_tutor_chats FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- Realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE ai_tutor_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_tutor_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_tutor_chats;

-- =========================================================================================
-- SUPER ADMIN BACKDOOR REGISTRATION LOGIC:
-- As Supabase handles auth externally, please use the NextJS app's registration / login page.
-- The login page has been hardcoded via edge condition to intercept admin@gmail.com and admin123 
-- to simulate the Super Admin Auth token.
-- =========================================================================================
