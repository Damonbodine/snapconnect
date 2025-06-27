-- AI Personality System Migration
-- Adds support for AI users with rich personality traits and social capabilities

-- Add AI personality fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS personality_traits JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_response_style JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_mock_user BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS posting_schedule JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS conversation_context JSONB DEFAULT '{}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_is_mock_user ON users(is_mock_user);
CREATE INDEX IF NOT EXISTS idx_users_personality_traits ON users USING GIN(personality_traits);
CREATE INDEX IF NOT EXISTS idx_users_ai_response_style ON users USING GIN(ai_response_style);
CREATE INDEX IF NOT EXISTS idx_users_posting_schedule ON users USING GIN(posting_schedule);

-- Function to get AI users ready for posting
CREATE OR REPLACE FUNCTION get_ai_users_for_posting(target_hour INTEGER DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  username TEXT,
  personality_traits JSONB,
  posting_schedule JSONB,
  last_post_date DATE
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.personality_traits,
    u.posting_schedule,
    DATE(COALESCE(last_post.created_at, '1970-01-01'::timestamp)) as last_post_date
  FROM users u
  LEFT JOIN (
    SELECT DISTINCT ON (user_id) 
      user_id, 
      created_at
    FROM posts 
    ORDER BY user_id, created_at DESC
  ) last_post ON u.id = last_post.user_id
  WHERE u.is_mock_user = TRUE
    AND (target_hour IS NULL OR 
         (u.posting_schedule->>'preferred_hour')::INTEGER = target_hour OR
         u.posting_schedule->>'preferred_hour' IS NULL)
    AND (last_post.created_at IS NULL OR 
         DATE(last_post.created_at) < CURRENT_DATE);
END;
$$;

-- Function to update AI user conversation context
CREATE OR REPLACE FUNCTION update_ai_conversation_context(
  user_id UUID,
  context_update JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE users 
  SET conversation_context = conversation_context || context_update,
      updated_at = NOW()
  WHERE id = user_id AND is_mock_user = TRUE;
  
  RETURN FOUND;
END;
$$;

-- Function to get compatible AI users for friend suggestions
CREATE OR REPLACE FUNCTION get_compatible_ai_users(
  target_user_id UUID,
  limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  fitness_level TEXT,
  personality_traits JSONB,
  compatibility_score DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_record RECORD;
BEGIN
  -- Get target user's profile
  SELECT u.fitness_level, u.goals, u.personality_traits
  INTO target_user_record
  FROM users u
  WHERE u.id = target_user_id;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level,
    u.personality_traits,
    -- Simple compatibility scoring based on shared goals and fitness level
    CASE 
      WHEN u.fitness_level = target_user_record.fitness_level THEN 0.5
      ELSE 0.2
    END +
    CASE 
      WHEN u.goals && target_user_record.goals THEN 0.3
      ELSE 0.1
    END +
    -- Add personality compatibility (if both have personality traits)
    CASE 
      WHEN u.personality_traits ? 'communication_style' AND 
           target_user_record.personality_traits ? 'communication_style' AND
           u.personality_traits->>'communication_style' = target_user_record.personality_traits->>'communication_style'
      THEN 0.2
      ELSE 0.1
    END as compatibility_score
  FROM users u
  WHERE u.is_mock_user = TRUE
    AND u.id != target_user_id
    AND NOT EXISTS (
      SELECT 1 FROM friendships f 
      WHERE (f.user_id = target_user_id AND f.friend_id = u.id) OR
            (f.user_id = u.id AND f.friend_id = target_user_id)
    )
  ORDER BY compatibility_score DESC
  LIMIT limit_count;
END;
$$;

-- Function to get AI users for commenting on posts
CREATE OR REPLACE FUNCTION get_ai_users_for_commenting(
  post_id UUID,
  max_commenters INTEGER DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  personality_traits JSONB,
  compatibility_score DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  post_record RECORD;
BEGIN
  -- Get post details
  SELECT p.workout_type, p.content, u.fitness_level, u.goals
  INTO post_record
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE p.id = post_id;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.personality_traits,
    -- Score based on workout type match and personality engagement level
    CASE 
      WHEN u.personality_traits->>'social_engagement' = 'high' THEN 0.4
      WHEN u.personality_traits->>'social_engagement' = 'medium' THEN 0.3
      ELSE 0.2
    END +
    CASE 
      WHEN post_record.workout_type = ANY(
        SELECT jsonb_array_elements_text(u.personality_traits->'preferred_workout_types')
      ) THEN 0.3
      ELSE 0.1
    END +
    -- Fitness level compatibility
    CASE 
      WHEN u.fitness_level = post_record.fitness_level THEN 0.2
      WHEN (u.fitness_level = 'advanced' AND post_record.fitness_level = 'intermediate') OR
           (u.fitness_level = 'intermediate' AND post_record.fitness_level = 'beginner') THEN 0.1
      ELSE 0.05
    END as compatibility_score
  FROM users u
  WHERE u.is_mock_user = TRUE
    AND u.id != (SELECT user_id FROM posts WHERE id = post_id)
    AND NOT EXISTS (
      SELECT 1 FROM comments c 
      WHERE c.post_id = post_id AND c.user_id = u.id
    )
  ORDER BY compatibility_score DESC, RANDOM()
  LIMIT max_commenters;
END;
$$;

-- Create a view for AI user statistics and monitoring
CREATE OR REPLACE VIEW ai_user_stats AS
SELECT 
  COUNT(*) as total_ai_users,
  COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as ai_users_created_today,
  COUNT(*) FILTER (WHERE personality_traits ? 'communication_style') as ai_users_with_personality,
  COUNT(*) FILTER (WHERE posting_schedule ? 'preferred_hour') as ai_users_with_schedule,
  AVG(array_length(goals, 1)) as avg_goals_per_ai_user,
  MODE() WITHIN GROUP (ORDER BY fitness_level) as most_common_fitness_level
FROM users 
WHERE is_mock_user = TRUE;

-- Add RLS policies for AI users
-- AI users can perform all the same actions as real users
CREATE POLICY "AI users can view published events" ON events
  FOR SELECT USING (status = 'published' AND deleted_at IS NULL);

CREATE POLICY "AI users can create events" ON events
  FOR INSERT WITH CHECK (
    auth.uid() = creator_id AND 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
  );

CREATE POLICY "AI users can update their events" ON events
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "AI users can manage their own event RSVPs" ON event_participants
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "AI users can view public posts" ON posts
  FOR SELECT USING (expires_at > NOW() OR expires_at IS NULL);

CREATE POLICY "AI users can insert their own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "AI users can view messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "AI users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Create function to validate AI personality traits
CREATE OR REPLACE FUNCTION validate_ai_personality_traits(traits JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check required fields for AI users
  IF NOT (traits ? 'communication_style' AND 
          traits ? 'posting_personality' AND 
          traits ? 'social_engagement') THEN
    RETURN FALSE;
  END IF;
  
  -- Validate enum values
  IF NOT (traits->>'communication_style' IN ('casual', 'motivational', 'technical', 'friendly')) THEN
    RETURN FALSE;
  END IF;
  
  IF NOT (traits->>'posting_personality' IN ('progress_focused', 'social', 'educational', 'inspirational')) THEN
    RETURN FALSE;
  END IF;
  
  IF NOT (traits->>'social_engagement' IN ('high', 'medium', 'low')) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Trigger to validate AI personality traits on insert/update
CREATE OR REPLACE FUNCTION validate_ai_personality_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_mock_user = TRUE AND NEW.personality_traits != '{}' THEN
    IF NOT validate_ai_personality_traits(NEW.personality_traits) THEN
      RAISE EXCEPTION 'Invalid AI personality traits provided';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_ai_personality_traits_trigger
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION validate_ai_personality_trigger();

-- Add comment to track migration
COMMENT ON COLUMN users.personality_traits IS 'JSONB field storing AI personality traits and user preferences';
COMMENT ON COLUMN users.ai_response_style IS 'JSONB field storing AI conversation and response patterns';
COMMENT ON COLUMN users.is_mock_user IS 'Boolean flag to identify AI users vs real users';
COMMENT ON COLUMN users.posting_schedule IS 'JSONB field storing AI posting preferences and schedules';
COMMENT ON COLUMN users.conversation_context IS 'JSONB field storing AI conversation history and context';