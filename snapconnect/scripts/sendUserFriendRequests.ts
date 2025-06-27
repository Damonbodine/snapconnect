/**
 * Send Friend Requests to Specific User
 * Makes AI bots send friend requests to a real user for testing
 * 
 * Usage: npx tsx scripts/sendUserFriendRequests.ts --email test@test.com --count 10
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

async function findUserByEmail(email: string) {
  try {
    // Try to find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, full_name, personality_traits')
      .eq('email', email)
      .eq('is_mock_user', false)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error);
      return null;
    }

    if (!user) {
      console.log(`❌ No user found with email: ${email}`);
      console.log('💡 Make sure you\'ve created an account in the app first');
      return null;
    }

    return user;
  } catch (error) {
    console.error('Failed to find user:', error);
    return null;
  }
}

async function getCompatibleBots(targetUser: any, count: number) {
  try {
    // Get AI users
    const { data: bots, error } = await supabase
      .from('users')
      .select('id, username, personality_traits, full_name')
      .eq('is_mock_user', true)
      .limit(count * 2); // Get more than needed in case some are already friends

    if (error || !bots) {
      console.error('Failed to get bots:', error);
      return [];
    }

    // Filter out any existing friendships
    const compatibleBots = [];
    
    for (const bot of bots) {
      if (compatibleBots.length >= count) break;
      
      // Check if already friends or pending
      const { data: existingFriendship } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(user_id.eq.${bot.id},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${bot.id})`)
        .single();

      if (!existingFriendship) {
        compatibleBots.push(bot);
      }
    }

    return compatibleBots.slice(0, count);
  } catch (error) {
    console.error('Failed to get compatible bots:', error);
    return [];
  }
}

async function sendFriendRequest(fromBotId: string, toUserId: string) {
  try {
    const { error } = await supabase
      .from('friendships')
      .insert({
        user_id: fromBotId,
        friend_id: toUserId,
        status: 'pending'
      });

    return !error;
  } catch (error) {
    console.error('Failed to send friend request:', error);
    return false;
  }
}

function generateFriendRequestReason(bot: any, targetUser: any): string {
  const botArchetype = bot.personality_traits?.archetype || 'fitness_newbie';
  
  const reasons = {
    fitness_newbie: [
      "Hey! I'm new to fitness too and would love to connect with someone on a similar journey! 💪",
      "Saw your profile and thought we could motivate each other as fitness beginners! 🌟",
      "Always looking for workout buddies who understand the beginner struggle! Let's do this together! 🤝"
    ],
    strength_warrior: [
      "Would love to share some lifting tips and maybe train together sometime! 💪",
      "Always happy to connect with fellow fitness enthusiasts! Let's push each other! 🏋️‍♂️",
      "Strength training is better with friends - would love to connect! 🔥"
    ],
    cardio_queen: [
      "Love meeting new people who are into fitness! Let's motivate each other! 🏃‍♀️✨",
      "Would love to have another fitness friend to share the journey with! 💖",
      "Your energy looks amazing! Would love to connect and maybe run together! 🌟"
    ],
    zen_master: [
      "Would love to connect with someone who appreciates the mindful side of fitness 🧘‍♀️",
      "Always drawn to people who bring positive energy to their fitness journey ✨",
      "Would love to share this wellness journey together! 🌱"
    ],
    outdoor_adventurer: [
      "Love connecting with people who appreciate fitness and adventure! 🏔️",
      "Would love to have a hiking/adventure buddy! Let's explore together! 🥾",
      "Always looking for fellow outdoor enthusiasts to share adventures with! 🌲"
    ]
  };

  const archetypeReasons = reasons[botArchetype as keyof typeof reasons] || reasons.fitness_newbie;
  return archetypeReasons[Math.floor(Math.random() * archetypeReasons.length)];
}

async function main() {
  const emailArg = process.argv.find(arg => arg.startsWith('--email'));
  const countArg = process.argv.find(arg => arg.startsWith('--count'));
  
  const email = emailArg ? emailArg.split('=')[1] : 'test@test.com';
  const count = countArg ? parseInt(countArg.split('=')[1]) : 10;

  console.log(`🤝 SENDING FRIEND REQUESTS TO USER`);
  console.log(`📧 Email: ${email}`);
  console.log(`📊 Requested count: ${count}\n`);

  try {
    // Find the target user
    console.log(`🔍 Looking for user with email: ${email}...`);
    const targetUser = await findUserByEmail(email);
    
    if (!targetUser) {
      console.log('\n💡 TROUBLESHOOTING:');
      console.log('1. Make sure you\'ve created an account in the SnapConnect app');
      console.log('2. Use the exact email address from your account');
      console.log('3. Check that your account is not marked as a mock user');
      return;
    }

    console.log(`✅ Found user: @${targetUser.username} (${targetUser.full_name || 'No name'})`);
    console.log(`🆔 User ID: ${targetUser.id}\n`);

    // Get compatible bots
    console.log(`🤖 Finding ${count} AI users to send friend requests...`);
    const bots = await getCompatibleBots(targetUser, count);
    
    if (bots.length === 0) {
      console.log('❌ No compatible bots found (might already be friends with all bots)');
      return;
    }

    console.log(`👥 Found ${bots.length} compatible AI users\n`);

    // Send friend requests
    console.log('📤 Sending friend requests...\n');
    const results = [];

    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      const archetype = bot.personality_traits?.archetype || 'fitness_newbie';
      const reason = generateFriendRequestReason(bot, targetUser);
      
      console.log(`[${i + 1}/${bots.length}] 🤖 @${bot.username} (${archetype})`);
      console.log(`   💬 "${reason}"`);
      
      const success = await sendFriendRequest(bot.id, targetUser.id);
      
      if (success) {
        console.log(`   ✅ Friend request sent!`);
        results.push({ bot: bot.username, success: true, reason });
      } else {
        console.log(`   ❌ Failed to send request`);
        results.push({ bot: bot.username, success: false, reason });
      }
      
      console.log('');
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log('🎉 FRIEND REQUESTS COMPLETED!\n');
    console.log('📊 SUMMARY:');
    console.log(`✅ Successful requests: ${successful}`);
    console.log(`❌ Failed requests: ${failed}`);
    console.log(`📱 Total sent: ${successful}\n`);

    if (successful > 0) {
      console.log('💡 CHECK YOUR APP:');
      console.log('1. Open the SnapConnect app');
      console.log('2. Go to your friends/social section');
      console.log('3. You should see pending friend requests from AI users!');
      console.log('4. Each request will have a personalized message');
      console.log('\n🎯 You can accept/decline these requests to test the friendship system!');
    }

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}