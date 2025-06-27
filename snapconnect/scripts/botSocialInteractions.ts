/**
 * Bot Social Interactions System
 * Creates realistic social engagement between AI users (likes, comments, follows)
 * 
 * Usage: npx tsx scripts/botSocialInteractions.ts [--dry-run] [--type likes|comments|friends]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY!
});

// Realistic social interaction patterns
const SOCIAL_PATTERNS = {
  // How likely each archetype is to engage with others
  engagement_rates: {
    fitness_newbie: {
      like_rate: 0.7,        // 70% chance to like posts they see
      comment_rate: 0.3,     // 30% chance to comment
      friend_rate: 0.4,      // 40% chance to send friend requests
      posts_to_see: 8,       // Views 8 posts per session
      engagement_style: 'supportive' // Encouraging and asking questions
    },
    strength_warrior: {
      like_rate: 0.5,
      comment_rate: 0.4,
      friend_rate: 0.3,
      posts_to_see: 6,
      engagement_style: 'technical' // Shares knowledge and tips
    },
    cardio_queen: {
      like_rate: 0.8,
      comment_rate: 0.5,
      friend_rate: 0.6,
      posts_to_see: 10,
      engagement_style: 'energetic' // Enthusiastic and motivational
    },
    zen_master: {
      like_rate: 0.6,
      comment_rate: 0.3,
      friend_rate: 0.2,
      posts_to_see: 5,
      engagement_style: 'mindful' // Thoughtful and encouraging
    },
    outdoor_adventurer: {
      like_rate: 0.6,
      comment_rate: 0.4,
      friend_rate: 0.5,
      posts_to_see: 7,
      engagement_style: 'adventurous' // Shares experiences and invites
    }
  },

  // What types of posts each archetype is drawn to
  post_affinities: {
    fitness_newbie: {
      fitness_newbie: 0.9,      // High affinity for similar beginners
      strength_warrior: 0.6,     // Interested in strength advice
      cardio_queen: 0.7,        // Inspired by cardio success
      zen_master: 0.5,          // Some interest in mindfulness
      outdoor_adventurer: 0.4   // Less interested in outdoor adventures
    },
    strength_warrior: {
      fitness_newbie: 0.8,      // Enjoys helping beginners
      strength_warrior: 0.9,     // High affinity for strength content
      cardio_queen: 0.3,        // Less interested in cardio
      zen_master: 0.4,          // Some appreciation for mindfulness
      outdoor_adventurer: 0.5   // Moderate interest in outdoor strength
    },
    cardio_queen: {
      fitness_newbie: 0.8,      // Loves encouraging beginners
      strength_warrior: 0.4,     // Some appreciation for strength
      cardio_queen: 0.9,        // High affinity for cardio content
      zen_master: 0.6,          // Appreciates mind-body connection
      outdoor_adventurer: 0.8   // Loves outdoor cardio activities
    },
    zen_master: {
      fitness_newbie: 0.7,      // Gently encouraging to all
      strength_warrior: 0.5,     // Appreciates discipline
      cardio_queen: 0.6,        // Enjoys flow states
      zen_master: 0.9,          // High affinity for mindful content
      outdoor_adventurer: 0.8   // Loves nature connection
    },
    outdoor_adventurer: {
      fitness_newbie: 0.6,      // Encourages outdoor activities
      strength_warrior: 0.5,     // Respects functional strength
      cardio_queen: 0.8,        // Loves endurance activities
      zen_master: 0.7,          // Appreciates nature mindfulness
      outdoor_adventurer: 0.9   // High affinity for adventure content
    }
  },

  // Comment templates by engagement style and target archetype
  comment_templates: {
    supportive: {
      fitness_newbie: [
        "You're doing amazing! Keep it up! 💪",
        "Great job! I remember my first time too 😊",
        "So proud of you for starting! How did it feel?",
        "Yes! Every step counts! You've got this! 🎉",
        "Love seeing your progress! What's your next goal?"
      ],
      strength_warrior: [
        "Wow, those numbers are impressive! 💪",
        "I wish I could lift that much! Any beginner tips?",
        "That looks so intense! How long did it take you to build up to that?",
        "Goals! Maybe one day I'll be that strong 🔥",
        "Incredible! What's your secret?"
      ],
      cardio_queen: [
        "That pace is amazing! 🏃‍♀️",
        "I need that energy! How do you stay so motivated?",
        "Goals! I'm still working up to longer distances",
        "You make it look so easy! Inspiring! ✨",
        "Love your cardio posts! They motivate me to move more"
      ]
    },
    technical: {
      fitness_newbie: [
        "Great form! Try focusing on [specific tip] for even better results",
        "Nice work! Here's what helped me when I started...",
        "Solid effort! Make sure you're [technical advice]",
        "Looking good! Progressive overload is key 💪",
        "Keep it up! Consider adding [exercise] to your routine"
      ],
      strength_warrior: [
        "Nice lift! What's your program looking like?",
        "Solid numbers! How's your recovery between sessions?",
        "Great depth on those squats! Form > weight always",
        "That pause at the bottom was perfect 🎯",
        "Impressive! What's your next PR target?"
      ]
    },
    energetic: {
      fitness_newbie: [
        "YES! You're crushing it! 🔥🔥",
        "This is SO exciting! Welcome to the fitness family! 🎉",
        "OMG you're doing so well! I'm here cheering you on! 📣",
        "LOVE this energy! You're inspiring me today! ⚡",
        "Keep shining! Your journey is beautiful to watch! ✨"
      ],
      cardio_queen: [
        "RUNNER'S HIGH IS THE BEST! 🏃‍♀️💨",
        "Yes queen! That pace is FIRE! 🔥",
        "We need to run together sometime! 🤝",
        "Your energy is contagious! Love it! ⚡",
        "Cardio squad unite! Let's gooo! 💪"
      ]
    },
    mindful: {
      fitness_newbie: [
        "Beautiful journey you're on. Trust the process 🙏",
        "Every step is sacred. You're exactly where you need to be ✨",
        "Grateful to witness your growth. Keep flowing 🌱",
        "Your dedication is inspiring. Breathe and believe 🧘‍♀️",
        "Finding strength in every moment. Namaste 🕯️"
      ],
      zen_master: [
        "Such beautiful mindful movement. Feeling the flow with you ✨",
        "Your practice radiates peace. Thank you for sharing 🙏",
        "Finding balance together. This is the way 🧘‍♀️",
        "Breathing with you in this moment. Grateful 🌅",
        "Your center is strong. Inspiring presence 🕯️"
      ]
    },
    adventurous: {
      fitness_newbie: [
        "Adventure awaits! Have you tried outdoor workouts? 🏔️",
        "Nature is calling! This energy would be perfect for hiking 🥾",
        "Love the determination! Ready for some trail therapy? 🌲",
        "You'd love outdoor fitness! Fresh air hits different 🌅",
        "This strength would conquer mountains! Let's go! ⛰️"
      ],
      outdoor_adventurer: [
        "Trail buddies! Where's your next adventure? 🏔️",
        "Nature therapy is the best therapy! What's your favorite spot? 🌲",
        "Adventure squad! Let's explore together 🥾",
        "Peak season is here! Ready for some elevation gain? ⛰️",
        "Wild workout vibes! Nature is our gym 🦅"
      ]
    }
  }
};

interface SocialInteractionResult {
  type: 'like' | 'comment' | 'friend';
  success: boolean;
  fromUser: string;
  toUser?: string;
  postId?: string;
  content?: string;
  error?: string;
}

// Get recent posts for engagement
async function getRecentPostsForEngagement(limit: number = 50): Promise<any[]> {
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      id,
      user_id,
      content,
      media_url,
      media_type,
      created_at,
      users!inner(username, personality_traits, is_mock_user)
    `)
    .eq('users.is_mock_user', true)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch recent posts:', error);
    return [];
  }

  return posts || [];
}

// Check if user has already engaged with a post
async function hasUserEngaged(userId: string, postId: string, type: 'like' | 'comment'): Promise<boolean> {
  if (type === 'like') {
    const { data } = await supabase
      .from('user_interactions')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .eq('interaction_type', 'like')
      .single();
    return !!data;
  } else {
    const { data } = await supabase
      .from('comments')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .single();
    return !!data;
  }
}

// Like a post
async function likePost(userId: string, postId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_interactions')
      .insert({
        user_id: userId,
        post_id: postId,
        interaction_type: 'like'
      });

    return !error;
  } catch (error) {
    console.error('Failed to like post:', error);
    return false;
  }
}

// Analyze existing comments on a post
async function getExistingComments(postId: string): Promise<string[]> {
  try {
    const { data: comments, error } = await supabase
      .from('comments')
      .select('content, users!inner(username)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(10); // Get up to 10 recent comments

    if (error || !comments) return [];
    
    return comments.map(c => `@${c.users.username}: "${c.content}"`);
  } catch (error) {
    console.error('Failed to fetch existing comments:', error);
    return [];
  }
}

// Check interaction history between two users
async function getInteractionHistory(userId1: string, userId2: string): Promise<{
  hasInteracted: boolean;
  recentInteractions: number;
  relationshipType: 'new' | 'casual' | 'regular';
}> {
  try {
    // Check recent likes and comments between users (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: interactions, error } = await supabase
      .from('user_interactions')
      .select('id')
      .or(`and(user_id.eq.${userId1},post_id.in.(select id from posts where user_id = '${userId2}')),and(user_id.eq.${userId2},post_id.in.(select id from posts where user_id = '${userId1}'))`)
      .gte('created_at', thirtyDaysAgo);

    if (error) {
      return { hasInteracted: false, recentInteractions: 0, relationshipType: 'new' };
    }

    const interactionCount = interactions?.length || 0;
    
    return {
      hasInteracted: interactionCount > 0,
      recentInteractions: interactionCount,
      relationshipType: interactionCount >= 10 ? 'regular' : interactionCount >= 3 ? 'casual' : 'new'
    };
  } catch (error) {
    console.error('Failed to get interaction history:', error);
    return { hasInteracted: false, recentInteractions: 0, relationshipType: 'new' };
  }
}

// Get recent activity context for a user
async function getUserRecentActivity(userId: string): Promise<{
  recentPosts: string[];
  currentFocus: string;
  activityLevel: 'high' | 'moderate' | 'low';
}> {
  try {
    const { data: recentPosts, error } = await supabase
      .from('posts')
      .select('content, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('created_at', { ascending: false })
      .limit(5);

    if (error || !recentPosts) {
      return { recentPosts: [], currentFocus: 'general fitness', activityLevel: 'low' };
    }

    const posts = recentPosts.map(p => p.content);
    const activityLevel = recentPosts.length >= 3 ? 'high' : recentPosts.length >= 1 ? 'moderate' : 'low';
    
    // Infer current focus from recent posts
    const allContent = posts.join(' ').toLowerCase();
    let currentFocus = 'general fitness';
    
    if (allContent.includes('strength') || allContent.includes('lift') || allContent.includes('deadlift')) {
      currentFocus = 'strength training';
    } else if (allContent.includes('run') || allContent.includes('cardio') || allContent.includes('miles')) {
      currentFocus = 'cardio/running';
    } else if (allContent.includes('yoga') || allContent.includes('stretch') || allContent.includes('flexibility')) {
      currentFocus = 'flexibility/yoga';
    } else if (allContent.includes('outdoor') || allContent.includes('hike') || allContent.includes('trail')) {
      currentFocus = 'outdoor activities';
    }

    return { recentPosts: posts, currentFocus, activityLevel };
  } catch (error) {
    console.error('Failed to get user recent activity:', error);
    return { recentPosts: [], currentFocus: 'general fitness', activityLevel: 'low' };
  }
}

// Analyze image from URL if it's a photo post
async function analyzePostImage(mediaUrl: string): Promise<string | null> {
  if (!mediaUrl) return null;
  
  try {
    console.log('👁️ Analyzing post image for comment context...');
    
    // If it's a base64 URL, extract the base64 data
    let imageData = '';
    if (mediaUrl.startsWith('data:image')) {
      imageData = mediaUrl;
    } else {
      // For regular URLs, we'd need to fetch and convert to base64
      // For now, skip analysis for external URLs
      return null;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Briefly describe what workout/exercise is shown in this fitness image (1-2 sentences, under 50 words). Focus on the main activity, equipment, and setting.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'What workout is shown in this image?'
            },
            {
              type: 'image_url',
              image_url: { url: imageData }
            }
          ]
        }
      ],
      max_tokens: 60,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('Image analysis for comment failed:', error);
    return null;
  }
}

// Generate contextually rich comment
async function generateComment(
  commenterArchetype: string,
  postContent: string,
  postAuthorArchetype: string,
  commenterUsername: string,
  post: any, // Full post object with media and metadata
  commenterUserId: string // Commenter's user ID for interaction history
): Promise<string> {
  const engagementStyle = SOCIAL_PATTERNS.engagement_rates[commenterArchetype as keyof typeof SOCIAL_PATTERNS.engagement_rates]?.engagement_style || 'supportive';
  
  // Get template-based comment for consistency (50% chance now, down from 60% to allow more context-rich responses)
  const templates = SOCIAL_PATTERNS.comment_templates[engagementStyle as keyof typeof SOCIAL_PATTERNS.comment_templates];
  const archetypeTemplates = templates?.[postAuthorArchetype as keyof typeof templates] || templates?.fitness_newbie;
  
  if (archetypeTemplates && Math.random() < 0.5) {
    return archetypeTemplates[Math.floor(Math.random() * archetypeTemplates.length)];
  }

  try {
    // Gather comprehensive context (run in parallel for speed)
    const [
      imageAnalysis,
      existingComments,
      interactionHistory,
      authorActivity,
      commenterActivity
    ] = await Promise.all([
      post.media_url && post.media_type === 'photo' ? analyzePostImage(post.media_url) : Promise.resolve(null),
      getExistingComments(post.id),
      getInteractionHistory(commenterUserId, post.user_id),
      getUserRecentActivity(post.user_id),
      getUserRecentActivity(commenterUserId)
    ]);

    // Build context-rich prompt
    let contextPrompt = `You are ${commenterUsername}, a ${commenterArchetype.replace('_', ' ')} fitness enthusiast. 

Your commenting style: ${engagementStyle}

POST DETAILS:
Caption: "${postContent}"`;

    if (imageAnalysis) {
      contextPrompt += `\nImage: ${imageAnalysis}`;
    }

    if (existingComments.length > 0) {
      contextPrompt += `\n\nEXISTING COMMENTS:
${existingComments.slice(0, 3).join('\n')}`;
    }

    if (interactionHistory.relationshipType !== 'new') {
      contextPrompt += `\n\nRELATIONSHIP: You're ${interactionHistory.relationshipType} friends (${interactionHistory.recentInteractions} recent interactions)`;
    }

    if (authorActivity.currentFocus !== 'general fitness') {
      contextPrompt += `\n\nAUTHOR'S FOCUS: Currently focused on ${authorActivity.currentFocus}`;
    }

    if (commenterActivity.currentFocus !== 'general fitness' && commenterActivity.currentFocus !== authorActivity.currentFocus) {
      contextPrompt += `\n\nYOUR FOCUS: You're currently focused on ${commenterActivity.currentFocus}`;
    }

    contextPrompt += `\n\nWrite a brief, authentic comment (1-2 sentences max, under 100 characters) that:
1. Matches your ${engagementStyle} personality
2. Feels genuine and contextually aware
3. ${existingComments.length > 0 ? 'Adds something new (avoid repeating existing comments)' : 'Starts a supportive conversation'}
4. ${imageAnalysis ? 'References what you see in the image naturally' : 'Responds to the caption meaningfully'}
5. ${interactionHistory.relationshipType === 'regular' ? 'Sounds like an ongoing friendship' : interactionHistory.relationshipType === 'casual' ? 'Shows familiarity' : 'Introduces yourself positively'}
6. Sounds like casual social media interaction

Be authentic, brief, and contextually smart.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: contextPrompt },
        { role: 'user', content: `Write a ${engagementStyle} comment that adds value to this conversation.` }
      ],
      max_tokens: 60,
      temperature: 0.8
    });

    return completion.choices[0]?.message?.content?.trim() || getRandomTemplate(engagementStyle, postAuthorArchetype);
  } catch (error) {
    console.error('Enhanced comment generation failed, falling back to simple:', error);
    return getRandomTemplate(engagementStyle, postAuthorArchetype);
  }
}

function getRandomTemplate(engagementStyle: string, targetArchetype: string): string {
  const templates = SOCIAL_PATTERNS.comment_templates[engagementStyle as keyof typeof SOCIAL_PATTERNS.comment_templates];
  const archetypeTemplates = templates?.[targetArchetype as keyof typeof templates] || templates?.fitness_newbie || ["Great post! 💪"];
  return archetypeTemplates[Math.floor(Math.random() * archetypeTemplates.length)];
}

// Comment on a post
async function commentOnPost(userId: string, postId: string, content: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('comments')
      .insert({
        user_id: userId,
        post_id: postId,
        content
      });

    return !error;
  } catch (error) {
    console.error('Failed to comment on post:', error);
    return false;
  }
}

// Check if users are already friends
async function areAlreadyFriends(userId1: string, userId2: string): Promise<boolean> {
  const { data } = await supabase
    .from('friendships')
    .select('id')
    .or(`and(user_id.eq.${userId1},friend_id.eq.${userId2}),and(user_id.eq.${userId2},friend_id.eq.${userId1})`)
    .single();
  
  return !!data;
}

// Send friend request
async function sendFriendRequest(fromUserId: string, toUserId: string): Promise<boolean> {
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

// Simulate social engagement for a user
async function simulateUserEngagement(user: any, dryRun: boolean = false): Promise<SocialInteractionResult[]> {
  const archetype = user.personality_traits?.archetype || 'fitness_newbie';
  const patterns = SOCIAL_PATTERNS.engagement_rates[archetype as keyof typeof SOCIAL_PATTERNS.engagement_rates];
  const affinities = SOCIAL_PATTERNS.post_affinities[archetype as keyof typeof SOCIAL_PATTERNS.post_affinities];
  
  if (!patterns) {
    return [];
  }

  const results: SocialInteractionResult[] = [];
  
  // Get recent posts to engage with
  const recentPosts = await getRecentPostsForEngagement();
  const eligiblePosts = recentPosts
    .filter(post => post.user_id !== user.id) // Don't engage with own posts
    .slice(0, patterns.posts_to_see);

  console.log(`👤 @${user.username} (${archetype}) browsing ${eligiblePosts.length} posts...`);

  for (const post of eligiblePosts) {
    const postAuthorArchetype = post.users.personality_traits?.archetype || 'fitness_newbie';
    const affinityScore = affinities[postAuthorArchetype as keyof typeof affinities] || 0.5;
    
    // Adjust engagement probability based on affinity
    const adjustedLikeRate = patterns.like_rate * affinityScore;
    const adjustedCommentRate = patterns.comment_rate * affinityScore;

    // Check if already engaged
    const alreadyLiked = await hasUserEngaged(user.id, post.id, 'like');
    const alreadyCommented = await hasUserEngaged(user.id, post.id, 'comment');

    // Like the post
    if (!alreadyLiked && Math.random() < adjustedLikeRate) {
      if (dryRun) {
        results.push({
          type: 'like',
          success: true,
          fromUser: user.username,
          toUser: post.users.username,
          postId: post.id
        });
      } else {
        const success = await likePost(user.id, post.id);
        results.push({
          type: 'like',
          success,
          fromUser: user.username,
          toUser: post.users.username,
          postId: post.id,
          error: success ? undefined : 'Failed to like post'
        });
      }
    }

    // Comment on the post
    if (!alreadyCommented && Math.random() < adjustedCommentRate) {
      const comment = await generateComment(archetype, post.content, postAuthorArchetype, user.username, post, user.id);
      
      if (dryRun) {
        results.push({
          type: 'comment',
          success: true,
          fromUser: user.username,
          toUser: post.users.username,
          postId: post.id,
          content: comment
        });
      } else {
        const success = await commentOnPost(user.id, post.id, comment);
        results.push({
          type: 'comment',
          success,
          fromUser: user.username,
          toUser: post.users.username,
          postId: post.id,
          content: comment,
          error: success ? undefined : 'Failed to comment on post'
        });
      }
    }

    // Smart friendship logic: send requests based on meaningful interactions and compatibility
    if ((alreadyLiked || alreadyCommented) && Math.random() < patterns.friend_rate * affinityScore * 0.3) {
      const alreadyFriends = await areAlreadyFriends(user.id, post.user_id);
      
      if (!alreadyFriends) {
        // Check if we've interacted enough to warrant a friendship
        const interactionHistory = await getInteractionHistory(user.id, post.user_id);
        const shouldSendRequest = 
          interactionHistory.recentInteractions >= 2 || // Multiple recent interactions
          (interactionHistory.totalInteractions >= 3 && affinityScore >= 0.8) || // Good interaction history + high affinity
          (archetype === postAuthorArchetype && Math.random() < 0.7); // Same archetype bonus
        
        if (shouldSendRequest) {
          if (dryRun) {
            results.push({
              type: 'friend',
              success: true,
              fromUser: user.username,
              toUser: post.users.username,
              reason: `${interactionHistory.totalInteractions} interactions, ${Math.round(affinityScore * 100)}% affinity`
            });
          } else {
            const success = await sendFriendRequest(user.id, post.user_id);
            results.push({
              type: 'friend',
              success,
              fromUser: user.username,
              toUser: post.users.username,
              reason: `${interactionHistory.totalInteractions} interactions, ${Math.round(affinityScore * 100)}% affinity`,
              error: success ? undefined : 'Failed to send friend request'
            });
          }
        }
      }
    }

    // Human-like delay between engagements
    const delay = Math.floor(Math.random() * 3000) + 1000; // 1-4 seconds
    if (!dryRun) await new Promise(resolve => setTimeout(resolve, delay));
  }

  return results;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const typeArg = process.argv.find(arg => arg.startsWith('--type='));
  const interactionType = typeArg ? typeArg.split('=')[1] : 'all';
  
  try {
    console.log(`🤝 ${dryRun ? 'DRY-RUN: ' : ''}Starting Bot Social Interactions...`);
    console.log(`🎯 Type: ${interactionType} | Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}\n`);

    // Get all AI users
    const { data: aiUsers, error } = await supabase
      .from('users')
      .select('id, username, personality_traits')
      .eq('is_mock_user', true);

    if (error) {
      throw new Error(`Failed to get AI users: ${error.message}`);
    }

    if (!aiUsers || aiUsers.length === 0) {
      console.log('📭 No AI users found');
      return;
    }

    console.log(`👥 Processing ${aiUsers.length} AI users for social engagement...\n`);

    const allResults: SocialInteractionResult[] = [];

    // Process users with human-like delays
    for (let i = 0; i < aiUsers.length; i++) {
      const user = aiUsers[i];
      
      console.log(`[${i + 1}/${aiUsers.length}] Processing @${user.username}...`);
      
      const userResults = await simulateUserEngagement(user, dryRun);
      allResults.push(...userResults);
      
      if (userResults.length > 0) {
        console.log(`   🎯 Engaged with ${userResults.length} posts`);
        userResults.forEach(result => {
          if (result.type === 'like') {
            console.log(`   👍 Liked @${result.toUser}'s post`);
          } else if (result.type === 'comment') {
            console.log(`   💬 Commented on @${result.toUser}'s post: "${result.content}"`);
          } else if (result.type === 'friend') {
            console.log(`   🤝 Sent friend request to @${result.toUser}`);
          }
        });
      } else {
        console.log(`   😴 No engagement this session`);
      }

      // Human-like delay between users
      if (i < aiUsers.length - 1) {
        const delay = Math.floor(Math.random() * 5000) + 2000; // 2-7 seconds
        console.log(`   ⏱️ Delay: ${Math.floor(delay / 1000)}s\n`);
        if (!dryRun) await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Summary
    const likes = allResults.filter(r => r.type === 'like');
    const comments = allResults.filter(r => r.type === 'comment');
    const friends = allResults.filter(r => r.type === 'friend');
    const successful = allResults.filter(r => r.success);

    console.log('\n🎉 SOCIAL ENGAGEMENT COMPLETED!\n');
    console.log('📊 ENGAGEMENT SUMMARY:');
    console.log(`👍 Likes: ${likes.length} (${likes.filter(l => l.success).length} successful)`);
    console.log(`💬 Comments: ${comments.length} (${comments.filter(c => c.success).length} successful)`);
    console.log(`🤝 Friend Requests: ${friends.length} (${friends.filter(f => f.success).length} successful)`);
    console.log(`📈 Overall Success Rate: ${Math.round((successful.length / allResults.length) * 100)}%`);

    if (comments.filter(c => c.success).length > 0) {
      console.log('\n💬 Sample Comments:');
      comments.filter(c => c.success).slice(0, 5).forEach(comment => {
        console.log(`   @${comment.fromUser} → @${comment.toUser}: "${comment.content}"`);
      });
    }

    console.log(`\n🚀 ${successful.length} social interactions created!`);
    console.log('💡 Your AI users are now actively engaging with each other!');

  } catch (error) {
    console.error('❌ Social interactions failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}

export { simulateUserEngagement, SOCIAL_PATTERNS, main as botSocialInteractions };