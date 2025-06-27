/**
 * Proactive Friendship System
 * Makes AI users actively seek meaningful friendships based on interaction patterns,
 * shared interests, personality compatibility, and natural social triggers
 * 
 * Usage: npx tsx scripts/proactiveFriendshipSystem.ts [--dry-run] [--users 10]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { SOCIAL_PATTERNS } from './botSocialInteractions';

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface FriendshipCandidate {
  userId: string;
  username: string;
  archetype: string;
  compatibilityScore: number;
  interactionCount: number;
  sharedInterests: string[];
  friendshipTriggers: string[];
  lastInteraction: Date;
}

interface FriendshipTrigger {
  type: 'repeated_engagement' | 'shared_achievement' | 'similar_journey' | 'personality_match' | 'mutual_support';
  description: string;
  weight: number;
}

// Friendship compatibility matrix based on archetypes
const FRIENDSHIP_COMPATIBILITY = {
  fitness_newbie: {
    fitness_newbie: 0.9,      // Love supporting each other
    strength_warrior: 0.7,     // Appreciates guidance
    cardio_queen: 0.8,        // Inspired by energy
    zen_master: 0.6,          // Appreciates calm guidance
    outdoor_adventurer: 0.7   // Excited by adventures
  },
  strength_warrior: {
    fitness_newbie: 0.8,      // Enjoys mentoring
    strength_warrior: 0.9,     // Shared passion
    cardio_queen: 0.5,        // Different focus
    zen_master: 0.6,          // Respects discipline
    outdoor_adventurer: 0.7   // Functional strength respect
  },
  cardio_queen: {
    fitness_newbie: 0.8,      // Loves encouraging
    strength_warrior: 0.5,     // Different energy
    cardio_queen: 0.9,        // Same wavelength
    zen_master: 0.7,          // Flow state connection
    outdoor_adventurer: 0.9   // Adventure buddies
  },
  zen_master: {
    fitness_newbie: 0.7,      // Gentle guidance
    strength_warrior: 0.6,     // Appreciates discipline
    cardio_queen: 0.7,        // Flow state connection
    zen_master: 0.8,          // Shared philosophy
    outdoor_adventurer: 0.9   // Nature connection
  },
  outdoor_adventurer: {
    fitness_newbie: 0.7,      // Introduces to outdoors
    strength_warrior: 0.7,     // Functional fitness
    cardio_queen: 0.9,        // Endurance adventures
    zen_master: 0.9,          // Nature mindfulness
    outdoor_adventurer: 0.95  // Adventure partners
  }
};

// Friendship triggers and their importance
const FRIENDSHIP_TRIGGERS: Record<string, FriendshipTrigger> = {
  consistent_engagement: {
    type: 'repeated_engagement',
    description: 'Has liked/commented on multiple posts over time',
    weight: 0.8
  },
  shared_milestone: {
    type: 'shared_achievement',
    description: 'Both hit similar fitness milestones recently',
    weight: 0.9
  },
  beginner_bond: {
    type: 'similar_journey',
    description: 'Both are beginners starting their fitness journey',
    weight: 0.85
  },
  personality_chemistry: {
    type: 'personality_match',
    description: 'Archetypes have high compatibility',
    weight: 0.7
  },
  mutual_encouragement: {
    type: 'mutual_support',
    description: 'They consistently support each other\'s posts',
    weight: 0.9
  },
  workout_buddies: {
    type: 'shared_achievement',
    description: 'Similar workout types and schedules',
    weight: 0.75
  }
};

// Get interaction history between two users
async function getDetailedInteractionHistory(userId1: string, userId2: string): Promise<{
  totalInteractions: number;
  recentInteractions: number;
  mutualSupport: boolean;
  lastInteractionDate: Date | null;
  interactionTypes: string[];
}> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Get posts by user2 first
    const { data: user2Posts } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', userId2);
    
    const user2PostIds = user2Posts?.map(p => p.id) || [];

    // Get posts by user1 first  
    const { data: user1Posts } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', userId1);
    
    const user1PostIds = user1Posts?.map(p => p.id) || [];

    // Get likes from user1 on user2's posts (only if there are posts)
    const { data: likes1to2 } = user2PostIds.length > 0 ? await supabase
      .from('user_interactions')
      .select('created_at, interaction_type')
      .eq('user_id', userId1)
      .in('post_id', user2PostIds)
      .gte('created_at', thirtyDaysAgo) : { data: [] };

    // Get likes from user2 on user1's posts (only if there are posts)
    const { data: likes2to1 } = user1PostIds.length > 0 ? await supabase
      .from('user_interactions')
      .select('created_at, interaction_type')
      .eq('user_id', userId2)
      .in('post_id', user1PostIds)
      .gte('created_at', thirtyDaysAgo) : { data: [] };

    // Get comments from user1 on user2's posts (only if there are posts)
    const { data: comments1to2 } = user2PostIds.length > 0 ? await supabase
      .from('comments')
      .select('created_at')
      .eq('user_id', userId1)
      .in('post_id', user2PostIds)
      .gte('created_at', thirtyDaysAgo) : { data: [] };

    // Get comments from user2 on user1's posts (only if there are posts)
    const { data: comments2to1 } = user1PostIds.length > 0 ? await supabase
      .from('comments')
      .select('created_at')
      .eq('user_id', userId2)
      .in('post_id', user1PostIds)
      .gte('created_at', thirtyDaysAgo) : { data: [] };

    const allInteractions = [
      ...(likes1to2 || []).map(l => ({ ...l, direction: '1to2', type: 'like' })),
      ...(likes2to1 || []).map(l => ({ ...l, direction: '2to1', type: 'like' })),
      ...(comments1to2 || []).map(c => ({ ...c, direction: '1to2', type: 'comment' })),
      ...(comments2to1 || []).map(c => ({ ...c, direction: '2to1', type: 'comment' }))
    ];

    const totalInteractions = allInteractions.length;
    const recentInteractions = allInteractions.filter(i => 
      new Date(i.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    const mutualSupport = (likes1to2?.length || 0) > 0 && (likes2to1?.length || 0) > 0;
    const lastInteraction = allInteractions.length > 0 
      ? new Date(Math.max(...allInteractions.map(i => new Date(i.created_at).getTime())))
      : null;

    const interactionTypes = [...new Set(allInteractions.map(i => i.type))];

    return {
      totalInteractions,
      recentInteractions,
      mutualSupport,
      lastInteractionDate: lastInteraction,
      interactionTypes
    };
  } catch (error) {
    console.error('Failed to get detailed interaction history:', error);
    return {
      totalInteractions: 0,
      recentInteractions: 0,
      mutualSupport: false,
      lastInteractionDate: null,
      interactionTypes: []
    };
  }
}

// Check if users are already friends or have pending requests
async function getFriendshipStatus(userId1: string, userId2: string): Promise<'none' | 'pending_sent' | 'pending_received' | 'friends'> {
  try {
    const { data: friendship } = await supabase
      .from('friendships')
      .select('user_id, friend_id, status')
      .or(`and(user_id.eq.${userId1},friend_id.eq.${userId2}),and(user_id.eq.${userId2},friend_id.eq.${userId1})`)
      .single();

    if (!friendship) return 'none';

    if (friendship.status === 'accepted') return 'friends';
    if (friendship.status === 'pending') {
      return friendship.user_id === userId1 ? 'pending_sent' : 'pending_received';
    }

    return 'none';
  } catch (error) {
    return 'none';
  }
}

// Calculate compatibility score between two users
async function calculateCompatibilityScore(user1: any, user2: any): Promise<{
  score: number;
  triggers: string[];
  sharedInterests: string[];
}> {
  const archetype1 = user1.personality_traits?.archetype || 'fitness_newbie';
  const archetype2 = user2.personality_traits?.archetype || 'fitness_newbie';
  
  // Base compatibility from archetype matrix
  const baseCompatibility = FRIENDSHIP_COMPATIBILITY[archetype1 as keyof typeof FRIENDSHIP_COMPATIBILITY]?.[archetype2 as keyof typeof FRIENDSHIP_COMPATIBILITY[keyof typeof FRIENDSHIP_COMPATIBILITY]] || 0.5;
  
  // Get interaction history
  const interactions = await getDetailedInteractionHistory(user1.id, user2.id);
  
  let score = baseCompatibility;
  const triggers: string[] = [];
  const sharedInterests: string[] = [];
  
  // Boost score based on interaction patterns
  if (interactions.totalInteractions >= 3) {
    score += 0.2;
    triggers.push('consistent_engagement');
  }
  
  if (interactions.mutualSupport) {
    score += 0.3;
    triggers.push('mutual_encouragement');
  }
  
  if (interactions.recentInteractions >= 2) {
    score += 0.15;
  }
  
  // Boost for beginner bond
  if (archetype1 === 'fitness_newbie' && archetype2 === 'fitness_newbie') {
    score += 0.15;
    triggers.push('beginner_bond');
  }
  
  // Boost for high archetype compatibility
  if (baseCompatibility >= 0.8) {
    triggers.push('personality_chemistry');
  }
  
  // Check for shared workout preferences
  const user1Prefs = user1.personality_traits?.preferred_workout_types || [];
  const user2Prefs = user2.personality_traits?.preferred_workout_types || [];
  const shared = user1Prefs.filter((pref: string) => user2Prefs.includes(pref));
  
  if (shared.length > 0) {
    score += 0.1 * shared.length;
    sharedInterests.push(...shared);
    triggers.push('workout_buddies');
  }
  
  return { score: Math.min(score, 1.0), triggers, sharedInterests };
}

// Find friendship candidates for a user
async function findFriendshipCandidates(user: any, limit: number = 10): Promise<FriendshipCandidate[]> {
  try {
    // Get potential candidates (other AI users, not already friends)
    const { data: candidates, error } = await supabase
      .from('users')
      .select('id, username, personality_traits, created_at')
      .eq('is_mock_user', true)
      .neq('id', user.id)
      .limit(50); // Get more than needed, then filter

    if (error || !candidates) return [];

    const friendshipCandidates: FriendshipCandidate[] = [];

    for (const candidate of candidates) {
      // Check if already friends or pending
      const status = await getFriendshipStatus(user.id, candidate.id);
      if (status !== 'none') continue;

      // Calculate compatibility
      const compatibility = await calculateCompatibilityScore(user, candidate);
      
      // Only consider if compatibility is decent (>0.6)
      if (compatibility.score < 0.6) continue;

      const interactions = await getDetailedInteractionHistory(user.id, candidate.id);

      friendshipCandidates.push({
        userId: candidate.id,
        username: candidate.username,
        archetype: candidate.personality_traits?.archetype || 'fitness_newbie',
        compatibilityScore: compatibility.score,
        interactionCount: interactions.totalInteractions,
        sharedInterests: compatibility.sharedInterests,
        friendshipTriggers: compatibility.triggers,
        lastInteraction: interactions.lastInteractionDate || new Date(0)
      });
    }

    // Sort by compatibility score and return top candidates
    return friendshipCandidates
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, limit);
  } catch (error) {
    console.error('Failed to find friendship candidates:', error);
    return [];
  }
}

// Send friend request with reasoning
async function sendFriendRequestWithReason(fromUserId: string, toUserId: string, reason: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('friendships')
      .insert({
        user_id: fromUserId,
        friend_id: toUserId,
        status: 'pending'
      });

    return !error;
  } catch (error) {
    console.error('Failed to send friend request:', error);
    return false;
  }
}

// Process proactive friendships for a user
async function processProactiveFriendships(user: any, dryRun: boolean = false): Promise<{
  candidates: FriendshipCandidate[];
  sentRequests: number;
  results: any[];
}> {
  const archetype = user.personality_traits?.archetype || 'fitness_newbie';
  const patterns = SOCIAL_PATTERNS.engagement_rates[archetype as keyof typeof SOCIAL_PATTERNS.engagement_rates];
  
  if (!patterns) {
    return { candidates: [], sentRequests: 0, results: [] };
  }

  // Find friendship candidates
  const candidates = await findFriendshipCandidates(user, 15);
  
  const results: any[] = [];
  let sentRequests = 0;
  
  console.log(`👤 @${user.username} (${archetype}) - Found ${candidates.length} potential friends`);
  
  for (const candidate of candidates) {
    // Should we send a friend request?
    const shouldSend = Math.random() < (patterns.friend_rate * candidate.compatibilityScore);
    
    if (shouldSend && sentRequests < 2) { // Limit to 2 friend requests per session
      const reason = `High compatibility (${Math.round(candidate.compatibilityScore * 100)}%) - ${candidate.friendshipTriggers.join(', ')}`;
      
      if (dryRun) {
        results.push({
          type: 'friend_request',
          success: true,
          fromUser: user.username,
          toUser: candidate.username,
          reason,
          compatibilityScore: candidate.compatibilityScore,
          triggers: candidate.friendshipTriggers
        });
      } else {
        const success = await sendFriendRequestWithReason(user.id, candidate.userId, reason);
        results.push({
          type: 'friend_request',
          success,
          fromUser: user.username,
          toUser: candidate.username,
          reason,
          compatibilityScore: candidate.compatibilityScore,
          triggers: candidate.friendshipTriggers,
          error: success ? undefined : 'Failed to send friend request'
        });
      }
      
      sentRequests++;
    }
  }
  
  return { candidates, sentRequests, results };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const userArg = process.argv.find(arg => arg.startsWith('--users'));
  const userLimit = userArg ? parseInt(userArg.split('=')[1]) || 10 : 10;
  
  console.log(`🤝 ${dryRun ? 'DRY-RUN: ' : ''}PROACTIVE FRIENDSHIP SYSTEM`);
  console.log(`👥 Processing up to ${userLimit} users\n`);
  
  try {
    // Get AI users
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, personality_traits, created_at')
      .eq('is_mock_user', true)
      .limit(userLimit);

    if (error || !users) {
      console.error('Failed to get users:', error);
      return;
    }

    console.log(`👥 Processing ${users.length} AI users for proactive friendships...\n`);

    const allResults: any[] = [];
    let totalCandidates = 0;
    let totalRequests = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      console.log(`[${i + 1}/${users.length}] Processing @${user.username}...`);
      
      const { candidates, sentRequests, results } = await processProactiveFriendships(user, dryRun);
      
      totalCandidates += candidates.length;
      totalRequests += sentRequests;
      allResults.push(...results);
      
      if (results.length > 0) {
        console.log(`   🎯 Found ${candidates.length} candidates, sent ${sentRequests} friend requests`);
        results.forEach(result => {
          console.log(`   🤝 → @${result.toUser} (${Math.round(result.compatibilityScore * 100)}% compatibility)`);
          console.log(`      💡 ${result.triggers.join(', ')}`);
        });
      } else {
        console.log(`   😴 No friendship opportunities right now`);
      }
      
      console.log('');
      
      // Delay between users
      if (i < users.length - 1 && !dryRun) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Summary
    console.log('🎉 PROACTIVE FRIENDSHIP PROCESSING COMPLETED!\n');
    console.log('📊 FRIENDSHIP SUMMARY:');
    console.log(`👥 Total Users Processed: ${users.length}`);
    console.log(`🔍 Total Candidates Found: ${totalCandidates}`);
    console.log(`🤝 Total Friend Requests Sent: ${totalRequests}`);
    console.log(`📈 Average Candidates per User: ${Math.round(totalCandidates / users.length)}`);
    
    if (allResults.length > 0) {
      const avgCompatibility = allResults.reduce((sum, r) => sum + r.compatibilityScore, 0) / allResults.length;
      console.log(`💯 Average Compatibility: ${Math.round(avgCompatibility * 100)}%`);
      
      console.log('\n🤝 SAMPLE FRIEND REQUESTS:');
      allResults.slice(0, 5).forEach(result => {
        console.log(`   @${result.fromUser} → @${result.toUser}`);
        console.log(`   💡 ${result.triggers.join(', ')} (${Math.round(result.compatibilityScore * 100)}%)`);
      });
    }

    console.log(`\n🚀 ${dryRun ? 'DRY-RUN COMPLETED!' : 'FRIENDSHIP SYSTEM ACTIVATED!'}`);
    console.log('💡 Users are now actively building meaningful fitness friendships!');
    
  } catch (error) {
    console.error('❌ Proactive friendship system failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}

export { processProactiveFriendships, findFriendshipCandidates, calculateCompatibilityScore };