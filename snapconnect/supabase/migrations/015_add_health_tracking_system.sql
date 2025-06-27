-- Health Tracking System Migration
-- Creates tables for step tracking, streaks, achievements, and AI coaching

-- Daily step logs table
CREATE TABLE IF NOT EXISTS daily_step_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  step_count INTEGER NOT NULL DEFAULT 0,
  goal_reached BOOLEAN DEFAULT false,
  calories_burned INTEGER DEFAULT 0,
  distance_km DECIMAL(8,2) DEFAULT 0,
  active_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user per date
  UNIQUE(user_id, date)
);

-- User streaks table for tracking consecutive achievements
CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  streak_type VARCHAR(50) NOT NULL, -- 'daily_steps', 'weekly_workouts', etc.
  current_count INTEGER DEFAULT 0,
  best_count INTEGER DEFAULT 0,
  last_updated DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One streak per type per user
  UNIQUE(user_id, streak_type)
);

-- User achievements/badges table
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  achievement_type VARCHAR(50) NOT NULL, -- 'steps', 'streak', 'workout', 'milestone'
  achievement_id VARCHAR(100) NOT NULL, -- specific achievement identifier
  title VARCHAR(200) NOT NULL,
  description TEXT,
  icon_name VARCHAR(100),
  level INTEGER DEFAULT 1,
  earned_date DATE DEFAULT CURRENT_DATE,
  metadata JSONB DEFAULT '{}', -- additional achievement data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate achievements
  UNIQUE(user_id, achievement_id)
);

-- Workout logs table for detailed workout tracking
CREATE TABLE IF NOT EXISTS workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  workout_type VARCHAR(50) NOT NULL, -- 'running', 'strength', 'yoga', etc.
  duration_minutes INTEGER NOT NULL,
  calories_burned INTEGER,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  average_heart_rate INTEGER,
  max_heart_rate INTEGER,
  intensity_level VARCHAR(20), -- 'low', 'moderate', 'high'
  notes TEXT,
  source VARCHAR(50) DEFAULT 'manual', -- 'healthkit', 'manual', 'app'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Health metrics table for storing daily health data
CREATE TABLE IF NOT EXISTS health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  resting_heart_rate INTEGER,
  sleep_hours DECIMAL(4,2),
  sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 10),
  weight_kg DECIMAL(5,2),
  body_fat_percentage DECIMAL(5,2),
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
  stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One record per user per date
  UNIQUE(user_id, date)
);

-- AI coaching messages table
CREATE TABLE IF NOT EXISTS ai_coaching_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  message_type VARCHAR(50) NOT NULL, -- 'motivation', 'advice', 'celebration', 'suggestion', 'check_in'
  message_text TEXT NOT NULL,
  health_context JSONB DEFAULT '{}', -- health data context when message was generated
  is_actionable BOOLEAN DEFAULT false,
  suggested_action TEXT,
  user_response VARCHAR(20), -- 'helpful', 'not_helpful', 'ignored'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Weekly health summaries table for trend analysis
