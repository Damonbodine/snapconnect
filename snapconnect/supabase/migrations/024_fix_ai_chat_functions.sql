-- Fix AI chat support - properly update existing functions
-- This addresses the function signature conflict from migration 023

-- Drop and recreate the get_user_conversations function with AI support
DROP FUNCTION IF EXISTS get_user_conversations();

CREATE OR REPLACE FUNCTION get_user_conversations()
RETURNS TABLE (
  friend_id UUID,
  friend_username TEXT,
  friend_full_name TEXT,
  friend_avatar_url TEXT,
  last_message_id UUID,
  last_message_content TEXT,
  last_message_type TEXT,
  last_message_sent_at TIMESTAMPTZ,
  unread_count INTEGER,
  is_sender BOOLEAN,
  is_ai_conversation BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  RETURN QUERY
  WITH latest_messages AS (
    SELECT 
      CASE 
        WHEN m.sender_id = current_user_id THEN m.receiver_id 
        ELSE m.sender_id 
      END as friend_user_id,
      m.id,
      m.content,
      m.message_type,
      m.sent_at,
      m.sender_id = current_user_id as is_sender,
      m.is_ai_sender,
      ROW_NUMBER() OVER (
        PARTITION BY 
          CASE 
            WHEN m.sender_id = current_user_id THEN m.receiver_id 
            ELSE m.sender_id 
          END 
        ORDER BY m.sent_at DESC
      ) as rn
    FROM messages m
    WHERE 
      (m.sender_id = current_user_id OR m.receiver_id = current_user_id)
      AND (m.expires_at IS NULL OR m.expires_at > NOW()) -- Only non-expired messages
  ),
  unread_counts AS (
    SELECT 
      m.sender_id as friend_user_id,
      COUNT(*) as unread_count
    FROM messages m
    WHERE 
      m.receiver_id = current_user_id 
      AND m.is_viewed = FALSE
      AND (m.expires_at IS NULL OR m.expires_at > NOW())
    GROUP BY m.sender_id
  )
  SELECT 
    u.id as friend_id,
    u.username as friend_username,
    u.full_name as friend_full_name,
    u.avatar_url as friend_avatar_url,
    lm.id as last_message_id,
    lm.content as last_message_content,
    lm.message_type as last_message_type,
    lm.sent_at as last_message_sent_at,
    COALESCE(uc.unread_count, 0)::INTEGER as unread_count,
    lm.is_sender,
    COALESCE(u.is_mock_user, FALSE) as is_ai_conversation
  FROM latest_messages lm
  JOIN users u ON lm.friend_user_id = u.id
  LEFT JOIN unread_counts uc ON uc.friend_user_id = u.id
  WHERE lm.rn = 1 -- Only latest message per conversation
    AND (
      -- Include friends (existing logic)
      EXISTS (
        SELECT 1 FROM friendships f
        WHERE ((f.user_id = current_user_id AND f.friend_id = u.id) 
               OR (f.friend_id = current_user_id AND f.user_id = u.id))
          AND f.status = 'accepted'
      )
      OR
      -- Include AI conversations (new logic)
      u.is_mock_user = TRUE
    )
  ORDER BY lm.sent_at DESC;
END;
$$;

-- Ensure all the other functions from migration 023 exist
-- (In case they didn't get created due to the function conflict)

-- Re-create send_ai_message function (idempotent)
CREATE OR REPLACE FUNCTION send_ai_message(
  ai_user_id UUID,
  receiver_user_id UUID,
  message_content TEXT DEFAULT NULL,
  message_media_url TEXT DEFAULT NULL,
  message_media_type TEXT DEFAULT NULL,
  personality_type TEXT DEFAULT NULL,
  context_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_message_id UUID;
  msg_type TEXT;
  is_ai_user BOOLEAN;
BEGIN
  -- Verify the sender is actually an AI user
  SELECT is_mock_user INTO is_ai_user
  FROM users 
  WHERE id = ai_user_id;
  
  IF is_ai_user IS NULL OR is_ai_user = FALSE THEN
    RAISE EXCEPTION 'Only AI users can use this function';
  END IF;
  
  -- Check if receiver exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = receiver_user_id) THEN
    RAISE EXCEPTION 'Receiver user not found';
  END IF;
  
  -- Determine message type
  IF message_content IS NOT NULL AND message_media_url IS NOT NULL THEN
    msg_type := 'mixed';
  ELSIF message_media_url IS NOT NULL THEN
    msg_type := message_media_type; -- 'photo' or 'video'
  ELSE
    msg_type := 'text';
  END IF;
  
  -- Insert new AI message
  INSERT INTO messages (
    sender_id, 
    receiver_id, 
    content, 
    media_url, 
    media_type,
    message_type,
    is_ai_sender,
    ai_personality_type,
    response_context
  )
  VALUES (
    ai_user_id, 
    receiver_user_id, 
    message_content, 
    message_media_url, 
    message_media_type,
    msg_type,
    TRUE,
    personality_type,
    context_data
  )
  RETURNING id INTO new_message_id;
  
  RETURN new_message_id;
END;
$$;

-- Re-create get_ai_conversation_context function (idempotent)
CREATE OR REPLACE FUNCTION get_ai_conversation_context(
  ai_user_id UUID,
  human_user_id UUID,
  message_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  message_id UUID,
  content TEXT,
  is_from_ai BOOLEAN,
  sent_at TIMESTAMPTZ,
  message_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return recent message history between AI and human
  RETURN QUERY
  SELECT 
    m.id as message_id,
    m.content,
    m.is_ai_sender as is_from_ai,
    m.sent_at,
    m.message_type
  FROM messages m
  WHERE 
    ((m.sender_id = ai_user_id AND m.receiver_id = human_user_id) 
     OR (m.sender_id = human_user_id AND m.receiver_id = ai_user_id))
    AND (m.expires_at IS NULL OR m.expires_at > NOW()) -- Only non-expired messages
  ORDER BY m.sent_at DESC
  LIMIT message_limit;
END;
$$;

-- Re-create get_ai_users function (idempotent)
CREATE OR REPLACE FUNCTION get_ai_users()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  personality_traits JSONB,
  ai_response_style JSONB,
  conversation_context JSONB
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
    u.conversation_context
  FROM users u
  WHERE u.is_mock_user = TRUE AND u.personality_traits IS NOT NULL
  ORDER BY u.username;
END;
$$;

-- Grant permissions for all functions
GRANT EXECUTE ON FUNCTION send_ai_message(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_conversation_context(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION send_ai_message IS 'Allows AI users to send messages to any user, bypassing friendship requirements';
COMMENT ON FUNCTION get_ai_conversation_context IS 'Gets conversation history between AI and human user for context';
COMMENT ON FUNCTION get_ai_users IS 'Returns all AI users available for chat';
COMMENT ON FUNCTION get_user_conversations IS 'Updated to include AI conversations alongside friend conversations';