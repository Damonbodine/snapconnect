-- SnapConnect Discover Feed - Test Data Seeding Template
-- Run this in Supabase SQL Editor to add fresh test posts
-- 
-- USAGE:
-- 1. Copy this entire file
-- 2. Paste into Supabase SQL Editor (https://supabase.com/dashboard/project/lubfyjzdfgpoocsswrkz/sql/new)
-- 3. Run the script
-- 4. Refresh your discover feed to see new posts
--
-- NOTE: Posts will be visible to user ID: f3d6b62b-d92b-443a-9385-7583afe50c2b

-- Helper function to generate random UUIDs for posts
CREATE OR REPLACE FUNCTION generate_post_id() RETURNS uuid AS $$
BEGIN
  RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

-- Clear existing test data (optional - uncomment if you want fresh start)
-- DELETE FROM post_views WHERE user_id = 'f3d6b62b-d92b-443a-9385-7583afe50c2b'::uuid;
-- DELETE FROM posts WHERE user_id IN (
--   '11111111-1111-1111-1111-111111111111'::uuid,
--   '22222222-2222-2222-2222-222222222222'::uuid,
--   '33333333-3333-3333-3333-333333333333'::uuid,
--   '44444444-4444-4444-4444-444444444444'::uuid,
--   '55555555-5555-5555-5555-555555555555'::uuid
-- );

-- Ensure test users exist (upsert to avoid conflicts)
INSERT INTO users (id, username, full_name, avatar_url, fitness_level, email, goals, created_at)
VALUES 
  -- Advanced Users
  (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'fitness_guru',
    'Alex Fitness',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=150&h=150&fit=crop&crop=face',
    'advanced',
    'alex@fitnessapp.com',
    ARRAY['Build muscle mass', 'Compete in powerlifting', 'Train for strongman'],
    now() - interval '5 days'
  ),
  (
    '44444444-4444-4444-4444-444444444444'::uuid,
    'strong_emma',
    'Emma Power',
    'https://images.unsplash.com/photo-1594736797933-d0ca9c65d2f0?w=150&h=150&fit=crop&crop=face',
    'advanced',
    'emma@fitnessapp.com',
    ARRAY['Deadlift 400lbs', 'Compete in crossfit', 'Improve endurance'],
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
    ARRAY['Master advanced poses', 'Teach yoga classes', 'Improve flexibility'],
    now() - interval '4 days'
  ),
  (
    '55555555-5555-5555-5555-555555555555'::uuid,
    'zen_master',
    'David Calm',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    'intermediate',
    'david@fitnessapp.com',
    ARRAY['Reduce stress', 'Build core strength', 'Swim 1 mile'],
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
    ARRAY['Run 5K without stopping', 'Lose 20 pounds', 'Exercise 3x per week'],
    now() - interval '1 day'
  ),
  (
    '66666666-6666-6666-6666-666666666666'::uuid,
    'newbie_lisa',
    'Lisa Begin',
    'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=150&h=150&fit=crop&crop=face',
    'beginner',
    'lisa@fitnessapp.com',
    ARRAY['Get comfortable at gym', 'Make fitness friends', 'Build confidence'],
    now() - interval '6 hours'
  )
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  avatar_url = EXCLUDED.avatar_url,
  fitness_level = EXCLUDED.fitness_level,
  email = EXCLUDED.email,
  goals = EXCLUDED.goals;

-- Insert fresh test posts with variety of workout types and times
INSERT INTO posts (id, user_id, content, media_url, media_type, workout_type, created_at)
VALUES
  -- Recent posts (last few hours)
  (
    generate_post_id(),
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Morning HIIT session DESTROYED me! 🔥 30 minutes of pure intensity - burpees, mountain climbers, and jump squats. My legs are jello but my mind is CLEAR! Who else starts their day with fire? 💪 #HIITLife #MorningWarrior',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=800&fit=crop',
    'photo',
    'cardio',
    now() - interval '1 hour'
  ),
  (
    generate_post_id(),
    '22222222-2222-2222-2222-222222222222'::uuid,
    'Sunrise yoga flow complete ✨ There is something magical about moving with your breath as the world wakes up. 60 minutes of pure bliss and mindful movement. Namaste beautiful humans! 🧘‍♀️ #YogaLife #SunriseFlow #Mindfulness',
    'https://images.unsplash.com/photo-1506629905607-45b6b7e84a15?w=800&h=800&fit=crop',
    'photo',
    'flexibility',
    now() - interval '2 hours'
  ),
  (
    generate_post_id(),
    '44444444-4444-4444-4444-444444444444'::uuid,
    'DEADLIFT PR ALERT! 🚨 Just pulled 315lbs for 2 clean reps! Been grinding for months to hit this milestone. Form over ego always, but today both came together perfectly. Shoutout to my lifting partner for the hype! 💪 #DeadliftPR #StrengthGains',
    'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&h=800&fit=crop',
    'photo',
    'strength',
    now() - interval '3 hours'
  ),
  (
    generate_post_id(),
    '33333333-3333-3333-3333-333333333333'::uuid,
    'Week 3 of Couch to 5K complete! 🏃‍♂️ Just ran for 20 minutes straight without stopping - something I never thought possible 3 weeks ago. To everyone just starting: trust the process and be patient with yourself! 🎉 #CouchTo5K #NewRunner',
    'https://images.unsplash.com/photo-1552508744-1696d4464960?w=800&h=800&fit=crop',
    'photo',
    'cardio',
    now() - interval '4 hours'
  ),
  
  -- Yesterday posts
  (
    generate_post_id(),
    '55555555-5555-5555-5555-555555555555'::uuid,
    'Beach meditation session at sunset 🌅 Sometimes the best workout is slowing down and reconnecting with yourself. 30 minutes of breathwork and gentle movement. Recovery is just as important as training! #Meditation #Recovery #BeachVibes',
    'https://images.unsplash.com/photo-1599447421416-3414500d18a5?w=800&h=800&fit=crop',
    'photo',
    'flexibility',
    now() - interval '18 hours'
  ),
  (
    generate_post_id(),
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Boxing therapy session complete! 🥊 Nothing clears the mind like 45 minutes on the heavy bag. Worked on combinations, footwork, and stress relief. Boxing isn''t just about fighting - it''s about fighting FOR yourself! #BoxingLife #StressRelief',
    'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&h=800&fit=crop',
    'photo',
    'cardio',
    now() - interval '20 hours'
  ),
  (
    generate_post_id(),
    '66666666-6666-6666-6666-666666666666'::uuid,
    'First week at the gym DONE! 🎉 Was terrified to step foot in here, but everyone has been so welcoming and helpful. Started with basic machines and bodyweight exercises. Small steps, big dreams! Thanks to everyone who encouraged me to start! 💪 #GymNewbie #FirstWeek',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=800&fit=crop',
    'photo',
    'strength',
    now() - interval '22 hours'
  ),
  
  -- 2-3 days ago posts
  (
    generate_post_id(),
    '22222222-2222-2222-2222-222222222222'::uuid,
    'Outdoor flow in the park today! 🌳 Trading the studio for fresh air and natural sounds. Nothing beats practicing yoga surrounded by trees and birds. Mother nature is the best yoga teacher! Who else loves outdoor practice? 🧘‍♀️ #OutdoorYoga #NatureTherapy',
    'https://images.unsplash.com/photo-1588286840104-8957b019727f?w=800&h=800&fit=crop',
    'photo',
    'flexibility',
    now() - interval '2 days'
  ),
  (
    generate_post_id(),
    '44444444-4444-4444-4444-444444444444'::uuid,
    'LEG DAY ANNIHILATION! 🍑 Squats, lunges, Romanian deadlifts, and Bulgarian split squats. My legs are questioning our friendship right now, but gains don''t come from comfort zones! Tomorrow I walk like a newborn giraffe 🦒 #LegDay #SquatLife',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=800&fit=crop',
    'photo',
    'strength',
    now() - interval '2 days 3 hours'
  ),
  (
    generate_post_id(),
    '33333333-3333-3333-3333-333333333333'::uuid,
    'Longest run yet - 30 minutes! 🏃‍♂️ Started this journey barely able to run 1 minute. Today I ran 30 minutes through the neighborhood and felt STRONG. If you''re on the fence about starting - just START. Future you will thank you! #RunningJourney #ProgressNotPerfection',
    'https://images.unsplash.com/photo-1552508744-1696d4464960?w=800&h=800&fit=crop',
    'photo',
    'cardio',
    now() - interval '3 days'
  ),

  -- Mix in some different workout types
  (
    generate_post_id(),
    '55555555-5555-5555-5555-555555555555'::uuid,
    'Swimming laps for cardio today! 🏊‍♂️ 1000 meters of pure zen. There''s something so peaceful about being underwater and focusing on breathing rhythm. My shoulders are toast but my soul is refreshed! #Swimming #CardioZen',
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&h=800&fit=crop',
    'photo',
    'cardio',
    now() - interval '5 hours'
  ),
  (
    generate_post_id(),
    '22222222-2222-2222-2222-222222222222'::uuid,
    'Hot yoga class survivor! 🔥🧘‍♀️ 90 minutes in 105°F heat - half yoga, half survival challenge. Sweated out everything toxic in my body and mind. Feeling cleansed and centered! #HotYoga #SweatTherapy #YogaChallenge',
    'https://images.unsplash.com/photo-1506629905607-45b6b7e84a15?w=800&h=800&fit=crop',
    'photo',
    'flexibility',
    now() - interval '1 day 2 hours'
  );

-- Verify the data was inserted
SELECT 
  'SUCCESS: Test data seeded!' as status,
  count(*) as new_posts_created,
  min(created_at) as oldest_post,
  max(created_at) as newest_post
FROM posts 
WHERE user_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666'
)
AND created_at > now() - interval '1 week';

