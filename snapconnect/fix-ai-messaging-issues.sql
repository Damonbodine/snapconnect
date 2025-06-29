-- Fix AI Messaging Issues
-- Create missing table and ensure all functions are properly defined

-- 1. Create the ai_proactive_messages table that's missing
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

-- 2. Ensure RLS is enabled and properly configured
ALTER TABLE ai_proactive_messages ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own proactive message logs
CREATE POLICY "Users can view their proactive messages" ON ai_proactive_messages
  FOR SELECT USING (user_id = auth.uid());

-- Allow service role to insert proactive message logs
CREATE POLICY "Service role can insert proactive messages" ON ai_proactive_messages
  FOR INSERT WITH CHECK (true);

-- 3. Create helper function to support proactive messaging logging
CREATE OR REPLACE FUNCTION create_proactive_messages_log_if_not_exists()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function is just a placeholder since the table already exists now
  -- But it's called by the proactive messaging service
  RETURN TRUE;
END;
$$;

-- 4. Add function to get AI users with better error handling
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

-- 5. Enhanced function to mark messages as viewed with better AI support
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

-- 6. Function to get recent conversation messages for AI context with better performance
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

-- 7. Enhanced cleanup function for expired messages
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

-- Grant permissions for all functions
GRANT EXECUTE ON FUNCTION create_proactive_messages_log_if_not_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_ai_users() TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_viewed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_conversation_messages(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_messages() TO authenticated;

-- Add helpful comments
COMMENT ON TABLE ai_proactive_messages IS 'Tracks proactive messages sent by AI users to humans';
COMMENT ON FUNCTION get_available_ai_users IS 'Returns all AI users available for chat with enhanced metadata';
COMMENT ON FUNCTION mark_message_viewed IS 'Marks message as viewed with AI-aware expiration logic';
COMMENT ON FUNCTION get_recent_conversation_messages IS 'Gets recent conversation messages for AI context generation';
COMMENT ON FUNCTION cleanup_expired_messages IS 'Cleans up expired messages while preserving AI messages';

-- Insert a test proactive message log to verify the table works
INSERT INTO ai_proactive_messages (user_id, ai_user_id, message_id, trigger_type)
SELECT 
  (SELECT id FROM users WHERE email = 'test@test.com' LIMIT 1),
  (SELECT id FROM users WHERE is_mock_user = TRUE LIMIT 1),
  (SELECT id FROM messages ORDER BY sent_at DESC LIMIT 1),
  'diagnostic_test'
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'test@test.com')
  AND EXISTS (SELECT 1 FROM users WHERE is_mock_user = TRUE)
  AND EXISTS (SELECT 1 FROM messages)
ON CONFLICT DO NOTHING;