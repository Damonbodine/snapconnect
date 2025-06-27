/**
 * Content Generation Service
 * Coordinates AI content generation for specific user IDs using their personalities
 * Manages the flow between user personality data and OpenAI content generation
 */

// Use server-side client in Node.js environment, regular client in React Native
const isNode = typeof window === 'undefined' && typeof process !== 'undefined';
const supabase = isNode 
  ? require('./supabase-server').supabaseServer 
  : require('./supabase').supabase;
import { openaiService, GeneratedContent } from './openaiService';
import { personalityService } from './personalityService';
import { PersonalityTraits, AIArchetype, AI_ARCHETYPES } from '../types/aiPersonality';
import { UserProfile, transformDatabaseUserToProfile } from '../types/user';

export interface ContentGenerationRequest {
  userId: string;
  contentType: 'workout_post' | 'progress_update' | 'motivation' | 'education' | 'social';
  forceGenerate?: boolean; // Override daily posting limits
}

export interface BotPersonalityData {
  userId: string;
  username: string;
  fullName: string;
  archetype: AIArchetype;
  personalityTraits: PersonalityTraits;
  postingSchedule: any;
  lastPostDate?: string;
}

export class ContentGenerationService {
  private static instance: ContentGenerationService;

  public static getInstance(): ContentGenerationService {
    if (!ContentGenerationService.instance) {
      ContentGenerationService.instance = new ContentGenerationService();
    }
    return ContentGenerationService.instance;
  }

  /**
   * Generate content for a specific AI user by their user ID
   */
  async generateContentForUser(request: ContentGenerationRequest): Promise<GeneratedContent> {
    try {
      console.log(`🎯 Generating ${request.contentType} for user ${request.userId}`);

      // Step 1: Load user personality data by user ID
      const botData = await this.loadBotPersonalityData(request.userId);
      if (!botData) {
        throw new Error(`Bot personality data not found for user ${request.userId}`);
      }

      console.log(`👤 Loaded bot: @${botData.username} (${botData.archetype.name})`);

      // Step 2: Check if user should post today (unless forced)
      if (!request.forceGenerate) {
        const canPost = await this.checkUserCanPost(request.userId);
        if (!canPost) {
          throw new Error(`User ${request.userId} has already posted today or is on rest day`);
        }
      }

      // Step 3: Generate content using OpenAI
      const generatedContent = await openaiService.generateCompletePost(
        request.userId,
        botData.personalityTraits,
        botData.archetype,
        request.contentType
      );

      console.log(`✅ Generated content for @${botData.username}: ${generatedContent.caption.substring(0, 50)}...`);

      return generatedContent;
    } catch (error) {
      console.error(`❌ Content generation failed for user ${request.userId}:`, error);
      throw error;
    }
  }

  /**
   * Generate content for multiple users in batch
   */
  async generateContentForUsers(requests: ContentGenerationRequest[]): Promise<{
    successful: GeneratedContent[];
    failed: { userId: string; error: string }[];
  }> {
    console.log(`🚀 Batch generating content for ${requests.length} users`);

    const successful: GeneratedContent[] = [];
    const failed: { userId: string; error: string }[] = [];

    // Process users sequentially to avoid overwhelming OpenAI API
    for (const request of requests) {
      try {
        const content = await this.generateContentForUser(request);
        successful.push(content);
        
        // Small delay between generations to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        failed.push({
          userId: request.userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`❌ Failed to generate content for ${request.userId}:`, error);
      }
    }