-- Show posts that will be visible to the test user
SELECT 
  u.username,
  u.fitness_level,
  LEFT(p.content, 60) as content_preview,
  p.workout_type,
  p.created_at,
  'Will appear in discover feed' as visibility
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.user_id != 'f3d6b62b-d92b-443a-9385-7583afe50c2b'::uuid
  AND p.created_at > now() - interval '1 week'
  AND NOT EXISTS (
    SELECT 1 FROM post_views pv 
    WHERE pv.post_id = p.id 
    AND pv.user_id = 'f3d6b62b-d92b-443a-9385-7583afe50c2b'::uuid
  )
ORDER BY p.created_at DESC;

SELECT 
  count(*) as total_unviewed_posts,
  'Ready for testing!' as message
FROM posts p
WHERE p.user_id != 'f3d6b62b-d92b-443a-9385-7583afe50c2b'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM post_views pv 
    WHERE pv.post_id = p.id 
    AND pv.user_id = 'f3d6b62b-d92b-443a-9385-7583afe50c2b'::uuid
  );

-- Verify mock users were created successfully
SELECT 
  '🧑‍🤝‍🧑 MOCK USERS CREATED:' as section,
  count(*) as total_users
FROM users 
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666'
);

-- Show all mock users for verification
SELECT 
  username,
  full_name,
  fitness_level,
  array_length(goals, 1) as goal_count,
  '✅ Profile ready for testing' as status
FROM users 
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666'
)
ORDER BY fitness_level DESC, username;