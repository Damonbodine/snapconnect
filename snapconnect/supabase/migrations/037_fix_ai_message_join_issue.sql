-- Fix critical JOIN issue that breaks AI message positioning
-- AI messages have sender_id = NULL, so INNER JOIN excludes them completely

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
  WHERE users.id = other_user_id;
  
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
  -- CRITICAL FIX: Use LEFT JOIN to include AI messages with NULL sender_id
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
    -- Handle NULL sender_id for AI messages
    COALESCE(s.username, 'AI Assistant') as sender_username,
    r.username as receiver_username,
    (m.expires_at IS NOT NULL AND m.expires_at < NOW()) as is_expired,
    COALESCE(m.is_ai_sender, FALSE) as is_ai_sender
  FROM messages m
  -- LEFT JOIN allows AI messages with NULL sender_id to be included
  LEFT JOIN users s ON m.sender_id = s.id
  -- Regular JOIN for receiver since it's never NULL
  JOIN users r ON m.receiver_id = r.id
  WHERE 
    ((m.sender_id = current_user_id AND m.receiver_id = other_user_id) 
     OR (m.sender_id = other_user_id AND m.receiver_id = current_user_id)
     -- CRITICAL: Include AI messages where sender_id is NULL
     OR (m.sender_id IS NULL AND m.receiver_id = current_user_id AND COALESCE(m.is_ai_sender, FALSE) = TRUE))
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

-- Add helpful comment explaining the fix
COMMENT ON FUNCTION get_messages_with_ai_support IS 'Fixed to properly handle AI messages with NULL sender_id using LEFT JOIN and explicit NULL checks';