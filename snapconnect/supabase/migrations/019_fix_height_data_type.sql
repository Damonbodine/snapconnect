-- Fix height_cm field to accept decimal values
-- Need to drop and recreate view that depends on this column

-- Drop the view that depends on height_cm
DROP VIEW IF EXISTS user_profiles_enhanced;

-- Change height_cm from INTEGER to DECIMAL to allow values like 190.5
ALTER TABLE users 
ALTER COLUMN height_cm TYPE DECIMAL(5,1);

-- Recreate the enhanced profile view
CREATE VIEW user_profiles_enhanced AS
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

-- Update the comment to reflect the change
COMMENT ON COLUMN users.height_cm IS 'User height in centimeters (allows decimal like 175.5) for BMI and calorie calculations';