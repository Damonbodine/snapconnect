/**
 * AI Personality Service
 * Manages AI archetype selection, personality generation, and user compatibility
 */

import { 
  AIArchetype, 
  PersonalityTraits, 
  AIResponseStyle, 
  PostingSchedule,
  ConversationContext,
  AI_ARCHETYPES,
  getRandomArchetype,
  calculatePersonalityCompatibility
} from '../types/aiPersonality';

export class PersonalityService {
  private static instance: PersonalityService;

  public static getInstance(): PersonalityService {
    if (!PersonalityService.instance) {
      PersonalityService.instance = new PersonalityService();
    }
    return PersonalityService.instance;
  }

  /**
   * Generate a unique personality based on an archetype with variations
   */
  generatePersonalityFromArchetype(archetype: AIArchetype, variationSeed?: number): {
    personality_traits: PersonalityTraits;
    ai_response_style: AIResponseStyle;
    posting_schedule: PostingSchedule;
    conversation_context: ConversationContext;
  } {
    // Use variation seed for deterministic randomness
    const random = variationSeed ? this.seededRandom(variationSeed) : Math.random;
    
    // Start with base archetype and add variations
    const personality_traits: PersonalityTraits = {
      ...archetype.base_personality,
      // Add some personality variations
      workout_frequency: this.varyNumber(archetype.base_personality.workout_frequency || 4, 1, 7, random),
      content_length_preference: this.randomChoice(['brief', 'detailed', 'varied'], random),
      emoji_usage: this.weightedChoice({
        'high': archetype.base_personality.social_engagement === 'high' ? 0.6 : 0.2,
        'medium': 0.5,
        'low': archetype.base_personality.social_engagement === 'low' ? 0.6 : 0.3
      }, random),
      hashtag_style: this.randomChoice(['minimal', 'moderate', 'extensive'], random),
      commenting_frequency: archetype.base_personality.social_engagement,
      response_speed: this.randomChoice(['immediate', 'delayed', 'varied'], random),
      friendship_openness: this.randomChoice(['selective', 'moderate', 'open'], random),
      preferred_workout_types: this.selectPreferredWorkoutTypes(archetype, random)
    };

    const ai_response_style: AIResponseStyle = {
      ...archetype.response_style,
      // Add response variations
      initiates_conversations: random() > 0.5,
      shares_personal_experiences: this.randomChoice(['minimal', 'moderate', 'extensive'], random),
      comment_timing: this.randomChoice(['immediate', 'delayed', 'random'], random),
      engagement_triggers: this.generateEngagementTriggers(archetype, random)
    };

    const posting_schedule: PostingSchedule = {
      ...archetype.posting_schedule,
      // Add scheduling variations
      preferred_days: this.generatePreferredDays(random),
      milestone_posting: random() > 0.3,
      seasonal_adaptation: random() > 0.4,
      trending_topic_participation: personality_traits.social_engagement === 'high' ? random() > 0.3 : random() > 0.7,
      rest_days: this.generateRestDays(random),
      content_themes: this.generateContentThemes(archetype, random)
    };

    const conversation_context: ConversationContext = {
      recent_conversations: {},
      total_messages_sent: 0,
      total_messages_received: 0,
      most_common_topics: [],
      favorite_conversation_partners: [],
      successful_conversation_patterns: [],
      topics_to_avoid: [],
      personality_adjustments: {},
      last_context_update: new Date().toISOString()
    };

    return {
      personality_traits,
      ai_response_style,
      posting_schedule,
      conversation_context
    };
  }

