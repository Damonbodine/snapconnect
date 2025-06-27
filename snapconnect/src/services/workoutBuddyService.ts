/**
 * Workout Buddy Service
 * Manages dynamic AI workout buddies with real-time status generation
 */

import { supabase } from './supabase';
import { openaiService } from './openaiService';
import { User } from '../types/user';
import { AIArchetype, PersonalityTraits } from '../types/aiPersonality';

export interface WorkoutBuddy {
  id: string;
  username: string;
  name: string;
  status: string;
  time: string;
  archetype: AIArchetype;
  personality: PersonalityTraits;
  avatar_url?: string;
}

export interface StatusGenerationRequest {
  personality: PersonalityTraits;
  archetype: AIArchetype;
  recentActivity?: string;
}

export class WorkoutBuddyService {
  private static instance: WorkoutBuddyService;
  private statusCache: Map<string, { status: string; generatedAt: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): WorkoutBuddyService {
    if (!WorkoutBuddyService.instance) {
      WorkoutBuddyService.instance = new WorkoutBuddyService();
    }
    return WorkoutBuddyService.instance;
  }

  /**
   * Get randomized AI workout buddies with dynamic statuses
   */
  async getWorkoutBuddies(limit: number = 6): Promise<WorkoutBuddy[]> {
    try {
      console.log('🤝 Fetching AI workout buddies...');

      // Fetch AI users from database
      const { data: aiUsers, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_mock_user', true)
        .not('personality_traits', 'is', null)
        .limit(limit * 2); // Fetch more to allow for randomization

      if (error) {
        console.error('❌ Failed to fetch AI users:', error);
        throw new Error('Failed to fetch AI users');
      }

      if (!aiUsers || aiUsers.length === 0) {
        console.warn('⚠️ No AI users found');
        return [];
      }

      // Randomize and select users
      const shuffledUsers = this.shuffleArray(aiUsers).slice(0, limit);

      // Generate workout buddies with dynamic statuses
      const buddies = await Promise.all(
        shuffledUsers.map(async (user) => {
          try {
            // Validate user object has required properties
            if (!user?.id || !user?.username) {
              console.warn('⚠️ Invalid user object:', user);
              return null;
            }

            // Create default archetype if missing
            const defaultArchetype: AIArchetype = {
              id: 'fitness_newbie',
              name: 'Fitness Newbie',
              description: 'Just starting their fitness journey',
              personality_base: {
                fitness_level: 'beginner',
                communication_style: 'friendly',
                content_tone: 'encouraging'
              }
            };

            const status = await this.generateWorkoutStatus(user);
            const timeAgo = this.generateRandomTimeAgo();

            return {
              id: user.id,
              username: user.username,
              name: user.full_name || user.username,
              status,
              time: timeAgo,
              archetype: user.ai_archetype || defaultArchetype,
              personality: user.personality_traits || {},
              avatar_url: user.avatar_url,
            };
          } catch (error) {
            console.error(`❌ Failed to generate status for user ${user?.id || 'unknown'}:`, error);
            
            // Only return fallback if user has minimum required data
            if (!user?.id || !user?.username) {
              return null;
            }

            // Create default archetype if missing
            const defaultArchetype: AIArchetype = {
              id: 'fitness_newbie',
              name: 'Fitness Newbie',
              description: 'Just starting their fitness journey',
              personality_base: {
                fitness_level: 'beginner',
                communication_style: 'friendly',
                content_tone: 'encouraging'
              }
            };

            // Return with fallback status
            return {
              id: user.id,
              username: user.username,
              name: user.full_name || user.username,
              status: this.getFallbackStatus(user.ai_archetype),
              time: this.generateRandomTimeAgo(),
              archetype: user.ai_archetype || defaultArchetype,
              personality: user.personality_traits || {},
              avatar_url: user.avatar_url,
            };
          }
        })
      );

      // Filter out null entries
      const validBuddies = buddies.filter((buddy): buddy is WorkoutBuddy => buddy !== null);

      console.log(`✅ Generated ${validBuddies.length} workout buddies`);
      return validBuddies;
    } catch (error) {
      console.error('❌ Failed to get workout buddies:', error);
      throw error;
    }
  }

  /**
   * Generate dynamic workout status using OpenAI
   */
  private async generateWorkoutStatus(user: User): Promise<string> {
    const cacheKey = user.id;
    const cached = this.statusCache.get(cacheKey);
    
    // Return cached status if still valid
    if (cached && Date.now() - cached.generatedAt < this.CACHE_DURATION) {
      return cached.status;
    }

    try {
      // Create default archetype if missing
      const defaultArchetype: AIArchetype = {
        id: 'fitness_newbie',
        name: 'Fitness Newbie',
        description: 'Just starting their fitness journey',
        personality_base: {
          fitness_level: 'beginner',
          communication_style: 'friendly',
          content_tone: 'encouraging'
        }
      };

      const archetype = user.ai_archetype || defaultArchetype;
      const personality = user.personality_traits || {
        fitness_level: 'beginner',
        communication_style: 'friendly',
        content_tone: 'encouraging',
        emoji_usage: 'moderate',
        preferred_workout_types: ['general_fitness']
      };

      const prompt = this.buildStatusPrompt(personality, archetype);
      
      const status = await openaiService.generateTextContent({
        prompt,
        personality,
        archetype,
        contentType: 'social',
        maxTokens: 50,
        temperature: 0.9, // Higher temperature for more variety
      });

      // Clean up the status (remove quotes, ensure it's concise)
      const cleanStatus = status
        .replace(/^["']|["']$/g, '') // Remove surrounding quotes
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .trim()
        .substring(0, 100); // Limit length

      // Cache the generated status
      this.statusCache.set(cacheKey, {
        status: cleanStatus,
        generatedAt: Date.now(),
      });

      return cleanStatus;
    } catch (error) {
      console.error(`❌ Failed to generate status for ${user.username}:`, error);
      return this.getFallbackStatus(user.ai_archetype);
    }
  }

  /**
   * Build prompt for workout status generation
   */
  private buildStatusPrompt(personality: PersonalityTraits, archetype: AIArchetype): string {
    const workoutActivities = [
      'just finished a workout',
      'completed a training session',
      'wrapped up gym time',
      'finished a run',
      'completed yoga practice',
      'finished strength training',
      'done with cardio session',
      'completed outdoor workout',
      'finished morning routine',
      'wrapped up fitness session',
    ];

    const activity = workoutActivities[Math.floor(Math.random() * workoutActivities.length)];
    
    return `You ${activity}. Write a brief, enthusiastic social media status update about your workout. 
    
    Keep it:
    - Under 100 characters
    - Authentic to your personality as a ${archetype.name}
    - Include 1-2 relevant emojis based on your emoji usage style: ${personality.emoji_usage}
    - Match your communication style: ${personality.communication_style}
    - Reflect your fitness focus: ${personality.preferred_workout_types?.join(', ')}
    
    Examples of good formats:
    - "Just crushed leg day! 💪 Feeling stronger every session"
    - "5K morning run complete 🏃‍♀️ Perfect way to start the day"
    - "Yoga flow session done 🧘‍♀️ Mind and body in harmony"
    
    Write only the status message, no quotes or extra text.`;
  }

  /**
   * Get fallback status based on archetype
   */
  private getFallbackStatus(archetype?: AIArchetype): string {
    const fallbacks = {
      fitness_newbie: 'Just finished my workout! 💪 Getting stronger every day',
      strength_warrior: 'Crushed another heavy lifting session 🏋️‍♂️ Iron therapy complete',
      cardio_queen: 'Morning run complete! 🏃‍♀️ Endorphins kicking in',
      zen_master: 'Yoga practice finished 🧘‍♀️ Finding balance in movement',
      outdoor_adventurer: 'Trail workout done! 🥾 Nature is the best gym',
    };

    const archetypeId = archetype?.id || 'fitness_newbie';
    return fallbacks[archetypeId as keyof typeof fallbacks] || fallbacks.fitness_newbie;
  }

  /**
   * Generate random time ago string
   */
  private generateRandomTimeAgo(): string {
    const timeOptions = [
      '1m ago', '2m ago', '3m ago', '5m ago', '8m ago', '12m ago', '15m ago',
      '18m ago', '22m ago', '25m ago', '30m ago', '35m ago', '42m ago', '45m ago',
      '52m ago', '58m ago', '1h ago', '1h 15m ago', '1h 30m ago', '1h 45m ago',
      '2h ago', '2h 30m ago', '3h ago', '4h ago', '5h ago',
    ];

    return timeOptions[Math.floor(Math.random() * timeOptions.length)];
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Clear status cache (useful for testing or manual refresh)
   */
  clearStatusCache(): void {
    this.statusCache.clear();
    console.log('🧹 Status cache cleared');
  }

  /**
   * Get cache stats (for debugging)
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.statusCache.size,
      entries: Array.from(this.statusCache.keys()),
    };
  }
}

// Export singleton instance
export const workoutBuddyService = WorkoutBuddyService.getInstance();