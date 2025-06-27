-- Add missing onboarding fields to users table
-- These fields are needed for the enhanced onboarding flow

ALTER TABLE users 
-- Equipment and exercise preferences
ADD COLUMN IF NOT EXISTS equipment_list TEXT, -- Free text list of equipment user has
ADD COLUMN IF NOT EXISTS exercise_preferences TEXT[] DEFAULT '{}', -- Array of exercise types user prefers
ADD COLUMN IF NOT EXISTS has_equipment BOOLEAN DEFAULT FALSE, -- Whether user has any equipment

-- SMART goal tracking fields
ADD COLUMN IF NOT EXISTS primary_goal TEXT, -- User's main fitness goal
ADD COLUMN IF NOT EXISTS smart_goal_target TEXT, -- Specific goal description
ADD COLUMN IF NOT EXISTS smart_goal_value TEXT, -- Target value (e.g., "10", "5K")
ADD COLUMN IF NOT EXISTS smart_goal_unit TEXT, -- Unit of measurement (e.g., "kg", "km", "reps")
ADD COLUMN IF NOT EXISTS smart_goal_timeframe TEXT, -- Timeframe (e.g., "3months", "6months")
ADD COLUMN IF NOT EXISTS smart_goal_why TEXT, -- Why this goal is important to user
ADD COLUMN IF NOT EXISTS smart_goal_target_date DATE, -- Target completion date

-- System preferences
ADD COLUMN IF NOT EXISTS privacy_level TEXT CHECK (privacy_level IN ('private', 'friends', 'public')) DEFAULT 'friends',
ADD COLUMN IF NOT EXISTS measurement_system TEXT CHECK (measurement_system IN ('metric', 'imperial')) DEFAULT 'metric',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_exercise_preferences ON users USING gin(exercise_preferences) WHERE exercise_preferences != '{}';
CREATE INDEX IF NOT EXISTS idx_users_has_equipment ON users(has_equipment);
CREATE INDEX IF NOT EXISTS idx_users_primary_goal ON users(primary_goal) WHERE primary_goal IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_smart_goal_target_date ON users(smart_goal_target_date) WHERE smart_goal_target_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_privacy_level ON users(privacy_level);
CREATE INDEX IF NOT EXISTS idx_users_measurement_system ON users(measurement_system);

-- Add helpful comments
COMMENT ON COLUMN users.equipment_list IS 'Free text description of fitness equipment user has available';
COMMENT ON COLUMN users.exercise_preferences IS 'Array of exercise types user prefers (gym, outdoor, home, classes, sports)';
COMMENT ON COLUMN users.has_equipment IS 'Boolean indicating if user has any fitness equipment at home';
COMMENT ON COLUMN users.primary_goal IS 'User primary fitness goal from enhanced onboarding';
COMMENT ON COLUMN users.smart_goal_target IS 'Specific SMART goal description from onboarding';
COMMENT ON COLUMN users.smart_goal_value IS 'Target numeric value for SMART goal';
COMMENT ON COLUMN users.smart_goal_unit IS 'Unit of measurement for SMART goal (kg, km, reps, etc.)';
COMMENT ON COLUMN users.smart_goal_timeframe IS 'Timeframe for achieving SMART goal';
COMMENT ON COLUMN users.smart_goal_why IS 'User motivation for their SMART goal';
COMMENT ON COLUMN users.smart_goal_target_date IS 'Target date for achieving SMART goal';
COMMENT ON COLUMN users.privacy_level IS 'User privacy preference for profile and posts';
COMMENT ON COLUMN users.measurement_system IS 'Preferred measurement system (metric or imperial)';
COMMENT ON COLUMN users.timezone IS 'User timezone for scheduling and notifications';