-- Query to examine AI user attributes vs human user attributes
-- This will help determine what data is available for the "Find Your Tribe" section

-- First, let's see the structure of AI users
SELECT 
  'AI_USERS' as user_type,
  id,
  username,
  full_name,
  fitness_level,
  goals,
  dietary_preferences,
  workout_frequency,
  city,
  bio,
  age,
  height,
  weight,
  activity_level,
  gender,
  motivation_style,
  coaching_style,
  workout_types,
  availability,
  is_mock_user,
  ai_archetype,
  personality_traits,
  created_at
FROM users 
WHERE is_mock_user = true 
LIMIT 5;

-- Compare with human users (sample)
SELECT 
  'HUMAN_USERS' as user_type,
  id,
  username,
  full_name,
  fitness_level,
  goals,
  dietary_preferences,
  workout_frequency,
  city,
  bio,
  age,
  height,
  weight,
  activity_level,
  gender,
  motivation_style,
  coaching_style,
  workout_types,
  availability,
  is_mock_user,
  ai_archetype,
  personality_traits,
  created_at
FROM users 
WHERE (is_mock_user = false OR is_mock_user IS NULL)
LIMIT 5;

-- Count of attributes filled for AI vs Human users
SELECT 
  CASE 
    WHEN is_mock_user = true THEN 'AI_USERS'
    ELSE 'HUMAN_USERS'
  END as user_type,
  COUNT(*) as total_users,
  COUNT(fitness_level) as has_fitness_level,
  COUNT(goals) as has_goals,
  COUNT(city) as has_city,
  COUNT(bio) as has_bio,
  COUNT(age) as has_age,
  COUNT(height) as has_height,
  COUNT(weight) as has_weight,
  COUNT(activity_level) as has_activity_level,
  COUNT(gender) as has_gender,
  COUNT(motivation_style) as has_motivation_style,
  COUNT(coaching_style) as has_coaching_style,
  COUNT(workout_types) as has_workout_types,
  COUNT(availability) as has_availability,
  COUNT(ai_archetype) as has_ai_archetype,
  COUNT(personality_traits) as has_personality_traits
FROM users 
GROUP BY is_mock_user;

-- Look at specific AI archetype and personality data
SELECT 
  username,
  ai_archetype,
  personality_traits,
  fitness_level,
  goals,
  workout_types,
  city
FROM users 
WHERE is_mock_user = true 
AND ai_archetype IS NOT NULL
LIMIT 10;