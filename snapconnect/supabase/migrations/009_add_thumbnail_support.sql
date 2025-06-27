-- Migration: Add thumbnail support for unified media display
-- This enables high-quality thumbnail display for both photos and videos in the feed

BEGIN;

-- Add thumbnail_url column to posts table
ALTER TABLE posts 
ADD COLUMN thumbnail_url TEXT;

-- Add poster_url column for video poster frames (future use)
ALTER TABLE posts 
ADD COLUMN poster_url TEXT;

-- Add comments to document the new columns
COMMENT ON COLUMN posts.thumbnail_url IS 'Optimized thumbnail (600x600) for feed display - both photos and videos';
COMMENT ON COLUMN posts.poster_url IS 'Video poster frame URL for enhanced video display';

-- Create index for thumbnail queries (performance optimization)
CREATE INDEX IF NOT EXISTS idx_posts_thumbnail_url ON posts(thumbnail_url);

-- Update get_unviewed_posts function to include thumbnail fields
DROP FUNCTION IF EXISTS get_unviewed_posts(UUID, INTEGER, INTEGER);

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
  thumbnail_url TEXT,
  poster_url TEXT,
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
    p.thumbnail_url,
    p.poster_url,
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

-- Grant permissions for updated function
GRANT EXECUTE ON FUNCTION get_unviewed_posts(UUID, INTEGER, INTEGER) TO authenticated;

-- Update RLS policies to include new fields (inherit from existing policies)
-- No explicit policy needed - thumbnail_url follows same access pattern as media_url

COMMIT;