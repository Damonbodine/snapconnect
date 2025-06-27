-- User Goals Table Migration
-- Creates a dedicated table for detailed SMART goal tracking with AI coaching integration

-- Create user_goals table for detailed goal management
CREATE TABLE IF NOT EXISTS user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Goal definition
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('fitness', 'weight', 'strength', 'endurance', 'flexibility', 'nutrition', 'wellness', 'habit', 'custom')) NOT NULL,
  goal_type TEXT CHECK (goal_type IN ('outcome', 'process', 'performance')) DEFAULT 'outcome',
  
  -- SMART goal criteria
  specific_target TEXT NOT NULL, -- e.g., "Lose 10 pounds", "Run 5K in under 25 minutes"
  measurable_metric TEXT NOT NULL, -- e.g., "weight_kg", "run_time_minutes", "weekly_workouts"
  target_value DECIMAL(10,2), -- Numeric target value
  target_unit TEXT, -- e.g., "kg", "minutes", "reps", "days"
  
  -- Timeline
  start_date DATE DEFAULT CURRENT_DATE,
  target_date DATE NOT NULL,
  estimated_duration_days INTEGER GENERATED ALWAYS AS (target_date - start_date) STORED,
  
  -- Progress tracking
  current_value DECIMAL(10,2) DEFAULT 0,
  progress_percentage INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN target_value > 0 THEN LEAST(100, ROUND((current_value / target_value) * 100))
      ELSE 0
    END
  ) STORED,
  
  -- Goal status and metadata
  status TEXT CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'overdue')) DEFAULT 'active',
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'moderate', 'challenging', 'ambitious')) DEFAULT 'moderate',
  
  -- Motivation and context
  why_important TEXT, -- User's personal motivation for this goal
  success_criteria TEXT[], -- Array of success indicators
  obstacles_anticipated TEXT[], -- Array of potential challenges
  support_needed TEXT[], -- Array of support types needed
  
  -- Coaching integration
  ai_coaching_enabled BOOLEAN DEFAULT TRUE,
  coaching_frequency TEXT CHECK (coaching_frequency IN ('daily', 'weekly', 'biweekly', 'milestone_based')) DEFAULT 'weekly',
  coaching_style_override TEXT CHECK (coaching_style_override IN ('gentle', 'motivational', 'data_driven', 'holistic')), -- Override user's default coaching style for this goal
  
  -- Accountability and social
  share_progress_publicly BOOLEAN DEFAULT FALSE,
  accountability_buddy_id UUID REFERENCES users(id) ON DELETE SET NULL,
  celebration_preference TEXT CHECK (celebration_preference IN ('private', 'friends', 'public', 'none')) DEFAULT 'friends',
  
  -- Milestones and rewards
  milestones JSONB DEFAULT '[]', -- Array of milestone objects with dates and rewards
  rewards_system JSONB DEFAULT '{}', -- Reward preferences and achievements
  
  -- AI context and learning
  ai_context JSONB DEFAULT '{}', -- AI learning context about user's patterns with this goal
  related_goals UUID[], -- Array of related goal IDs
  parent_goal_id UUID REFERENCES user_goals(id) ON DELETE SET NULL, -- For sub-goals
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  last_progress_update TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_target_date CHECK (target_date > start_date),
  CONSTRAINT valid_current_value CHECK (current_value >= 0),
  CONSTRAINT valid_target_value CHECK (target_value > 0),
  CONSTRAINT no_self_parent CHECK (id != parent_goal_id)
);

