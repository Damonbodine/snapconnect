/**
 * Human-Like Bot Enhancement System
 * Makes AI users behave more naturally and human-like
 * 
 * Usage: npx tsx scripts/enhanceHumanLikeBots.ts --preview
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

// Human-like behavior patterns
const HUMAN_PATTERNS = {
  // Posting time preferences (realistic distributions)
  posting_times: {
    fitness_newbie: [6, 7, 8, 18, 19, 20], // Morning motivation, evening workouts
    strength_warrior: [5, 6, 17, 18, 19], // Early birds, post-work sessions
    cardio_queen: [6, 7, 8, 12, 17, 18], // Morning runs, lunch breaks, evening
    zen_master: [6, 7, 8, 19, 20, 21], // Sunrise/sunset practices
    outdoor_adventurer: [5, 6, 7, 16, 17, 18] // Early outdoor activities, golden hour
  },

  // Realistic posting frequency (not every day)
  weekly_patterns: {
    fitness_newbie: [1, 1, 0, 1, 0, 1, 0], // 4 days/week, inconsistent
    strength_warrior: [1, 1, 1, 0, 1, 1, 0], // 5 days/week, consistent
    cardio_queen: [1, 1, 1, 1, 1, 0, 1], // 6 days/week, Sunday runs
    zen_master: [1, 0, 1, 0, 1, 0, 1], // Every other day, balanced
    outdoor_adventurer: [0, 1, 1, 1, 1, 1, 0] // Weekday adventures, weekend rest
  },

  // Human-like inconsistencies and personality quirks
  personality_quirks: {
    fitness_newbie: {
      typos: ['omg', 'cant', 'gonna', 'wanna', 'tho'],
      excitement: ['!!!', '💪💪', '🔥🔥', 'YESSS'],
      doubts: ['hope I can', 'trying to', 'still learning'],
      celebrations: ['first time', 'finally did', 'so proud'],
      emojis: ['😅', '💪', '🎉', '🏃‍♀️', '🏋️‍♀️', '❤️'],
      hashtags: ['#newbie', '#fitnessjourney', '#beginnermindset', '#babysteps']
    },
    strength_warrior: {
      technical: ['PR', 'sets', 'reps', 'compound movements', 'progressive overload'],
      intensity: ['crushed', 'destroyed', 'annihilated', 'dominated'],
      numbers: ['275lb', '3x5', '1RM', '80%', 'tempo'],
      emojis: ['💪', '🔥', '⚡', '🏋️‍♂️', '🎯'],
      hashtags: ['#strengthtraining', '#powerlifting', '#gains', '#iron']
    },
    cardio_queen: {
      metrics: ['pace', 'heart rate', 'miles', 'splits', 'zone 2'],
      energy: ['flying', 'flowing', 'crushing', 'soaring'],
      recovery: ['legs are', 'feeling it', 'earned this'],
      emojis: ['🏃‍♀️', '💨', '⚡', '🔥', '❤️', '🌟'],
      hashtags: ['#runnerlife', '#cardio', '#endurance', '#runnershigh']
    },
    zen_master: {
      mindful: ['present', 'breathe', 'flow', 'balance', 'centered'],
      gratitude: ['grateful', 'blessed', 'thankful', 'appreciation'],
      gentle: ['slowly', 'gently', 'mindfully', 'peacefully'],
      emojis: ['🧘‍♀️', '✨', '🙏', '🌅', '🕯️', '☮️'],
      hashtags: ['#yoga', '#mindfulness', '#balance', '#namaste']
    },
    outdoor_adventurer: {
      nature: ['fresh air', 'trail', 'summit', 'wilderness', 'outdoors'],
      adventure: ['exploring', 'conquering', 'discovering', 'chasing'],
      weather: ['sunrise', 'golden hour', 'crisp air', 'perfect day'],
      emojis: ['🏔️', '🌲', '🌅', '🥾', '⛰️', '🦅'],
      hashtags: ['#outdoorfitness', '#nature', '#adventure', '#trails']
    }
  },

  // Realistic content variations
  content_themes: {
    monday: ['motivation', 'fresh start', 'week goals', 'monday energy'],
    tuesday: ['consistency', 'routine', 'progress', 'dedication'],
    wednesday: ['hump day', 'midweek', 'pushing through', 'halfway there'],
    thursday: ['almost weekend', 'strong finish', 'consistency pays'],
    friday: ['week wrap', 'feeling strong', 'weekend prep', 'accomplished'],
    saturday: ['weekend warrior', 'extra time', 'longer session', 'fun workout'],
    sunday: ['active recovery', 'gentle movement', 'prep for week', 'reflection']
  }
};

// Human-like content generation with personality
async function generateHumanLikeContent(user: any, context: any): Promise<{caption: string, shouldPost: boolean}> {
  const archetype = user.personality_traits?.archetype || 'fitness_newbie';
  const quirks = HUMAN_PATTERNS.personality_quirks[archetype as keyof typeof HUMAN_PATTERNS.personality_quirks];
  
  // Check if user should post today based on realistic patterns
  const dayOfWeek = new Date().getDay();
  const weeklyPattern = HUMAN_PATTERNS.weekly_patterns[archetype as keyof typeof HUMAN_PATTERNS.weekly_patterns];
  const shouldPostToday = weeklyPattern[dayOfWeek] === 1;
  
  // Add some randomness (80% follow pattern, 20% break it)
  const shouldPost = Math.random() < 0.2 ? !shouldPostToday : shouldPostToday;
  
  if (!shouldPost) {
    return { caption: '', shouldPost: false };
  }

  // Build a human-like system prompt with recent context
  const systemPrompt = `You are ${user.username}, a ${archetype.replace('_', ' ')} fitness enthusiast.

Your personality details:
- Archetype: ${archetype}
- Communication style: ${getPersonalityTraits(archetype)}
- Today is ${getDayContext()}

Recent context:
${context.recentPosts ? `Your last posts: ${context.recentPosts.slice(0, 2).map((p: any) => `"${p.content}"`).join(', ')}` : 'This is your first post'}
${context.weatherMood ? `Weather/mood: ${context.weatherMood}` : ''}

Write a fitness social media post that:
1. Sounds completely natural and human
2. Reflects your specific personality quirks
3. References today's context (${getDayContext()})
4. Uses realistic language, including minor imperfections
5. Includes 1-2 relevant emojis
6. Stays under 150 characters
7. Feels authentic to YOUR voice

Be spontaneous and genuine. Real people aren't perfect in their posts.`;

  const contentPrompt = generateContextualPrompt(archetype, context);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contentPrompt }
      ],
      max_tokens: 120,
      temperature: 0.9, // Higher temperature for more human variation
      presence_penalty: 0.3, // Encourage diverse content
      frequency_penalty: 0.2 // Reduce repetition
    });

    let caption = completion.choices[0]?.message?.content?.trim() || generateFallbackCaption(archetype);
    
    // Add human-like imperfections occasionally
    caption = addHumanQuirks(caption, quirks);
    
    return { caption, shouldPost: true };
    
  } catch (error) {
    console.error('Content generation failed:', error);
    return { caption: generateFallbackCaption(archetype), shouldPost: true };
  }
}

function getPersonalityTraits(archetype: string): string {
  const traits = {
    fitness_newbie: 'Excited but uncertain, asks questions, celebrates small wins, sometimes overwhelmed',
    strength_warrior: 'Confident, technical, focused on numbers and progress, motivating to others',
    cardio_queen: 'Energetic, social, loves sharing achievements, passionate about endurance',
    zen_master: 'Calm, reflective, mindful language, focuses on balance and inner growth',
    outdoor_adventurer: 'Adventurous, nature-loving, spontaneous, weather-dependent moods'
  };
  return traits[archetype as keyof typeof traits] || traits.fitness_newbie;
}

function getDayContext(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];
  const hour = new Date().getHours();
  
  let timeContext = '';
  if (hour < 9) timeContext = 'morning';
  else if (hour < 17) timeContext = 'afternoon';
  else timeContext = 'evening';
  
  return `${today} ${timeContext}`;
}

function generateContextualPrompt(archetype: string, context: any): string {
  const day = new Date().getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayThemes = HUMAN_PATTERNS.content_themes[dayNames[day] as keyof typeof HUMAN_PATTERNS.content_themes];
  const theme = dayThemes[Math.floor(Math.random() * dayThemes.length)];
  
  const prompts = {
    fitness_newbie: [
      `Share about a workout you just tried, focusing on ${theme}. Be genuine about the experience.`,
      `Post about your fitness journey progress, mentioning ${theme}. Show both excitement and vulnerability.`,
      `Share a small victory or challenge from today's exercise, connecting to ${theme}.`
    ],
    strength_warrior: [
      `Share details about your strength training session, incorporating ${theme}. Include specific numbers.`,
      `Post about your lifting progress or technique focus, relating to ${theme}.`,
      `Share a strength training insight or achievement, connecting to ${theme}.`
    ],
    cardio_queen: [
      `Share about your cardio session today, focusing on ${theme}. Include how you felt.`,
      `Post about your endurance training or running experience, mentioning ${theme}.`,
      `Share your cardio achievements or goals, relating to ${theme}.`
    ],
    zen_master: [
      `Share about your mindful movement practice, incorporating ${theme}. Focus on inner experience.`,
      `Post about balance and wellness, connecting to ${theme}. Be reflective.`,
      `Share a mindful insight from your practice, relating to ${theme}.`
    ],
    outdoor_adventurer: [
      `Share about your outdoor fitness adventure, focusing on ${theme}. Mention nature.`,
      `Post about your outdoor training or exploration, incorporating ${theme}.`,
      `Share your connection with nature through fitness, relating to ${theme}.`
    ]
  };
  
  const archetypePrompts = prompts[archetype as keyof typeof prompts] || prompts.fitness_newbie;
  return archetypePrompts[Math.floor(Math.random() * archetypePrompts.length)];
}

function addHumanQuirks(caption: string, quirks: any): string {
  // 20% chance to add minor "human" imperfections
  if (Math.random() < 0.2) {
    // Occasionally use contractions or casual language
    caption = caption.replace(/cannot/g, "can't");
    caption = caption.replace(/going to/g, "gonna");
    caption = caption.replace(/want to/g, "wanna");
    caption = caption.replace(/though/g, "tho");
  }
  
  // 15% chance to add extra enthusiasm
  if (Math.random() < 0.15 && quirks.excitement) {
    const excitement = quirks.excitement[Math.floor(Math.random() * quirks.excitement.length)];
    caption += ` ${excitement}`;
  }
  
  return caption;
}

function generateFallbackCaption(archetype: string): string {
  const fallbacks = {
    fitness_newbie: "Just finished a workout! Still learning but feeling stronger 💪",
    strength_warrior: "Solid training session today. Progressive overload paying off 🔥",
    cardio_queen: "Great run this morning! Heart rate zones on point ❤️",
    zen_master: "Mindful movement session complete. Feeling centered ✨",
    outdoor_adventurer: "Trail therapy session done. Nature never disappoints 🏔️"
  };
  return fallbacks[archetype as keyof typeof fallbacks] || fallbacks.fitness_newbie;
}

// Enhanced posting logic with human-like timing
async function createHumanLikePost(user: any): Promise<any> {
  // Get context for more human-like content
  const context = await getUserContext(user);
  
  // Generate human-like content
  const { caption, shouldPost } = await generateHumanLikeContent(user, context);
  
  if (!shouldPost) {
    return { success: false, reason: 'Following realistic posting pattern - not posting today' };
  }
  
  // Add human-like posting delay (1-30 minutes)
  const humanDelay = Math.floor(Math.random() * 30 * 60 * 1000); // 0-30 minutes
  console.log(`⏱️ Human-like delay for @${user.username}: ${Math.floor(humanDelay / 60000)} minutes`);
  
  return {
    success: true,
    caption,
    humanDelay,
    context
  };
}

async function getUserContext(user: any): Promise<any> {
  // Get recent posts for context
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3);
    
  return {
    recentPosts: recentPosts || [],
    weatherMood: generateWeatherMood(),
    dayOfWeek: new Date().getDay()
  };
}

function generateWeatherMood(): string {
  const moods = [
    'motivated by the sunny weather',
    'feeling energized despite the rain',
    'perfect temperature for working out',
    'crisp morning air is invigorating',
    'cozy indoor workout vibes'
  ];
  return moods[Math.floor(Math.random() * moods.length)];
}

// Preview function to show enhancements
async function previewEnhancements() {
  console.log('🧠 HUMAN-LIKE BOT ENHANCEMENTS PREVIEW\n');
  
  console.log('📅 REALISTIC POSTING PATTERNS:');
  Object.entries(HUMAN_PATTERNS.weekly_patterns).forEach(([archetype, pattern]) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const schedule = pattern.map((posts, i) => posts ? days[i] : '---').join(' ');
    console.log(`   ${archetype}: ${schedule}`);
  });
  
  console.log('\n⏰ OPTIMAL POSTING TIMES:');
  Object.entries(HUMAN_PATTERNS.posting_times).forEach(([archetype, times]) => {
    const timeStr = times.map(t => `${t}:00`).join(', ');
    console.log(`   ${archetype}: ${timeStr}`);
  });
  
  console.log('\n🎭 PERSONALITY QUIRKS:');
  Object.entries(HUMAN_PATTERNS.personality_quirks).forEach(([archetype, quirks]) => {
    console.log(`   ${archetype}:`);
    console.log(`     Emojis: ${quirks.emojis.join(' ')}`);
    console.log(`     Hashtags: ${quirks.hashtags.join(' ')}`);
  });
  
  console.log('\n🎯 ENHANCEMENT FEATURES:');
  console.log('   ✅ Realistic posting schedules (not every day)');
  console.log('   ✅ Personality-driven content variations');
  console.log('   ✅ Context-aware captions (day, weather, history)');
  console.log('   ✅ Human imperfections (contractions, enthusiasm)');
  console.log('   ✅ Time-based content themes');
  console.log('   ✅ Natural posting delays');
  console.log('   ✅ Archetype-specific language patterns');
  
  console.log('\n💡 NEXT STEPS:');
  console.log('   1. Integrate with existing bot army script');
  console.log('   2. Add social interactions (likes, comments)');
  console.log('   3. Implement follower relationships');
  console.log('   4. Add seasonal/trending content awareness');
  console.log('   5. Create bot-to-bot conversations');
}

async function main() {
  const isPreview = process.argv.includes('--preview');
  
  if (isPreview) {
    await previewEnhancements();
    return;
  }
  
  console.log('🧠 Human-Like Bot Enhancement System');
  console.log('💡 Run with --preview to see enhancement details');
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}

export { 
  generateHumanLikeContent, 
  createHumanLikePost, 
  HUMAN_PATTERNS,
  main as enhanceHumanLikeBots 
};