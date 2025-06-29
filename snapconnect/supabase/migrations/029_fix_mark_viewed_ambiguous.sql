-- Fix ambiguous column reference in mark_ai_message_viewed function

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
  
  -- Get message details (qualified table references)
  SELECT m.receiver_id, COALESCE(m.is_ai_sender, FALSE) 
  INTO message_receiver, is_ai_message
  FROM messages m
  WHERE m.id = message_id;
  
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
    WHERE messages.id = message_id 
      AND messages.receiver_id = current_user_id
      AND messages.is_viewed = FALSE;
  ELSE
    -- Regular messages: use original ephemeral behavior
    UPDATE messages 
    SET 
      is_viewed = TRUE,
      viewed_at = NOW(),
      expires_at = NOW() + INTERVAL '10 seconds'
    WHERE messages.id = message_id 
      AND messages.receiver_id = current_user_id
      AND messages.is_viewed = FALSE;
  END IF;
  
  -- Insert view record (qualified table references)
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