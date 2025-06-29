-- Check AI users in the database
SELECT 
  id,
  username,
  full_name,
  avatar_url,
  is_mock_user,
  personality_traits IS NOT NULL as has_personality,
  created_at
FROM users 
WHERE is_mock_user = true 
ORDER BY username 
LIMIT 10;

-- Check if the get_ai_users function exists
SELECT EXISTS (
  SELECT 1 FROM pg_proc 
  WHERE proname = 'get_ai_users'
) as function_exists;

-- Test the get_ai_users function if it exists
SELECT * FROM get_ai_users() LIMIT 5;