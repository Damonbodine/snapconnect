/**
 * Daily Bot Army Coordination Script
 * Manages automated posting for all 70 AI users based on their individual schedules
 * 
 * Usage: 
 *   npx tsx scripts/runDailyBotArmy.ts
 *   npx tsx scripts/runDailyBotArmy.ts --hour 14 --force
 *   npx tsx scripts/runDailyBotArmy.ts --stats
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { aiPostingService } from '../src/services/aiPostingService';
import { contentGenerationService } from '../src/services/contentGenerationService';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://lubfyjzdfgpoocsswrkz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface CommandLineArgs {
  hour?: number;
  force?: boolean;
  stats?: boolean;
  users?: string;
  contentType?: 'workout_post' | 'progress_update' | 'motivation' | 'education' | 'social';
  help?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CommandLineArgs {
  const args: CommandLineArgs = {};
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    switch (arg) {
      case '--hour':
        args.hour = parseInt(process.argv[++i]);
        break;
      case '--force':
        args.force = true;
        break;
      case '--stats':
        args.stats = true;
        break;
      case '--users':
        args.users = process.argv[++i];
        break;
      case '--content-type':
        args.contentType = process.argv[++i] as any;
        break;
      case '--help':
        args.help = true;
        break;
    }
  }
  
  return args;
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
🤖 Daily Bot Army Coordination Script

Usage:
  npx tsx scripts/runDailyBotArmy.ts [options]

Options:
  --hour <hour>           Target hour (0-23) for posting (default: current hour)
  --force                 Force posting even if users already posted today
  --stats                 Show posting statistics only
  --users <user_ids>      Comma-separated list of specific user IDs to post
  --content-type <type>   Content type: workout_post, progress_update, motivation, education, social
  --help                  Show this help message

Examples:
  npx tsx scripts/runDailyBotArmy.ts                                    # Normal daily run
  npx tsx scripts/runDailyBotArmy.ts --hour 14                         # Post for 2 PM hour
  npx tsx scripts/runDailyBotArmy.ts --force                           # Force all users to post
  npx tsx scripts/runDailyBotArmy.ts --stats                           # Show statistics only
  npx tsx scripts/runDailyBotArmy.ts --users "abc-123,def-456"         # Post for specific users
  npx tsx scripts/runDailyBotArmy.ts --content-type motivation         # Generate motivation posts
`);
}

/**
 * Display posting statistics
 */
async function showStats() {
  try {
    console.log('📊 Getting AI posting statistics...\n');
    
    const stats = await aiPostingService.getPostingStats();
    const contentStats = await contentGenerationService.getContentGenerationStats();
    
    console.log('📈 Today\'s Posting Statistics:');
    console.log(`   Total Posts: ${stats.todayStats.totalPosts}`);
    console.log(`   AI Posts: ${stats.todayStats.aiPosts}`);
    console.log(`   Real User Posts: ${stats.todayStats.realPosts}`);
    console.log('');
    
    console.log('🤖 AI User Statistics:');
    console.log(`   Total AI Users: ${stats.aiUserStats.totalAIUsers}`);
    console.log(`   Users Posted Today: ${stats.aiUserStats.usersPostedToday}`);
    console.log(`   Average Posts Per User: ${stats.aiUserStats.averagePostsPerUser}`);
    console.log('');
    
    console.log('🎭 Archetype Breakdown:');
    Object.entries(stats.archetypeStats).forEach(([archetype, data]) => {
      console.log(`   ${archetype}: ${data.users} users, ${data.postsToday} posts today`);
    });
    
    console.log('');
    console.log('📋 Content Generation Stats:');
    console.log(`   Total Posts Today: ${contentStats.postsToday}`);
    console.log(`   Users Posted Today: ${contentStats.usersPostedToday}`);
    console.log('');
    
    console.log('🎯 Archetype Distribution:');
    Object.entries(contentStats.archetypeBreakdown).forEach(([archetype, count]) => {
      console.log(`   ${archetype}: ${count} users`);
    });
    
  } catch (error) {
    console.error('❌ Failed to get statistics:', error);
  }
}

