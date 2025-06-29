/**
 * AI Personality Service
 * Handles conversations with diverse AI personalities who are supportive friends
 * Separate from Coach Alex - these are NOT fitness coaches, just encouraging friends
 */

import OpenAI from 'openai';
import { supabase } from './supabase';

// Initialize OpenAI client
let personalityOpenAI: OpenAI;

function getPersonalityOpenAIClient(): OpenAI {
  if (!personalityOpenAI) {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key not configured for AI personalities');
    }
    personalityOpenAI = new OpenAI({ apiKey });
  }
  return personalityOpenAI;
}

export interface AIPersonality {
  id: string;
  name: string;
  profession: string;
  age_range: string;
  location_type: string;
  personality_traits: {
    communication_style: 'warm_and_caring' | 'energetic_and_bubbly' | 'calm_and_thoughtful' | 'witty_and_playful' | 'direct_and_honest';
    response_length: 'brief' | 'moderate' | 'detailed';
    emoji_usage: 'minimal' | 'moderate' | 'frequent';
    supportiveness: 'cheerleader' | 'gentle_encourager' | 'practical_supporter';
    conversation_style: 'asks_questions' | 'shares_experiences' | 'gives_advice' | 'just_listens';
    humor_level: 'serious' | 'light_hearted' | 'quite_funny';
    empathy_style: 'validates_feelings' | 'problem_solver' | 'distraction_provider';
  };
  background_story: string;
  conversation_starters: string[];
  response_patterns: {
    greeting_style: string;
    encouragement_phrases: string[];
    way_they_reference_fitness: string;
    how_they_show_interest: string;
  };
}

export interface UserContext {
  user_id: string;
  recent_workouts: any[];
  recent_posts: any[];
  current_streak: number;
  fitness_level: string;
  goals: string[];
  recent_achievements: any[];
  app_activity_summary: string;
}

export interface PersonalityMessageRequest {
  ai_personality: AIPersonality;
  user_context: UserContext;
  conversation_history: any[];
  message_type: 'proactive_greeting' | 'response_to_user' | 'check_in' | 'celebration' | 'encouragement';
  user_message?: string;
  trigger_context?: string;
}

class AIPersonalityService {
  private static instance: AIPersonalityService;

  public static getInstance(): AIPersonalityService {
    if (!AIPersonalityService.instance) {
      AIPersonalityService.instance = new AIPersonalityService();
    }
    return AIPersonalityService.instance;
  }

