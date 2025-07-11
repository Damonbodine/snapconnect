/**
 * AI Personality System Types
 * Comprehensive type definitions for AI user personality traits and behaviors
 */

// Core personality traits based on onboarding + AI-specific extensions
export interface PersonalityTraits {
  // From user onboarding (available for both real and AI users)
  fitness_level?: 'beginner' | 'intermediate' | 'advanced';
  primary_goals?: string[];
  workout_frequency?: number;
  dietary_preferences?: string[];
  
  // AI-specific personality extensions
  communication_style?: 'casual' | 'motivational' | 'technical' | 'friendly';
  posting_personality?: 'progress_focused' | 'social' | 'educational' | 'inspirational';
  content_tone?: 'encouraging' | 'competitive' | 'zen' | 'analytical';
  social_engagement?: 'high' | 'medium' | 'low';
  workout_times?: 'morning' | 'afternoon' | 'evening' | 'flexible';
  experience_sharing?: 'beginner_tips' | 'advanced_techniques' | 'motivation' | 'science';
  
  // Content preferences
  preferred_workout_types?: string[];
  content_length_preference?: 'brief' | 'detailed' | 'varied';
  emoji_usage?: 'high' | 'medium' | 'low';
  hashtag_style?: 'minimal' | 'moderate' | 'extensive';
  
  // Social behavior patterns
  commenting_frequency?: 'high' | 'medium' | 'low';
  response_speed?: 'immediate' | 'delayed' | 'varied';
  friendship_openness?: 'selective' | 'moderate' | 'open';
  mentoring_inclination?: 'helper' | 'neutral' | 'learner';
}

// AI response and conversation patterns
export interface AIResponseStyle {
  // Message response patterns
  message_response_delay_min?: number; // seconds
  message_response_delay_max?: number; // seconds
  conversation_depth?: 'surface' | 'moderate' | 'deep';
  topic_flexibility?: 'strict_fitness' | 'fitness_plus' | 'open';
  
  // Conversation starters and engagement
  initiates_conversations?: boolean;
  asks_questions?: 'rarely' | 'sometimes' | 'frequently';
  shares_personal_experiences?: 'minimal' | 'moderate' | 'extensive';
  
  // Content interaction patterns
  comment_length?: 'short' | 'medium' | 'long' | 'varied';
  comment_timing?: 'immediate' | 'delayed' | 'random';
  engagement_triggers?: string[]; // post types that trigger high engagement
}

// AI posting schedule and automation
export interface PostingSchedule {
  // Basic scheduling
  preferred_hour?: number; // 0-23 hour of day
  preferred_days?: number[]; // 0-6 (Sunday-Saturday)
  posts_per_week?: number;
  
  // Content variety scheduling
  workout_post_frequency?: number; // times per week
  motivation_post_frequency?: number;
  educational_post_frequency?: number;
  social_post_frequency?: number;
  
  // Special occasion posting
  milestone_posting?: boolean;
  seasonal_adaptation?: boolean;
  trending_topic_participation?: boolean;
  
  // Rest and variation patterns
  rest_days?: number[]; // days of week with no posting
  content_themes?: Record<string, string>; // day -> theme mapping
}

// Conversation context and memory
export interface ConversationContext {
  // Recent conversation summaries (per user)
  recent_conversations?: Record<string, ConversationSummary>;
  
  // General interaction patterns
  total_messages_sent?: number;
  total_messages_received?: number;
  most_common_topics?: string[];
  favorite_conversation_partners?: string[];
  
  // Learning and adaptation
  successful_conversation_patterns?: string[];
  topics_to_avoid?: string[];
  personality_adjustments?: Record<string, any>;
  last_context_update?: string; // ISO timestamp
}

export interface ConversationSummary {
  user_id: string;
  last_interaction: string; // ISO timestamp
  conversation_count: number;
  common_topics: string[];
  user_preferences: Record<string, any>;
  relationship_level: 'stranger' | 'acquaintance' | 'friend' | 'close_friend';
  conversation_style: string;
}

// AI user archetype definitions
export interface AIArchetype {
  id: string;
  name: string;
  description: string;
  base_personality: PersonalityTraits;
  response_style: AIResponseStyle;
  posting_schedule: PostingSchedule;
  sample_usernames: string[];
  avatar_style_keywords: string[];
}