/**
 * Run daily posting for all eligible AI users
 */
async function runDailyPosting(targetHour?: number, force: boolean = false) {
  try {
    console.log('🚀 Starting Daily Bot Army Coordination...\n');
    
    const currentTime = new Date();
    const hour = targetHour ?? currentTime.getHours();
    
    console.log(`🕐 Target Hour: ${hour}`);
    console.log(`📅 Date: ${currentTime.toISOString().split('T')[0]}`);
    console.log(`🔄 Force Mode: ${force ? 'ENABLED' : 'DISABLED'}`);
    console.log('');
    
    // Run the daily posting
    const result = await aiPostingService.runDailyPosting(hour);
    
    console.log('📊 Daily Posting Results:');
    console.log(`   Users Processed: ${result.totalUsers}`);
    console.log(`   Successful Posts: ${result.successfulPosts.length}`);
    console.log(`   Failed Posts: ${result.failedPosts.length}`);
    console.log(`   Skipped Users: ${result.skippedUsers.length}`);
    console.log('');
    
    if (result.successfulPosts.length > 0) {
      console.log('✅ Successful Posts:');
      result.successfulPosts.forEach(post => {
        console.log(`   @${post.username} (${post.postId})`);
      });
      console.log('');
    }
    
    if (result.failedPosts.length > 0) {
      console.log('❌ Failed Posts:');
      result.failedPosts.forEach(post => {
        console.log(`   @${post.username}: ${post.error}`);
      });
      console.log('');
    }
    
    // Show final statistics
    await showStats();
    
  } catch (error) {
    console.error('❌ Daily posting run failed:', error);
    process.exit(1);
  }
}

/**
 * Post for specific user IDs
 */
async function postForSpecificUsers(
  userIds: string[], 
  contentType: 'workout_post' | 'progress_update' | 'motivation' | 'education' | 'social' = 'workout_post',
  force: boolean = true
) {
  try {
    console.log(`🎯 Creating ${contentType} posts for ${userIds.length} specific users...\n`);
    
    const results = await aiPostingService.createPostsForUsers(userIds, contentType, force);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log('📊 Specific User Posting Results:');
    console.log(`   Total Users: ${userIds.length}`);
    console.log(`   Successful: ${successful.length}`);
    console.log(`   Failed: ${failed.length}`);
    console.log('');
    
    if (successful.length > 0) {
      console.log('✅ Successful Posts:');
      successful.forEach(post => {
        console.log(`   @${post.username} (${post.postId})`);
      });
      console.log('');
    }
    
    if (failed.length > 0) {
      console.log('❌ Failed Posts:');
      failed.forEach(post => {
        console.log(`   ${post.userId}: ${post.error}`);
      });
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Specific user posting failed:', error);
    process.exit(1);
  }
}

/**
 * Validate environment and dependencies
 */
async function validateEnvironment() {
  // Check OpenAI API key
  if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY === 'your_openai_api_key_here') {
    console.error('❌ OpenAI API key not configured');
    console.log('💡 Please set EXPO_PUBLIC_OPENAI_API_KEY in your .env file');
    process.exit(1);
  }
  
  // Test Supabase connection
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact' }).eq('is_mock_user', true);
    if (error) {
      throw error;
    }
    console.log(`✅ Database connection successful (${data.length} AI users found)`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    return;
  }
  
  console.log('🤖 Daily Bot Army Coordination Script\n');
  
  // Validate environment
  await validateEnvironment();
  console.log('');
  
  if (args.stats) {
    await showStats();
    return;
  }
  
  if (args.users) {
    const userIds = args.users.split(',').map(id => id.trim());
    await postForSpecificUsers(userIds, args.contentType, args.force);
    return;
  }
  
  // Run daily posting
  await runDailyPosting(args.hour, args.force);
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}

export { main as runDailyBotArmy };