-- Migration to remove all message expiration functionality
-- This makes all messages persistent and removes ephemeral behavior

-- Update existing messages to remove expiration
UPDATE messages 
SET expires_at = NULL 
WHERE expires_at IS NOT NULL;

-- Drop the expiration index since we no longer need it
DROP INDEX IF EXISTS idx_messages_expires_at;

-- Update mark_message_viewed function to not set expiration
CREATE OR REPLACE FUNCTION mark_message_viewed(message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    message_record RECORD;
    sender_user_id UUID;
    viewer_user_id UUID;
BEGIN
    -- Get the current user
    viewer_user_id := auth.uid();
    
    IF viewer_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Get message details
    SELECT * INTO message_record 
    FROM messages 
    WHERE id = message_id;
    
    IF message_record IS NULL THEN
        RETURN FALSE;
    END IF;
    
    sender_user_id := message_record.sender_id;
    
    -- Verify the viewer is either sender or recipient
    IF viewer_user_id != sender_user_id AND viewer_user_id != message_record.receiver_id THEN
        RETURN FALSE;
    END IF;
    
    -- Update the message as viewed (no expiration set)
    UPDATE messages 
    SET 
        is_viewed = TRUE,
        viewed_at = NOW()
    WHERE id = message_id;
    
    RETURN TRUE;
END;
$$;

-- Update mark_ai_message_viewed function (already doesn't set expiration but let's be explicit)
CREATE OR REPLACE FUNCTION mark_ai_message_viewed(message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    message_record RECORD;
    viewer_user_id UUID;
BEGIN
    -- Get the current user
    viewer_user_id := auth.uid();
    
    IF viewer_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Get message details
    SELECT * INTO message_record 
    FROM messages 
    WHERE id = message_id;
    
    IF message_record IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verify the viewer is the recipient of the AI message
    IF viewer_user_id != message_record.receiver_id THEN
        RETURN FALSE;
    END IF;
    
    -- Update the message as viewed (no expiration for AI messages)
    UPDATE messages 
    SET 
        is_viewed = TRUE,
        viewed_at = NOW()
    WHERE id = message_id;
    
    RETURN TRUE;
END;
$$;

-- Drop and recreate get_messages_between_friends to not filter expired messages
DROP FUNCTION IF EXISTS get_messages_between_friends(UUID, INTEGER);
CREATE OR REPLACE FUNCTION get_messages_between_friends(target_friend_id UUID, limit_count INTEGER DEFAULT 50)
RETURNS TABLE(
    id UUID,
    sender_id UUID,
    receiver_id UUID,
    content TEXT,
    media_url TEXT,
    media_type TEXT,
    created_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_ai_sender BOOLEAN,
    message_type TEXT,
    sent_at TIMESTAMPTZ,
    is_viewed BOOLEAN,
    ai_personality_type TEXT,
    response_context JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    RETURN QUERY
    SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.content,
        m.media_url,
        m.media_type,
        m.created_at,
        m.viewed_at,
        m.expires_at,
        m.is_ai_sender,
        m.message_type,
        m.sent_at,
        m.is_viewed,
        m.ai_personality_type,
        m.response_context
    FROM messages m
    WHERE 
        (m.sender_id = current_user_id AND m.receiver_id = target_friend_id)
        OR 
        (m.sender_id = target_friend_id AND m.receiver_id = current_user_id)
        -- Removed: AND (m.expires_at IS NULL OR m.expires_at > NOW())
    ORDER BY m.created_at DESC
    LIMIT limit_count;
END;
$$;

-- Remove the cleanup_expired_messages function since we no longer need it
DROP FUNCTION IF EXISTS cleanup_expired_messages();

-- Drop and recreate send_message function to not set expiration
DROP FUNCTION IF EXISTS send_message(UUID, TEXT, TEXT, TEXT);
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
    sender_user_id UUID;
    message_id UUID;
BEGIN
    sender_user_id := auth.uid();
    
    IF sender_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;
    
    IF message_content IS NULL AND message_media_url IS NULL THEN
        RAISE EXCEPTION 'Message must have either content or media';
    END IF;
    
    INSERT INTO messages (sender_id, receiver_id, content, media_url, media_type, is_ai_sender)
    VALUES (sender_user_id, receiver_user_id, message_content, message_media_url, message_media_type, FALSE)
    RETURNING id INTO message_id;
    
    RETURN message_id;
END;
$$;

-- Update send_non_ephemeral_ai_message to just be send_ai_message (since all messages are now non-ephemeral)
CREATE OR REPLACE FUNCTION send_ai_message(
    receiver_user_id UUID,
    message_content TEXT,
    personality_type TEXT DEFAULT 'supportive'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    message_id UUID;
BEGIN
    IF message_content IS NULL OR message_content = '' THEN
        RAISE EXCEPTION 'AI message content cannot be empty';
    END IF;
    
    INSERT INTO messages (
        sender_id, 
        receiver_id, 
        content, 
        is_ai_sender,
        ai_personality_type
    )
    VALUES (
        NULL, -- AI messages have no sender_id
        receiver_user_id, 
        message_content, 
        TRUE,
        personality_type
    )
    RETURNING id INTO message_id;
    
    RETURN message_id;
END;
$$;

-- Drop the old function name if it exists
DROP FUNCTION IF EXISTS send_non_ephemeral_ai_message(UUID, TEXT, TEXT);

-- Migration complete: Remove all message expiration functionality - messages are now persistent