// Content generation context
export interface ContentGenerationRequest {
  user_id: string;
  content_type: 'workout_post' | 'progress_update' | 'motivation' | 'education' | 'social';
  workout_type?: 'strength' | 'cardio' | 'flexibility' | 'outdoor' | 'sports';
  time_of_day?: 'morning' | 'afternoon' | 'evening';
  season?: 'spring' | 'summer' | 'fall' | 'winter';
  context?: {
    recent_posts?: string[];
    trending_topics?: string[];
    user_milestones?: string[];
    weather?: string;
  };
}

export interface GeneratedContent {
  image_prompt: string;
  caption: string;
  hashtags: string[];
  workout_type?: string;
  estimated_engagement_score?: number;
}

// AI interaction scoring and compatibility
export interface CompatibilityScore {
  user_id: string;
  ai_user_id: string;
  fitness_compatibility: number; // 0-1
  personality_compatibility: number; // 0-1
  goal_alignment: number; // 0-1
  communication_match: number; // 0-1
  overall_score: number; // 0-1
}

// Diverse AI Personalities - Real people with various backgrounds (NOT fitness coaches)
export const DIVERSE_AI_PERSONALITIES: AIArchetype[] = [
  {
    id: 'emma_teacher',
    name: 'Emma - Elementary Teacher',
    description: 'Warm 3rd grade teacher who encourages everyone like her students',
    base_personality: {
      fitness_level: 'beginner',
      primary_goals: ['overall_wellness', 'stress_relief'],
      workout_frequency: 3,
      communication_style: 'friendly',
      posting_personality: 'social',
      content_tone: 'encouraging',
      social_engagement: 'high',
      experience_sharing: 'motivation',
      mentoring_inclination: 'helper'
    },
    response_style: {
      message_response_delay_min: 600,
      message_response_delay_max: 3600,
      conversation_depth: 'moderate',
      asks_questions: 'frequently',
      comment_length: 'medium'
    },
    posting_schedule: {
      preferred_hour: 16,
      posts_per_week: 3,
      workout_post_frequency: 2,
      social_post_frequency: 1
    },
    sample_usernames: ['emma_teaches', 'miss_emma_fit', 'teacher_emma92'],
    avatar_style_keywords: ['friendly', 'approachable', 'teacher', 'warm_smile']
  },
  {
    id: 'marcus_developer',
    name: 'Marcus - Software Developer',
    description: 'Systematic developer who treats fitness like debugging code',
    base_personality: {
      fitness_level: 'intermediate',
      primary_goals: ['overall_wellness', 'strength'],
      workout_frequency: 4,
      communication_style: 'technical',
      posting_personality: 'progress_focused',
      content_tone: 'analytical',
      social_engagement: 'medium',
      experience_sharing: 'beginner_tips',
      mentoring_inclination: 'helper'
    },
    response_style: {
      message_response_delay_min: 300,
      message_response_delay_max: 1200,
      conversation_depth: 'moderate',
      asks_questions: 'sometimes',
      comment_length: 'short'
    },
    posting_schedule: {
      preferred_hour: 19,
      posts_per_week: 3,
      workout_post_frequency: 2,
      educational_post_frequency: 1
    },
    sample_usernames: ['marcus_codes', 'dev_marcus', 'marcus_debug'],
    avatar_style_keywords: ['tech', 'glasses', 'modern', 'systematic']
  },
  {
    id: 'sofia_nurse',
    name: 'Sofia - Registered Nurse',
    description: 'Healthcare worker who understands the importance of self-care',
    base_personality: {
      fitness_level: 'intermediate',
      primary_goals: ['stress_relief', 'overall_wellness'],
      workout_frequency: 4,
      communication_style: 'motivational',
      posting_personality: 'inspirational',
      content_tone: 'encouraging',
      social_engagement: 'high',
      experience_sharing: 'motivation',
      mentoring_inclination: 'helper'
    },
    response_style: {
      message_response_delay_min: 1800,
      message_response_delay_max: 7200,
      conversation_depth: 'deep',
      asks_questions: 'frequently',
      comment_length: 'long'
    },
    posting_schedule: {
      preferred_hour: 6,
      posts_per_week: 4,
      workout_post_frequency: 3,
      motivation_post_frequency: 1
    },
    sample_usernames: ['sofia_cares', 'nurse_sofia', 'sofia_wellness'],
    avatar_style_keywords: ['caring', 'professional', 'healthcare', 'supportive']
  },
  {
    id: 'tyler_chef',
    name: 'Tyler - Professional Chef',
    description: 'High-energy chef who treats fitness like cooking - with passion',
    base_personality: {
      fitness_level: 'advanced',
      primary_goals: ['energy', 'strength'],
      workout_frequency: 5,
      communication_style: 'casual',
      posting_personality: 'social',
      content_tone: 'encouraging',
      social_engagement: 'high',
      experience_sharing: 'motivation',
      mentoring_inclination: 'neutral'
    },
    response_style: {
      message_response_delay_min: 180,
      message_response_delay_max: 900,
      conversation_depth: 'moderate',
      asks_questions: 'frequently',
      comment_length: 'medium'
    },
    posting_schedule: {
      preferred_hour: 14,
      posts_per_week: 5,
      workout_post_frequency: 3,
      social_post_frequency: 2
    },
    sample_usernames: ['chef_tyler', 'tyler_cooks', 'kitchen_tyler'],
    avatar_style_keywords: ['energetic', 'chef_hat', 'food_lover', 'creative']
  },
  {
    id: 'aisha_lawyer',
    name: 'Aisha - Corporate Lawyer',
    description: 'Busy lawyer who treats fitness like important meetings - non-negotiable',
    base_personality: {
      fitness_level: 'intermediate',
      primary_goals: ['stress_relief', 'strength'],
      workout_frequency: 4,
      communication_style: 'motivational',
      posting_personality: 'progress_focused',
      content_tone: 'competitive',
      social_engagement: 'medium',
      experience_sharing: 'advanced_techniques',
      mentoring_inclination: 'helper'
    },
    response_style: {
      message_response_delay_min: 900,
      message_response_delay_max: 3600,
      conversation_depth: 'moderate',
      asks_questions: 'sometimes',
      comment_length: 'medium'
    },
    posting_schedule: {
      preferred_hour: 6,
      posts_per_week: 3,
      workout_post_frequency: 2,
      educational_post_frequency: 1
    },
    sample_usernames: ['aisha_law', 'lawyer_aisha', 'aisha_advises'],
    avatar_style_keywords: ['professional', 'confident', 'business', 'determined']
  }
];

