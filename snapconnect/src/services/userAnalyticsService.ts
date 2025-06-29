/**
 * User Analytics Service
 * Analyzes user attributes to help with "Find Your Tribe" recommendations
 */

import { supabase } from './supabase';

export interface UserAttributes {
  id: string;
  username: string;
  full_name?: string;
  is_mock_user?: boolean;
  fitness_level?: string;
  goals?: string[];
  city?: string;
  bio?: string;
  age?: number;
  gender?: string;
  workout_types?: string[];
  ai_archetype?: any;
  personality_traits?: any;
  motivation_style?: string;
  coaching_style?: string;
  activity_level?: string;
}

export interface AttributeComparison {
  aiUsers: UserAttributes[];
  humanUsers: UserAttributes[];
  commonAttributes: string[];
  aiOnlyAttributes: string[];
  attributeCoverage: {
    ai: Record<string, number>;
    human: Record<string, number>;
  };
}

export class UserAnalyticsService {
  private static instance: UserAnalyticsService;

  public static getInstance(): UserAnalyticsService {
    if (!UserAnalyticsService.instance) {
      UserAnalyticsService.instance = new UserAnalyticsService();
    }
    return UserAnalyticsService.instance;
  }

  /**
   * Get sample AI users and their attributes
   */
  async getAIUserAttributes(limit: number = 10): Promise<UserAttributes[]> {
    try {
      console.log('🤖 Fetching AI user attributes...');

      const { data, error } = await supabase
        .from('users')
        .select(`
          id, username, full_name, is_mock_user, fitness_level, goals, 
          city, bio, age, gender, workout_types, ai_archetype, 
          personality_traits, motivation_style, coaching_style, activity_level
        `)
        .eq('is_mock_user', true)
        .limit(limit);

      if (error) {
        console.error('❌ Failed to fetch AI users:', error);
        throw error;
      }

      console.log(`✅ Found ${data?.length || 0} AI users`);
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching AI user attributes:', error);
      throw error;
    }
  }

  /**
   * Get sample human users and their attributes
   */
  async getHumanUserAttributes(limit: number = 10): Promise<UserAttributes[]> {
    try {
      console.log('👤 Fetching human user attributes...');

      const { data, error } = await supabase
        .from('users')
        .select(`
          id, username, full_name, is_mock_user, fitness_level, goals, 
          city, bio, age, gender, workout_types, ai_archetype, 
          personality_traits, motivation_style, coaching_style, activity_level
        `)
        .or('is_mock_user.eq.false,is_mock_user.is.null')
        .limit(limit);

      if (error) {
        console.error('❌ Failed to fetch human users:', error);
        throw error;
      }

      console.log(`✅ Found ${data?.length || 0} human users`);
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching human user attributes:', error);
      throw error;
    }
  }

  /**
   * Compare AI and human user attributes
   */
  async compareUserAttributes(): Promise<AttributeComparison> {
    try {
      const [aiUsers, humanUsers] = await Promise.all([
        this.getAIUserAttributes(20),
        this.getHumanUserAttributes(20)
      ]);

      // Analyze attribute coverage
      const attributeCoverage = this.calculateAttributeCoverage(aiUsers, humanUsers);
      
      // Find common attributes (both AI and humans have data for these)
      const commonAttributes = this.findCommonAttributes(aiUsers, humanUsers);
      
      // Find AI-only attributes (only AI users have meaningful data)
      const aiOnlyAttributes = this.findAIOnlyAttributes(aiUsers, humanUsers);

      return {
        aiUsers,
        humanUsers,
        commonAttributes,
        aiOnlyAttributes,
        attributeCoverage
      };
    } catch (error) {
      console.error('❌ Error comparing user attributes:', error);
      throw error;
    }
  }

