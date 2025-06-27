/**
 * AI Posting Service
 * Handles automated posting for AI users including image storage and post creation
 * Converts generated content into actual posts in the database
 */

// Use server-side client in Node.js environment, regular client in React Native
const isNode = typeof window === 'undefined' && typeof process !== 'undefined';
const supabase = isNode 
  ? require('./supabase-server').supabaseServer() 
  : require('./supabase').supabase;
import { contentGenerationService, ContentGenerationRequest } from './contentGenerationService';
import { GeneratedContent } from './openaiService';

export interface PostCreationResult {
  success: boolean;
  postId?: string;
  userId: string;
  username?: string;
  error?: string;
}

export interface DailyPostingResult {
  totalUsers: number;
  successfulPosts: PostCreationResult[];
  failedPosts: PostCreationResult[];
  skippedUsers: string[];
}

export class AIPostingService {
  private static instance: AIPostingService;

  public static getInstance(): AIPostingService {
    if (!AIPostingService.instance) {
      AIPostingService.instance = new AIPostingService();
    }
    return AIPostingService.instance;
  }

  /**
   * Create a post for a specific AI user with generated content
   */
  async createPostForUser(
    userId: string,
    contentType: 'workout_post' | 'progress_update' | 'motivation' | 'education' | 'social',
    forceGenerate: boolean = false
  ): Promise<PostCreationResult> {
    try {
      console.log(`📝 Creating ${contentType} post for user ${userId}`);

      // Step 1: Generate content for the user
      const request: ContentGenerationRequest = {
        userId,
        contentType,
        forceGenerate,
      };

      const generatedContent = await contentGenerationService.generateContentForUser(request);

      // Step 2: Upload image to Supabase storage
      const mediaUrl = await this.uploadImageToStorage(
        generatedContent.imageBase64,
        userId,
        contentType
      );

      // Step 3: Create post in database
      const postId = await this.createPostInDatabase(
        userId,
        generatedContent.caption,
        mediaUrl,
        contentType
      );

      // Step 4: Get username for logging
      const username = await this.getUsernameById(userId);

      console.log(`✅ Created post ${postId} for @${username}`);

      return {
        success: true,
        postId,
        userId,
        username,
      };
    } catch (error) {
      const username = await this.getUsernameById(userId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ Failed to create post for @${username} (${userId}):`, errorMessage);

      return {
        success: false,
        userId,
        username,
        error: errorMessage,
      };
    }
  }

  /**
   * Run daily posting for all AI users ready to post
   */
  async runDailyPosting(targetHour?: number): Promise<DailyPostingResult> {
    try {
      console.log('🚀 Starting daily AI posting run...');

      // Step 1: Get users ready for posting
      const postingRequests = await contentGenerationService.getUsersReadyForPosting(targetHour);
      
      if (postingRequests.length === 0) {
        console.log('📭 No users ready for posting at this time');
        return {
          totalUsers: 0,
          successfulPosts: [],
          failedPosts: [],
          skippedUsers: [],
        };
      }

      console.log(`👥 Found ${postingRequests.length} users ready to post`);

      // Step 2: Process posts in batches to avoid overwhelming the system
      const batchSize = 5;
      const successfulPosts: PostCreationResult[] = [];
      const failedPosts: PostCreationResult[] = [];

      for (let i = 0; i < postingRequests.length; i += batchSize) {
        const batch = postingRequests.slice(i, i + batchSize);
        console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(postingRequests.length / batchSize)}`);

        // Process batch in parallel
        const batchPromises = batch.map(request => 
          this.createPostForUser(request.userId, request.contentType)
        );

        const batchResults = await Promise.all(batchPromises);

        // Categorize results
        batchResults.forEach(result => {
          if (result.success) {
            successfulPosts.push(result);
          } else {
            failedPosts.push(result);
          }
        });

        // Delay between batches to respect rate limits
        if (i + batchSize < postingRequests.length) {
          console.log('⏱️ Waiting 5 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      const result: DailyPostingResult = {
        totalUsers: postingRequests.length,
        successfulPosts,
        failedPosts,
        skippedUsers: [], // We handle skipping in getUsersReadyForPosting
      };

      console.log(`📊 Daily posting complete: ${successfulPosts.length} successful, ${failedPosts.length} failed`);

      return result;
    } catch (error) {
      console.error('❌ Daily posting run failed:', error);
      throw error;
    }
  }

  /**
   * Create posts for specific user IDs (for testing or manual runs)
   */
  async createPostsForUsers(
    userIds: string[],
    contentType: 'workout_post' | 'progress_update' | 'motivation' | 'education' | 'social' = 'workout_post',
    forceGenerate: boolean = true
  ): Promise<PostCreationResult[]> {
    console.log(`🎯 Creating ${contentType} posts for ${userIds.length} specific users`);

    const results: PostCreationResult[] = [];

    // Process users sequentially to avoid rate limiting
    for (const userId of userIds) {
      try {
        const result = await this.createPostForUser(userId, contentType, forceGenerate);
        results.push(result);
        
        // Small delay between posts
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        results.push({
          success: false,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    console.log(`📊 Batch complete: ${successful}/${userIds.length} successful`);

    return results;
  }

  /**
   * Upload base64 image to Supabase storage
   */
  private async uploadImageToStorage(
    imageBase64: string,
    userId: string,
    contentType: string
  ): Promise<string> {
    try {
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `ai-generated/${userId}/${contentType}-${timestamp}.png`;

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('posts-media')
        .upload(filename, imageBuffer, {
          contentType: 'image/png',
          cacheControl: '3600',
        });

      if (error) {
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('posts-media')
        .getPublicUrl(filename);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Failed to upload image to storage:', error);
      throw error;
    }
  }

  /**
   * Create post record in database
   */
  private async createPostInDatabase(
    userId: string,
    content: string,
    mediaUrl: string,
    workoutType: string
  ): Promise<string> {
    try {
      // Set expiry to 24 hours from now (matching the ephemeral system)
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() + 24);

      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          content,
          media_url: mediaUrl,
          media_type: 'photo',
          workout_type: workoutType,
          expires_at: expiryTime.toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      console.error('Failed to create post in database:', error);
      throw error;
    }
  }

  /**
   * Get username by user ID for logging
   */
  private async getUsernameById(userId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return `user_${userId.substring(0, 8)}`;
      }

      return data.username;
    } catch (error) {
      return `user_${userId.substring(0, 8)}`;
    }
  }

  /**
   * Get posting statistics for monitoring
   */
  async getPostingStats(): Promise<{
    todayStats: {
      totalPosts: number;
      aiPosts: number;
      realPosts: number;
    };
    aiUserStats: {
      totalAIUsers: number;
      usersPostedToday: number;
      averagePostsPerUser: number;
    };
    archetypeStats: Record<string, {
      users: number;
      postsToday: number;
    }>;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get today's posts
      const { data: todayPosts, error: postsError } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          users!inner(is_mock_user, personality_traits)
        `)
        .gte('created_at', `${today}T00:00:00.000Z`);

      if (postsError) {
        throw new Error(`Failed to get today's posts: ${postsError.message}`);
      }

      const totalPosts = todayPosts?.length || 0;
      const aiPosts = todayPosts?.filter(p => p.users.is_mock_user)?.length || 0;
      const realPosts = totalPosts - aiPosts;

      // Get AI user stats
      const { data: aiUsers, error: usersError } = await supabase
        .from('users')
        .select('id, personality_traits')
        .eq('is_mock_user', true);

      if (usersError) {
        throw new Error(`Failed to get AI users: ${usersError.message}`);
      }

      const totalAIUsers = aiUsers?.length || 0;
      const aiUserIds = new Set(todayPosts?.filter(p => p.users.is_mock_user).map(p => p.user_id) || []);
      const usersPostedToday = aiUserIds.size;
      const averagePostsPerUser = usersPostedToday > 0 ? aiPosts / usersPostedToday : 0;

      // Archetype stats
      const archetypeStats: Record<string, { users: number; postsToday: number }> = {};
      
      // Count users per archetype
      aiUsers?.forEach(user => {
        const archetype = user.personality_traits?.archetype || 'unknown';
        if (!archetypeStats[archetype]) {
          archetypeStats[archetype] = { users: 0, postsToday: 0 };
        }
        archetypeStats[archetype].users++;
      });

      // Count posts per archetype today
      todayPosts?.filter(p => p.users.is_mock_user).forEach(post => {
        const archetype = post.users.personality_traits?.archetype || 'unknown';
        if (archetypeStats[archetype]) {
          archetypeStats[archetype].postsToday++;
        }
      });

      return {
        todayStats: {
          totalPosts,
          aiPosts,
          realPosts,
        },
        aiUserStats: {
          totalAIUsers,
          usersPostedToday,
          averagePostsPerUser: Math.round(averagePostsPerUser * 100) / 100,
        },
        archetypeStats,
      };
    } catch (error) {
      console.error('Failed to get posting stats:', error);
      throw error;
    }
  }

  /**
   * Clean up old AI posts (for maintenance)
   */
  async cleanupExpiredPosts(): Promise<number> {
    try {
      console.log('🧹 Cleaning up expired AI posts...');

      const { data, error } = await supabase
        .from('posts')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        throw new Error(`Failed to cleanup expired posts: ${error.message}`);
      }

      const deletedCount = data?.length || 0;
      console.log(`✅ Cleaned up ${deletedCount} expired posts`);

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup expired posts:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const aiPostingService = AIPostingService.getInstance();