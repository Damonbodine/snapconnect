/**
 * Script to create real authenticated test users with complete profiles
 * Run with: npx tsx scripts/createTestUsers.ts
 */

import { createClient } from '@supabase/supabase-js';

// Use your project credentials
const supabaseUrl = 'https://lubfyjzdfgpoocsswrkz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // We'll need this for admin operations

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('💡 Get it from: https://supabase.com/dashboard/project/lubfyjzdfgpoocsswrkz/settings/api');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface TestUser {
  email: string;
  password: string;
  profile: {
    username: string;
    full_name: string;
    avatar_url: string;
    fitness_level: 'beginner' | 'intermediate' | 'advanced';
    goals: string[];
  };
}

const testUsers: TestUser[] = [
  {
    email: 'alex.fitness@test.com',
    password: 'testpass123',
    profile: {
      username: 'fitness_guru',
      full_name: 'Alex Fitness',
      avatar_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=150&h=150&fit=crop&crop=face',
      fitness_level: 'advanced',
      goals: ['Build muscle mass', 'Compete in powerlifting', 'Train for strongman']
    }
  },
  {
    email: 'sarah.yoga@test.com', 
    password: 'testpass123',
    profile: {
      username: 'yoga_master',
      full_name: 'Sarah Zen',
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
      fitness_level: 'intermediate',
      goals: ['Master advanced poses', 'Teach yoga classes', 'Improve flexibility']
    }
  },
  {
    email: 'emma.strong@test.com',
    password: 'testpass123', 
    profile: {
      username: 'strong_emma',
      full_name: 'Emma Power',
      avatar_url: 'https://images.unsplash.com/photo-1594736797933-d0ca9c65d2f0?w=150&h=150&fit=crop&crop=face',
      fitness_level: 'advanced',
      goals: ['Deadlift 400lbs', 'Compete in crossfit', 'Improve endurance']
    }
  },
  {
    email: 'mike.runner@test.com',
    password: 'testpass123',
    profile: {
      username: 'runner_mike', 
      full_name: 'Mike Start',
      avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      fitness_level: 'beginner',
      goals: ['Run 5K without stopping', 'Lose 20 pounds', 'Exercise 3x per week']
    }
  },
  {
    email: 'david.zen@test.com',
    password: 'testpass123',
    profile: {
      username: 'zen_master',
      full_name: 'David Calm', 
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      fitness_level: 'intermediate',
      goals: ['Reduce stress', 'Build core strength', 'Swim 1 mile']
    }
  },
  {
    email: 'lisa.beginner@test.com',
    password: 'testpass123',
    profile: {
      username: 'newbie_lisa',
      full_name: 'Lisa Begin',
      avatar_url: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=150&h=150&fit=crop&crop=face', 
      fitness_level: 'beginner',
      goals: ['Get comfortable at gym', 'Make fitness friends', 'Build confidence']
    }
  },
  {
    email: 'carlos.boxer@test.com',
    password: 'testpass123',
    profile: {
      username: 'boxing_carlos',
      full_name: 'Carlos Strike',
      avatar_url: 'https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=150&h=150&fit=crop&crop=face',
      fitness_level: 'advanced',
      goals: ['Master boxing technique', 'Compete in amateur boxing', 'Improve footwork']
    }
  },
  {
    email: 'jenny.dancer@test.com',
    password: 'testpass123',
    profile: {
      username: 'dance_jenny',
      full_name: 'Jenny Flow',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
      fitness_level: 'intermediate',
      goals: ['Perfect my dance routine', 'Teach dance fitness', 'Improve rhythm']
    }
  },
  {
    email: 'tyler.climber@test.com',
    password: 'testpass123',
    profile: {
      username: 'rock_tyler',
      full_name: 'Tyler Peak',
      avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face',
      fitness_level: 'advanced',
      goals: ['Climb 5.12 routes', 'Build finger strength', 'Complete outdoor multi-pitch']
    }
  },
  {
    email: 'maya.swimmer@test.com',
    password: 'testpass123',
    profile: {
      username: 'swim_maya',
      full_name: 'Maya Wave',
      avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face',
      fitness_level: 'intermediate',
      goals: ['Swim 2000m freestyle', 'Perfect butterfly stroke', 'Join masters team']
    }
  },
  {
    email: 'jason.cyclist@test.com',
    password: 'testpass123',
    profile: {
      username: 'cycle_jason',
      full_name: 'Jason Ride',
      avatar_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=150&h=150&fit=crop&crop=face',
      fitness_level: 'beginner',
      goals: ['Bike 50 miles', 'Learn proper gear shifting', 'Join weekend group rides']
    }
  }
];

