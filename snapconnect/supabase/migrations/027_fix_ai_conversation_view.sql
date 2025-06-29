-- Fix AI conversation view
-- Allow viewing conversations with AI users even without friendship

-- Enhanced function to get messages that includes AI conversations
CREATE OR REPLACE FUNCTION get_messages_with_ai_support(
  other_user_id UUID, 
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  sender_id UUID,
  receiver_id UUID,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  message_type TEXT,
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_viewed BOOLEAN,
  viewed_at TIMESTAMPTZ,
  sender_username TEXT,
  receiver_username TEXT,
  is_expired BOOLEAN,
  is_ai_sender BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  other_user_is_ai BOOLEAN;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if the other user is an AI
  SELECT COALESCE(is_mock_user, FALSE) INTO other_user_is_ai
  FROM users 
  WHERE id = other_user_id;
  
  -- If other user is AI, allow conversation regardless of friendship
  -- If other user is human, require friendship
  IF NOT other_user_is_ai THEN
    -- Check if they are friends (original logic)
    IF NOT EXISTS (
      SELECT 1 FROM friendships 
      WHERE ((user_id = current_user_id AND friend_id = other_user_id) 
             OR (friend_id = current_user_id AND user_id = other_user_id))
        AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Can only view messages with friends or AI users';
    END IF;
  END IF;
  
  -- Return messages between the two users
  RETURN QUERY
  SELECT 
    m.id,
    m.sender_id,
    m.receiver_id,
    m.content,
    m.media_url,
    m.media_type,
    m.message_type,
    m.sent_at,
    m.expires_at,
    m.is_viewed,
    m.viewed_at,
    s.username as sender_username,
    r.username as receiver_username,
    (m.expires_at IS NOT NULL AND m.expires_at < NOW()) as is_expired,
    COALESCE(m.is_ai_sender, FALSE) as is_ai_sender
  FROM messages m
  JOIN users s ON m.sender_id = s.id
  JOIN users r ON m.receiver_id = r.id
  WHERE 
    ((m.sender_id = current_user_id AND m.receiver_id = other_user_id) 
     OR (m.sender_id = other_user_id AND m.receiver_id = current_user_id))
    AND (
      -- Include non-expired messages
      (m.expires_at IS NULL OR m.expires_at > NOW())
      OR 
      -- Always include AI messages even if they would be "expired" (they shouldn't expire anyway)
      COALESCE(m.is_ai_sender, FALSE) = TRUE
    )
  ORDER BY m.sent_at DESC
  LIMIT limit_count;
END;
$$;

-- Enhanced conversation list that includes AI conversations
CREATE OR REPLACE FUNCTION get_user_conversations_with_ai()
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
      COALESCE(m.is_ai_sender, FALSE) as is_ai_sender,
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
      AND (
        -- Non-expired messages
        (m.expires_at IS NULL OR m.expires_at > NOW())
        OR
        -- Always include AI messages
        COALESCE(m.is_ai_sender, FALSE) = TRUE
      )
  ),
  unread_counts AS (
    SELECT 
      m.sender_id as friend_user_id,
      COUNT(*) as unread_count
    FROM messages m
    WHERE 
      m.receiver_id = current_user_id 
      AND m.is_viewed = FALSE
      AND (
        (m.expires_at IS NULL OR m.expires_at > NOW())
        OR
        COALESCE(m.is_ai_sender, FALSE) = TRUE
      )
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
      COALESCE(u.is_mock_user, FALSE) = TRUE
    )
  ORDER BY lm.sent_at DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_messages_with_ai_support(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations_with_ai() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION get_messages_with_ai_support IS 'Get messages between users, supports AI conversations without friendship requirement';
COMMENT ON FUNCTION get_user_conversations_with_ai IS 'Get conversation list including AI conversations';