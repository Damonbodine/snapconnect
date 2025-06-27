INSERT INTO users (id, username, full_name, avatar_url, fitness_level, email, goals, created_at)
VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'yoga_master',
  'Sarah Zen',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
  'intermediate',
  'sarah@fitnessapp.com',
  ARRAY['Master advanced poses', 'Teach yoga classes', 'Improve flexibility'],
  now() - interval '4 days'
)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  avatar_url = EXCLUDED.avatar_url,
  fitness_level = EXCLUDED.fitness_level,
  email = EXCLUDED.email,
  goals = EXCLUDED.goals;

SELECT 'User created successfully!' as status;