-- Create goal progress logs table for detailed tracking
CREATE TABLE IF NOT EXISTS goal_progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES user_goals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Progress data
  recorded_value DECIMAL(10,2) NOT NULL,
  previous_value DECIMAL(10,2),
  change_amount DECIMAL(10,2) GENERATED ALWAYS AS (recorded_value - COALESCE(previous_value, 0)) STORED,
  progress_percentage INTEGER,
  
  -- Context
  log_type TEXT CHECK (log_type IN ('manual', 'auto_sync', 'milestone', 'correction')) DEFAULT 'manual',
  data_source TEXT CHECK (data_source IN ('user_input', 'healthkit', 'app_tracking', 'ai_estimate', 'external_sync')) DEFAULT 'user_input',
  notes TEXT,
  mood_rating INTEGER CHECK (mood_rating >= 1 AND mood_rating <= 5), -- How user felt about this progress
  confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 5), -- How confident user is about achieving goal
  
  -- AI coaching context
  ai_generated_insights TEXT[], -- AI-generated insights about this progress entry
  coaching_triggered BOOLEAN DEFAULT FALSE, -- Whether this progress entry triggered coaching
  
  -- Media and evidence
  photo_urls TEXT[], -- Photos of progress (before/after, workout pics, etc.)
  
  -- Timestamps
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create goal coaching messages table for AI coaching history
CREATE TABLE IF NOT EXISTS goal_coaching_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES user_goals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Message content
  message_text TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('encouragement', 'milestone_celebration', 'course_correction', 'strategy_suggestion', 'obstacle_help', 'check_in')) NOT NULL,
  coaching_tone TEXT CHECK (coaching_tone IN ('motivational', 'analytical', 'supportive', 'challenging')),
  
  -- Context and triggers
  triggered_by TEXT CHECK (triggered_by IN ('progress_update', 'missed_checkin', 'milestone_reached', 'goal_stalled', 'user_request', 'scheduled')),
  goal_context JSONB DEFAULT '{}', -- Goal state when message was generated
  user_context JSONB DEFAULT '{}', -- User state when message was generated
  
  -- User interaction
  user_response TEXT CHECK (user_response IN ('helpful', 'not_helpful', 'motivating', 'overwhelming', 'ignored')),
  user_feedback TEXT,
  led_to_action BOOLEAN DEFAULT FALSE,
  
  -- AI learning
  effectiveness_score DECIMAL(3,2), -- 0.0 to 1.0 score for AI learning
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_status ON user_goals(status);
CREATE INDEX IF NOT EXISTS idx_user_goals_category ON user_goals(category);
CREATE INDEX IF NOT EXISTS idx_user_goals_target_date ON user_goals(target_date);
CREATE INDEX IF NOT EXISTS idx_user_goals_priority ON user_goals(priority);
CREATE INDEX IF NOT EXISTS idx_user_goals_parent_goal ON user_goals(parent_goal_id) WHERE parent_goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_goals_progress ON user_goals(progress_percentage);
CREATE INDEX IF NOT EXISTS idx_user_goals_active ON user_goals(user_id, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_goal_progress_logs_goal_id ON goal_progress_logs(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_logs_recorded_at ON goal_progress_logs(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_progress_logs_user_goal ON goal_progress_logs(user_id, goal_id);

CREATE INDEX IF NOT EXISTS idx_goal_coaching_messages_goal_id ON goal_coaching_messages(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_coaching_messages_user_id ON goal_coaching_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_coaching_messages_created_at ON goal_coaching_messages(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Update last_progress_update when current_value changes
  IF OLD.current_value IS DISTINCT FROM NEW.current_value THEN
    NEW.last_progress_update = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_goals_updated_at
  BEFORE UPDATE ON user_goals
  FOR EACH ROW EXECUTE FUNCTION update_user_goals_updated_at();

-- Create function to automatically create progress log when goal progress is updated
CREATE OR REPLACE FUNCTION create_progress_log_on_goal_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create log if current_value actually changed
  IF OLD.current_value IS DISTINCT FROM NEW.current_value THEN
    INSERT INTO goal_progress_logs (
      goal_id,
      user_id,
      recorded_value,
      previous_value,
      progress_percentage,
      log_type,
      data_source
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.current_value,
      OLD.current_value,
      NEW.progress_percentage,
      'auto_sync',
      'app_tracking'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_progress_log_on_goal_update
  AFTER UPDATE ON user_goals
  FOR EACH ROW EXECUTE FUNCTION create_progress_log_on_goal_update();

-- Create function to check for overdue goals and update status
CREATE OR REPLACE FUNCTION update_overdue_goals()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE user_goals 
  SET status = 'overdue'
  WHERE status = 'active' 
    AND target_date < CURRENT_DATE
    AND progress_percentage < 100;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's active goals with progress summary
CREATE OR REPLACE FUNCTION get_user_active_goals(target_user_id UUID)
RETURNS TABLE (
  id UUID,
  title VARCHAR(200),
  category TEXT,
  target_date DATE,
  days_remaining INTEGER,
  progress_percentage INTEGER,
  current_value DECIMAL(10,2),
  target_value DECIMAL(10,2),
  target_unit TEXT,
  priority TEXT,
  last_progress_date DATE,
  coaching_needed BOOLEAN
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.title,
    g.category,
    g.target_date,
    (g.target_date - CURRENT_DATE)::INTEGER as days_remaining,
    g.progress_percentage,
    g.current_value,
    g.target_value,
    g.target_unit,
    g.priority,
    DATE(g.last_progress_update) as last_progress_date,
    -- Coaching needed if no progress update in last 7 days for weekly+ goals
    CASE 
      WHEN g.coaching_frequency = 'daily' AND (g.last_progress_update < NOW() - INTERVAL '2 days' OR g.last_progress_update IS NULL) THEN TRUE
      WHEN g.coaching_frequency = 'weekly' AND (g.last_progress_update < NOW() - INTERVAL '7 days' OR g.last_progress_update IS NULL) THEN TRUE
      WHEN g.coaching_frequency = 'biweekly' AND (g.last_progress_update < NOW() - INTERVAL '14 days' OR g.last_progress_update IS NULL) THEN TRUE
      ELSE FALSE
    END as coaching_needed
  FROM user_goals g
  WHERE g.user_id = target_user_id
    AND g.status = 'active'
  ORDER BY 
    g.priority DESC,
    g.target_date ASC,
    g.progress_percentage ASC;
END;
$$;

-- Create function to get goal insights for AI coaching
CREATE OR REPLACE FUNCTION get_goal_insights_for_coaching(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'active_goals_count', (
      SELECT COUNT(*) FROM user_goals 
      WHERE user_id = target_user_id AND status = 'active'
    ),
    'overdue_goals_count', (
      SELECT COUNT(*) FROM user_goals 
      WHERE user_id = target_user_id AND status = 'overdue'
    ),
    'goals_needing_attention', (
      SELECT COUNT(*) FROM user_goals 
      WHERE user_id = target_user_id 
        AND status = 'active'
        AND (last_progress_update < NOW() - INTERVAL '7 days' OR last_progress_update IS NULL)
    ),
    'average_progress', (
      SELECT ROUND(AVG(progress_percentage), 1) 
      FROM user_goals 
      WHERE user_id = target_user_id AND status = 'active'
    ),
    'recent_progress', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'goal_title', g.title,
          'category', g.category,
          'progress_percentage', g.progress_percentage,
          'days_remaining', (g.target_date - CURRENT_DATE),
          'last_update', DATE(g.last_progress_update)
        ) ORDER BY g.last_progress_update DESC
      ), '[]'::json)
      FROM user_goals g
      WHERE g.user_id = target_user_id 
        AND g.status = 'active'
        AND g.last_progress_update >= NOW() - INTERVAL '30 days'
      LIMIT 5
    ),
    'goal_categories', (
      SELECT json_agg(DISTINCT category)
      FROM user_goals 
      WHERE user_id = target_user_id AND status = 'active'
    ),
    'upcoming_deadlines', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'goal_title', title,
          'target_date', target_date,
          'days_remaining', (target_date - CURRENT_DATE),
          'progress_percentage', progress_percentage
        ) ORDER BY target_date ASC
      ), '[]'::json)
      FROM user_goals 
      WHERE user_id = target_user_id 
        AND status = 'active'
        AND target_date <= CURRENT_DATE + INTERVAL '30 days'
      LIMIT 3
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_coaching_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own goals" ON user_goals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own goal progress logs" ON goal_progress_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own goal coaching messages" ON goal_coaching_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert goal coaching messages" ON goal_coaching_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goal coaching messages" ON goal_coaching_messages
  FOR UPDATE USING (auth.uid() = user_id);

-- Add helpful comments
COMMENT ON TABLE user_goals IS 'Detailed SMART goal tracking with AI coaching integration';
COMMENT ON TABLE goal_progress_logs IS 'Historical log of all goal progress updates with context';
COMMENT ON TABLE goal_coaching_messages IS 'AI coaching messages specific to individual goals';

COMMENT ON COLUMN user_goals.specific_target IS 'Clear, specific description of what user wants to achieve';
COMMENT ON COLUMN user_goals.measurable_metric IS 'The metric that will be tracked (weight_kg, run_time_minutes, etc.)';
COMMENT ON COLUMN user_goals.target_value IS 'Numeric target value to achieve';
COMMENT ON COLUMN user_goals.progress_percentage IS 'Auto-calculated progress percentage based on current vs target value';
COMMENT ON COLUMN user_goals.ai_context IS 'AI learning context about user patterns and preferences for this goal';
COMMENT ON COLUMN user_goals.milestones IS 'JSON array of milestone objects with dates, values, and rewards';

COMMENT ON COLUMN goal_progress_logs.mood_rating IS 'User mood when logging progress (1=frustrated, 5=excited)';
COMMENT ON COLUMN goal_progress_logs.confidence_level IS 'User confidence in achieving goal (1=low, 5=very confident)';

COMMENT ON COLUMN goal_coaching_messages.effectiveness_score IS 'AI learning score for message effectiveness (0.0-1.0)';
COMMENT ON COLUMN goal_coaching_messages.triggered_by IS 'What event triggered this coaching message';