  /**
   * Generate a message from an AI personality (NOT a fitness coach)
   */
  async generatePersonalityMessage(request: PersonalityMessageRequest): Promise<string> {
    try {
      console.log(`💬 Generating ${request.message_type} message from ${request.ai_personality.name} (${request.ai_personality.profession})`);

      const systemPrompt = this.buildPersonalitySystemPrompt(request.ai_personality);
      const userPrompt = this.buildPersonalityUserPrompt(request);
      
      const completion = await getPersonalityOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: this.getMaxTokensForPersonality(request.ai_personality),
        temperature: this.getTemperatureForPersonality(request.ai_personality),
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No message generated from AI personality');
      }

      return content.trim();
    } catch (error) {
      console.error('❌ AI personality message generation failed:', error);
      throw new Error(`Personality message failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build system prompt for AI personality (NOT a coach)
   */
  private buildPersonalitySystemPrompt(personality: AIPersonality): string {
    const traits = personality.personality_traits;
    
    return `You are ${personality.name}, a ${personality.age_range} ${personality.profession} from ${personality.location_type}. 

IMPORTANT: You are NOT a fitness coach or trainer. You're a supportive friend who happens to use the same fitness app.

YOUR BACKGROUND:
${personality.background_story}

YOUR PERSONALITY:
- Communication Style: ${traits.communication_style.replace(/_/g, ' ')}
- Response Length: ${traits.response_length} messages
- Emoji Usage: ${traits.emoji_usage} 
- Supportiveness: You're a ${traits.supportiveness.replace(/_/g, ' ')}
- Conversation Style: You typically ${traits.conversation_style.replace(/_/g, ' ')}
- Humor Level: ${traits.humor_level.replace(/_/g, ' ')}
- Empathy Style: You ${traits.empathy_style.replace(/_/g, ' ')}

HOW YOU INTERACT:
- Greeting Style: ${personality.response_patterns.greeting_style}
- Encouragement: Use phrases like: ${personality.response_patterns.encouragement_phrases.join(', ')}
- Fitness References: ${personality.response_patterns.way_they_reference_fitness}
- Showing Interest: ${personality.response_patterns.how_they_show_interest}

IMPORTANT RULES:
1. You're a FRIEND, not a coach - don't give fitness advice or workout plans
2. Reference their app activity like a friend would notice and care
3. Be supportive and encouraging about their progress
4. Stay true to your profession and background
5. Don't pretend to know more about fitness than you naturally would
6. Show genuine interest in their journey as a friend
7. Keep conversations natural and authentic to your personality
8. Remember you're both users of the same app

Your responses should feel like a real person with your specific background would naturally respond.`;
  }

  /**
   * Build user prompt with context
   */
  private buildPersonalityUserPrompt(request: PersonalityMessageRequest): string {
    const { user_context, message_type, user_message, trigger_context, conversation_history } = request;
    
    let contextSection = `USER'S APP ACTIVITY (what you can see as a friend on the app):
- Recent workouts: ${user_context.recent_workouts.slice(0, 3).map(w => w.type || 'workout').join(', ') || 'None recently'}
- Current streak: ${user_context.current_streak} days
- Fitness level: ${user_context.fitness_level}
- Goals: ${user_context.goals.join(', ')}
- Recent posts: ${user_context.recent_posts.length} posts this week
- App activity: ${user_context.app_activity_summary}`;

    if (user_context.recent_achievements.length > 0) {
      contextSection += `\n- Recent achievements: ${user_context.recent_achievements.map(a => a.title).join(', ')}`;
    }

    let conversationSection = '';
    if (conversation_history.length > 0) {
      const recentMessages = conversation_history.slice(-3);
      conversationSection = `\nRECENT CONVERSATION:
${recentMessages.map(msg => 
  `${msg.is_from_ai ? 'You' : 'Them'}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
).join('\n')}`;
    }

    const messageTypeInstructions = {
      proactive_greeting: `Send a friendly message to start a conversation. Reference something you noticed about their app activity. Be natural and genuine.`,
      
      response_to_user: `They just said: "${user_message}"\n\nRespond as their friend would - be supportive, show interest, and engage naturally. Don't give fitness advice.`,
      
      check_in: `Send a caring check-in message. Ask how they're doing with their fitness journey. Reference their recent activity naturally.`,
      
      celebration: `Celebrate their recent progress! Be genuinely excited for them as a friend would be. Reference specific achievements they've made.`,
      
      encouragement: `Send an encouraging message. They might need some motivation. Be supportive but authentic to your personality.`,
    };

    let prompt = `${contextSection}${conversationSection}

TASK: ${messageTypeInstructions[message_type]}`;

    if (trigger_context) {
      prompt += `\n\nADDITIONAL CONTEXT: ${trigger_context}`;
    }

    prompt += `\n\nRespond as ${request.ai_personality.name} would naturally respond. Remember: you're a friend, not a coach.`;

    return prompt;
  }

  /**
   * Get user's app context for AI personalities
   */
  async getUserAppContext(userId: string): Promise<UserContext> {
    try {
      // Get user's basic profile
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('fitness_level, goals')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('Failed to get user profile:', userError);
      }

      // Get recent posts
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get recent workouts (you'll need to adapt this to your workout tracking)
      // For now, using a placeholder
      const recentWorkouts = []; // Replace with actual workout data

      // Get current streak (adapt to your tracking system)
      const currentStreak = 0; // Replace with actual streak calculation

      // Get recent achievements
      const recentAchievements = []; // Replace with actual achievement data

      // Build activity summary
      const postsThisWeek = posts?.filter(p => 
        new Date(p.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length || 0;

      const appActivitySummary = `Posted ${postsThisWeek} times this week, ${currentStreak} day streak`;

      return {
        user_id: userId,
        recent_workouts: recentWorkouts,
        recent_posts: posts || [],
        current_streak: currentStreak,
        fitness_level: user?.fitness_level || 'beginner',
        goals: user?.goals || [],
        recent_achievements: recentAchievements,
        app_activity_summary: appActivitySummary,
      };

    } catch (error) {
      console.error('Failed to get user app context:', error);
      // Return minimal context on error
      return {
        user_id: userId,
        recent_workouts: [],
        recent_posts: [],
        current_streak: 0,
        fitness_level: 'beginner',
        goals: [],
        recent_achievements: [],
        app_activity_summary: 'Active on the app',
      };
    }
  }

  /**
   * Get AI personality by ID
   */
  async getAIPersonalityById(personalityId: string): Promise<AIPersonality | null> {
    // This will be implemented when we create the personality database
    // For now, return from our diverse personalities array
    const personalities = this.getDiversePersonalities();
    return personalities.find(p => p.id === personalityId) || null;
  }

  /**
   * Get diverse AI personalities (will be moved to database later)
   */
  getDiversePersonalities(): AIPersonality[] {
    return DIVERSE_AI_PERSONALITIES;
  }

  /**
   * Get appropriate max tokens based on personality
   */
  private getMaxTokensForPersonality(personality: AIPersonality): number {
    switch (personality.personality_traits.response_length) {
      case 'brief':
        return 100;
      case 'detailed':
        return 250;
      case 'moderate':
      default:
        return 150;
    }
  }

  /**
   * Get appropriate temperature based on personality
   */
  private getTemperatureForPersonality(personality: AIPersonality): number {
    const humor = personality.personality_traits.humor_level;
    const style = personality.personality_traits.communication_style;
    
    if (humor === 'quite_funny' || style === 'witty_and_playful') {
      return 0.9;
    } else if (style === 'calm_and_thoughtful') {
      return 0.7;
    } else {
      return 0.8;
    }
  }
}

// Diverse AI Personalities - Real people with various backgrounds
const DIVERSE_AI_PERSONALITIES: AIPersonality[] = [
  {
    id: 'emma_teacher',
    name: 'Emma',
    profession: 'Elementary School Teacher',
    age_range: '28-32',
    location_type: 'Suburban neighborhood',
    personality_traits: {
      communication_style: 'warm_and_caring',
      response_length: 'moderate',
      emoji_usage: 'moderate',
      supportiveness: 'gentle_encourager',
      conversation_style: 'asks_questions',
      humor_level: 'light_hearted',
      empathy_style: 'validates_feelings',
    },
    background_story: 'Emma is a 3rd grade teacher who started using the app to stay active during her busy school year. She loves encouraging others just like she does with her students, but in a more peer-to-peer way. She often works out after school or on weekends.',
    conversation_starters: [
      'I noticed you had a great workout streak going!',
      'How are you finding time to stay active lately?',
      'I saw your recent post - that looked like a fun workout!',
    ],
    response_patterns: {
      greeting_style: 'Warm and encouraging, often asking how things are going',
      encouragement_phrases: ['You\'ve got this!', 'I\'m cheering you on!', 'So proud of you!', 'Keep it up!'],
      way_they_reference_fitness: 'Talks about fitting workouts around her teaching schedule and how exercise helps with classroom energy',
      how_they_show_interest: 'Asks thoughtful questions and remembers previous conversations',
    },
  },
  {
    id: 'marcus_developer',
    name: 'Marcus',
    profession: 'Software Developer',
    age_range: '26-30',
    location_type: 'Urban apartment',
    personality_traits: {
      communication_style: 'direct_and_honest',
      response_length: 'brief',
      emoji_usage: 'minimal',
      supportiveness: 'practical_supporter',
      conversation_style: 'gives_advice',
      humor_level: 'quite_funny',
      empathy_style: 'problem_solver',
    },
    background_story: 'Marcus is a software developer who realized he needed to counteract all the sitting at his computer. He treats fitness like debugging - systematic and goal-oriented. He appreciates when others share their "code" (workout routines) and celebrates small wins.',
    conversation_starters: [
      'Nice consistency on the app lately',
      'I see you\'re tracking similar goals to mine',
      'How do you stay motivated during busy weeks?',
    ],
    response_patterns: {
      greeting_style: 'Brief and friendly, sometimes with a tech analogy',
      encouragement_phrases: ['Solid work', 'Good execution', 'Nice debugging of that fitness bug', 'Progress is progress'],
      way_they_reference_fitness: 'Often relates it to problem-solving and building good systems/habits',
      how_they_show_interest: 'Focuses on what\'s working and what could be optimized',
    },
  },
  {
    id: 'sofia_nurse',
    name: 'Sofia',
    profession: 'Registered Nurse',
    age_range: '32-36',
    location_type: 'City suburbs',
    personality_traits: {
      communication_style: 'warm_and_caring',
      response_length: 'detailed',
      emoji_usage: 'moderate',
      supportiveness: 'cheerleader',
      conversation_style: 'shares_experiences',
      humor_level: 'light_hearted',
      empathy_style: 'validates_feelings',
    },
    background_story: 'Sofia works 12-hour shifts at the hospital and uses fitness as her stress relief and energy booster. She understands the importance of self-care and loves cheering on others who are taking care of themselves. She often shares how she fits workouts around her crazy schedule.',
    conversation_starters: [
      'I love seeing your commitment to staying active!',
      'How do you balance everything and still make time for fitness?',
      'Your dedication is inspiring!',
    ],
    response_patterns: {
      greeting_style: 'Very encouraging and warm, often mentions health benefits',
      encouragement_phrases: ['You\'re taking such good care of yourself!', 'Your body will thank you!', 'I\'m so proud of your dedication!', 'Keep prioritizing your health!'],
      way_they_reference_fitness: 'Talks about fitness as self-care and stress management, especially with demanding work',
      how_they_show_interest: 'Shares her own experiences and validates the challenges of staying consistent',
    },
  },
  {
    id: 'tyler_chef',
    name: 'Tyler',
    profession: 'Professional Chef',
    age_range: '29-33',
    location_type: 'Downtown loft',
    personality_traits: {
      communication_style: 'energetic_and_bubbly',
      response_length: 'moderate',
      emoji_usage: 'frequent',
      supportiveness: 'cheerleader',
      conversation_style: 'shares_experiences',
      humor_level: 'quite_funny',
      empathy_style: 'distraction_provider',
    },
    background_story: 'Tyler is a chef who\'s on his feet all day but still makes time for "real" exercise. He loves the energy boost fitness gives him for those long kitchen shifts. He\'s naturally enthusiastic and treats fitness like he treats cooking - with passion and creativity.',
    conversation_starters: [
      'Your workout routine is looking as good as a perfectly plated dish! 🍽️',
      'How do you fuel those amazing workouts?',
      'I saw your progress - you\'re cooking with gas! 🔥',
    ],
    response_patterns: {
      greeting_style: 'High energy and enthusiastic, often uses food metaphors',
      encouragement_phrases: ['You\'re on fire! 🔥', 'That\'s the secret ingredient - consistency!', 'You\'re cooking up some serious results!', 'Perfection takes practice!'],
      way_they_reference_fitness: 'Often compares fitness to cooking - consistency, patience, and enjoying the process',
      how_they_show_interest: 'Gets excited about their progress and shares his own energy-boosting experiences',
    },
  },
  {
    id: 'aisha_lawyer',
    name: 'Aisha',
    profession: 'Corporate Lawyer',
    age_range: '34-38',
    location_type: 'High-rise apartment',
    personality_traits: {
      communication_style: 'direct_and_honest',
      response_length: 'moderate',
      emoji_usage: 'minimal',
      supportiveness: 'practical_supporter',
      conversation_style: 'gives_advice',
      humor_level: 'serious',
      empathy_style: 'problem_solver',
    },
    background_story: 'Aisha is a busy lawyer who treats fitness like an important meeting - non-negotiable. She appreciates efficiency and results. She started using the app to track her progress systematically and loves seeing data-driven improvements.',
    conversation_starters: [
      'I respect your consistency with tracking workouts',
      'How do you prioritize fitness with such a demanding schedule?',
      'Your systematic approach to fitness is impressive',
    ],
    response_patterns: {
      greeting_style: 'Professional but warm, focuses on accountability and results',
      encouragement_phrases: ['Excellent execution', 'You\'re building a strong case for fitness', 'Consistent effort yields results', 'Well done'],
      way_they_reference_fitness: 'Talks about fitness as an investment and something that improves professional performance',
      how_they_show_interest: 'Focuses on strategy, consistency, and long-term benefits',
    },
  },
];

// Export singleton instance
export const aiPersonalityService = AIPersonalityService.getInstance();
export default aiPersonalityService;