CREATE TABLE IF NOT EXISTS weekly_health_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  week_starting DATE NOT NULL,
  total_steps INTEGER DEFAULT 0,
  average_daily_steps INTEGER DEFAULT 0,
  goal_days_reached INTEGER DEFAULT 0,
  total_workouts INTEGER DEFAULT 0,
  total_active_minutes INTEGER DEFAULT 0,
  average_sleep_hours DECIMAL(4,2),
  new_achievements INTEGER DEFAULT 0,
  weekly_insight TEXT, -- AI-generated weekly insight
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One summary per user per week
  UNIQUE(user_id, week_starting)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_step_logs_user_date ON daily_step_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_type ON user_streaks(user_id, streak_type);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_type ON user_achievements(user_id, achievement_type);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON workout_logs(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_health_metrics_user_date ON health_metrics(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_coaching_messages_user_date ON ai_coaching_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_week ON weekly_health_summaries(user_id, week_starting DESC);

-- RLS (Row Level Security) policies
ALTER TABLE daily_step_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coaching_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_health_summaries ENABLE ROW LEVEL SECURITY;

-- Policies for daily_step_logs
CREATE POLICY "Users can view own step logs" ON daily_step_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own step logs" ON daily_step_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own step logs" ON daily_step_logs
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for user_streaks
CREATE POLICY "Users can view own streaks" ON user_streaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own streaks" ON user_streaks
  FOR ALL USING (auth.uid() = user_id);

-- Policies for user_achievements
CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for workout_logs
CREATE POLICY "Users can manage own workout logs" ON workout_logs
  FOR ALL USING (auth.uid() = user_id);

-- Policies for health_metrics
CREATE POLICY "Users can manage own health metrics" ON health_metrics
  FOR ALL USING (auth.uid() = user_id);

-- Policies for ai_coaching_messages
CREATE POLICY "Users can view own coaching messages" ON ai_coaching_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coaching messages" ON ai_coaching_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own coaching messages" ON ai_coaching_messages
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for weekly_health_summaries
CREATE POLICY "Users can view own weekly summaries" ON weekly_health_summaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own weekly summaries" ON weekly_health_summaries
  FOR ALL USING (auth.uid() = user_id);

-- Functions for streak management
CREATE OR REPLACE FUNCTION update_step_streak()
RETURNS TRIGGER AS $$
BEGIN
  -- Update daily steps streak when a step log is inserted/updated
  IF NEW.goal_reached THEN
    -- Goal reached, increment or start streak
    INSERT INTO user_streaks (user_id, streak_type, current_count, best_count, last_updated)
    VALUES (NEW.user_id, 'daily_steps', 1, 1, NEW.date)
    ON CONFLICT (user_id, streak_type) DO UPDATE SET
      current_count = CASE 
        WHEN user_streaks.last_updated = NEW.date - INTERVAL '1 day' 
        THEN user_streaks.current_count + 1
        ELSE 1
      END,
      best_count = GREATEST(user_streaks.best_count, 
        CASE 
          WHEN user_streaks.last_updated = NEW.date - INTERVAL '1 day'
          THEN user_streaks.current_count + 1
          ELSE 1
        END
      ),
      last_updated = NEW.date,
      is_active = true,
      updated_at = NOW();
  ELSE
    -- Goal not reached, break streak if it was active yesterday
    UPDATE user_streaks 
    SET 
      current_count = 0,
      is_active = false,
      updated_at = NOW()
    WHERE user_id = NEW.user_id 
      AND streak_type = 'daily_steps'
      AND last_updated = NEW.date - INTERVAL '1 day'
      AND is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for step streak updates
CREATE TRIGGER trigger_update_step_streak
  AFTER INSERT OR UPDATE ON daily_step_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_step_streak();

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION check_step_achievements()
RETURNS TRIGGER AS $$
BEGIN
  -- Award achievement for first 10K steps
  IF NEW.step_count >= 10000 AND NEW.goal_reached THEN
    INSERT INTO user_achievements (user_id, achievement_type, achievement_id, title, description, icon_name)
    VALUES (NEW.user_id, 'steps', 'first_10k', 'Step Champion', 'Reached 10,000 steps in a day!', 'trophy')
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;
  
  -- Award achievements for step streaks
  DECLARE
    current_streak INTEGER;
  BEGIN
    SELECT current_count INTO current_streak
    FROM user_streaks 
    WHERE user_id = NEW.user_id AND streak_type = 'daily_steps';
    
    -- 7-day streak
    IF current_streak >= 7 THEN
      INSERT INTO user_achievements (user_id, achievement_type, achievement_id, title, description, icon_name, level)
      VALUES (NEW.user_id, 'streak', 'weekly_warrior', 'Weekly Warrior', 'Maintained a 7-day step streak!', 'fire', 1)
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
    END IF;
    
    -- 30-day streak
    IF current_streak >= 30 THEN
      INSERT INTO user_achievements (user_id, achievement_type, achievement_id, title, description, icon_name, level)
      VALUES (NEW.user_id, 'streak', 'monthly_master', 'Monthly Master', 'Incredible 30-day step streak!', 'crown', 2)
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
    END IF;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for achievement checking
CREATE TRIGGER trigger_check_step_achievements
  AFTER INSERT OR UPDATE ON daily_step_logs
  FOR EACH ROW
  EXECUTE FUNCTION check_step_achievements();

-- Function to get user's health dashboard data
CREATE OR REPLACE FUNCTION get_health_dashboard(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'todaysSteps', COALESCE((
      SELECT step_count 
      FROM daily_step_logs 
      WHERE user_id = target_user_id AND date = CURRENT_DATE
    ), 0),
    'currentStreak', COALESCE((
      SELECT current_count 
      FROM user_streaks 
      WHERE user_id = target_user_id AND streak_type = 'daily_steps' AND is_active = true
    ), 0),
    'bestStreak', COALESCE((
      SELECT best_count 
      FROM user_streaks 
      WHERE user_id = target_user_id AND streak_type = 'daily_steps'
    ), 0),
    'totalAchievements', (
      SELECT COUNT(*) 
      FROM user_achievements 
      WHERE user_id = target_user_id
    ),
    'weeklyAverage', COALESCE((
      SELECT ROUND(AVG(step_count)) 
      FROM daily_step_logs 
      WHERE user_id = target_user_id 
        AND date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0),
    'recentAchievements', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', id,
          'title', title,
          'description', description,
          'icon_name', icon_name,
          'earned_date', earned_date
        ) ORDER BY earned_date DESC
      ), '[]'::json)
      FROM user_achievements 
      WHERE user_id = target_user_id 
        AND earned_date >= CURRENT_DATE - INTERVAL '7 days'
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to batch update step data (useful for syncing from HealthKit)
CREATE OR REPLACE FUNCTION batch_update_step_data(
  target_user_id UUID,
  step_data JSON
)
RETURNS JSON AS $$
DECLARE
  step_record JSON;
  inserted_count INTEGER := 0;
  updated_count INTEGER := 0;
BEGIN
  -- Loop through the step data array
  FOR step_record IN SELECT * FROM json_array_elements(step_data)
  LOOP
    INSERT INTO daily_step_logs (
      user_id, 
      date, 
      step_count, 
      goal_reached,
      updated_at
    )
    VALUES (
      target_user_id,
      (step_record->>'date')::DATE,
      (step_record->>'steps')::INTEGER,
      (step_record->>'steps')::INTEGER >= 10000,
      NOW()
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
      step_count = (step_record->>'steps')::INTEGER,
      goal_reached = (step_record->>'steps')::INTEGER >= 10000,
      updated_at = NOW();
    
    -- Count operations for response
    IF FOUND THEN
      updated_count := updated_count + 1;
    ELSE
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'total', inserted_count + updated_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;