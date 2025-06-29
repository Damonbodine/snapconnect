/**
 * Bot Liker Script
 * Makes AI bots like specific user posts
 * 
 * Usage: npx tsx scripts/botLiker.ts [--user=email] [--likes=number] [--dry-run]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface LikeOptions {
  userEmail: string;
  targetLikes: number;
  dryRun: boolean;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  users: {
    username: string;
    email: string;
  };
}

interface Bot {
  id: string;
  username: string;
}

// Parse command line arguments
function parseArgs(): LikeOptions {
  const args = process.argv.slice(2);
  const options: LikeOptions = {
    userEmail: 'test@test.com',
    targetLikes: 10,
    dryRun: false,
  };

  args.forEach(arg => {
    if (arg.startsWith('--user=')) {
      options.userEmail = arg.split('=')[1];
    } else if (arg.startsWith('--likes=')) {
      options.targetLikes = parseInt(arg.split('=')[1]) || 10;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  });

  return options;
}

// Get most recent post from user
async function getMostRecentPost(userEmail: string): Promise<Post | null> {
  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        created_at,
        users!inner(username, email)
      `)
      .eq('users.email', userEmail)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Failed to fetch user posts:', error);
      return null;
    }

    return posts?.[0] || null;
  } catch (error) {
    console.error('Error fetching user posts:', error);
    return null;
  }
}

// Get current likes on a post
async function getCurrentLikes(postId: string): Promise<{ count: number; botLikerIds: string[] }> {
  try {
    // Get total like count
    const { count } = await supabase
      .from('user_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)
      .eq('interaction_type', 'like');

    // Get bot likes specifically
    const { data: botLikes } = await supabase
      .from('user_interactions')
      .select('user_id, users!inner(is_mock_user)')
      .eq('post_id', postId)
      .eq('interaction_type', 'like')
      .eq('users.is_mock_user', true);

    return {
      count: count || 0,
      botLikerIds: botLikes?.map(like => like.user_id) || []
    };
  } catch (error) {
    console.error('Error getting current likes:', error);
    return { count: 0, botLikerIds: [] };
  }
}

// Get available bots (excluding those who already liked)
async function getAvailableBots(excludeIds: string[]): Promise<Bot[]> {
  try {
    let query = supabase
      .from('users')
      .select('id, username')
      .eq('is_mock_user', true);

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.map(id => `"${id}"`).join(',')})`);
    }

    const { data: bots, error } = await query.limit(50);

    if (error) {
      console.error('Failed to fetch bots:', error);
      return [];
    }

    return bots || [];
  } catch (error) {
    console.error('Error fetching bots:', error);
    return [];
  }
}

// Add like from bot
async function addBotLike(botId: string, postId: string, dryRun: boolean): Promise<boolean> {
  if (dryRun) {
    return true;
  }

  try {
    const { error } = await supabase
      .from('user_interactions')
      .insert({
        user_id: botId,
        post_id: postId,
        interaction_type: 'like',
      });

    if (error) {
      // Ignore unique constraint violations (already liked)
      if (error.code === '23505') {
        return true;
      }
      console.error('Failed to add bot like:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error adding bot like:', error);
    return false;
  }
}

// Main function
async function main() {
  const options = parseArgs();
  
  console.log('👍 Bot Liker System');
  console.log('===================');
  console.log(`📧 Target user: ${options.userEmail}`);
  console.log(`🎯 Target likes: ${options.targetLikes}`);
  console.log(`🏃 Mode: ${options.dryRun ? 'DRY RUN' : 'REAL LIKES'}`);
  console.log('');

  try {
    // Get most recent post
    console.log('📝 Finding most recent post...');
    const post = await getMostRecentPost(options.userEmail);
    
    if (!post) {
      console.log(`❌ No posts found for user ${options.userEmail}`);
      return;
    }

    console.log(`✅ Found post: "${post.content.substring(0, 50)}..."`);
    console.log(`📅 Posted: ${new Date(post.created_at).toLocaleString()}`);
    console.log('');

    // Get current likes
    console.log('📊 Checking current likes...');
    const currentLikes = await getCurrentLikes(post.id);
    
    console.log(`👍 Current total likes: ${currentLikes.count}`);
    console.log(`🤖 Current bot likes: ${currentLikes.botLikerIds.length}`);

    // Calculate how many more likes we need
    const botLikesNeeded = Math.max(0, options.targetLikes - currentLikes.botLikerIds.length);
    
    if (botLikesNeeded === 0) {
      console.log(`✅ Post already has ${currentLikes.botLikerIds.length} bot likes (target: ${options.targetLikes})`);
      return;
    }

    console.log(`🎯 Need ${botLikesNeeded} more bot likes`);
    console.log('');

    // Get available bots
    console.log('🤖 Finding available bots...');
    const availableBots = await getAvailableBots(currentLikes.botLikerIds);
    
    if (availableBots.length === 0) {
      console.log('❌ No available bots found to add likes');
      return;
    }

    console.log(`✅ Found ${availableBots.length} available bots`);

    // Select bots to like the post
    const selectedBots = availableBots.slice(0, botLikesNeeded);
    
    console.log(`🎯 Selected ${selectedBots.length} bots to add likes:`);
    selectedBots.forEach((bot, i) => {
      console.log(`   ${i + 1}. ${bot.username}`);
    });
    console.log('');

    // Add likes
    console.log('👍 Adding likes...');
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < selectedBots.length; i++) {
      const bot = selectedBots[i];
      
      const success = await addBotLike(bot.id, post.id, options.dryRun);
      
      if (success) {
        successCount++;
        if (options.dryRun) {
          console.log(`   [DRY RUN] ${bot.username} would like the post`);
        } else {
          console.log(`   ✅ ${bot.username} liked the post`);
        }
      } else {
        errorCount++;
        console.log(`   ❌ Failed to add like from ${bot.username}`);
      }

      // Small delay between likes for natural pacing
      if (i < selectedBots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
    }

    // Summary
    console.log('');
    console.log('📊 Results');
    console.log('==========');
    console.log(`✅ Successful likes: ${successCount}`);
    console.log(`❌ Failed likes: ${errorCount}`);
    console.log(`👍 Total bot likes on post: ${currentLikes.botLikerIds.length + successCount}`);

    if (options.dryRun) {
      console.log('');
      console.log('🎯 Dry run completed - no actual likes added');
      console.log('💡 Remove --dry-run flag to add real likes');
    } else {
      console.log('');
      console.log('🎉 Bot liking completed!');
      console.log('📱 Check your app - the post should now have more likes');
    }

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});