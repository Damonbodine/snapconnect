-- Fix: Update voice coaching function to use correct user_goals column
-- The previous migration referenced 'is_active' column that doesn't exist in user_goals table

-- Drop and recreate the function with correct column reference
DROP FUNCTION IF EXISTS create_voice_coaching_session(UUID, TEXT, JSONB);

-- Function to create new voice coaching session (FIXED)
CREATE OR REPLACE FUNCTION create_voice_coaching_session(
  target_user_id UUID,
  session_token TEXT,
  workout_context JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_session_id UUID;
  user_context JSONB;
BEGIN
  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Get user context for session (FIXED: use ug.status = 'active' instead of ug.is_active)
  SELECT json_build_object(
    'fitness_level', u.fitness_level,
    'coaching_style', u.coaching_style,
    'motivation_style', u.motivation_style,
    'current_goals', array_agg(DISTINCT ug.category),
    'health_metrics', json_build_object(
      'height', u.height,
      'weight', u.weight,
      'activity_level', u.activity_level
    )
  )
  INTO user_context
  FROM users u
  LEFT JOIN user_goals ug ON u.id = ug.user_id AND ug.status = 'active'
  WHERE u.id = target_user_id
  GROUP BY u.id, u.fitness_level, u.coaching_style, u.motivation_style, u.height, u.weight, u.activity_level;
  
  -- Create new session
  INSERT INTO voice_coaching_sessions (
    user_id,
    session_token,
    conversation_context,
    workout_context
  )
  VALUES (
    target_user_id,
    session_token,
    user_context,
    workout_context
  )
  RETURNING id INTO new_session_id;
  
  RETURN new_session_id;
END;
$$;

-- Grant permissions for the fixed function
GRANT EXECUTE ON FUNCTION create_voice_coaching_session(UUID, TEXT, JSONB) TO authenticated;

-- Success message
SELECT 'Voice coaching function fixed - user_goals.status column reference corrected! 🎙️✅' as status;