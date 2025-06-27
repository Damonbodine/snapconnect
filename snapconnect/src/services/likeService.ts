import { supabase } from './supabase';

export interface LikeInteraction {
  id: string;
  user_id: string;
  post_id: string;
  interaction_type: 'like';
  created_at: string;
}

export interface PostLikeCounts {
  [postId: string]: number;
}

export interface PostLikeStates {
  [postId: string]: boolean;
}

class LikeService {
  // Like a post
  async likePost(postId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('user_interactions')
      .insert({
        user_id: user.id,
        post_id: postId,
        interaction_type: 'like'
      });

    if (error) {
      console.error('Failed to like post:', error);
      throw new Error('Failed to like post');
    }
  }

  // Unlike a post
  async unlikePost(postId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('user_interactions')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', postId)
      .eq('interaction_type', 'like');

    if (error) {
      console.error('Failed to unlike post:', error);
      throw new Error('Failed to unlike post');
    }
  }

  // Get like counts for multiple posts
  async getLikeCounts(postIds: string[]): Promise<PostLikeCounts> {
    if (postIds.length === 0) return {};

    const { data, error } = await supabase
      .from('user_interactions')
      .select('post_id')
      .in('post_id', postIds)
      .eq('interaction_type', 'like');

    if (error) {
      console.error('Failed to get like counts:', error);
      return {};
    }

    // Count likes per post
    const counts: PostLikeCounts = {};
    postIds.forEach(postId => {
      counts[postId] = data.filter(like => like.post_id === postId).length;
    });

    return counts;
  }

  // Get user's like states for multiple posts
  async getUserLikeStates(postIds: string[]): Promise<PostLikeStates> {
    if (postIds.length === 0) return {};

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {};
    }

    const { data, error } = await supabase
      .from('user_interactions')
      .select('post_id')
      .eq('user_id', user.id)
      .in('post_id', postIds)
      .eq('interaction_type', 'like');

    if (error) {
      console.error('Failed to get user like states:', error);
      return {};
    }

    // Create like state map
    const states: PostLikeStates = {};
    postIds.forEach(postId => {
      states[postId] = data.some(like => like.post_id === postId);
    });

    return states;
  }

  // Get liked posts for a user (for their profile)
  async getUserLikedPosts(userId: string, limit: number = 20, offset: number = 0) {
    const { data, error } = await supabase
      .from('user_interactions')
      .select(`
        post_id,
        created_at,
        posts (
          id,
          content,
          media_url,
          media_type,
          thumbnail_url,
          workout_type,
          created_at,
          user_id,
          users (
            id,
            username,
            avatar_url,
            fitness_level
          )
        )
      `)
      .eq('user_id', userId)
      .eq('interaction_type', 'like')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to get user liked posts:', error);
      throw new Error('Failed to get liked posts');
    }

    // Filter out null posts (in case post was deleted)
    return data.filter(like => like.posts !== null).map(like => like.posts);
  }

  // Real-time subscription for like changes on a post
  subscribeToPostLikes(postId: string, callback: (count: number) => void) {
    return supabase
      .channel(`post-likes-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_interactions',
          filter: `post_id=eq.${postId}`,
        },
        async () => {
          // Refetch like count when changes occur
          const counts = await this.getLikeCounts([postId]);
          callback(counts[postId] || 0);
        }
      )
      .subscribe();
  }
}

export const likeService = new LikeService();