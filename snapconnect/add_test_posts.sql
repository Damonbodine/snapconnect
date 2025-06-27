-- Add test users and posts for discover feed testing
-- Run this in your Supabase SQL Editor

-- First, let's create some test users (skip if they already exist)
INSERT INTO users (id, username, full_name, avatar_url, fitness_level, email, created_at)
VALUES 
  (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'fitness_guru',
    'Alex Fitness',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=150&h=150&fit=crop&crop=face',
    'advanced',
    'alex@fitnessapp.com',
    now() - interval '2 days'
  ),
  (
    '22222222-2222-2222-2222-222222222222'::uuid,
    'yoga_master', 
    'Sarah Zen',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    'intermediate',
    'sarah@fitnessapp.com',
    now() - interval '3 days'
  ),
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
    '44444444-4444-4444-4444-444444444444'::uuid,
    'strong_emma',
    'Emma Power',
    'https://images.unsplash.com/photo-1594736797933-d0ca9c65d2f0?w=150&h=150&fit=crop&crop=face',
    'advanced',
    'emma@fitnessapp.com',
    now() - interval '4 hours'
  ),
  (
    '55555555-5555-5555-5555-555555555555'::uuid,
    'zen_master',
    'David Calm',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    'intermediate',
    'david@fitnessapp.com',
    now() - interval '6 hours'
  )
ON CONFLICT (id) DO NOTHING;

-- Now add diverse fitness posts with real workout photos
INSERT INTO posts (id, user_id, content, media_url, media_type, workout_type, created_at)
VALUES
  -- Alex's HIIT workout
  (
    'post-1111-aaaa-bbbb-cccccccccccc'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Beast mode activated! 🔥 Just crushed a 45-minute HIIT session at FitZone Gym. Burpees, mountain climbers, and jump squats had me sweating buckets. Who else loves that post-workout endorphin rush? 💪 #HIITLife #BeastMode',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=800&fit=crop',
    'photo',
    'cardio',
    now() - interval '2 hours'
  ),
  
  -- Sarah's morning yoga
  (
    'post-2222-aaaa-bbbb-cccccccccccc'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'Morning flow complete ✨ Started the day with 60 minutes of vinyasa yoga. Nothing beats that mind-body connection when you flow with your breath. Feeling centered and ready for whatever today brings! 🧘‍♀️ #YogaLife #MorningFlow',
    'https://images.unsplash.com/photo-1506629905607-45b6b7e84a15?w=800&h=800&fit=crop',
    'photo',
    'flexibility',
    'Sunrise Yoga Studio',
    now() - interval '3 hours'
  ),
  
  -- Mike's first 5K
  (
    'post-3333-aaaa-bbbb-cccccccccccc'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    'I DID IT! 🏃‍♂️ Just completed my first ever 5K run without stopping! Six weeks ago I could barely run to the mailbox. Today I ran 3.1 miles! To everyone just starting their fitness journey - YOU GOT THIS! Small steps lead to big victories! 🎉',
    'https://images.unsplash.com/photo-1552508744-1696d4464960?w=800&h=800&fit=crop',
    'photo',
    'cardio',
    'Riverside Park Trail',
    now() - interval '1 hour'
  ),
  
  -- Emma's deadlift PR
  (
    'post-4444-aaaa-bbbb-cccccccccccc'::uuid,
    '44444444-4444-4444-4444-444444444444'::uuid,
    'NEW PR ALERT! 🚨 Just hit 275lbs on deadlifts for 3 clean reps! Been working on my form for months and it finally paid off. Remember: progressive overload + perfect form = gains that last. Shoutout to my amazing spotter! 💪 #DeadliftPR #StrengthTraining',
    'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&h=800&fit=crop',
    'photo',
    'strength',
    'Iron Paradise Gym',
    now() - interval '4 hours'
  ),
  
  -- David's meditation session
  (
    'post-5555-aaaa-bbbb-cccccccccccc'::uuid,
    '55555555-5555-5555-5555-555555555555'::uuid,
    'Recovery day vibes 🌅 Spent 30 minutes in moving meditation at the beach. Sometimes the best workout is slowing down and reconnecting with yourself. Rest is just as important as training! Who else practices mindful movement? #Recovery #Meditation #Balance',
    'https://images.unsplash.com/photo-1599447421416-3414500d18a5?w=800&h=800&fit=crop',
    'photo',
    'flexibility',
    'Santa Monica Beach',
    now() - interval '6 hours'
  ),
  
  -- Alex's boxing session
  (
    'post-6666-aaaa-bbbb-cccccccccccc'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Heavy bag therapy session complete! 🥊 Nothing relieves stress like throwing hands for 45 minutes. Worked on jab-cross combos and footwork. Boxing isn''t just about strength - it''s cardio, coordination, and mental toughness all in one! #BoxingLife #StressRelief',
    'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&h=800&fit=crop',
    'photo',
    'cardio',
    'Champions Boxing Club',
    now() - interval '5 hours'
  ),
  
  -- Sarah's outdoor flow
  (
    'post-7777-aaaa-bbbb-cccccccccccc'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'Nature is the best yoga studio 🌳 Took my practice outside today for some fresh air flow. The birds were my soundtrack and the grass was my mat. There''s something magical about connecting with the earth while you move. Try it! #OutdoorYoga #NatureTherapy',
    'https://images.unsplash.com/photo-1588286840104-8957b019727f?w=800&h=800&fit=crop',
    'photo',
    'flexibility',
    'Central Park',
    now() - interval '7 hours'
  ),
  
  -- Emma's squat session
  (
    'post-8888-aaaa-bbbb-cccccccccccc'::uuid,
    '44444444-4444-4444-4444-444444444444'::uuid,
    'Leg day = best day! 🍑 Hit squats, Romanian deadlifts, and Bulgarian split squats today. My legs are jello but my soul is happy! Remember: strong legs = strong foundation for everything else in life. Never skip leg day! #LegDay #SquatLife #StrongNotSkinny',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=800&fit=crop',
    'photo',
    'strength',
    'Beast Mode Fitness',
    now() - interval '8 hours'
  )
ON CONFLICT (id) DO NOTHING;

-- Verify the posts were created
SELECT 
  p.id,
  u.username,
  p.content,
  p.workout_type,
  p.created_at
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.id LIKE 'post-%'
ORDER BY p.created_at DESC;

-- Show summary
SELECT 
  'Test data created successfully!' as status,
  count(DISTINCT u.id) as test_users_created,
  count(p.id) as test_posts_created
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE u.id::text LIKE '11111111-%' 
   OR u.id::text LIKE '22222222-%' 
   OR u.id::text LIKE '33333333-%'
   OR u.id::text LIKE '44444444-%'
   OR u.id::text LIKE '55555555-%';