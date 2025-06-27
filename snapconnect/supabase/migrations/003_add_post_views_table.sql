-- Migration: Add post_views table for ephemeral discover feed
-- This table tracks which users have viewed which posts to prevent showing the same content twice

BEGIN;

-- Create post_views table
CREATE TABLE IF NOT EXISTS post_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  
  -- Tracking details
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  view_duration INTEGER DEFAULT 0, -- milliseconds spent viewing
  view_percentage INTEGER DEFAULT 100, -- percentage of content viewed (for videos)
  
  -- Metadata for debugging and analytics
  device_type TEXT, -- 'ios', 'android', 'web'
  app_version TEXT, -- for debugging view tracking issues
  
  -- Ensure one view record per user per post
  UNIQUE(user_id, post_id)
);

-- Create performance-critical indexes
CREATE INDEX IF NOT EXISTS idx_post_views_user_id ON post_views(user_id);
CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_viewed_at ON post_views(viewed_at DESC);

-- Composite index for efficient filtering (most important for performance)
CREATE INDEX IF NOT EXISTS idx_post_views_user_post ON post_views(user_id, post_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_post_views_user_viewed_at ON post_views(user_id, viewed_at DESC);

-- Enable Row Level Security
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for post_views table
-- Users can only see their own view records
CREATE POLICY "Users can view their own post views" ON post_views
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own view records
CREATE POLICY "Users can insert their own post views" ON post_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own view records (for duration updates)
CREATE POLICY "Users can update their own post views" ON post_views
  FOR UPDATE USING (auth.uid() = user_id);

-- No delete policy - preserve viewing history for analytics

-- Function to get unviewed posts for a specific user
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
    p.user_id != p_user_id  -- Don't show user their own posts
    AND p.expires_at > NOW()  -- Not expired
    AND NOT EXISTS (  -- Not viewed by user
      SELECT 1 FROM post_views pv 
      WHERE pv.post_id = p.id AND pv.user_id = p_user_id
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Function to batch mark posts as viewed
CREATE OR REPLACE FUNCTION batch_mark_viewed(
  p_user_id UUID,
  p_view_records JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_record JSONB;
BEGIN
  -- Insert each view record
  FOR v_record IN SELECT * FROM jsonb_array_elements(p_view_records)
  LOOP
    INSERT INTO post_views (
      user_id, 
      post_id, 
      viewed_at,
      view_duration,
      view_percentage,
      device_type,
      app_version
    )
    VALUES (
      p_user_id,
      (v_record->>'postId')::UUID,
      TO_TIMESTAMP((v_record->>'viewedAt')::BIGINT / 1000.0),
      (v_record->>'duration')::INTEGER,
      COALESCE((v_record->>'viewPercentage')::INTEGER, 100),
      v_record->>'deviceType',
      v_record->>'appVersion'
    )
    ON CONFLICT (user_id, post_id) 
    DO UPDATE SET 
      viewed_at = EXCLUDED.viewed_at,
      view_duration = GREATEST(post_views.view_duration, EXCLUDED.view_duration),
      view_percentage = GREATEST(post_views.view_percentage, EXCLUDED.view_percentage);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Function to clean up expired view records (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_expired_post_views()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Delete view records for posts that expired more than 7 days ago
  DELETE FROM post_views 
  WHERE post_id IN (
    SELECT id FROM posts 
    WHERE expires_at < NOW() - INTERVAL '7 days'
  );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON post_views TO authenticated;
GRANT EXECUTE ON FUNCTION get_unviewed_posts(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_mark_viewed(UUID, JSONB) TO authenticated;

COMMIT;