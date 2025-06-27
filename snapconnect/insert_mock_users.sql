-- Insert mock users for profile testing
-- Run this in Supabase SQL Editor to add the missing users

INSERT INTO users (id, username, full_name, avatar_url, fitness_level, email, created_at)
VALUES 
  -- Advanced Users
  (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'fitness_guru',
    'Alex Fitness',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=150&h=150&fit=crop&crop=face',
    'advanced',
    'alex@fitnessapp.com',
    now() - interval '5 days'
  ),
  (
    '44444444-4444-4444-4444-444444444444'::uuid,
    'strong_emma',
    'Emma Power',
    'https://images.unsplash.com/photo-1594736797933-d0ca9c65d2f0?w=150&h=150&fit=crop&crop=face',
    'advanced',
    'emma@fitnessapp.com',
    now() - interval '3 days'
  ),
  -- Intermediate Users
  (
    '22222222-2222-2222-2222-222222222222'::uuid,
    'yoga_master',
    'Sarah Zen',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    'intermediate',
    'sarah@fitnessapp.com',
    now() - interval '4 days'
  ),
  (
    '55555555-5555-5555-5555-555555555555'::uuid,
    'zen_master',
    'David Calm',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    'intermediate',
    'david@fitnessapp.com',
    now() - interval '2 days'
  ),
  -- Beginner Users
  (
    '33333333-3333-3333-3333-333333333333'::uuid,
    'runner_mike',
    'Mike Start',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    'beginner',
    'mike@fitnessapp.com',
    now() - interval '1 day'
  ),
  (
    '66666666-6666-6666-6666-666666666666'::uuid,
    'newbie_lisa',
    'Lisa Begin',
    'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=150&h=150&fit=crop&crop=face',
    'beginner',
    'lisa@fitnessapp.com',
    now() - interval '6 hours'
  )
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  avatar_url = EXCLUDED.avatar_url,
  fitness_level = EXCLUDED.fitness_level,
  email = EXCLUDED.email;

-- Verify the users were created
SELECT 
  id,
  username,
  full_name,
  fitness_level,
  'Successfully created!' as status
FROM users 
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222', 
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666'
)
ORDER BY fitness_level, username;