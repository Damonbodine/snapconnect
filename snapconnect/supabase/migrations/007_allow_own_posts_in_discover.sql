-- Migration: Allow users to see their own posts in discover feed (ephemeral viewing)
-- This enables users to confirm their posts were successful before they disappear after viewing

BEGIN;

-- Drop existing function first to avoid signature conflicts
DROP FUNCTION IF EXISTS get_unviewed_posts(UUID, INTEGER, INTEGER);

-- Recreate function to include user's own posts (only change: remove p.user_id != p_user_id filter)
CREATE OR REPLACE FUNCTION get_unviewed_posts(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  workout_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  fitness_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.content,
    p.media_url,
    p.media_type,
    p.workout_type,
    p.created_at,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE 
    p.expires_at > NOW()  -- Not expired
    AND NOT EXISTS (  -- Not viewed by user (including their own posts)
      SELECT 1 FROM post_views pv 
      WHERE pv.post_id = p.id AND pv.user_id = p_user_id
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_unviewed_posts(UUID, INTEGER, INTEGER) TO authenticated;

COMMIT;