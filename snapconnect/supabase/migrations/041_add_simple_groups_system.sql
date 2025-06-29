-- Create simple groups system for SnapConnect
-- Users can join groups and stay in them permanently

-- Create groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('workout', 'running', 'yoga', 'cycling', 'swimming', 'sports', 'hiking', 'dance', 'martial_arts', 'nutrition', 'general')) DEFAULT 'general',
  
  -- Activity tracking
  last_activity TEXT, -- Brief description of recent group activity
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create group memberships table (simple join table)
CREATE TABLE group_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Join details
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one membership per user per group
  UNIQUE(group_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_groups_category ON groups(category);
CREATE INDEX idx_group_memberships_group_id ON group_memberships(group_id);
CREATE INDEX idx_group_memberships_user_id ON group_memberships(user_id);

-- Function to get groups with member counts
CREATE OR REPLACE FUNCTION get_groups_with_member_count()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  category TEXT,
  member_count BIGINT,
  last_activity TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  user_is_member BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.description,
    g.category,
    COALESCE(member_counts.count, 0) as member_count,
    g.last_activity,
    g.created_at,
    CASE 
      WHEN user_memberships.group_id IS NOT NULL THEN TRUE 
      ELSE FALSE 
    END as user_is_member
  FROM groups g
  LEFT JOIN (
    SELECT 
      group_id, 
      COUNT(*) as count 
    FROM group_memberships 
    GROUP BY group_id
  ) member_counts ON g.id = member_counts.group_id
  LEFT JOIN (
    SELECT DISTINCT group_id 
    FROM group_memberships 
    WHERE user_id = auth.uid()
  ) user_memberships ON g.id = user_memberships.group_id
  ORDER BY g.created_at DESC;
END;
$$;

-- Function to join a group
CREATE OR REPLACE FUNCTION join_group(group_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert membership (ignore if already exists)
  INSERT INTO group_memberships (group_id, user_id)
  VALUES (group_id_param, auth.uid())
  ON CONFLICT (group_id, user_id) DO NOTHING;
    
  RETURN jsonb_build_object('success', true, 'message', 'Successfully joined group');
END;
$$;

-- Function to get group members
CREATE OR REPLACE FUNCTION get_group_members(group_id_param UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  joined_at TIMESTAMP WITH TIME ZONE,
  is_ai_user BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.username,
    u.full_name,
    u.avatar_url,
    gm.joined_at,
    COALESCE(u.is_mock_user, FALSE) as is_ai_user
  FROM group_memberships gm
  JOIN users u ON gm.user_id = u.id
  WHERE gm.group_id = group_id_param 
  ORDER BY gm.joined_at ASC;
END;
$$;

-- Set up RLS (Row Level Security)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;

-- RLS Policies - anyone can view groups and memberships
CREATE POLICY "Anyone can view groups" ON groups FOR SELECT USING (true);
CREATE POLICY "Anyone can view group memberships" ON group_memberships FOR SELECT USING (true);
CREATE POLICY "Users can join groups" ON group_memberships FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Insert default groups
INSERT INTO groups (name, description, category, last_activity) VALUES
('Running Club', 'Weekly running meetups and marathon training support', 'running', 'Planning weekend 10K'),
('Gym Buddies', 'Strength training tips and workout accountability', 'workout', 'Sharing workout splits'),
('Yoga Flow', 'Daily yoga practice and mindfulness community', 'yoga', 'New morning routine');