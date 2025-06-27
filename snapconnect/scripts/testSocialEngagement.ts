/**
 * Test Social Engagement System
 * Shows engagement patterns and tests liking/commenting with small user group
 * 
 * Usage: npx tsx scripts/testSocialEngagement.ts [--live] [--users 5]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { SOCIAL_PATTERNS, simulateUserEngagement } from './botSocialInteractions';

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function showEngagementSchedule() {
  console.log('📅 SOCIAL ENGAGEMENT SCHEDULE & PATTERNS\n');
  
  console.log('🎯 ENGAGEMENT RATES BY ARCHETYPE:');
  Object.entries(SOCIAL_PATTERNS.engagement_rates).forEach(([archetype, rates]) => {
    console.log(`\n   ${archetype.replace('_', ' ').toUpperCase()}:`);
    console.log(`   👍 Like Rate: ${Math.round(rates.like_rate * 100)}%`);
    console.log(`   💬 Comment Rate: ${Math.round(rates.comment_rate * 100)}%`);
    console.log(`   🤝 Friend Rate: ${Math.round(rates.friend_rate * 100)}%`);
    console.log(`   👀 Posts Viewed: ${rates.posts_to_see} per session`);
    console.log(`   🎭 Style: ${rates.engagement_style}`);
  });

  console.log('\n🎭 ENGAGEMENT STYLES:');
  console.log('   Supportive: Encouraging, asks questions, celebrates progress');
  console.log('   Technical: Shares knowledge, gives specific tips, mentions numbers');
  console.log('   Energetic: Enthusiastic, lots of emojis, motivational language');
  console.log('   Mindful: Thoughtful, grateful, focuses on inner experience');
  console.log('   Adventurous: Shares experiences, invites to activities, nature-focused');

  console.log('\n💡 CONTENT AFFINITIES (who engages with what):');
  console.log('   Fitness Newbies → Love other newbies (90%), inspired by cardio queens (70%)');
  console.log('   Strength Warriors → Help beginners (80%), engage with strength content (90%)');
  console.log('   Cardio Queens → Encourage everyone (80%), love outdoor adventures (80%)');
  console.log('   Zen Masters → Gently support all (70%), connect with nature lovers (80%)');
  console.log('   Outdoor Adventurers → Respect strength (50%), love cardio endurance (80%)');

  console.log('\n⏰ ENGAGEMENT TIMING:');
  console.log('   🔄 Continuous: Bots engage whenever they see new posts');
  console.log('   📱 Session-based: Each bot browses 5-10 posts per engagement session');
  console.log('   ⏱️ Human delays: 1-4 seconds between likes/comments');
  console.log('   🎲 Random timing: 2-7 second delays between different users');

  console.log('\n📊 REALISTIC BEHAVIOR:');
  console.log('   ✅ Not everyone likes everything (50-80% engagement rates)');
  console.log('   ✅ Comments are less frequent than likes (30-50% of like rate)');
  console.log('   ✅ Friend requests are rare and meaningful (10-30% chance)');
  console.log('   ✅ Users prefer content similar to their interests');
  console.log('   ✅ Each user has consistent personality in comments');
}

async function testSocialEngagement(userCount: number = 5, isLive: boolean = false) {
  console.log(`\n🧪 TESTING SOCIAL ENGAGEMENT (${isLive ? 'LIVE' : 'DRY-RUN'})\n`);

  // Get a few AI users for testing
  const { data: testUsers, error } = await supabase
    .from('users')
    .select('id, username, personality_traits')
    .eq('is_mock_user', true)
    .limit(userCount);

  if (error || !testUsers) {
    console.error('Failed to get test users:', error);
    return;
  }

  console.log(`👥 Testing with ${testUsers.length} users:\n`);

  const allResults: any[] = [];

  for (let i = 0; i < testUsers.length; i++) {
    const user = testUsers[i];
    const archetype = user.personality_traits?.archetype || 'fitness_newbie';
    
    console.log(`[${i + 1}/${testUsers.length}] 👤 @${user.username} (${archetype})`);
    
    // Simulate engagement for this user
    const results = await simulateUserEngagement(user, !isLive);
    allResults.push(...results);
    
    if (results.length > 0) {
      console.log(`   🎯 Total interactions: ${results.length}`);
      
      const likes = results.filter(r => r.type === 'like');
      const comments = results.filter(r => r.type === 'comment');
      const friends = results.filter(r => r.type === 'friend');
      
      if (likes.length > 0) console.log(`   👍 Likes: ${likes.length}`);
      if (comments.length > 0) {
        console.log(`   💬 Comments: ${comments.length}`);
        comments.slice(0, 2).forEach(comment => {
          console.log(`     → @${comment.toUser}: "${comment.content}"`);
        });
      }
      if (friends.length > 0) console.log(`   🤝 Friend requests: ${friends.length}`);
    } else {
      console.log(`   😴 No engagement this session`);
    }
    
    console.log('');
    
    // Small delay between users (simulate realistic timing)
    if (i < testUsers.length - 1 && isLive) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  const totalLikes = allResults.filter(r => r.type === 'like').length;
  const totalComments = allResults.filter(r => r.type === 'comment').length;
  const totalFriends = allResults.filter(r => r.type === 'friend').length;

  console.log('📊 TEST RESULTS SUMMARY:');
  console.log(`👍 Total Likes: ${totalLikes}`);
  console.log(`💬 Total Comments: ${totalComments}`);
  console.log(`🤝 Total Friend Requests: ${totalFriends}`);
  console.log(`🎯 Total Interactions: ${allResults.length}`);
  
  if (totalComments > 0) {
    console.log('\n💬 SAMPLE COMMENTS GENERATED:');
    allResults
      .filter(r => r.type === 'comment')
      .slice(0, 5)
      .forEach(comment => {
        console.log(`   @${comment.fromUser} → @${comment.toUser}: "${comment.content}"`);
      });
  }

  console.log(`\n${isLive ? '🚀 LIVE TEST COMPLETED!' : '✅ DRY-RUN TEST COMPLETED!'}`);
  console.log(`${isLive ? 'Check your database for new likes/comments!' : 'Use --live to actually create interactions'}`);
}

async function showRecentPosts() {
  console.log('\n📱 RECENT POSTS AVAILABLE FOR ENGAGEMENT:\n');
  
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      id,
      content,
      created_at,
      users!inner(username, personality_traits, is_mock_user)
    `)
    .eq('users.is_mock_user', true)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !posts || posts.length === 0) {
    console.log('   📭 No recent posts found from AI users');
    console.log('   💡 Run: npm run bot:army-human first to create posts');
    return;
  }

  posts.forEach((post, index) => {
    const archetype = post.users.personality_traits?.archetype || 'unknown';
    const timeAgo = Math.floor((Date.now() - new Date(post.created_at).getTime()) / (1000 * 60));
    console.log(`${index + 1}. @${post.users.username} (${archetype}) - ${timeAgo}m ago`);
    console.log(`   "${post.content}"`);
    console.log('');
  });

  console.log(`📊 Found ${posts.length} recent posts ready for engagement!`);
}

async function main() {
  const isLive = process.argv.includes('--live');
  const userArg = process.argv.find(arg => arg.startsWith('--users'));
  const userCount = userArg ? parseInt(userArg.split('=')[1]) || 5 : 5;

  console.log('🤝 SOCIAL ENGAGEMENT TEST SYSTEM\n');

  // Show engagement patterns
  showEngagementSchedule();

  // Show recent posts
  await showRecentPosts();

  // Test engagement
  await testSocialEngagement(userCount, isLive);

  console.log('\n💡 NEXT STEPS:');
  console.log('   1. Create posts: npm run bot:army-human');
  console.log('   2. Test engagement: npm run test:social --live --users=3');
  console.log('   3. Full engagement: npm run bot:social');
  console.log('   4. Monitor results: npm run bot:test');
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export { main as testSocialEngagement };