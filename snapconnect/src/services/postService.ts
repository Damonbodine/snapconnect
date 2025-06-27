import { supabase } from './supabase';
import { mediaUploadService, UploadedMedia } from './mediaUploadService';
import { MediaFile } from '../types/media';
import { feedRankingService, ScoredPost } from './feedRankingService';

export interface CreatePostData {
  content: string;
  workoutType?: string;
  media?: MediaFile;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: 'photo' | 'video';
  thumbnail_url?: string; // Optimized thumbnail for feed display
  poster_url?: string;    // Video poster frame (future use)
  workout_type?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PostWithUser extends Post {
  users: {
    username: string;
    full_name: string;
    avatar_url: string;
    fitness_level: 'beginner' | 'intermediate' | 'advanced';
  };
}

export interface ViewRecord {
  postId: string;
  viewedAt: number;
  duration: number;
  viewPercentage?: number;
  deviceType: string;
  appVersion: string;
}

export class PostService {
  private static instance: PostService;

  public static getInstance(): PostService {
    if (!PostService.instance) {
      PostService.instance = new PostService();
    }
    return PostService.instance;
  }

  /**
   * Create a new post with optional media
   */
  async createPost(
    userId: string,
    postData: CreatePostData,
    onProgress?: (progress: number) => void
  ): Promise<Post> {
    try {
      console.log('📝 Creating post for user:', userId);
      console.log('📝 Post data:', postData);

      let uploadedMedia: UploadedMedia | null = null;

      // Upload media if provided
      if (postData.media) {
        console.log('📝 Uploading media...');
        onProgress?.(20);
        
        uploadedMedia = await mediaUploadService.uploadMedia(
          postData.media,
          userId,
          (uploadProgress) => {
            // Map upload progress to overall progress (20-80%)
            const mappedProgress = 20 + (uploadProgress.progress * 0.6);
            onProgress?.(mappedProgress);
          }
        );
        
        console.log('📝 Media uploaded:', uploadedMedia);
      }

      onProgress?.(80);

      // Set expiration time (24 hours from now for ephemeral content)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Insert post into database
      const postRecord = {
        user_id: userId,
        content: postData.content,
        media_url: uploadedMedia?.url,
        media_type: uploadedMedia?.mediaType,
        thumbnail_url: uploadedMedia?.thumbnailUrl, // Include thumbnail for unified display
        poster_url: uploadedMedia?.posterUrl,       // For future video enhancements
        workout_type: postData.workoutType,
        expires_at: expiresAt.toISOString(),
      };

      console.log('📝 Inserting post record:', postRecord);

      const { data, error } = await supabase
        .from('posts')
        .insert(postRecord)
        .select()
        .single();

      if (error) {
        console.error('📝 Database insert error:', error);
        throw new Error(`Failed to create post: ${error.message}`);
      }

      console.log('📝 Post created successfully:', data);
      onProgress?.(100);

      return data as Post;
    } catch (error) {
      console.error('📝 Error creating post:', error);
      throw error;
    }
  }

  /**
   * Get posts for a specific user
   */
  async getUserPosts(userId: string, limit: number = 20): Promise<Post[]> {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch user posts: ${error.message}`);
      }

      return data as Post[];
    } catch (error) {
      console.error('Error fetching user posts:', error);
      throw error;
    }
  }

  /**
   * Get recent posts for discover feed (legacy - use getUnviewedPosts instead)
   */
  async getDiscoverPosts(limit: number = 50): Promise<PostWithUser[]> {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          users (
            username,
            full_name,
            avatar_url,
            fitness_level
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch discover posts: ${error.message}`);
      }

