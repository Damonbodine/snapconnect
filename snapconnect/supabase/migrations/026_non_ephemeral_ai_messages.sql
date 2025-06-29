-- Non-ephemeral AI messages for testing
-- AI messages won't expire when viewed

-- Create modified mark_message_viewed function for AI messages
CREATE OR REPLACE FUNCTION mark_ai_message_viewed(message_id UUID)
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
  
  -- Check if message exists and user is the receiver
  IF message_receiver IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  IF message_receiver != current_user_id THEN
    RAISE EXCEPTION 'Can only mark your own received messages as viewed';
  END IF;
  
  -- Update message - DON'T set expiration for AI messages
  IF is_ai_message THEN
    -- AI messages: mark as viewed but don't expire
    UPDATE messages 
    SET 
      is_viewed = TRUE,
      viewed_at = NOW()
      -- No expires_at for AI messages!
    WHERE id = message_id 
      AND receiver_id = current_user_id
      AND is_viewed = FALSE;
  ELSE
    -- Regular messages: use original ephemeral behavior
    UPDATE messages 
    SET 
      is_viewed = TRUE,
      viewed_at = NOW(),
      expires_at = NOW() + INTERVAL '10 seconds'
    WHERE id = message_id 
      AND receiver_id = current_user_id
      AND is_viewed = FALSE;
  END IF;
  
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

-- Enhanced send_ai_message that ensures non-ephemeral behavior
CREATE OR REPLACE FUNCTION send_non_ephemeral_ai_message(
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
  
  -- Insert new AI message with explicit non-ephemeral settings
  INSERT INTO messages (
    sender_id, 
    receiver_id, 
    content, 
    media_url, 
    media_type,
    message_type,
    is_ai_sender,
    ai_personality_type,
    response_context,
    expires_at -- Explicitly set to NULL for non-ephemeral
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
    context_data,
    NULL -- Never expires!
  )
  RETURNING id INTO new_message_id;
  
  RETURN new_message_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION mark_ai_message_viewed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION send_non_ephemeral_ai_message(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION mark_ai_message_viewed IS 'Mark AI messages as viewed without setting expiration (non-ephemeral)';
COMMENT ON FUNCTION send_non_ephemeral_ai_message IS 'Send AI messages that never expire, even when viewed';