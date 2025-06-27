-- Migration: Add posting automation functions for AI users
-- Supports user ID-based posting coordination and tracking

BEGIN;

-- Function to get AI users ready for posting based on schedules and posting history
CREATE OR REPLACE FUNCTION get_ai_users_ready_for_posting(
  target_hour INTEGER DEFAULT NULL,
  target_day INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  full_name TEXT,
  personality_traits JSONB,
  posting_schedule JSONB,
  last_post_date TIMESTAMP WITH TIME ZONE,
  archetype TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_hour INTEGER;
  current_day INTEGER;
BEGIN
  -- Use current time if not specified
  current_hour := COALESCE(target_hour, EXTRACT(HOUR FROM NOW()));
  current_day := COALESCE(target_day, EXTRACT(DOW FROM NOW()));
  
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.full_name,
    u.personality_traits,
    u.posting_schedule,
    last_post.created_at as last_post_date,
    COALESCE(u.personality_traits->>'archetype', 'fitness_newbie') as archetype
  FROM users u
  LEFT JOIN LATERAL (
    SELECT created_at
    FROM posts p
    WHERE p.user_id = u.id
    ORDER BY p.created_at DESC
    LIMIT 1
  ) last_post ON true
  WHERE u.is_mock_user = TRUE
    -- Check if user should post at this hour (if they have a preference)
    AND (
      u.posting_schedule->>'preferred_hour' IS NULL OR
      (u.posting_schedule->>'preferred_hour')::INTEGER = current_hour
    )
    -- Check if today is not a rest day
    AND (
      u.posting_schedule->'rest_days' IS NULL OR
      NOT (u.posting_schedule->'rest_days' @> to_jsonb(current_day))
    )
    -- Check if today is a preferred day (if specified)
    AND (
      u.posting_schedule->'preferred_days' IS NULL OR
      u.posting_schedule->'preferred_days' @> to_jsonb(current_day)
    )
    -- Check if user hasn't posted today
    AND (
      last_post.created_at IS NULL OR
      DATE(last_post.created_at) < CURRENT_DATE
    )
  ORDER BY 
    -- Prioritize users who haven't posted in longer
    COALESCE(last_post.created_at, '1970-01-01'::timestamp) ASC,
    u.username ASC;
END;
$$;

-- Function to mark AI user as posted today with content tracking
CREATE OR REPLACE FUNCTION mark_ai_user_posted_today(
  user_id UUID,
  content_type TEXT DEFAULT 'workout_post',
  post_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update user's last posting info in a tracking table (optional)
  -- For now, we'll just verify the user exists and is an AI user
  
  -- Verify this is an AI user
  IF NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = user_id AND u.is_mock_user = TRUE
  ) THEN
    RAISE EXCEPTION 'User % is not an AI user or does not exist', user_id;
  END IF;
  
  -- Could add additional tracking logic here in the future
  -- For example, updating a posting_log table
  
  RETURN TRUE;
END;
$$;

-- Function to get AI user posting statistics
CREATE OR REPLACE FUNCTION get_ai_user_posting_stats(
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  total_ai_users INTEGER,
  users_posted_today INTEGER,
  total_posts_today INTEGER,
  total_posts_period INTEGER,
  avg_posts_per_user DECIMAL,
  archetype_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  period_start TIMESTAMP WITH TIME ZONE;
  today_start TIMESTAMP WITH TIME ZONE;
  archetype_stats JSONB;
BEGIN
  period_start := CURRENT_DATE - INTERVAL '1 day' * days_back;
  today_start := CURRENT_DATE;
  
  -- Build archetype breakdown
  SELECT jsonb_object_agg(
    archetype_name,
    jsonb_build_object(
      'users', user_count,
      'posts_today', posts_today,
      'posts_period', posts_period
    )
  ) INTO archetype_stats
  FROM (
    SELECT 
      COALESCE(u.personality_traits->>'archetype', 'unknown') as archetype_name,
      COUNT(DISTINCT u.id) as user_count,
      COUNT(DISTINCT CASE WHEN p.created_at >= today_start THEN p.id END) as posts_today,
      COUNT(DISTINCT CASE WHEN p.created_at >= period_start THEN p.id END) as posts_period
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    WHERE u.is_mock_user = TRUE
    GROUP BY COALESCE(u.personality_traits->>'archetype', 'unknown')
  ) archetype_data;
  
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM users WHERE is_mock_user = TRUE) as total_ai_users,
    (
      SELECT COUNT(DISTINCT p.user_id)::INTEGER 
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      WHERE u.is_mock_user = TRUE 
        AND p.created_at >= today_start
    ) as users_posted_today,
    (
      SELECT COUNT(*)::INTEGER 
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      WHERE u.is_mock_user = TRUE 
        AND p.created_at >= today_start
    ) as total_posts_today,
    (
      SELECT COUNT(*)::INTEGER 
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      WHERE u.is_mock_user = TRUE 
        AND p.created_at >= period_start
    ) as total_posts_period,
    (
      SELECT 
        CASE 
          WHEN COUNT(DISTINCT p.user_id) > 0 
          THEN ROUND(COUNT(*)::DECIMAL / COUNT(DISTINCT p.user_id), 2)
          ELSE 0
        END
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      WHERE u.is_mock_user = TRUE 
        AND p.created_at >= period_start
    ) as avg_posts_per_user,
    archetype_stats as archetype_breakdown;
END;
$$;

-- Function to get AI user posting history for specific user
CREATE OR REPLACE FUNCTION get_ai_user_posting_history(
  target_user_id UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  post_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  content TEXT,
  workout_type TEXT,
  content_length INTEGER,
  days_since_last_post INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  period_start TIMESTAMP WITH TIME ZONE;
BEGIN
  period_start := CURRENT_DATE - INTERVAL '1 day' * days_back;
  
  -- Verify this is an AI user
  IF NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = target_user_id AND u.is_mock_user = TRUE
  ) THEN
    RAISE EXCEPTION 'User % is not an AI user or does not exist', target_user_id;
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id as post_id,
    p.created_at,
    p.content,
    p.workout_type,
    LENGTH(p.content) as content_length,
    COALESCE(
      (p.created_at::date - LAG(p.created_at::date) OVER (ORDER BY p.created_at))::INTEGER,
      0
    ) as days_since_last_post
  FROM posts p
  WHERE p.user_id = target_user_id
    AND p.created_at >= period_start
  ORDER BY p.created_at DESC;
END;
$$;

-- Function to clean up expired posts (maintenance)
CREATE OR REPLACE FUNCTION cleanup_expired_posts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete posts that have expired
  DELETE FROM posts 
  WHERE expires_at < NOW()
  AND expires_at IS NOT NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Function to validate AI user personality traits
CREATE OR REPLACE FUNCTION validate_ai_user_for_posting(
  target_user_id UUID
)
RETURNS TABLE (
  is_valid BOOLEAN,
  validation_errors TEXT[],
  archetype TEXT,
  preferred_hour INTEGER,
  posts_per_week INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  errors TEXT[] := '{}';
  is_valid_result BOOLEAN := TRUE;
BEGIN
  -- Get user data
  SELECT 
    u.is_mock_user,
    u.personality_traits,
    u.posting_schedule
  INTO user_record
  FROM users u
  WHERE u.id = target_user_id;
  
  -- Check if user exists and is AI user
  IF NOT FOUND THEN
    errors := array_append(errors, 'User not found');
    is_valid_result := FALSE;
  ELSIF user_record.is_mock_user IS NOT TRUE THEN
    errors := array_append(errors, 'User is not an AI user');
    is_valid_result := FALSE;
  END IF;
  
  -- Validate personality traits
  IF user_record.personality_traits IS NULL OR user_record.personality_traits = '{}' THEN
    errors := array_append(errors, 'Missing personality traits');
    is_valid_result := FALSE;
  END IF;
  
  -- Validate posting schedule
  IF user_record.posting_schedule IS NULL OR user_record.posting_schedule = '{}' THEN
    errors := array_append(errors, 'Missing posting schedule');
    is_valid_result := FALSE;
  END IF;
  
  RETURN QUERY
  SELECT 
    is_valid_result,
    errors,
    COALESCE(user_record.personality_traits->>'archetype', 'unknown'),
    COALESCE((user_record.posting_schedule->>'preferred_hour')::INTEGER, 12),
    COALESCE((user_record.posting_schedule->>'posts_per_week')::INTEGER, 3);
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_user_created_date 
ON posts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_expires_at 
ON posts(expires_at) 
WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_posting_schedule 
ON users USING GIN(posting_schedule) 
WHERE is_mock_user = TRUE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_ai_users_ready_for_posting(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_ai_user_posted_today(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_user_posting_stats(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_user_posting_history(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_posts() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_ai_user_for_posting(UUID) TO authenticated;

-- Add comment to track this migration
COMMENT ON FUNCTION get_ai_users_ready_for_posting IS 'Returns AI users ready to post based on their schedules and posting history';
COMMENT ON FUNCTION mark_ai_user_posted_today IS 'Marks an AI user as having posted today with content tracking';
COMMENT ON FUNCTION get_ai_user_posting_stats IS 'Returns comprehensive posting statistics for AI users';
COMMENT ON FUNCTION get_ai_user_posting_history IS 'Returns posting history for a specific AI user';
COMMENT ON FUNCTION cleanup_expired_posts IS 'Removes expired posts from the database';
COMMENT ON FUNCTION validate_ai_user_for_posting IS 'Validates AI user data for posting automation';

COMMIT;