      return data as PostWithUser[];
    } catch (error) {
      console.error('Error fetching discover posts:', error);
      throw error;
    }
  }

  /**
   * Get unviewed posts for a specific user (ephemeral discover feed)
   */
  async getUnviewedPosts(
    userId: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<PostWithUser[]> {
    try {
      console.log('🔍 Fetching unviewed posts for user:', userId);
      
      const { data, error } = await supabase.rpc('get_unviewed_posts', {
        p_user_id: userId,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        console.error('🔍 Error fetching unviewed posts:', error);
        throw new Error(`Failed to fetch unviewed posts: ${error.message}`);
      }

      console.log(`🔍 Found ${data?.length || 0} unviewed posts`);
      
      return (data || []).map(post => ({
        id: post.id,
        user_id: post.user_id,
        content: post.content,
        media_url: post.media_url,
        media_type: post.media_type,
        thumbnail_url: post.thumbnail_url, // Include thumbnail for unified display
        poster_url: post.poster_url,       // For future video enhancements
        workout_type: post.workout_type,
        created_at: post.created_at,
        updated_at: post.created_at, // Use created_at as fallback
        users: {
          username: post.username,
          full_name: post.full_name,
          avatar_url: post.avatar_url,
          fitness_level: post.fitness_level,
        },
      })) as PostWithUser[];
    } catch (error) {
      console.error('Error fetching unviewed posts:', error);
      throw error;
    }
  }

  /**
   * Get ranked unviewed posts for a specific user (algorithmic feed)
   */
  async getRankedUnviewedPosts(
    userId: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<ScoredPost[]> {
    try {
      console.log('🎯 Fetching ranked unviewed posts for user:', userId);
      
      // Fetch more posts than needed for ranking (typically 2-3x)
      const fetchLimit = Math.min(limit * 3, 100); // Fetch up to 3x for better ranking
      
      const { data, error } = await supabase.rpc('get_unviewed_posts', {
        p_user_id: userId,
        p_limit: fetchLimit,
        p_offset: offset,
      });

      if (error) {
        console.error('🎯 Error fetching posts for ranking:', error);
        throw new Error(`Failed to fetch posts for ranking: ${error.message}`);
      }

      const rawPosts = (data || []).map(post => ({
        id: post.id,
        user_id: post.user_id,
        content: post.content,
        media_url: post.media_url,
        media_type: post.media_type,
        thumbnail_url: post.thumbnail_url,
        poster_url: post.poster_url,
        workout_type: post.workout_type,
        created_at: post.created_at,
        updated_at: post.created_at,
        users: {
          username: post.username,
          full_name: post.full_name,
          avatar_url: post.avatar_url,
          fitness_level: post.fitness_level,
        },
      })) as PostWithUser[];

      console.log(`🎯 Ranking ${rawPosts.length} posts for user ${userId}`);

      // Apply algorithmic ranking
      const rankedPosts = await feedRankingService.rankPosts(rawPosts, userId);
      
      // Return only the requested limit
      const finalPosts = rankedPosts.slice(0, limit);
      
      console.log(`🎯 Returning top ${finalPosts.length} ranked posts`);
      
      return finalPosts;
    } catch (error) {
      console.error('Error fetching ranked posts:', error);
      // Fallback to regular unviewed posts
      const fallbackPosts = await this.getUnviewedPosts(userId, limit, offset);
      return fallbackPosts.map(post => ({
        ...post,
        rankingScore: 0.5,
        rankingFactors: {
          fitnessLevelMatch: 0.5,
          workoutTypePreference: 0.5,
          likesScore: 0,
          commentsScore: 0,
          viewDurationScore: 0,
          friendshipBoost: 0,
          mutualConnectionsScore: 0,
          recencyScore: 0.5,
          timeOfDayMatch: 0.5,
          mediaQualityScore: 0.5,
          contentLengthScore: 0.5,
          diversityBoost: 0,
        },
      }));
    }
  }

  /**
   * Mark a single post as viewed
   */
  async markPostAsViewed(
    userId: string,
    postId: string,
    duration: number = 2000,
    viewPercentage: number = 100,
    deviceType: string = 'unknown',
    appVersion: string = '1.0.0'
  ): Promise<void> {
    try {
      console.log('👁️ Marking post as viewed:', { userId, postId, duration });

      const { error } = await supabase
        .from('post_views')
        .insert({
          user_id: userId,
          post_id: postId,
          view_duration: duration,
          view_percentage: viewPercentage,
          device_type: deviceType,
          app_version: appVersion,
        });

      if (error) {
        // Ignore duplicate key errors (already viewed)
        if (error.code !== '23505') {
          console.error('👁️ Error marking post as viewed:', error);
          throw new Error(`Failed to mark post as viewed: ${error.message}`);
        }
      }

      console.log('👁️ Post marked as viewed successfully');
    } catch (error) {
      console.error('Error marking post as viewed:', error);
      throw error;
    }
  }

  /**
   * Batch mark multiple posts as viewed
   */
  async batchMarkViewed(viewRecords: ViewRecord[]): Promise<void> {
    try {
      console.log('👁️ Batch marking posts as viewed:', viewRecords.length);

      if (viewRecords.length === 0) return;

      // Get current user ID (assuming first record has valid user context)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase.rpc('batch_mark_viewed', {
        p_user_id: user.id,
        p_view_records: viewRecords,
      });

      if (error) {
        console.error('👁️ Error batch marking posts as viewed:', error);
        throw new Error(`Failed to batch mark posts as viewed: ${error.message}`);
      }

      console.log('👁️ Batch marking completed successfully');
    } catch (error) {
      console.error('Error batch marking posts as viewed:', error);
      throw error;
    }
  }

  /**
   * Get user's viewing statistics
   */
  async getUserViewingStats(userId: string): Promise<{
    totalViewed: number;
    viewedToday: number;
    averageViewDuration: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('post_views')
        .select('view_duration, viewed_at')
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to fetch viewing stats: ${error.message}`);
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const viewedToday = data.filter(view => 
        new Date(view.viewed_at) >= today
      ).length;

      const totalViewed = data.length;
      const averageViewDuration = totalViewed > 0 
        ? data.reduce((sum, view) => sum + (view.view_duration || 0), 0) / totalViewed
        : 0;

      return {
        totalViewed,
        viewedToday,
        averageViewDuration,
      };
    } catch (error) {
      console.error('Error fetching viewing stats:', error);
      throw error;
    }
  }

  /**
   * Delete a post (and its media)
   */
  async deletePost(postId: string, userId: string): Promise<boolean> {
    try {
      // First get the post to check ownership and get media URL
      const { data: post, error: fetchError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .eq('user_id', userId) // Ensure user owns the post
        .single();

      if (fetchError || !post) {
        throw new Error('Post not found or unauthorized');
      }

      // Delete media from storage if it exists
      if (post.media_url) {
        try {
          // Extract file path from URL
          const url = new URL(post.media_url);
          const filePath = url.pathname.split('/').pop();
          if (filePath) {
            await mediaUploadService.deleteMedia(`${userId}/${filePath}`);
          }
        } catch (mediaError) {
          console.warn('Failed to delete media file:', mediaError);
          // Continue with post deletion even if media deletion fails
        }
      }

      // Delete post from database
      const { error: deleteError } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', userId);

      if (deleteError) {
        throw new Error(`Failed to delete post: ${deleteError.message}`);
      }

      return true;
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  /**
   * Update post content
   */
  async updatePost(
    postId: string,
    userId: string,
    updates: Partial<Pick<Post, 'content' | 'workout_type'>>
  ): Promise<Post> {
    try {
      const { data, error } = await supabase
        .from('posts')
        .update(updates)
        .eq('id', postId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update post: ${error.message}`);
      }

      return data as Post;
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }

  /**
   * Get post by ID
   */
  async getPost(postId: string): Promise<Post | null> {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Post not found
        }
        throw new Error(`Failed to fetch post: ${error.message}`);
      }

      return data as Post;
    } catch (error) {
      console.error('Error fetching post:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const postService = PostService.getInstance();