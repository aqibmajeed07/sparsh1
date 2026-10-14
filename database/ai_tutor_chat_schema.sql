-- ============================================================================
-- SPARSH AI TUTOR - CHAT SESSIONS & HISTORY SCHEMA
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ============================================================================

-- Enable required UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. CHAT SESSIONS TABLE ──────────────────────────────────────────────────
-- Stores each chat conversation thread
CREATE TABLE IF NOT EXISTS ai_tutor_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    language TEXT NOT NULL DEFAULT 'en-US',
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── 2. CHAT MESSAGES TABLE ──────────────────────────────────────────────────
-- Stores each individual message (User / AI / System) linked to a session
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

-- Backward compatibility: add session_id & isl_translation to existing ai_tutor_chats table if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_tutor_chats') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_tutor_chats' AND column_name = 'session_id') THEN
            ALTER TABLE ai_tutor_chats ADD COLUMN session_id UUID REFERENCES ai_tutor_sessions(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_tutor_chats' AND column_name = 'isl_translation') THEN
            ALTER TABLE ai_tutor_chats ADD COLUMN isl_translation TEXT;
        END IF;
    END IF;
END $$;

-- ─── 3. HIGH-PERFORMANCE QUERY INDEXES ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_tutor_sessions_user ON ai_tutor_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_messages_session ON ai_tutor_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_messages_user ON ai_tutor_messages(user_id);

-- ─── 4. AUTO-TOUCH updated_at ON SESSION ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_ai_tutor_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ai_tutor_sessions
    SET updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_tutor_session_time ON ai_tutor_messages;
CREATE TRIGGER trigger_update_ai_tutor_session_time
AFTER INSERT ON ai_tutor_messages
FOR EACH ROW
EXECUTE FUNCTION update_ai_tutor_session_timestamp();

-- ─── 5. ROW LEVEL SECURITY (RLS) POLICIES ───────────────────────────────────
ALTER TABLE ai_tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tutor_messages ENABLE ROW LEVEL SECURITY;

-- ai_tutor_sessions RLS
DROP POLICY IF EXISTS "Users can read own sessions" ON ai_tutor_sessions;
CREATE POLICY "Users can read own sessions" ON ai_tutor_sessions
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert own sessions" ON ai_tutor_sessions;
CREATE POLICY "Users can insert own sessions" ON ai_tutor_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own sessions" ON ai_tutor_sessions;
CREATE POLICY "Users can update own sessions" ON ai_tutor_sessions
    FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can delete own sessions" ON ai_tutor_sessions;
CREATE POLICY "Users can delete own sessions" ON ai_tutor_sessions
    FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- ai_tutor_messages RLS
DROP POLICY IF EXISTS "Users can read own messages" ON ai_tutor_messages;
CREATE POLICY "Users can read own messages" ON ai_tutor_messages
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert own messages" ON ai_tutor_messages;
CREATE POLICY "Users can insert own messages" ON ai_tutor_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can delete own messages" ON ai_tutor_messages;
CREATE POLICY "Users can delete own messages" ON ai_tutor_messages
    FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- Fix delete policy on legacy ai_tutor_chats table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_tutor_chats') THEN
        DROP POLICY IF EXISTS "Users can delete own chats" ON ai_tutor_chats;
        CREATE POLICY "Users can delete own chats" ON ai_tutor_chats FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);
    END IF;
END $$;

-- ─── 6. REALTIME REPLICATION ────────────────────────────────────────────────
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE ai_tutor_sessions;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE ai_tutor_messages;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
