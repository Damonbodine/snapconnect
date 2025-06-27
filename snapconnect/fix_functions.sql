-- Fix the functions by dropping and recreating them
-- Run this in your Supabase SQL Editor

-- 1. Drop existing functions first
DROP FUNCTION IF EXISTS get_unviewed_posts(uuid,integer,integer);
DROP FUNCTION IF EXISTS batch_mark_viewed(uuid,jsonb);

-- 2. Create the function to get unviewed posts for a user
CREATE OR REPLACE FUNCTION get_unviewed_posts(
  p_user_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
) RETURNS TABLE (
  id uuid,
  user_id uuid,
  content text,
  media_url text,
  media_type text,
  workout_type text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  username text,
  full_name text,
  avatar_url text,
  fitness_level text
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 
    p.id,
    p.user_id,
    p.content,
    p.media_url,
    p.media_type,
    p.workout_type,
    p.expires_at,
    p.created_at,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level
  FROM posts p
  JOIN users u ON p.user_id = u.id
  LEFT JOIN post_views pv ON p.id = pv.post_id AND pv.user_id = p_user_id
  WHERE p.user_id != p_user_id  -- Don't show user's own posts
    AND pv.id IS NULL           -- Only unviewed posts
    AND (p.expires_at IS NULL OR p.expires_at > now()) -- Not expired
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- 3. Create function to batch mark posts as viewed
CREATE OR REPLACE FUNCTION batch_mark_viewed(
  p_user_id uuid,
  p_view_records jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO post_views (user_id, post_id, viewed_at, session_id, duration)
  SELECT 
    p_user_id,
    (record->>'postId')::uuid,
    (record->>'viewedAt')::timestamp with time zone,
    record->>'sessionId',
    record->>'duration'
  FROM jsonb_array_elements(p_view_records) AS record
  ON CONFLICT (user_id, post_id) DO NOTHING;
END;
$$;

-- 4. Test the function with your user ID
SELECT 
  'Testing get_unviewed_posts function' as test,
  count(*) as total_posts_available
FROM get_unviewed_posts('f3d6b62b-d92b-443a-9385-7583afe50c2b'::uuid, 20, 0);

-- 5. Show what posts should be visible to your user
SELECT 
  p.id,
  u.username,
  LEFT(p.content, 50) as content_preview,
  p.workout_type,
  p.created_at
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.user_id != 'f3d6b62b-d92b-443a-9385-7583afe50c2b'::uuid
  AND (p.expires_at IS NULL OR p.expires_at > now())
ORDER BY p.created_at DESC;

-- 6. Verify the function works
SELECT 
  id,
  username,
  LEFT(content, 30) as preview,
  workout_type
FROM get_unviewed_posts('f3d6b62b-d92b-443a-9385-7583afe50c2b'::uuid, 10, 0);

SELECT 'Functions created successfully! Check the results above.' as status;