    console.log(`📊 Batch results: ${successful.length} successful, ${failed.length} failed`);
    return { successful, failed };
  }

  /**
   * Get users ready for posting based on their schedules
   */
  async getUsersReadyForPosting(targetHour?: number): Promise<ContentGenerationRequest[]> {
    try {
      const currentHour = targetHour || new Date().getHours();
      console.log(`🕐 Finding AI users ready to post at hour ${currentHour}`);

      // Query AI users who should post at this hour and haven't posted today
      const { data: readyUsers, error } = await supabase
        .from('users')
        .select(`
          id,
          username,
          posting_schedule,
          personality_traits
        `)
        .eq('is_mock_user', true)
        .or(
          `posting_schedule->preferred_hour.is.null,posting_schedule->preferred_hour.eq.${currentHour}`
        );

      if (error) {
        throw new Error(`Failed to fetch users ready for posting: ${error.message}`);
      }

      // Filter users who haven't posted today
      const requests: ContentGenerationRequest[] = [];
      
      for (const user of readyUsers || []) {
        const hasPostedToday = await this.hasUserPostedToday(user.id);
        if (!hasPostedToday) {
          // Determine content type based on user's posting schedule
          const contentType = this.selectContentTypeForUser(user);
          requests.push({
            userId: user.id,
            contentType,
          });
        }
      }

      console.log(`👥 Found ${requests.length} users ready to post`);
      return requests;
    } catch (error) {
      console.error('❌ Failed to get users ready for posting:', error);
      throw error;
    }
  }

  /**
   * Load bot personality data by user ID
   */
  private async loadBotPersonalityData(userId: string): Promise<BotPersonalityData | null> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('is_mock_user', true)
        .single();

      if (error || !user) {
        console.error(`User ${userId} not found or not an AI user:`, error);
        return null;
      }

      // Transform database user to profile
      const userProfile = transformDatabaseUserToProfile(user);

      // Find archetype based on personality traits
      const archetypeId = userProfile.personality_traits?.archetype || 
                         this.inferArchetypeFromUsername(user.username);
      
      const archetype = AI_ARCHETYPES.find(a => a.id === archetypeId);
      if (!archetype) {
        throw new Error(`Archetype ${archetypeId} not found for user ${userId}`);
      }

      return {
        userId: user.id,
        username: user.username,
        fullName: user.full_name || user.username,
        archetype,
        personalityTraits: userProfile.personality_traits || archetype.base_personality,
        postingSchedule: userProfile.posting_schedule || archetype.posting_schedule,
        lastPostDate: await this.getLastPostDate(userId),
      };
    } catch (error) {
      console.error(`Failed to load bot personality data for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Check if user can post today based on their schedule
   */
  private async checkUserCanPost(userId: string): Promise<boolean> {
    try {
      // Check if user has already posted today
      const hasPosted = await this.hasUserPostedToday(userId);
      if (hasPosted) {
        return false;
      }

      // Load user's posting schedule
      const { data: user, error } = await supabase
        .from('users')
        .select('posting_schedule')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return false;
      }

      const schedule = user.posting_schedule;
      if (!schedule) {
        return true; // No schedule restrictions
      }

      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

      // Check if today is a rest day
      if (schedule.rest_days && schedule.rest_days.includes(dayOfWeek)) {
        return false;
      }

      // Check if today is a preferred day (if specified)
      if (schedule.preferred_days && schedule.preferred_days.length > 0) {
        return schedule.preferred_days.includes(dayOfWeek);
      }

      return true;
    } catch (error) {
      console.error(`Failed to check if user ${userId} can post:`, error);
      return false;
    }
  }

  /**
   * Check if user has posted today
   */
  private async hasUserPostedToday(userId: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      const { data, error } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .limit(1);

      if (error) {
        console.error(`Failed to check posts for user ${userId}:`, error);
        return false;
      }

      return (data?.length || 0) > 0;
    } catch (error) {
      console.error(`Failed to check if user ${userId} posted today:`, error);
      return false;
    }
  }

  /**
   * Get last post date for user
   */
  private async getLastPostDate(userId: string): Promise<string | undefined> {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return undefined;
      }

      return data[0].created_at;
    } catch (error) {
      console.error(`Failed to get last post date for user ${userId}:`, error);
      return undefined;
    }
  }

  /**
   * Select content type for user based on their posting patterns
   */
  private selectContentTypeForUser(user: any): 'workout_post' | 'progress_update' | 'motivation' | 'education' | 'social' {
    const schedule = user.posting_schedule;
    
    if (!schedule) {
      return 'workout_post'; // Default
    }

    // Simple rotation based on day of week
    const dayOfWeek = new Date().getDay();
    const contentTypes: ('workout_post' | 'progress_update' | 'motivation' | 'education' | 'social')[] = [
      'motivation',     // Sunday
      'workout_post',   // Monday  
      'education',      // Tuesday
      'workout_post',   // Wednesday
      'social',         // Thursday
      'workout_post',   // Friday
      'progress_update' // Saturday
    ];

    return contentTypes[dayOfWeek] || 'workout_post';
  }

  /**
   * Infer archetype from username patterns
   */
  private inferArchetypeFromUsername(username: string): string {
    if (username.includes('iron_') || username.includes('strength_') || username.includes('barbell_') || username.includes('lift_')) {
      return 'strength_warrior';
    }
    if (username.includes('run_') || username.includes('cardio_') || username.includes('endurance_') || username.includes('heart_rate_')) {
      return 'cardio_queen';
    }
    if (username.includes('zen_') || username.includes('mindful_') || username.includes('yoga_') || username.includes('balance_')) {
      return 'zen_master';
    }
    if (username.includes('trail_') || username.includes('outdoor_') || username.includes('nature_') || username.includes('peak_')) {
      return 'outdoor_adventurer';
    }
    
    return 'fitness_newbie'; // Default
  }

  /**
   * Get statistics about content generation
   */
  async getContentGenerationStats(): Promise<{
    totalAIUsers: number;
    usersPostedToday: number;
    postsToday: number;
    archetypeBreakdown: Record<string, number>;
  }> {
    try {
      // Get total AI users
      const { data: aiUsers, error: usersError } = await supabase
        .from('users')
        .select('id, personality_traits')
        .eq('is_mock_user', true);

      if (usersError) {
        throw new Error(`Failed to get AI users: ${usersError.message}`);
      }

      const totalAIUsers = aiUsers?.length || 0;

      // Get posts today
      const today = new Date().toISOString().split('T')[0];
      const { data: postsToday, error: postsError } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          users!inner(is_mock_user)
        `)
        .eq('users.is_mock_user', true)
        .gte('created_at', `${today}T00:00:00.000Z`);

      if (postsError) {
        throw new Error(`Failed to get posts today: ${postsError.message}`);
      }

      const postsCount = postsToday?.length || 0;
      const uniqueUsers = new Set(postsToday?.map(p => p.user_id) || []);
      const usersPostedToday = uniqueUsers.size;

      // Archetype breakdown
      const archetypeBreakdown: Record<string, number> = {};
      aiUsers?.forEach(user => {
        const archetype = user.personality_traits?.archetype || 'unknown';
        archetypeBreakdown[archetype] = (archetypeBreakdown[archetype] || 0) + 1;
      });

      return {
        totalAIUsers,
        usersPostedToday,
        postsToday: postsCount,
        archetypeBreakdown,
      };
    } catch (error) {
      console.error('Failed to get content generation stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const contentGenerationService = ContentGenerationService.getInstance();