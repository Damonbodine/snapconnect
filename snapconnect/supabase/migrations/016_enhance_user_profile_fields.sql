-- Enhanced User Profile Fields Migration
-- Adds comprehensive health and lifestyle fields to support better AI coaching
-- SAFE: Checked against existing schema for no collisions

-- Add health baseline fields (avoid collision with existing fields)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS current_weight_kg DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS target_weight_kg DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS height_cm INTEGER,
ADD COLUMN IF NOT EXISTS daily_step_goal INTEGER DEFAULT 10000,
ADD COLUMN IF NOT EXISTS weekly_workout_goal INTEGER DEFAULT 3;

-- Add lifestyle and schedule fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferred_workout_times TEXT[] DEFAULT '{}', -- e.g., ['morning', 'evening']
ADD COLUMN IF NOT EXISTS available_equipment TEXT[] DEFAULT '{}', -- e.g., ['dumbbells', 'yoga_mat', 'resistance_bands']
ADD COLUMN IF NOT EXISTS injuries_limitations TEXT, -- Free text for user to describe any limitations
ADD COLUMN IF NOT EXISTS sleep_schedule JSONB DEFAULT '{}', -- e.g., {"bedtime": "22:30", "wakeup": "07:00", "sleep_goal_hours": 8}
ADD COLUMN IF NOT EXISTS motivation_style TEXT CHECK (motivation_style IN ('encouraging', 'challenging', 'scientific', 'casual')) DEFAULT 'encouraging';

-- Add current activity and experience fields (different from existing fitness_level)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS current_activity_level TEXT CHECK (current_activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active')) DEFAULT 'lightly_active',
ADD COLUMN IF NOT EXISTS fitness_experience_years INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS preferred_workout_duration INTEGER DEFAULT 30; -- minutes

-- Add enhanced nutrition fields (extends existing dietary_preferences)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS meal_prep_preference TEXT CHECK (meal_prep_preference IN ('none', 'simple', 'moderate', 'advanced')) DEFAULT 'simple',
ADD COLUMN IF NOT EXISTS cooking_skill_level TEXT CHECK (cooking_skill_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'intermediate',
ADD COLUMN IF NOT EXISTS food_allergies TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS nutrition_goals TEXT[] DEFAULT '{}'; -- e.g., ['high_protein', 'low_carb', 'balanced']

-- Add wellness and mental health tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10) DEFAULT 5,
ADD COLUMN IF NOT EXISTS energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10) DEFAULT 5,
ADD COLUMN IF NOT EXISTS wellness_goals TEXT[] DEFAULT '{}'; -- e.g., ['better_sleep', 'stress_reduction', 'mental_clarity']

-- Add social and accountability preferences
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS accountability_preference TEXT CHECK (accountability_preference IN ('none', 'app_only', 'friends', 'coach', 'community')) DEFAULT 'app_only',
ADD COLUMN IF NOT EXISTS social_sharing_comfort TEXT CHECK (social_sharing_comfort IN ('private', 'friends_only', 'selective', 'public')) DEFAULT 'friends_only';

-- Add time availability and constraints
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS available_workout_days TEXT[] DEFAULT '{}', -- e.g., ['monday', 'wednesday', 'friday']
ADD COLUMN IF NOT EXISTS workout_time_constraints JSONB DEFAULT '{}'; -- e.g., {"max_session_minutes": 45, "prefer_short_sessions": true}

-- Add coaching style preferences (different from existing AI fields)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS coaching_style TEXT CHECK (coaching_style IN ('gentle', 'motivational', 'data_driven', 'holistic', 'goal_focused')) DEFAULT 'motivational',
ADD COLUMN IF NOT EXISTS feedback_frequency TEXT CHECK (feedback_frequency IN ('real_time', 'daily', 'weekly', 'minimal')) DEFAULT 'daily',
ADD COLUMN IF NOT EXISTS progress_tracking_detail TEXT CHECK (progress_tracking_detail IN ('basic', 'detailed', 'comprehensive')) DEFAULT 'detailed';

-- Add motivational context fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS primary_motivation TEXT, -- Free text for user's main motivation
ADD COLUMN IF NOT EXISTS biggest_fitness_challenge TEXT, -- Free text for biggest fitness challenge
ADD COLUMN IF NOT EXISTS previous_fitness_successes TEXT, -- Free text for what has worked before
ADD COLUMN IF NOT EXISTS location_type TEXT CHECK (location_type IN ('urban', 'suburban', 'rural')) DEFAULT 'suburban';

