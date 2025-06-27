-- Check if mock users exist in the database
SELECT 
  id,
  username,
  full_name,
  fitness_level,
  email,
  created_at
FROM users 
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222', 
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666'
)
ORDER BY username;

-- Also check what users DO exist
SELECT 
  'Total users in database:' as info,
  count(*) as count
FROM users;

-- Check recent users
SELECT 
  id,
  username,
  email,
  created_at
FROM users 
ORDER BY created_at DESC 
LIMIT 10;