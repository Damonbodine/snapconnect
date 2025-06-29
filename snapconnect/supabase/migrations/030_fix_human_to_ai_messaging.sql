-- Fix human-to-AI messaging by allowing messages to AI users without friendship requirement
-- This fixes the issue where humans can't send messages to AI users due to friendship requirement

-- Update the send_message function to allow messaging AI users without friendship
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
  receiver_is_ai BOOLEAN;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is trying to message themselves
  IF current_user_id = receiver_user_id THEN
    RAISE EXCEPTION 'Cannot send message to yourself';
  END IF;
  
  -- Check if receiver is an AI user
  SELECT COALESCE(is_mock_user, FALSE) INTO receiver_is_ai
  FROM users 
  WHERE id = receiver_user_id;
  
  -- If receiver is human, check friendship requirement
  -- If receiver is AI, skip friendship check
  IF NOT receiver_is_ai THEN
    -- Check if they are friends (original logic for human-to-human messaging)
    IF NOT EXISTS (
      SELECT 1 FROM friendships 
      WHERE ((user_id = current_user_id AND friend_id = receiver_user_id) 
             OR (friend_id = current_user_id AND user_id = receiver_user_id))
        AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Can only send messages to friends';
    END IF;
  END IF;
  -- Note: If receiver_is_ai is TRUE, we skip the friendship check entirely
  
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

-- Update the RLS policy to allow humans to send messages to AI users
CREATE POLICY "Users can send messages to AI users" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    -- Allow if receiver is an AI user (bypasses friendship requirement)
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = receiver_id AND is_mock_user = TRUE
    )
  );

-- Add helpful comment
COMMENT ON FUNCTION send_message IS 'Updated to allow humans to message AI users without friendship requirement';