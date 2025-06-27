-- Add ephemeral messaging system for friends
-- Messages disappear 10 seconds after being viewed
-- Only friends can send messages to each other

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  content TEXT, -- Text content (nullable for media-only messages)
  media_url TEXT, -- Photo/video URL 
  media_type TEXT CHECK (media_type IN ('photo', 'video')) DEFAULT NULL,
  message_type TEXT CHECK (message_type IN ('text', 'photo', 'video', 'mixed')) DEFAULT 'text',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE, -- Set when message is viewed
  is_viewed BOOLEAN DEFAULT FALSE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Ensure users can't message themselves
  CONSTRAINT check_different_users CHECK (sender_id != receiver_id)
);

-- Create message_views table for tracking ephemeral behavior
CREATE TABLE message_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Unique constraint to prevent duplicate views
  UNIQUE(message_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX idx_messages_receiver_sender ON messages(receiver_id, sender_id);
CREATE INDEX idx_messages_sent_at ON messages(sent_at DESC);
CREATE INDEX idx_messages_expires_at ON messages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_message_views_message_id ON message_views(message_id);
CREATE INDEX idx_message_views_user_id ON message_views(user_id);

-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages
-- Users can view messages they sent or received
CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Users can send messages to their friends only
CREATE POLICY "Users can send messages to friends" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    -- Check if receiver is a friend
    EXISTS (
      SELECT 1 FROM friendships 
      WHERE ((user_id = auth.uid() AND friend_id = receiver_id) 
             OR (friend_id = auth.uid() AND user_id = receiver_id))
        AND status = 'accepted'
    )
  );

-- Users can update their own sent messages (for marking viewed)
CREATE POLICY "Users can update their sent messages" ON messages
  FOR UPDATE USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Users cannot delete messages (they expire automatically)
CREATE POLICY "Prevent message deletion" ON messages
  FOR DELETE USING (FALSE);

-- RLS Policies for message_views
-- Users can view their own message views
CREATE POLICY "Users can view their message views" ON message_views
  FOR SELECT USING (
    auth.uid() = user_id
  );

-- Users can insert message views for messages they received
CREATE POLICY "Users can mark messages as viewed" ON message_views
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    -- Ensure the message exists and user is the receiver
    EXISTS (
      SELECT 1 FROM messages 
      WHERE id = message_id AND receiver_id = auth.uid()
    )
  );

-- Function to send a message between friends
CREATE OR REPLACE FUNCTION send_message(
  receiver_user_id UUID,
  message_content TEXT DEFAULT NULL,
  message_media_url TEXT DEFAULT NULL,
  message_media_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_message_id UUID;
  current_user_id UUID;
  msg_type TEXT;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is trying to message themselves
  IF current_user_id = receiver_user_id THEN
    RAISE EXCEPTION 'Cannot send message to yourself';
  END IF;
  
  -- Check if they are friends
  IF NOT EXISTS (
    SELECT 1 FROM friendships 
    WHERE ((user_id = current_user_id AND friend_id = receiver_user_id) 
           OR (friend_id = current_user_id AND user_id = receiver_user_id))
      AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Can only send messages to friends';
  END IF;
  
  -- Determine message type
  IF message_content IS NOT NULL AND message_media_url IS NOT NULL THEN
    msg_type := 'mixed';
  ELSIF message_media_url IS NOT NULL THEN
    msg_type := message_media_type; -- 'photo' or 'video'
  ELSE
    msg_type := 'text';
  END IF;
  
  -- Insert new message
  INSERT INTO messages (
    sender_id, 
    receiver_id, 
    content, 
    media_url, 
    media_type,
    message_type
  )
  VALUES (
    current_user_id, 
    receiver_user_id, 
    message_content, 
    message_media_url, 
    message_media_type,
    msg_type
  )
  RETURNING id INTO new_message_id;
  
  RETURN new_message_id;
END;
$$;

-- Function to mark a message as viewed (starts the 10-second timer)
CREATE OR REPLACE FUNCTION mark_message_viewed(message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  message_receiver UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Get message receiver to verify access
  SELECT receiver_id INTO message_receiver
  FROM messages 
  WHERE id = message_id;
  
  -- Check if message exists and user is the receiver
  IF message_receiver IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  IF message_receiver != current_user_id THEN
    RAISE EXCEPTION 'Can only mark your own received messages as viewed';
  END IF;
  
  -- Update message with view timestamp and expiration (10 seconds from now)
  UPDATE messages 
  SET 
    is_viewed = TRUE,
    viewed_at = NOW(),
    expires_at = NOW() + INTERVAL '10 seconds'
  WHERE id = message_id 
    AND receiver_id = current_user_id
    AND is_viewed = FALSE; -- Only mark as viewed once
  
  -- Insert view record
  INSERT INTO message_views (message_id, user_id)
  VALUES (message_id, current_user_id)
  ON CONFLICT (message_id, user_id) DO NOTHING;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to get messages between two friends
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
    WHERE ((user_id = current_user_id AND friend_id = friend_id) 
           OR (friend_id = current_user_id AND user_id = friend_id))
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
    ((m.sender_id = current_user_id AND m.receiver_id = friend_id) 
     OR (m.sender_id = friend_id AND m.receiver_id = current_user_id))
    AND (m.expires_at IS NULL OR m.expires_at > NOW()) -- Only non-expired messages
  ORDER BY m.sent_at DESC
  LIMIT limit_count;
END;
$$;

-- Function to get conversation list for a user
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
  is_sender BOOLEAN
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
    lm.is_sender
  FROM latest_messages lm
  JOIN users u ON lm.friend_user_id = u.id
  LEFT JOIN unread_counts uc ON uc.friend_user_id = u.id
  WHERE lm.rn = 1 -- Only latest message per conversation
    AND EXISTS ( -- Only include friends
      SELECT 1 FROM friendships f
      WHERE ((f.user_id = current_user_id AND f.friend_id = u.id) 
             OR (f.friend_id = current_user_id AND f.user_id = u.id))
        AND f.status = 'accepted'
    )
  ORDER BY lm.sent_at DESC;
END;
$$;

-- Function to cleanup expired messages (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired messages
  DELETE FROM messages 
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION send_message(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_viewed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_messages_between_friends(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_messages() TO authenticated;

-- Create a scheduled job to cleanup expired messages every minute
-- Note: This requires pg_cron extension to be enabled
-- SELECT cron.schedule('cleanup-expired-messages', '* * * * *', 'SELECT cleanup_expired_messages();');