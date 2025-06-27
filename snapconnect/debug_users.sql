-- Debug: Check what users actually exist
SELECT 'Current users in database:' as info;

SELECT 
  id,
  username, 
  full_name,
  fitness_level,
  created_at
FROM users
ORDER BY created_at DESC;

-- Check specifically for our target user
SELECT 'Checking for yoga_master user:' as info;

SELECT 
  id,
  username,
  full_name
FROM users 
WHERE id = '22222222-2222-2222-2222-222222222222'::uuid
   OR username = 'yoga_master';

-- Check if posts exist but users don't
SELECT 'Posts with missing users:' as info;

SELECT DISTINCT 
  p.user_id,
  'Post exists but user missing' as issue
FROM posts p
LEFT JOIN users u ON p.user_id = u.id
WHERE u.id IS NULL
LIMIT 10;