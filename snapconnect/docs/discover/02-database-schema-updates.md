# Database Schema Updates for Ephemeral Discover Feed

## 🎯 Overview

This document outlines all database changes needed to support ephemeral content viewing in the discover feed. The core requirement is tracking which users have viewed which posts to prevent showing the same content twice.

## 🗄️ New Tables

### 1. Post Views Table

**Purpose**: Track individual user views of posts for ephemeral functionality.

```sql
-- Create post_views table
CREATE TABLE post_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  
  -- Tracking details
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  view_duration INTEGER DEFAULT 0, -- seconds spent viewing (optional)
  view_percentage INTEGER DEFAULT 100, -- percentage of content viewed (for videos)
  
  -- Metadata
  device_type TEXT, -- 'ios', 'android', 'web'
  app_version TEXT, -- for debugging view tracking issues
  
  -- Ensure one view record per user per post
  UNIQUE(user_id, post_id)
);
```

### 2. Content Consumption Analytics (Optional)

**Purpose**: Track aggregate viewing patterns for content optimization.

```sql
-- Create content_analytics table (optional)
CREATE TABLE content_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  
  -- Aggregate stats
  total_views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  average_view_duration DECIMAL(5,2) DEFAULT 0,
  
  -- Time-based stats
  views_last_hour INTEGER DEFAULT 0,
  views_last_day INTEGER DEFAULT 0,
  
  -- Metadata
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(post_id)
);
```

## 📊 Database Indexes

### Performance-Critical Indexes

```sql
-- Primary performance indexes
CREATE INDEX idx_post_views_user_id ON post_views(user_id);
CREATE INDEX idx_post_views_post_id ON post_views(post_id);
CREATE INDEX idx_post_views_viewed_at ON post_views(viewed_at DESC);

-- Composite index for efficient filtering
CREATE INDEX idx_post_views_user_post ON post_views(user_id, post_id);

-- Index for time-based queries
CREATE INDEX idx_post_views_user_viewed_at ON post_views(user_id, viewed_at DESC);

-- Optional: Analytics indexes
CREATE INDEX idx_content_analytics_post_id ON content_analytics(post_id);
CREATE INDEX idx_content_analytics_updated ON content_analytics(last_updated DESC);
```

## 🔍 Updated Queries

### 1. Get Unviewed Posts for User

**Core Query**: Fetch posts that a specific user hasn't viewed yet.

```sql
-- Basic unviewed posts query
SELECT 
  p.*,
  u.username,
  u.full_name,
  u.avatar_url,
  u.fitness_level
FROM posts p
JOIN users u ON p.user_id = u.id
LEFT JOIN post_views pv ON p.id = pv.post_id AND pv.user_id = $1
WHERE 
  pv.id IS NULL  -- User hasn't viewed this post
  AND p.expires_at > NOW()  -- Post hasn't expired
  AND p.user_id != $1  -- Don't show user their own posts
ORDER BY p.created_at DESC
LIMIT $2;
```

### 2. Mark Post as Viewed

**Purpose**: Record when a user views a post.

```sql
-- Insert view record (with conflict handling)
INSERT INTO post_views (user_id, post_id, view_duration, view_percentage, device_type, app_version)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id, post_id) 
DO UPDATE SET 
  viewed_at = NOW(),
  view_duration = GREATEST(post_views.view_duration, EXCLUDED.view_duration),
  view_percentage = GREATEST(post_views.view_percentage, EXCLUDED.view_percentage);
```

### 3. Get User's Viewing History

**Purpose**: For debugging or user analytics.

```sql
-- Get recent viewing history for user
SELECT 
  pv.viewed_at,
  pv.view_duration,
  p.content,
  p.media_type,
  u.username as post_creator
FROM post_views pv
JOIN posts p ON pv.post_id = p.id
JOIN users u ON p.user_id = u.id
WHERE pv.user_id = $1
ORDER BY pv.viewed_at DESC
LIMIT 50;
```

### 4. Cleanup Expired Views

**Purpose**: Remove view records for expired posts to save space.

```sql
-- Delete views for expired posts (run periodically)
DELETE FROM post_views 
WHERE post_id IN (
  SELECT id FROM posts 
  WHERE expires_at < NOW() - INTERVAL '7 days'
);
```

## 🚀 Database Functions

### 1. Efficient Post Filtering Function

```sql
-- Function to get unviewed posts with better performance
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
  created_at TIMESTAMP WITH TIME ZONE,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  fitness_level TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.content,
    p.media_url,
    p.media_type,
    p.created_at,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE 
    p.user_id != p_user_id  -- Don't show own posts
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
```

### 2. Batch View Tracking Function

