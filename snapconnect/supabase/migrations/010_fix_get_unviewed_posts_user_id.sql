-- Migration: Fix get_unviewed_posts function to include user_id field
-- This fixes the issue where user_id was missing from the returned posts

BEGIN;

-- Drop and recreate the function with user_id included
DROP FUNCTION IF EXISTS get_unviewed_posts(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_unviewed_posts(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,  -- Added missing user_id field
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  thumbnail_url TEXT,  -- Added for consistency with PostService
  poster_url TEXT,     -- Added for consistency with PostService
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
    p.user_id,  -- Added missing user_id field
    p.content,
    p.media_url,
    p.media_type,
    p.thumbnail_url,  -- Added for consistency
    p.poster_url,     -- Added for consistency
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_unviewed_posts(UUID, INTEGER, INTEGER) TO authenticated;

COMMIT;