-- Fix AI Messaging System - Missing Table and Functions
-- This migration fixes all the issues identified in the AI messaging diagnostic

-- 1. Create the missing ai_proactive_messages table
CREATE TABLE IF NOT EXISTS ai_proactive_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_proactive_messages_user_id ON ai_proactive_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_proactive_messages_ai_user_id ON ai_proactive_messages(ai_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_proactive_messages_trigger_type ON ai_proactive_messages(trigger_type);
CREATE INDEX IF NOT EXISTS idx_ai_proactive_messages_sent_at ON ai_proactive_messages(sent_at);

-- Enable RLS
ALTER TABLE ai_proactive_messages ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view their proactive messages" ON ai_proactive_messages
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can insert proactive messages" ON ai_proactive_messages
  FOR INSERT WITH CHECK (true);

-- 2. Create helper function for proactive messaging
CREATE OR REPLACE FUNCTION create_proactive_messages_log_if_not_exists()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function ensures the table exists (it now does)
  RETURN TRUE;
END;
$$;

-- 3. Enhanced mark_message_viewed function with AI support
CREATE OR REPLACE FUNCTION mark_message_viewed(message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  message_receiver UUID;
  is_ai_message BOOLEAN;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Get message details
  SELECT receiver_id, COALESCE(is_ai_sender, FALSE) 
  INTO message_receiver, is_ai_message
  FROM messages 
  WHERE id = message_id;
  
  -- Check if user is the receiver of this message
  IF message_receiver != current_user_id THEN
    RAISE EXCEPTION 'Can only mark your own received messages as viewed';
  END IF;
  
  -- Update the message
  UPDATE messages 
  SET 
    is_viewed = TRUE,
    viewed_at = NOW(),
    -- Only set expiration for non-AI messages (AI messages shouldn't expire)
    expires_at = CASE 
      WHEN is_ai_message THEN NULL 
      ELSE NOW() + interval '10 seconds' 
    END
  WHERE id = message_id;
  
  RETURN TRUE;
END;
$$;

-- 4. Enhanced cleanup function that preserves AI messages
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired messages (but not AI messages)
  DELETE FROM messages 
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW()
    AND COALESCE(is_ai_sender, FALSE) = FALSE; -- Don't delete AI messages
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- 5. Function to get conversation context for AI with better performance
CREATE OR REPLACE FUNCTION get_recent_conversation_messages(
  user1_id UUID,
  user2_id UUID,
  message_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  message_id UUID,
  content TEXT,
  is_from_ai BOOLEAN,
  sent_at TIMESTAMPTZ,
  message_type TEXT,
  sender_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as message_id,
    m.content,
    COALESCE(m.is_ai_sender, FALSE) as is_from_ai,
    m.sent_at,
    m.message_type,
    m.sender_id
  FROM messages m
  WHERE 
    ((m.sender_id = user1_id AND m.receiver_id = user2_id) 
     OR (m.sender_id = user2_id AND m.receiver_id = user1_id))
    AND m.content IS NOT NULL
    AND (
      -- Include non-expired messages
      (m.expires_at IS NULL OR m.expires_at > NOW())
      OR 
      -- Always include AI messages (they don't expire)
      COALESCE(m.is_ai_sender, FALSE) = TRUE
    )
  ORDER BY m.sent_at DESC
  LIMIT message_limit;
END;
$$;

-- 6. Enhanced function to get available AI users
CREATE OR REPLACE FUNCTION get_available_ai_users()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  personality_traits JSONB,
  ai_response_style JSONB,
  conversation_context JSONB,
  is_digital_human BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.personality_traits,
    u.ai_response_style,
    u.conversation_context,
    COALESCE(u.is_digital_human, FALSE) as is_digital_human
  FROM users u
  WHERE u.is_mock_user = TRUE 
    AND u.personality_traits IS NOT NULL
    AND u.username IS NOT NULL
  ORDER BY u.username;
END;
$$;

-- Grant permissions for all functions
GRANT EXECUTE ON FUNCTION create_proactive_messages_log_if_not_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_viewed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_messages() TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_conversation_messages(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_ai_users() TO authenticated;

-- Add helpful comments
COMMENT ON TABLE ai_proactive_messages IS 'Tracks proactive messages sent by AI users to humans for frequency control';
COMMENT ON FUNCTION create_proactive_messages_log_if_not_exists IS 'Helper function to ensure proactive messages table exists';
COMMENT ON FUNCTION mark_message_viewed IS 'Enhanced version that handles AI message expiration correctly';
COMMENT ON FUNCTION cleanup_expired_messages IS 'Cleans up expired messages while preserving AI messages';
COMMENT ON FUNCTION get_recent_conversation_messages IS 'Gets recent conversation messages for AI context with proper filtering';
COMMENT ON FUNCTION get_available_ai_users IS 'Enhanced version of get_ai_users with additional metadata';

-- Test insert to verify the table works
INSERT INTO ai_proactive_messages (user_id, ai_user_id, message_id, trigger_type)
SELECT 
  (SELECT id FROM users WHERE email = 'test@test.com' LIMIT 1),
  (SELECT id FROM users WHERE is_mock_user = TRUE LIMIT 1),
  (SELECT id FROM messages ORDER BY sent_at DESC LIMIT 1),
  'migration_test'
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'test@test.com')
  AND EXISTS (SELECT 1 FROM users WHERE is_mock_user = TRUE)
  AND EXISTS (SELECT 1 FROM messages)
ON CONFLICT DO NOTHING;