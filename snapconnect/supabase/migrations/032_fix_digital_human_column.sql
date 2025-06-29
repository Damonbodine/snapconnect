-- Fix get_available_ai_users function - remove reference to non-existent column
-- The is_digital_human column doesn't exist, so we'll make it optional

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
    FALSE as is_digital_human  -- Default to false since column doesn't exist
  FROM users u
  WHERE u.is_mock_user = TRUE 
    AND u.personality_traits IS NOT NULL
    AND u.username IS NOT NULL
  ORDER BY u.username;
END;
$$;

-- Also fix the original get_ai_users function to be consistent
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_available_ai_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_users() TO authenticated;