async function createTestUser(testUser: TestUser) {
  console.log(`\n🔄 Creating user: ${testUser.profile.full_name} (${testUser.email})`);
  
  try {
    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true, // Skip email confirmation
      user_metadata: {
        full_name: testUser.profile.full_name
      }
    });

    if (authError) {
      console.error(`❌ Auth error for ${testUser.email}:`, authError);
      return false;
    }

    console.log(`✅ Auth user created: ${authData.user.id}`);

    // Step 2: Create profile in users table
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: testUser.email,
        username: testUser.profile.username,
        full_name: testUser.profile.full_name,
        avatar_url: testUser.profile.avatar_url,
        fitness_level: testUser.profile.fitness_level,
        goals: testUser.profile.goals
      });

    if (profileError) {
      console.error(`❌ Profile error for ${testUser.email}:`, profileError);
      return false;
    }

    console.log(`✅ Profile created: @${testUser.profile.username}`);
    return true;

  } catch (error) {
    console.error(`❌ Unexpected error for ${testUser.email}:`, error);
    return false;
  }
}

async function createTestPosts(userId: string, username: string) {
  const posts = [
    {
      content: `Morning workout complete! 💪 Just finished an amazing session. Feeling stronger every day! #FitnessJourney #${username}`,
      media_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=800&fit=crop',
      media_type: 'photo',
      workout_type: 'strength'
    },
    {
      content: `Beautiful sunrise yoga session 🧘‍♀️ Starting the day with mindful movement and positive energy! #Yoga #Mindfulness #${username}`,
      media_url: 'https://images.unsplash.com/photo-1506629905607-45b6b7e84a15?w=800&h=800&fit=crop', 
      media_type: 'photo',
      workout_type: 'flexibility'
    }
  ];

  for (const post of posts) {
    const { error } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        content: post.content,
        media_url: post.media_url,
        media_type: post.media_type,
        workout_type: post.workout_type
      });

    if (error) {
      console.error(`❌ Post creation error:`, error);
    } else {
      console.log(`✅ Post created for @${username}`);
    }
  }
}

async function main() {
  console.log('🚀 Creating test users for SnapConnect...\n');
  
  let successCount = 0;
  let totalUsers = testUsers.length;

  for (const testUser of testUsers) {
    const success = await createTestUser(testUser);
    if (success) {
      successCount++;
      
      // Create a couple test posts for each user
      const { data: userData } = await supabase.auth.admin.listUsers();
      const createdUser = userData?.users.find(u => u.email === testUser.email);
      
      if (createdUser) {
        await createTestPosts(createdUser.id, testUser.profile.username);
      }
    }
  }

  console.log(`\n🎉 Test user creation complete!`);
  console.log(`✅ Successfully created: ${successCount}/${totalUsers} users`);
  console.log(`\n📋 Test credentials (all use password: testpass123):`);
  
  testUsers.forEach(user => {
    console.log(`   📧 ${user.email} → @${user.profile.username} (${user.profile.fitness_level})`);
  });

  console.log(`\n🔗 Next steps:`);
  console.log(`   1. Check users in Supabase Auth dashboard`);
  console.log(`   2. Test profile navigation in the app`);
  console.log(`   3. Posts from these users won't disappear (not ephemeral)`);
  console.log(`   4. Perfect for testing friends feature!`);

  process.exit(0);
}

main().catch(console.error);