```sql
-- Function to batch multiple view records
CREATE OR REPLACE FUNCTION batch_mark_viewed(
  p_user_id UUID,
  p_post_ids UUID[],
  p_view_data JSONB DEFAULT '{}'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER := 0;
  v_post_id UUID;
BEGIN
  FOREACH v_post_id IN ARRAY p_post_ids
  LOOP
    INSERT INTO post_views (user_id, post_id, device_type, app_version)
    VALUES (
      p_user_id, 
      v_post_id,
      p_view_data->>'device_type',
      p_view_data->>'app_version'
    )
    ON CONFLICT (user_id, post_id) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END LOOP;
  
  RETURN v_count;
END;
$$;
```

## 🔒 Row Level Security (RLS) Policies

### Post Views Table Policies

```sql
-- Enable RLS on post_views table
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

-- Users can only see their own view records
CREATE POLICY "Users can view their own post views" ON post_views
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own view records
CREATE POLICY "Users can insert their own post views" ON post_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own view records
CREATE POLICY "Users can update their own post views" ON post_views
  FOR UPDATE USING (auth.uid() = user_id);

-- No delete policy (preserve viewing history)
```

### Updated Posts Table Policies

```sql
-- Update existing posts policy to work with view filtering
DROP POLICY IF EXISTS "Users can view public posts" ON posts;

CREATE POLICY "Users can view non-expired posts" ON posts
  FOR SELECT USING (
    expires_at > NOW() OR expires_at IS NULL
  );
```

## 📈 Performance Considerations

### Query Optimization

1. **Use EXISTS instead of LEFT JOIN** for large datasets
2. **Limit with OFFSET for pagination** instead of loading all posts
3. **Composite indexes** on frequently queried columns
4. **Periodic cleanup** of old view records

### Scaling Strategies

```sql
-- Partition post_views table by date (for high volume)
CREATE TABLE post_views_2024_01 PARTITION OF post_views
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Materialized view for analytics (refresh periodically)
CREATE MATERIALIZED VIEW content_engagement_summary AS
SELECT 
  p.user_id as creator_id,
  COUNT(pv.id) as total_views,
  COUNT(DISTINCT pv.user_id) as unique_viewers,
  AVG(pv.view_duration) as avg_view_duration
FROM posts p
LEFT JOIN post_views pv ON p.id = pv.post_id
WHERE p.created_at > NOW() - INTERVAL '30 days'
GROUP BY p.user_id;
```

## 🔧 Migration Scripts

### Production Migration

```sql
-- Migration: Add post_views table and indexes
BEGIN;

-- Create table
CREATE TABLE post_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  view_duration INTEGER DEFAULT 0,
  view_percentage INTEGER DEFAULT 100,
  device_type TEXT,
  app_version TEXT,
  UNIQUE(user_id, post_id)
);

-- Add indexes
CREATE INDEX idx_post_views_user_id ON post_views(user_id);
CREATE INDEX idx_post_views_post_id ON post_views(post_id);
CREATE INDEX idx_post_views_user_post ON post_views(user_id, post_id);
CREATE INDEX idx_post_views_viewed_at ON post_views(viewed_at DESC);

-- Enable RLS
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can view their own post views" ON post_views
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own post views" ON post_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own post views" ON post_views
  FOR UPDATE USING (auth.uid() = user_id);

COMMIT;
```

### Rollback Script

```sql
-- Rollback: Remove post_views table
BEGIN;

DROP TABLE IF EXISTS post_views CASCADE;
DROP FUNCTION IF EXISTS get_unviewed_posts(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS batch_mark_viewed(UUID, UUID[], JSONB);

COMMIT;
```

## 🧪 Testing Queries

### Verify Setup

```sql
-- Test 1: Create a test view record
INSERT INTO post_views (user_id, post_id) 
VALUES (
  (SELECT id FROM users LIMIT 1),
  (SELECT id FROM posts LIMIT 1)
);

-- Test 2: Query unviewed posts
SELECT count(*) FROM posts p
LEFT JOIN post_views pv ON p.id = pv.post_id AND pv.user_id = (SELECT id FROM users LIMIT 1)
WHERE pv.id IS NULL;

-- Test 3: Performance test with explain
EXPLAIN ANALYZE 
SELECT p.*, u.username 
FROM posts p 
JOIN users u ON p.user_id = u.id 
LEFT JOIN post_views pv ON p.id = pv.post_id AND pv.user_id = 'test-user-id'
WHERE pv.id IS NULL 
ORDER BY p.created_at DESC 
LIMIT 20;
```

## 📋 Next Steps

1. **Run migration script** in development environment
2. **Test query performance** with sample data
3. **Update postService.ts** to use new queries
4. **Implement view tracking** in React Native components
5. **Add monitoring** for query performance

## 🔗 Related Files

- `03-ephemeral-content-strategy.md` - How content lifecycle works
- `04-view-tracking-implementation.md` - Frontend implementation
- `src/services/postService.ts` - Service layer updates needed

---

**Status**: Ready for implementation  
**Database Impact**: New table, indexes, functions  
**Performance Impact**: Minimal with proper indexing  
**Migration Time**: < 1 minute on most databases