/**
 * Human-Like Bot Army Script
 * Creates natural, human-like posts with realistic behaviors and patterns
 * 
 * Usage: npx tsx scripts/runHumanLikeBotArmy.ts [--dry-run] [--limit N]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { HUMAN_PATTERNS } from './enhanceHumanLikeBots';

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

interface HumanLikePostResult {
  success: boolean;
  username: string;
  userId: string;
  archetype: string;
  postId?: string;
  caption?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

// Check if user should post based on realistic patterns
function shouldUserPostToday(archetype: string, username: string): { shouldPost: boolean; reason: string } {
  const dayOfWeek = new Date().getDay();
  const weeklyPattern = HUMAN_PATTERNS.weekly_patterns[archetype as keyof typeof HUMAN_PATTERNS.weekly_patterns];
  
  if (!weeklyPattern) {
    return { shouldPost: true, reason: 'Unknown archetype, defaulting to post' };
  }
  
  const scheduledToPost = weeklyPattern[dayOfWeek] === 1;
  
  // Add 20% randomness - sometimes people break their patterns
  const randomFactor = Math.random();
  const usernameHash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const personalRandomness = (usernameHash % 100) / 100; // Consistent randomness per user
  
  let finalDecision = scheduledToPost;
  
  if (personalRandomness < 0.15) { // 15% chance to be "spontaneous"
    finalDecision = !scheduledToPost;
    const reason = scheduledToPost ? 'Taking a spontaneous rest day' : 'Feeling motivated, posting on off-day';
    return { shouldPost: finalDecision, reason };
  }
  
  if (scheduledToPost) {
    return { shouldPost: true, reason: 'Following weekly schedule' };
  } else {
    return { shouldPost: false, reason: 'Rest day according to schedule' };
  }
}

// Check if it's an optimal posting time for the user
function isOptimalPostingTime(archetype: string): { isOptimal: boolean; reason: string } {
  const currentHour = new Date().getHours();
  const optimalTimes = HUMAN_PATTERNS.posting_times[archetype as keyof typeof HUMAN_PATTERNS.posting_times];
  
  if (!optimalTimes) {
    return { isOptimal: true, reason: 'Unknown archetype, allowing any time' };
  }
  
  const isOptimal = optimalTimes.includes(currentHour);
  
  if (isOptimal) {
    return { isOptimal: true, reason: `Optimal time for ${archetype}` };
  } else {
    // Allow posting within 2 hours of optimal time with lower probability
    const nearOptimal = optimalTimes.some(time => Math.abs(time - currentHour) <= 2);
    if (nearOptimal && Math.random() < 0.3) {
      return { isOptimal: true, reason: 'Near optimal time, posting anyway' };
    }
    return { isOptimal: false, reason: `Not optimal time for ${archetype} (prefers ${optimalTimes.join(', ')})` };
  }
}

// Generate human-like content with personality and context
async function generateHumanLikeContent(user: any): Promise<string> {
  const archetype = user.personality_traits?.archetype || 'fitness_newbie';
  const quirks = HUMAN_PATTERNS.personality_quirks[archetype as keyof typeof HUMAN_PATTERNS.personality_quirks];
  
  // Get user's recent posts for context
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3);
  
  // Build context-aware system prompt
  const dayContext = getDayContext();
  const personalityDetails = getDetailedPersonality(archetype);
  
  const systemPrompt = `You are ${user.username}, a real person who is a ${archetype.replace('_', ' ')} in the fitness community.

Your authentic personality:
${personalityDetails}

Context:
- Today: ${dayContext}
- Your recent posts: ${recentPosts?.slice(0, 2).map(p => `"${p.content}"`).join(', ') || 'This is one of your first posts'}

Write a completely natural fitness social media post that:
1. Sounds like YOU specifically (not generic)
2. References ${dayContext} naturally
3. Uses your authentic voice and vocabulary
4. Includes realistic imperfections (contractions, casual language)
5. Shows your personality quirks and interests
6. Includes 1-2 emojis that you'd actually use
7. Is 80-140 characters (realistic post length)
8. Avoids repetition from your recent posts

Be genuinely human - real people aren't perfect or overly polished in their posts.`;

  const contentPrompt = generateContextualPrompt(archetype, dayContext);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contentPrompt }
      ],
      max_tokens: 100,
      temperature: 0.95, // High temperature for natural variation
      presence_penalty: 0.4, // Encourage unique content
      frequency_penalty: 0.3 // Reduce repetition
    });

    let caption = completion.choices[0]?.message?.content?.trim() || generateFallbackCaption(archetype);
    
    // Add subtle human quirks
    caption = addHumanQuirks(caption, quirks, user.username);
    
    return caption;
    
  } catch (error) {
    console.error(`Content generation failed for @${user.username}:`, error);
    return generateFallbackCaption(archetype);
  }
}

function getDayContext(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];
  const hour = new Date().getHours();
  
  let timeContext = '';
  if (hour < 10) timeContext = 'morning';
  else if (hour < 14) timeContext = 'midday';
  else if (hour < 18) timeContext = 'afternoon';
  else timeContext = 'evening';
  
  return `${today} ${timeContext}`;
}

function getDetailedPersonality(archetype: string): string {
  const personalities = {
    fitness_newbie: `You're excited about fitness but still learning. You celebrate small wins, ask questions, and sometimes feel overwhelmed. You use casual language and show both determination and vulnerability. You're genuinely enthusiastic but not overconfident.`,
    
    strength_warrior: `You're serious about strength training and results. You use technical terms naturally, mention specific numbers (weights, reps), and are disciplined about progression. You're confident but not arrogant, and you enjoy the mental challenge of lifting.`,
    
    cardio_queen: `You're passionate about endurance activities and love the mental clarity from cardio. You track metrics naturally, enjoy the community aspect, and often mention how workouts make you feel. You're energetic and social in your posts.`,
    
    zen_master: `You approach fitness through mindfulness and balance. You use thoughtful language, mention inner experiences, and connect movement to well-being. You're grateful and reflective, preferring quality over intensity.`,
    
    outdoor_adventurer: `You prefer natural settings for fitness and adventure. You're spontaneous, weather-aware, and connect deeply with nature. You use adventurous language and often mention the outdoors' impact on your mood and energy.`
  };
  
  return personalities[archetype as keyof typeof personalities] || personalities.fitness_newbie;
}

function generateContextualPrompt(archetype: string, dayContext: string): string {
  const prompts = {
    fitness_newbie: [
      `Share something about your fitness journey today, being honest about the experience.`,
      `Post about a workout you tried, showing both excitement and any challenges.`,
      `Share a small victory or something you learned, keeping it real and relatable.`
    ],
    strength_warrior: [
      `Share details about your strength session, including specific numbers or techniques.`,
      `Post about your training progress or a particular lift you focused on.`,
      `Share a strength-focused insight or achievement from today's training.`
    ],
    cardio_queen: [
      `Share about your cardio session and how it made you feel physically and mentally.`,
      `Post about your endurance training, pace, or running/cardio experience.`,
      `Share your cardio achievements or the mental benefits you experienced.`
    ],
    zen_master: [
      `Share about your mindful movement practice and its impact on your well-being.`,
      `Post about finding balance through movement, being reflective and grateful.`,
      `Share a mindful insight from your practice or how movement centered you.`
    ],
    outdoor_adventurer: [
      `Share about your outdoor fitness adventure and connection with nature.`,
      `Post about outdoor training, mentioning the environment and how it energized you.`,
      `Share how nature and outdoor activity impacted your mood and fitness.`
    ]
  };
  
  const archetypePrompts = prompts[archetype as keyof typeof prompts] || prompts.fitness_newbie;
  const selectedPrompt = archetypePrompts[Math.floor(Math.random() * archetypePrompts.length)];
  
  return `${selectedPrompt} Context: ${dayContext}. Be authentic to your personality.`;
}

function addHumanQuirks(caption: string, quirks: any, username: string): string {
  const userSeed = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const personalRandom = (userSeed % 100) / 100;
  
  // Each user has consistent quirks based on their username
  if (personalRandom < 0.25) {
    // Add contractions for this user
    caption = caption.replace(/cannot/g, "can't");
    caption = caption.replace(/going to/g, "gonna");
    caption = caption.replace(/want to/g, "wanna");
    caption = caption.replace(/have to/g, "gotta");
  }
  
  if (personalRandom > 0.7 && quirks?.excitement) {
    // This user tends to be more enthusiastic
    const enthusiasm = quirks.excitement[Math.floor(Math.random() * quirks.excitement.length)];
    if (Math.random() < 0.3) caption += ` ${enthusiasm}`;
  }
  
  return caption;
}

function generateFallbackCaption(archetype: string): string {
  const fallbacks = {
    fitness_newbie: "Another step forward in my fitness journey! Still learning but feeling stronger 💪",
    strength_warrior: "Solid training session today. Progressive overload is the way 🔥",
    cardio_queen: "Amazing cardio session! My heart rate zones were perfect today ❤️",
    zen_master: "Mindful movement practice complete. Feeling centered and grateful ✨",
    outdoor_adventurer: "Trail therapy session done. Nature is the best gym 🏔️"
  };
  return fallbacks[archetype as keyof typeof fallbacks] || fallbacks.fitness_newbie;
}

// Create post with human-like timing and behavior
async function createHumanLikePost(user: any, dryRun: boolean = false): Promise<HumanLikePostResult> {
  const archetype = user.personality_traits?.archetype || 'fitness_newbie';
  
  try {
    // Check if user should post today
    const { shouldPost, reason: scheduleReason } = shouldUserPostToday(archetype, user.username);
    
    if (!shouldPost) {
      return {
        success: false,
        username: user.username,
        userId: user.id,
        archetype,
        skipped: true,
        skipReason: scheduleReason
      };
    }
    
    // Check if it's optimal posting time
    const { isOptimal, reason: timeReason } = isOptimalPostingTime(archetype);
    
    if (!isOptimal) {
      return {
        success: false,
        username: user.username,
        userId: user.id,
        archetype,
        skipped: true,
        skipReason: timeReason
      };
    }
    
    console.log(`📝 ${dryRun ? '[DRY-RUN] ' : ''}Creating human-like post for @${user.username} (${archetype})`);
    console.log(`   📅 Schedule: ${scheduleReason}`);
    console.log(`   ⏰ Timing: ${timeReason}`);
    
    if (dryRun) {
      const mockCaption = await generateHumanLikeContent(user);
      return {
        success: true,
        username: user.username,
        userId: user.id,
        archetype,
        postId: 'dry-run-id',
        caption: mockCaption
      };
    }
    
    // Generate human-like content
    const caption = await generateHumanLikeContent(user);
    
    // Add human-like delay (simulate thinking/typing time)
    const humanDelay = Math.floor(Math.random() * 120000) + 30000; // 30s to 2.5min
    console.log(`   ⏱️ Human typing delay: ${Math.floor(humanDelay / 1000)}s`);
    await new Promise(resolve => setTimeout(resolve, humanDelay));
    
    // Generate contextual image
    const imagePrompt = generateImagePrompt(archetype, caption);
    
    const imageResponse = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      size: '1024x1024',
      quality: 'low'
    });
    
    const imageBase64 = imageResponse.data[0].b64_json!;
    
    // Upload image
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const timestamp = Date.now();
    const filename = `ai-generated/${user.id}/human-like-${timestamp}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from('posts-media')
      .upload(filename, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
      });
    
    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }
    
    const { data: publicUrlData } = supabase.storage
      .from('posts-media')
      .getPublicUrl(filename);
    
    const mediaUrl = publicUrlData.publicUrl;
    
    // Create post
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 24);
    
    const { data: postData, error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        content: caption,
        media_url: mediaUrl,
        media_type: 'photo',
        workout_type: 'general',
        expires_at: expiryTime.toISOString(),
      })
      .select('id')
      .single();
    
    if (postError) {
      throw new Error(`Database insert failed: ${postError.message}`);
    }
    
    console.log(`✅ @${user.username}: "${caption}"`);
    
    return {
      success: true,
      username: user.username,
      userId: user.id,
      archetype,
      postId: postData.id,
      caption
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`❌ @${user.username}: ${errorMessage}`);
    
    return {
      success: false,
      username: user.username,
      userId: user.id,
      archetype,
      error: errorMessage
    };
  }
}

function generateImagePrompt(archetype: string, caption: string): string {
  const styles = {
    fitness_newbie: 'friendly gym environment with beginner equipment, encouraging atmosphere, natural lighting',
    strength_warrior: 'serious gym with heavy weights and barbells, focused training environment, dramatic lighting',
    cardio_queen: 'dynamic cardio setting with running or HIIT equipment, energetic atmosphere, bright lighting',
    zen_master: 'peaceful yoga or wellness space, calm atmosphere, soft natural lighting, mindful setting',
    outdoor_adventurer: 'outdoor fitness environment, natural setting, adventure activities, golden hour lighting'
  };
  
  const baseStyle = styles[archetype as keyof typeof styles] || styles.fitness_newbie;
  
  return `High-quality fitness photograph showing ${baseStyle}. The image should authentically represent the mood and activity described in: "${caption.substring(0, 100)}". Professional photography, realistic style, appropriate for social media.`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find(arg => arg.startsWith('--limit'));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) || 70 : 70;
  
  try {
    console.log(`🧠 ${dryRun ? 'DRY-RUN: ' : ''}Starting Human-Like Bot Army...\n`);
    console.log(`📊 Limit: ${limit} users | Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}\n`);
    
    // Get all AI users
    const { data: allUsers, error } = await supabase
      .from('users')
      .select('id, username, full_name, personality_traits')
      .eq('is_mock_user', true)
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to get AI users: ${error.message}`);
    }
    
    if (!allUsers || allUsers.length === 0) {
      console.log('📭 No AI users found');
      return;
    }
    
    console.log(`👥 Found ${allUsers.length} AI users\n`);
    
    const results: HumanLikePostResult[] = [];
    
    // Process users with human-like timing
    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i];
      
      console.log(`[${i + 1}/${allUsers.length}] Processing @${user.username}...`);
      
      const result = await createHumanLikePost(user, dryRun);
      results.push(result);
      
      // Realistic delay between processing users (humans don't post simultaneously)
      if (i < allUsers.length - 1) {
        const delay = Math.floor(Math.random() * 10000) + 5000; // 5-15 seconds
        console.log(`⏱️ Realistic delay: ${Math.floor(delay / 1000)}s\n`);
        if (!dryRun) await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success && !r.skipped);
    const skipped = results.filter(r => r.skipped);
    
    console.log('\n🎉 HUMAN-LIKE BOT ARMY COMPLETED!\n');
    console.log('📊 RESULTS:');
    console.log(`✅ Posted: ${successful.length}`);
    console.log(`⏭️ Skipped (realistic): ${skipped.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📈 Success Rate: ${Math.round((successful.length / (successful.length + failed.length || 1)) * 100)}%`);
    
    if (skipped.length > 0) {
      console.log('\n⏭️ Realistically Skipped Users:');
      skipped.forEach(result => {
        console.log(`   @${result.username}: ${result.skipReason}`);
      });
    }
    
    if (successful.length > 0) {
      console.log('\n✅ Posted Today:');
      successful.slice(0, 10).forEach(result => {
        console.log(`   @${result.username}: "${result.caption?.substring(0, 50)}..."`);
      });
      if (successful.length > 10) {
        console.log(`   ... and ${successful.length - 10} more posts!`);
      }
    }
    
    if (failed.length > 0) {
      console.log('\n❌ Failed Posts:');
      failed.forEach(result => {
        console.log(`   @${result.username}: ${result.error}`);
      });
    }
    
    console.log(`\n🚀 ${successful.length} human-like posts created!`);
    console.log('💡 Users skipped are following realistic human posting patterns');
    
  } catch (error) {
    console.error('❌ Human-like bot army failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}

export { main as runHumanLikeBotArmy };