  /**
   * Generate a unique username based on archetype and variations
   */
  generateUsername(archetype: AIArchetype, variationSeed?: number): string {
    const random = variationSeed ? this.seededRandom(variationSeed) : Math.random;
    const baseUsername = this.randomChoice(archetype.sample_usernames, random);
    
    // Add variations to make it unique
    const variations = [
      () => `${baseUsername}_${Math.floor(random() * 100)}`,
      () => `${baseUsername}_fit`,
      () => `${baseUsername}_${Math.floor(random() * 1000)}`,
      () => `${baseUsername}_pro`,
      () => `${baseUsername}_${this.randomChoice(['strong', 'fit', 'active', 'healthy'], random)}`,
      () => `${baseUsername}_2024`,
      () => `${baseUsername}_${this.randomChoice(['gym', 'fitness', 'workout', 'train'], random)}`
    ];

    return this.randomChoice(variations, random)();
  }

  /**
   * Generate realistic full name
   */
  generateFullName(archetype: AIArchetype, variationSeed?: number): string {
    const random = variationSeed ? this.seededRandom(variationSeed) : Math.random;
    
    const firstNames = {
      fitness_newbie: ['Lisa', 'Mike', 'Sarah', 'Jake', 'Emma', 'Chris'],
      strength_warrior: ['Alex', 'Marcus', 'Diana', 'Victor', 'Samantha', 'Troy'],
      cardio_queen: ['Rachel', 'Amy', 'Jessica', 'Megan', 'Kelly', 'Ashley'],
      zen_master: ['Zara', 'David', 'Maya', 'Kai', 'Lotus', 'Sage'],
      outdoor_adventurer: ['Tyler', 'Olivia', 'Hunter', 'Skylar', 'River', 'Aspen']
    };

    const lastNames = ['Johnson', 'Smith', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark'];

    const archFirstNames = firstNames[archetype.id as keyof typeof firstNames] || firstNames.fitness_newbie;
    const firstName = this.randomChoice(archFirstNames, random);
    const lastName = this.randomChoice(lastNames, random);

    return `${firstName} ${lastName}`;
  }

  /**
   * Generate avatar URL based on archetype style
   */
  generateAvatarUrl(archetype: AIArchetype, variationSeed?: number): string {
    const random = variationSeed ? this.seededRandom(variationSeed) : Math.random;
    
    // Use Unsplash with fitness-related search terms based on archetype
    const searchTerms = archetype.avatar_style_keywords.join(',');
    const width = 300;
    const height = 300;
    const randomId = Math.floor(random() * 1000);

    return `https://images.unsplash.com/${width}x${height}/?${searchTerms}&fit=crop&crop=face&sig=${randomId}`;
  }

  /**
   * Select compatible archetypes for bulk user generation
   */
  distributeArchetypes(totalUsers: number): { archetype: AIArchetype; count: number }[] {
    // Distribute users across archetypes with realistic proportions
    const distribution = {
      fitness_newbie: 0.25, // 25% beginners
      cardio_queen: 0.20,   // 20% cardio enthusiasts
      strength_warrior: 0.20, // 20% strength focused
      zen_master: 0.15,     // 15% mind-body
      outdoor_adventurer: 0.20 // 20% outdoor types
    };

    return AI_ARCHETYPES.map(archetype => ({
      archetype,
      count: Math.floor(totalUsers * (distribution[archetype.id as keyof typeof distribution] || 0))
    })).filter(item => item.count > 0);
  }

  /**
   * Calculate compatibility between user and AI archetype
   */
  calculateArchetypeCompatibility(userTraits: PersonalityTraits, archetype: AIArchetype): number {
    return calculatePersonalityCompatibility(userTraits, archetype.base_personality);
  }

  // Private helper methods
  private seededRandom(seed: number) {
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  private randomChoice<T>(array: T[], random: () => number = Math.random): T {
    return array[Math.floor(random() * array.length)];
  }

  private weightedChoice(weights: Record<string, number>, random: () => number = Math.random): string {
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    let randomValue = random() * total;
    
    for (const [choice, weight] of Object.entries(weights)) {
      randomValue -= weight;
      if (randomValue <= 0) return choice;
    }
    
    return Object.keys(weights)[0];
  }

  private varyNumber(base: number, min: number, max: number, random: () => number = Math.random): number {
    const variation = Math.floor(random() * 3) - 1; // -1, 0, or 1
    return Math.max(min, Math.min(max, base + variation));
  }

  private selectPreferredWorkoutTypes(archetype: AIArchetype, random: () => number = Math.random): string[] {
    const allTypes = ['strength', 'cardio', 'flexibility', 'outdoor', 'sports'];
    const archetypePreferences = {
      fitness_newbie: ['cardio', 'strength'],
      strength_warrior: ['strength', 'sports'],
      cardio_queen: ['cardio', 'outdoor'],
      zen_master: ['flexibility', 'outdoor'],
      outdoor_adventurer: ['outdoor', 'cardio', 'strength']
    };

    const baseTypes = archetypePreferences[archetype.id as keyof typeof archetypePreferences] || ['cardio'];
    
    // Sometimes add an extra type for variety
    if (random() > 0.6) {
      const additionalType = this.randomChoice(allTypes.filter(type => !baseTypes.includes(type)), random);
      return [...baseTypes, additionalType];
    }
    
    return baseTypes;
  }

  private generateEngagementTriggers(archetype: AIArchetype, random: () => number = Math.random): string[] {
    const allTriggers = ['progress_post', 'question_post', 'struggle_post', 'achievement_post', 'motivation_post', 'technique_post'];
    
    const archetypeTriggers = {
      fitness_newbie: ['question_post', 'struggle_post', 'motivation_post'],
      strength_warrior: ['progress_post', 'technique_post', 'achievement_post'],
      cardio_queen: ['achievement_post', 'motivation_post', 'progress_post'],
      zen_master: ['motivation_post', 'struggle_post'],
      outdoor_adventurer: ['achievement_post', 'progress_post', 'motivation_post']
    };

    return archetypeTriggers[archetype.id as keyof typeof archetypeTriggers] || ['motivation_post'];
  }

  private generatePreferredDays(random: () => number = Math.random): number[] {
    // Most people prefer weekdays for gym, weekends for outdoor activities
    const weekdays = [1, 2, 3, 4, 5]; // Monday-Friday
    const weekends = [0, 6]; // Sunday, Saturday
    
    if (random() > 0.7) {
      // Weekend warrior
      return weekends;
    } else if (random() > 0.3) {
      // Weekday regular
      return weekdays;
    } else {
      // Mixed schedule
      return [...weekdays, ...weekends];
    }
  }

  private generateRestDays(random: () => number = Math.random): number[] {
    // Everyone needs rest days
    const allDays = [0, 1, 2, 3, 4, 5, 6];
    const restDayCount = Math.floor(random() * 2) + 1; // 1-2 rest days
    
    const restDays: number[] = [];
    while (restDays.length < restDayCount) {
      const day = this.randomChoice(allDays, random);
      if (!restDays.includes(day)) {
        restDays.push(day);
      }
    }
    
    return restDays;
  }

  private generateContentThemes(archetype: AIArchetype, random: () => number = Math.random): Record<string, string> {
    const themes = {
      fitness_newbie: {
        1: 'Monday Motivation',
        3: 'Wednesday Workout',
        5: 'Friday Reflection'
      },
      strength_warrior: {
        1: 'Monday Muscle',
        3: 'Wednesday Wisdom',
        5: 'Friday Flex'
      },
      cardio_queen: {
        1: 'Monday Miles',
        3: 'Wednesday Workout',
        6: 'Saturday Adventure'
      },
      zen_master: {
        1: 'Mindful Monday',
        3: 'Wellness Wednesday',
        0: 'Sunday Serenity'
      },
      outdoor_adventurer: {
        0: 'Sunday Adventure',
        3: 'Wednesday Workout',
        6: 'Saturday Summit'
      }
    };

    return themes[archetype.id as keyof typeof themes] || {};
  }
}

// Export singleton instance
export const personalityService = PersonalityService.getInstance();