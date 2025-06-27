-- Migration: Add comments system to posts
-- This enables users to comment on posts with proper permissions and ephemeral behavior

BEGIN;

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Comment content
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 500),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Track if comment was edited
  is_edited BOOLEAN DEFAULT FALSE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments table

-- Users can view comments on posts they can view (inherit post visibility)
CREATE POLICY "Users can view comments on viewable posts" ON comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = comments.post_id 
      AND (posts.expires_at > NOW() OR posts.expires_at IS NULL)
    )
  );

-- Users can insert comments on active posts
CREATE POLICY "Users can insert comments on active posts" ON comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = post_id 
      AND (posts.expires_at > NOW() OR posts.expires_at IS NULL)
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update their own comments" ON comments
  FOR UPDATE USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = comments.post_id 
      AND (posts.expires_at > NOW() OR posts.expires_at IS NULL)
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    -- Prevent changing post_id or user_id
    AND post_id = post_id 
    AND user_id = user_id
  );

-- Users can delete their own comments OR post owners can delete comments on their posts
CREATE POLICY "Users can delete own comments or post owners can delete comments" ON comments
  FOR DELETE USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = comments.post_id 
      AND posts.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp and set is_edited flag
CREATE OR REPLACE FUNCTION update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Set is_edited to true if content changed (but not on insert)
  IF TG_OP = 'UPDATE' AND OLD.content != NEW.content THEN
    NEW.is_edited = TRUE;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_comments_updated_at 
  BEFORE UPDATE ON comments
  FOR EACH ROW 
  EXECUTE FUNCTION update_comment_updated_at();

-- Function to get comments for a post with user info
CREATE OR REPLACE FUNCTION get_post_comments(
  p_post_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  is_edited BOOLEAN,
  user_id UUID,
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
    c.id,
    c.content,
    c.created_at,
    c.updated_at,
    c.is_edited,
    c.user_id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level
  FROM comments c
  JOIN users u ON c.user_id = u.id
  WHERE 
    c.post_id = p_post_id
    AND EXISTS (
      SELECT 1 FROM posts p 
      WHERE p.id = p_post_id 
      AND (p.expires_at > NOW() OR p.expires_at IS NULL)
    )
  ORDER BY c.created_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Function to get comment count for posts
CREATE OR REPLACE FUNCTION get_comment_counts(p_post_ids UUID[])
RETURNS TABLE (
  post_id UUID,
  comment_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.post_id,
    COUNT(*) as comment_count
  FROM comments c
  WHERE c.post_id = ANY(p_post_ids)
  GROUP BY c.post_id;
END;
$$;

-- Add a view for easier comment queries with user info
CREATE VIEW comments_with_users AS
SELECT 
  c.id,
  c.post_id,
  c.content,
  c.created_at,
  c.updated_at,
  c.is_edited,
  c.user_id,
  u.username,
  u.full_name,
  u.avatar_url,
  u.fitness_level
FROM comments c
JOIN users u ON c.user_id = u.id;

-- Function to clean up comments on expired posts (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_expired_comments()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Delete comments on posts that expired more than 7 days ago
  DELETE FROM comments 
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
GRANT SELECT, INSERT, UPDATE, DELETE ON comments TO authenticated;
GRANT SELECT ON comments_with_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_post_comments(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_comment_counts(UUID[]) TO authenticated;

COMMIT;