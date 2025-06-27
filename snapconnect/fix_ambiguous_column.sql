-- Fix the ambiguous column reference in get_messages_between_friends function

CREATE OR REPLACE FUNCTION get_messages_between_friends(friend_id UUID, limit_count INTEGER DEFAULT 50)
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
  is_expired BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if they are friends
  IF NOT EXISTS (
    SELECT 1 FROM friendships 
    WHERE ((user_id = current_user_id AND friend_id = get_messages_between_friends.friend_id) 
           OR (friend_id = current_user_id AND user_id = get_messages_between_friends.friend_id))
      AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Can only view messages with friends';
  END IF;
  
  -- Return messages between the two users (excluding expired ones)
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
    (m.expires_at IS NOT NULL AND m.expires_at < NOW()) as is_expired
  FROM messages m
  JOIN users s ON m.sender_id = s.id
  JOIN users r ON m.receiver_id = r.id
  WHERE 
    ((m.sender_id = current_user_id AND m.receiver_id = get_messages_between_friends.friend_id) 
     OR (m.sender_id = get_messages_between_friends.friend_id AND m.receiver_id = current_user_id))
    AND (m.expires_at IS NULL OR m.expires_at > NOW()) -- Only non-expired messages
  ORDER BY m.sent_at DESC
  LIMIT limit_count;
END;
$$;