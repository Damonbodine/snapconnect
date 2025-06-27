import { createClient } from '@supabase/supabase-js';

// This script creates test data for the discover feed
// Run with: npx ts-node scripts/createTestData.ts

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestData() {
  console.log('🚀 Creating test data for discover feed...');

  try {
    // First, create the post_views table if it doesn't exist
    console.log('📊 Creating post_views table...');
    const { error: tableError } = await supabase.rpc('create_post_views_table');
    if (tableError && !tableError.message.includes('already exists')) {
      console.error('❌ Failed to create table:', tableError);
    } else {
      console.log('✅ post_views table ready');
    }

    // Get current user (you'll need to be logged in)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ Please log in first:', userError);
      return;
    }

    console.log(`👤 Current user: ${user.email}`);

    // Create some test users if they don't exist
    const testUsers = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        username: 'fitness_guru',
        full_name: 'Alex Fitness',
        avatar_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=100&h=100&fit=crop&crop=face',
        fitness_level: 'advanced' as const,
        email: 'alex@example.com'
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        username: 'yoga_master',
        full_name: 'Sarah Zen',
        avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face',
        fitness_level: 'intermediate' as const,
        email: 'sarah@example.com'
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        username: 'newbie_runner',
        full_name: 'Mike Start',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
        fitness_level: 'beginner' as const,
        email: 'mike@example.com'
      }
    ];

    // Insert test users (ignore conflicts)
    console.log('👥 Creating test users...');
    for (const testUser of testUsers) {
      const { error } = await supabase.from('users').upsert(testUser, { onConflict: 'id' });
      if (error) {
        console.log(`⚠️ User ${testUser.username} might already exist:`, error.message);
      } else {
        console.log(`✅ Created user: ${testUser.username}`);
      }
    }

    // Create test posts
    const testPosts = [
      {
        id: 'post-1',
        user_id: testUsers[0].id,
        content: 'Just finished an amazing HIIT workout! 💪 Feeling stronger every day. Who else is crushing their fitness goals this week?',
        media_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=600&fit=crop',
        media_type: 'photo',
        workout_type: 'cardio',
        location: 'Downtown Gym'
      },
      {
        id: 'post-2',
        user_id: testUsers[1].id,
        content: 'Morning yoga session complete 🧘‍♀️ Finding peace in movement and breath. The mind-body connection is everything!',
        media_url: 'https://images.unsplash.com/photo-1506629905607-45b6b7e84a15?w=600&h=600&fit=crop',
        media_type: 'photo',
        workout_type: 'flexibility',
        location: 'Yoga Studio'
      },
      {
        id: 'post-3',
        user_id: testUsers[2].id,
        content: 'First week of running complete! 🏃‍♂️ Started with just 1 mile and already feeling the difference. Small steps, big changes!',
        media_url: 'https://images.unsplash.com/photo-1552508744-1696d4464960?w=600&h=600&fit=crop',
        media_type: 'photo',
        workout_type: 'cardio',
        location: 'Local Park'
      },
      {
        id: 'post-4',
        user_id: testUsers[0].id,
        content: 'Deadlift PR today! 🔥 225lbs x 5 reps. Form over everything - progress isn\'t always about the numbers but today felt good!',
        media_url: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&h=600&fit=crop',
        media_type: 'photo',
        workout_type: 'strength',
        location: 'Iron Temple Gym'
      },
      {
        id: 'post-5',
        user_id: testUsers[1].id,
        content: 'Sunset stretching session 🌅 Sometimes the best workouts are the gentlest ones. Recovery is just as important as training!',
        media_url: 'https://images.unsplash.com/photo-1599447421416-3414500d18a5?w=600&h=600&fit=crop',
        media_type: 'photo',
        workout_type: 'flexibility',
        location: 'Beach'
      }
    ];

    console.log('📝 Creating test posts...');
    for (const post of testPosts) {
      const { error } = await supabase.from('posts').upsert(post, { onConflict: 'id' });
      if (error) {
        console.log(`⚠️ Post ${post.id} might already exist:`, error.message);
      } else {
        console.log(`✅ Created post: ${post.content.slice(0, 50)}...`);
      }
    }

    console.log('🎉 Test data creation complete!');
    console.log('\n📊 Summary:');
    console.log(`- Created ${testUsers.length} test users`);
    console.log(`- Created ${testPosts.length} test posts`);
    console.log('- All posts should appear in your discover feed');
    console.log('\n🔍 Try refreshing your discover feed to see the posts!');

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  }
}

// Run the script
createTestData();