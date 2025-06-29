-- Migration: Add Voice Coaching Support
-- 🎙️ Enhances existing coach_conversations table to support voice interactions

-- Add voice-specific columns to existing coach_conversations table
-- (We'll reuse the existing ai_coaching_messages table structure and rename/enhance it)

-- First, create the new enhanced table structure
CREATE TABLE IF NOT EXISTS coach_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  is_user_message BOOLEAN NOT NULL DEFAULT false,
  is_voice_message BOOLEAN NOT NULL DEFAULT false,
  audio_duration INTEGER, -- Duration in seconds for voice messages
  context_snapshot JSONB, -- Full enhanced context at time of message
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coach_conversations_user_id ON coach_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_conversations_created_at ON coach_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_coach_conversations_user_recent ON coach_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_conversations_voice ON coach_conversations(user_id, is_voice_message);

-- Enable RLS (Row Level Security)
ALTER TABLE coach_conversations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own coach conversations" ON coach_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coach conversations" ON coach_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coach conversations" ON coach_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own coach conversations" ON coach_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_coach_conversations_updated_at ON coach_conversations;
CREATE TRIGGER update_coach_conversations_updated_at
  BEFORE UPDATE ON coach_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create a view for easy conversation retrieval with user info
CREATE OR REPLACE VIEW coach_conversations_with_context AS
SELECT 
  cc.*,
  u.username,
  u.full_name,
  u.fitness_level,
  u.coaching_style
FROM coach_conversations cc
JOIN users u ON cc.user_id = u.id;

-- Function to get recent conversation history for a user
CREATE OR REPLACE FUNCTION get_recent_coach_conversation(
  target_user_id UUID,
  message_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  message_text TEXT,
  is_user_message BOOLEAN,
  is_voice_message BOOLEAN,
  audio_duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id,
    cc.message_text,
    cc.is_user_message,
    cc.is_voice_message,
    cc.audio_duration,
    cc.created_at
  FROM coach_conversations cc
  WHERE cc.user_id = target_user_id
  ORDER BY cc.created_at DESC
  LIMIT message_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get conversation statistics
CREATE OR REPLACE FUNCTION get_coach_conversation_stats(target_user_id UUID)
RETURNS TABLE (
  total_messages BIGINT,
  voice_messages BIGINT,
  text_messages BIGINT,
  user_messages BIGINT,
  coach_messages BIGINT,
  total_voice_duration INTEGER,
  first_conversation TIMESTAMP WITH TIME ZONE,
  last_conversation TIMESTAMP WITH TIME ZONE,
  conversations_today BIGINT,
  conversations_this_week BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_messages,
    COUNT(*) FILTER (WHERE is_voice_message = true) as voice_messages,
    COUNT(*) FILTER (WHERE is_voice_message = false) as text_messages,
    COUNT(*) FILTER (WHERE is_user_message = true) as user_messages,
    COUNT(*) FILTER (WHERE is_user_message = false) as coach_messages,
    COALESCE(SUM(audio_duration), 0)::INTEGER as total_voice_duration,
    MIN(created_at) as first_conversation,
    MAX(created_at) as last_conversation,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as conversations_today,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as conversations_this_week
  FROM coach_conversations
  WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old conversations (for data management)
CREATE OR REPLACE FUNCTION cleanup_old_coach_conversations(
  days_to_keep INTEGER DEFAULT 90
)
RETURNS BIGINT AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  DELETE FROM coach_conversations 
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the functions
GRANT EXECUTE ON FUNCTION get_recent_coach_conversation(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_coach_conversation_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_coach_conversations(INTEGER) TO service_role;

-- Add helpful comments
COMMENT ON TABLE coach_conversations IS 'Voice and text conversations between users and Coach Alex';
COMMENT ON COLUMN coach_conversations.is_voice_message IS 'True if this message was input/output via voice';
COMMENT ON COLUMN coach_conversations.audio_duration IS 'Duration in seconds for voice messages';
COMMENT ON COLUMN coach_conversations.context_snapshot IS 'Full enhanced context (health, social, events) at time of message';

-- Insert some example data for testing (optional)
-- INSERT INTO coach_conversations (user_id, message_text, is_user_message, is_voice_message, context_snapshot)
-- VALUES 
--   ('user-uuid-here', 'Hello Coach Alex!', true, false, '{"test": true}'),
--   ('user-uuid-here', 'Hi there! How are you feeling today?', false, false, '{"test": true}');

-- Success message
SELECT 'Voice coaching database schema created successfully! 🎙️' as status;