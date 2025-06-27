/**
 * Simple Bot System Test Script
 * Tests the AI posting automation system without complex service imports
 * 
 * Usage: npx tsx scripts/testBotSystem.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  try {
    console.log('🤖 Testing Bot Automation System\n');

    // Test 1: Check AI users
    console.log('1️⃣ Checking AI users...');
    const { data: aiUsers, error: usersError } = await supabase
      .from('users')
      .select('id, username, full_name, personality_traits, posting_schedule, is_mock_user')
      .eq('is_mock_user', true)
      .limit(5);

    if (usersError) {
      throw new Error(`Failed to fetch AI users: ${usersError.message}`);
    }

    console.log(`   ✅ Found ${aiUsers?.length || 0} AI users`);
    aiUsers?.forEach(user => {
      const archetype = user.personality_traits?.archetype || 'unknown';
      console.log(`   - @${user.username} (${archetype})`);
    });
    console.log();

    // Test 2: Check migration functions
    console.log('2️⃣ Testing migration functions...');
    
    // Test get_ai_users_ready_for_posting function
    const { data: readyUsers, error: readyError } = await supabase
      .rpc('get_ai_users_ready_for_posting', {
        target_hour: new Date().getHours()
      });

    if (readyError) {
      console.log(`   ⚠️ Migration function error: ${readyError.message}`);
    } else {
      console.log(`   ✅ Ready for posting: ${readyUsers?.length || 0} users`);
      readyUsers?.forEach((user: any) => {
        console.log(`   - @${user.username} (${user.archetype})`);
      });
    }
    console.log();

    // Test 3: Check posting statistics
    console.log('3️⃣ Getting posting statistics...');
    const { data: stats, error: statsError } = await supabase
      .rpc('get_ai_user_posting_stats', { days_back: 7 });

    if (statsError) {
      console.log(`   ⚠️ Stats function error: ${statsError.message}`);
    } else if (stats && stats.length > 0) {
      const stat = stats[0];
      console.log(`   ✅ Statistics:`);
      console.log(`   - Total AI Users: ${stat.total_ai_users}`);
      console.log(`   - Posted Today: ${stat.users_posted_today}`);
      console.log(`   - Total Posts Today: ${stat.total_posts_today}`);
      console.log(`   - Posts This Week: ${stat.total_posts_period}`);
      console.log(`   - Avg Posts/User: ${stat.avg_posts_per_user}`);
    }
    console.log();

    // Test 4: Check posts from today
    console.log('4️⃣ Checking today\'s posts...');
    const today = new Date().toISOString().split('T')[0];
    const { data: todayPosts, error: postsError } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        workout_type,
        created_at,
        users!inner(username, is_mock_user)
      `)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .eq('users.is_mock_user', true)
      .order('created_at', { ascending: false })
      .limit(5);

    if (postsError) {
      console.log(`   ⚠️ Posts query error: ${postsError.message}`);
    } else {
      console.log(`   ✅ AI posts today: ${todayPosts?.length || 0}`);
      todayPosts?.forEach((post: any) => {
        const time = new Date(post.created_at).toLocaleTimeString();
        console.log(`   - @${post.users.username} at ${time}: ${post.content?.substring(0, 50)}...`);
      });
    }
    console.log();

    // Test 5: OpenAI API key validation
    console.log('5️⃣ Validating OpenAI API key...');
    const openaiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!openaiKey || openaiKey === 'your_openai_api_key_here') {
      console.log('   ❌ OpenAI API key not configured');
    } else if (openaiKey.startsWith('sk-proj-') || openaiKey.startsWith('sk-')) {
      console.log('   ✅ OpenAI API key looks valid');
    } else {
      console.log('   ⚠️ OpenAI API key format unrecognized');
    }
    console.log();

    console.log('🎉 Bot system test completed!');
    console.log('\nNext steps:');
    console.log('- If migration functions work: Try npx tsx scripts/runDailyBotArmy.ts --stats');
    console.log('- If ready users found: Try creating a test post for one user');
    console.log('- If errors: Check the specific error messages above');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}

export { main as testBotSystem };