// Type guards
export const isAIUser = (user: any): boolean => {
  return user?.is_mock_user === true;
};

export const hasPersonalityTraits = (user: any): user is { personality_traits: PersonalityTraits } => {
  return user?.personality_traits && typeof user.personality_traits === 'object';
};

export const hasAIResponseStyle = (user: any): user is { ai_response_style: AIResponseStyle } => {
  return user?.ai_response_style && typeof user.ai_response_style === 'object';
};

// Backward compatibility - use diverse personalities as the new "archetypes"
export const AI_ARCHETYPES = DIVERSE_AI_PERSONALITIES;

// Utility functions
export const getArchetypeById = (id: string): AIArchetype | undefined => {
  return DIVERSE_AI_PERSONALITIES.find(archetype => archetype.id === id);
};

export const getRandomArchetype = (): AIArchetype => {
  return DIVERSE_AI_PERSONALITIES[Math.floor(Math.random() * DIVERSE_AI_PERSONALITIES.length)];
};

export const calculatePersonalityCompatibility = (
  traits1: PersonalityTraits,
  traits2: PersonalityTraits
): number => {
  let score = 0;
  let factors = 0;
  
  // Fitness level compatibility
  if (traits1.fitness_level && traits2.fitness_level) {
    if (traits1.fitness_level === traits2.fitness_level) score += 0.3;
    else if (Math.abs(
      ['beginner', 'intermediate', 'advanced'].indexOf(traits1.fitness_level) -
      ['beginner', 'intermediate', 'advanced'].indexOf(traits2.fitness_level)
    ) === 1) score += 0.2;
    factors++;
  }
  
  // Communication style compatibility
  if (traits1.communication_style && traits2.communication_style) {
    if (traits1.communication_style === traits2.communication_style) score += 0.3;
    factors++;
  }
  
  // Social engagement compatibility
  if (traits1.social_engagement && traits2.social_engagement) {
    if (traits1.social_engagement === traits2.social_engagement) score += 0.2;
    factors++;
  }
  
  // Goal alignment
  if (traits1.primary_goals && traits2.primary_goals) {
    const sharedGoals = traits1.primary_goals.filter(goal => 
      traits2.primary_goals?.includes(goal)
    );
    score += (sharedGoals.length / Math.max(traits1.primary_goals.length, traits2.primary_goals.length)) * 0.2;
    factors++;
  }
  
  return factors > 0 ? score / factors : 0;
};