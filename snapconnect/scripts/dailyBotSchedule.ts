/**
 * Daily Bot Schedule Script
 * Designed to be run once per day to create posts for all AI users
 * 
 * Usage: npx tsx scripts/dailyBotSchedule.ts
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
    console.log('🕐 Daily Bot Schedule Check');
    console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}`);
    console.log(`⏰ Time: ${new Date().toLocaleTimeString()}\n`);

    // Check how many users are ready to post using the migration function
    const currentHour = new Date().getHours();
    const { data: readyUsers, error } = await supabase
      .rpc('get_ai_users_ready_for_posting', {
        target_hour: currentHour
      });

    if (error) {
      console.log(`⚠️ Error checking ready users: ${error.message}`);
    } else {
      console.log(`👥 Users ready to post at hour ${currentHour}: ${readyUsers?.length || 0}`);
    }

    // Get posting statistics
    const { data: stats, error: statsError } = await supabase
      .rpc('get_ai_user_posting_stats', { days_back: 1 });

    if (statsError) {
      console.log(`⚠️ Error getting stats: ${statsError.message}`);
    } else if (stats && stats.length > 0) {
      const stat = stats[0];
      console.log(`📊 Today's stats: ${stat.users_posted_today}/${stat.total_ai_users} users posted`);
      
      if (stat.users_posted_today === 0) {
        console.log('\n🚀 No posts today yet - ready to run full bot army!');
        console.log('💡 Run: npx tsx scripts/runFullBotArmy.ts');
      } else if (stat.users_posted_today < stat.total_ai_users) {
        console.log(`\n⚡ Partial posting completed (${stat.users_posted_today}/${stat.total_ai_users})`);
        console.log('💡 Run: npx tsx scripts/runFullBotArmy.ts (will skip users who already posted)');
      } else {
        console.log('\n✅ All users have posted today!');
      }
    }

    console.log('\n📋 Available Commands:');
    console.log('• npx tsx scripts/runFullBotArmy.ts --dry-run   # Preview all 70 users');
    console.log('• npx tsx scripts/runFullBotArmy.ts             # Create posts for all ready users');
    console.log('• npx tsx scripts/runFullBotArmy.ts --limit 10  # Test with 10 users only');
    console.log('• npx tsx scripts/testBotSystem.ts              # System health check');

  } catch (error) {
    console.error('❌ Daily schedule check failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}

export { main as dailyBotSchedule };