-- Add user preferences for enhanced onboarding tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS onboarding_completed_steps TEXT[] DEFAULT '{}', -- Track which onboarding steps completed
ADD COLUMN IF NOT EXISTS onboarding_completion_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS profile_setup_phase TEXT CHECK (profile_setup_phase IN ('basic', 'enhanced', 'complete')) DEFAULT 'basic';

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_users_current_activity_level ON users(current_activity_level) WHERE current_activity_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_motivation_style ON users(motivation_style) WHERE motivation_style IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_coaching_style ON users(coaching_style) WHERE coaching_style IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_daily_step_goal ON users(daily_step_goal) WHERE daily_step_goal IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_preferred_workout_times ON users USING gin(preferred_workout_times) WHERE preferred_workout_times != '{}';
CREATE INDEX IF NOT EXISTS idx_users_available_equipment ON users USING gin(available_equipment) WHERE available_equipment != '{}';
CREATE INDEX IF NOT EXISTS idx_users_profile_setup_phase ON users(profile_setup_phase);
CREATE INDEX IF NOT EXISTS idx_users_onboarding_completion ON users(onboarding_completion_date) WHERE onboarding_completion_date IS NOT NULL;

-- Create function to calculate enhanced profile completeness
CREATE OR REPLACE FUNCTION calculate_enhanced_profile_completeness(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  completeness_score INTEGER := 0;
  total_fields INTEGER := 35; -- Updated count including new fields
BEGIN
  -- Count filled essential fields (weight more heavily)
  SELECT 
    -- Basic profile (weight: 2 each)
    (CASE WHEN username IS NOT NULL THEN 2 ELSE 0 END) +
    (CASE WHEN full_name IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN avatar_url IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN bio IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN city IS NOT NULL THEN 1 ELSE 0 END) +
    
    -- Core fitness info (weight: 2 each) 
    (CASE WHEN fitness_level IS NOT NULL THEN 2 ELSE 0 END) +
    (CASE WHEN workout_intensity IS NOT NULL THEN 2 ELSE 0 END) +
    (CASE WHEN array_length(goals, 1) > 0 THEN 2 ELSE 0 END) +
    (CASE WHEN array_length(dietary_preferences, 1) > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN workout_frequency IS NOT NULL THEN 2 ELSE 0 END) +
    
    -- Health baseline (weight: 1 each)
    (CASE WHEN current_weight_kg IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN target_weight_kg IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN height_cm IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN daily_step_goal IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN weekly_workout_goal IS NOT NULL THEN 1 ELSE 0 END) +
    
    -- Lifestyle preferences (weight: 1 each)
    (CASE WHEN array_length(preferred_workout_times, 1) > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN array_length(available_equipment, 1) > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN motivation_style IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN current_activity_level IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN fitness_experience_years IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN preferred_workout_duration IS NOT NULL THEN 1 ELSE 0 END) +
    
    -- Coaching preferences (weight: 1 each)
    (CASE WHEN coaching_style IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN feedback_frequency IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN progress_tracking_detail IS NOT NULL THEN 1 ELSE 0 END) +
    
    -- Optional but valuable (weight: 1 each)
    (CASE WHEN primary_motivation IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN biggest_fitness_challenge IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN previous_fitness_successes IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN sleep_schedule IS NOT NULL AND sleep_schedule != '{}' THEN 1 ELSE 0 END) +
    (CASE WHEN array_length(wellness_goals, 1) > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN accountability_preference IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN social_sharing_comfort IS NOT NULL THEN 1 ELSE 0 END)
  INTO completeness_score
  FROM users 
  WHERE id = target_user_id;
  
  -- Return percentage (cap at 100%)
  RETURN LEAST(100, ROUND((completeness_score::DECIMAL / total_fields) * 100));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the enhanced profile view
CREATE OR REPLACE VIEW user_profiles_enhanced AS
SELECT 
  u.*,
  calculate_enhanced_profile_completeness(u.id) as profile_completeness_percentage,
  CASE 
    WHEN calculate_enhanced_profile_completeness(u.id) >= 90 THEN 'complete'
    WHEN calculate_enhanced_profile_completeness(u.id) >= 70 THEN 'mostly_complete'
    WHEN calculate_enhanced_profile_completeness(u.id) >= 50 THEN 'partially_complete'
    ELSE 'needs_enhancement'
  END as profile_status,
  -- Health coaching readiness score
  CASE 
    WHEN daily_step_goal IS NOT NULL AND 
         current_activity_level IS NOT NULL AND 
         coaching_style IS NOT NULL AND
         array_length(goals, 1) > 0 THEN 'ready'
    WHEN fitness_level IS NOT NULL AND 
         workout_frequency IS NOT NULL THEN 'basic_ready'
    ELSE 'needs_setup'
  END as coaching_readiness
FROM users u;

-- Function to get users who need profile enhancement
CREATE OR REPLACE FUNCTION get_users_needing_profile_enhancement(min_completeness INTEGER DEFAULT 70)
RETURNS TABLE (
  id UUID,
  username TEXT,
  profile_completeness_percentage INTEGER,
  coaching_readiness TEXT,
  missing_critical_fields TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    calculate_enhanced_profile_completeness(u.id) as profile_completeness_percentage,
    CASE 
      WHEN u.daily_step_goal IS NOT NULL AND 
           u.current_activity_level IS NOT NULL AND 
           u.coaching_style IS NOT NULL AND
           array_length(u.goals, 1) > 0 THEN 'ready'
      WHEN u.fitness_level IS NOT NULL AND 
           u.workout_frequency IS NOT NULL THEN 'basic_ready'
      ELSE 'needs_setup'
    END as coaching_readiness,
    -- Identify missing critical fields
    ARRAY(
      SELECT field_name FROM (
        VALUES 
          ('daily_step_goal', u.daily_step_goal IS NULL),
          ('current_activity_level', u.current_activity_level IS NULL), 
          ('coaching_style', u.coaching_style IS NULL),
          ('goals', array_length(u.goals, 1) IS NULL OR array_length(u.goals, 1) = 0),
          ('motivation_style', u.motivation_style IS NULL),
          ('preferred_workout_times', u.preferred_workout_times IS NULL OR u.preferred_workout_times = '{}'),
          ('workout_intensity', u.workout_intensity IS NULL)
      ) AS missing_fields(field_name, is_missing)
      WHERE is_missing = TRUE
    ) as missing_critical_fields
  FROM users u
  WHERE u.is_mock_user = FALSE -- Only real users
    AND calculate_enhanced_profile_completeness(u.id) < min_completeness
  ORDER BY calculate_enhanced_profile_completeness(u.id) ASC;
END;
$$;

-- Add helpful comments for documentation
COMMENT ON COLUMN users.current_weight_kg IS 'User current weight in kilograms for BMI and calorie calculations';
COMMENT ON COLUMN users.target_weight_kg IS 'User target weight in kilograms for goal tracking';
COMMENT ON COLUMN users.height_cm IS 'User height in centimeters for BMI and calorie calculations';
COMMENT ON COLUMN users.daily_step_goal IS 'User personalized daily step goal (default 10,000)';
COMMENT ON COLUMN users.weekly_workout_goal IS 'User weekly workout goal (default 3 sessions)';
COMMENT ON COLUMN users.preferred_workout_times IS 'Array of preferred workout times like [morning, evening, lunch]';
COMMENT ON COLUMN users.available_equipment IS 'Array of available equipment like [dumbbells, yoga_mat, resistance_bands]';
COMMENT ON COLUMN users.injuries_limitations IS 'Free text describing any injuries or physical limitations for safe workout recommendations';
COMMENT ON COLUMN users.sleep_schedule IS 'JSON object with bedtime, wakeup, and sleep goal hours for recovery tracking';
COMMENT ON COLUMN users.motivation_style IS 'Preferred coaching motivation style for AI personalization';
COMMENT ON COLUMN users.current_activity_level IS 'Current activity level from sedentary to extremely active';
COMMENT ON COLUMN users.fitness_experience_years IS 'Years of fitness experience (0 for complete beginner)';
COMMENT ON COLUMN users.preferred_workout_duration IS 'Preferred workout session duration in minutes';
COMMENT ON COLUMN users.coaching_style IS 'Preferred AI coaching approach style';
COMMENT ON COLUMN users.feedback_frequency IS 'How often user wants coaching feedback and check-ins';
COMMENT ON COLUMN users.progress_tracking_detail IS 'Level of detail for progress tracking and analytics';
COMMENT ON COLUMN users.primary_motivation IS 'User primary motivation for fitness journey';
COMMENT ON COLUMN users.biggest_fitness_challenge IS 'User biggest challenge to help AI provide targeted support';
COMMENT ON COLUMN users.previous_fitness_successes IS 'What has worked for user before for AI to build on successes';
COMMENT ON COLUMN users.onboarding_completed_steps IS 'Array tracking which enhanced onboarding steps user completed';
COMMENT ON COLUMN users.profile_setup_phase IS 'Current profile setup phase: basic, enhanced, or complete';