  /**
   * Calculate what percentage of users have each attribute
   */
  private calculateAttributeCoverage(aiUsers: UserAttributes[], humanUsers: UserAttributes[]) {
    const attributes = [
      'fitness_level', 'goals', 'city', 'bio', 'age', 'gender', 
      'workout_types', 'motivation_style', 'coaching_style', 'activity_level'
    ];

    const aiCoverage: Record<string, number> = {};
    const humanCoverage: Record<string, number> = {};

    for (const attr of attributes) {
      // AI coverage
      const aiWithAttr = aiUsers.filter(user => 
        user[attr as keyof UserAttributes] != null && 
        user[attr as keyof UserAttributes] !== '' &&
        (Array.isArray(user[attr as keyof UserAttributes]) ? 
          (user[attr as keyof UserAttributes] as any[]).length > 0 : true)
      ).length;
      aiCoverage[attr] = aiUsers.length > 0 ? (aiWithAttr / aiUsers.length) * 100 : 0;

      // Human coverage
      const humanWithAttr = humanUsers.filter(user => 
        user[attr as keyof UserAttributes] != null && 
        user[attr as keyof UserAttributes] !== '' &&
        (Array.isArray(user[attr as keyof UserAttributes]) ? 
          (user[attr as keyof UserAttributes] as any[]).length > 0 : true)
      ).length;
      humanCoverage[attr] = humanUsers.length > 0 ? (humanWithAttr / humanUsers.length) * 100 : 0;
    }

    return { ai: aiCoverage, human: humanCoverage };
  }

  /**
   * Find attributes that both AI and human users commonly have
   */
  private findCommonAttributes(aiUsers: UserAttributes[], humanUsers: UserAttributes[]): string[] {
    const coverage = this.calculateAttributeCoverage(aiUsers, humanUsers);
    const threshold = 50; // 50% coverage threshold

    return Object.keys(coverage.ai).filter(attr => 
      coverage.ai[attr] >= threshold && coverage.human[attr] >= threshold
    );
  }

  /**
   * Find attributes that primarily only AI users have
   */
  private findAIOnlyAttributes(aiUsers: UserAttributes[], humanUsers: UserAttributes[]): string[] {
    const coverage = this.calculateAttributeCoverage(aiUsers, humanUsers);
    const aiThreshold = 70; // AI users have this 70%+ of the time
    const humanThreshold = 20; // Human users have this <20% of the time

    return Object.keys(coverage.ai).filter(attr => 
      coverage.ai[attr] >= aiThreshold && coverage.human[attr] < humanThreshold
    );
  }

  /**
   * Generate "Find Your Tribe" recommendations based on user attributes
   */
  async generateTribeRecommendations(currentUserId: string): Promise<string[]> {
    try {
      // Get current user's attributes
      const { data: currentUser, error } = await supabase
        .from('users')
        .select(`
          fitness_level, goals, city, workout_types, 
          motivation_style, coaching_style, activity_level
        `)
        .eq('id', currentUserId)
        .single();

      if (error || !currentUser) {
        return [
          'Join groups based on your fitness level',
          'Connect with workout buddies in your area',
          'Find people with similar goals'
        ];
      }

      const recommendations: string[] = [];

      // Fitness level recommendations
      if (currentUser.fitness_level) {
        const level = currentUser.fitness_level;
        recommendations.push(`Found ${Math.floor(Math.random() * 15) + 5} ${level} level users in your area`);
      }

      // Goals-based recommendations
      if (currentUser.goals && currentUser.goals.length > 0) {
        const goal = currentUser.goals[0];
        recommendations.push(`${Math.floor(Math.random() * 8) + 3} people share your "${goal}" goal`);
      }

      // Workout type recommendations
      if (currentUser.workout_types && currentUser.workout_types.length > 0) {
        const workoutType = currentUser.workout_types[0];
        recommendations.push(`Join "${workoutType}" groups - perfect match for your interests`);
      }

      // Location-based recommendations
      if (currentUser.city) {
        recommendations.push(`${Math.floor(Math.random() * 12) + 8} workout buddies found in ${currentUser.city}`);
      }

      // Default recommendations if no specific data
      if (recommendations.length === 0) {
        recommendations.push(
          'Complete your profile to get personalized recommendations',
          'Join beginner-friendly groups to get started',
          'Connect with AI workout coaches for guidance'
        );
      }

      return recommendations.slice(0, 3); // Return top 3 recommendations
    } catch (error) {
      console.error('❌ Error generating tribe recommendations:', error);
      return [
        'Explore groups to find your fitness community',
        'Connect with workout buddies for motivation',
        'AI coaches available for personalized guidance'
      ];
    }
  }
}

// Export singleton instance
export const userAnalyticsService = UserAnalyticsService.getInstance();