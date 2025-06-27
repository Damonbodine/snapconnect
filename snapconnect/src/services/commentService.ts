import { supabase } from './supabase';

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
}

export interface CommentWithUser extends Comment {
  username: string;
  full_name: string;
  avatar_url: string;
  fitness_level: 'beginner' | 'intermediate' | 'advanced';
}

export interface CreateCommentData {
  content: string;
}

export interface UpdateCommentData {
  content: string;
}

export class CommentService {
  private static instance: CommentService;

  public static getInstance(): CommentService {
    if (!CommentService.instance) {
      CommentService.instance = new CommentService();
    }
    return CommentService.instance;
  }

  /**
   * Get comments for a specific post
   */
  async getPostComments(
    postId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<CommentWithUser[]> {
    try {
      console.log('💬 Fetching comments for post:', postId);

      const { data, error } = await supabase.rpc('get_post_comments', {
        p_post_id: postId,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        console.error('💬 Error fetching comments:', error);
        throw new Error(`Failed to fetch comments: ${error.message}`);
      }

      console.log(`💬 Found ${data?.length || 0} comments`);
      
      return (data || []).map(comment => ({
        id: comment.id,
        post_id: postId,
        user_id: comment.user_id,
        content: comment.content,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        is_edited: comment.is_edited,
        username: comment.username,
        full_name: comment.full_name,
        avatar_url: comment.avatar_url,
        fitness_level: comment.fitness_level,
      })) as CommentWithUser[];
    } catch (error) {
      console.error('Error fetching post comments:', error);
      throw error;
    }
  }

  /**
   * Create a new comment on a post
   */
  async createComment(
    postId: string,
    commentData: CreateCommentData
  ): Promise<Comment> {
    try {
      console.log('💬 Creating comment on post:', postId);
      console.log('💬 Comment data:', commentData);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Validate content
      if (!commentData.content.trim()) {
        throw new Error('Comment content cannot be empty');
      }

      if (commentData.content.length > 500) {
        throw new Error('Comment content cannot exceed 500 characters');
      }

      const commentRecord = {
        post_id: postId,
        user_id: user.id,
        content: commentData.content.trim(),
      };

      console.log('💬 Inserting comment record:', commentRecord);

      const { data, error } = await supabase
        .from('comments')
        .insert(commentRecord)
        .select()
        .single();

      if (error) {
        console.error('💬 Database insert error:', error);
        throw new Error(`Failed to create comment: ${error.message}`);
      }

      console.log('💬 Comment created successfully:', data);
      return data as Comment;
    } catch (error) {
      console.error('💬 Error creating comment:', error);
      throw error;
    }
  }

  /**
   * Update an existing comment (only by the author)
   */
  async updateComment(
    commentId: string,
    commentData: UpdateCommentData
  ): Promise<Comment> {
    try {
      console.log('💬 Updating comment:', commentId);
      console.log('💬 Update data:', commentData);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Validate content
      if (!commentData.content.trim()) {
        throw new Error('Comment content cannot be empty');
      }

      if (commentData.content.length > 500) {
        throw new Error('Comment content cannot exceed 500 characters');
      }

      const { data, error } = await supabase
        .from('comments')
        .update({
          content: commentData.content.trim(),
        })
        .eq('id', commentId)
        .eq('user_id', user.id) // Ensure user owns the comment
        .select()
        .single();

      if (error) {
        console.error('💬 Database update error:', error);
        if (error.code === 'PGRST116') {
          throw new Error('Comment not found or you do not have permission to edit it');
        }
        throw new Error(`Failed to update comment: ${error.message}`);
      }

      console.log('💬 Comment updated successfully:', data);
      return data as Comment;
    } catch (error) {
      console.error('💬 Error updating comment:', error);
      throw error;
    }
  }

  /**
   * Delete a comment (by author or post owner)
   */
  async deleteComment(commentId: string): Promise<boolean> {
    try {
      console.log('💬 Deleting comment:', commentId);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) {
        console.error('💬 Database delete error:', error);
        if (error.code === 'PGRST116') {
          throw new Error('Comment not found or you do not have permission to delete it');
        }
        throw new Error(`Failed to delete comment: ${error.message}`);
      }

      console.log('💬 Comment deleted successfully');
      return true;
    } catch (error) {
      console.error('💬 Error deleting comment:', error);
      throw error;
    }
  }

  /**
   * Get comment counts for multiple posts
   */
  async getCommentCounts(postIds: string[]): Promise<Record<string, number>> {
    try {
      console.log('💬 Fetching comment counts for posts:', postIds.length);

      if (postIds.length === 0) {
        return {};
      }

      const { data, error } = await supabase.rpc('get_comment_counts', {
        p_post_ids: postIds,
      });

      if (error) {
        console.error('💬 Error fetching comment counts:', error);
        throw new Error(`Failed to fetch comment counts: ${error.message}`);
      }

      // Convert array result to object for easier lookup
      const countMap: Record<string, number> = {};
      (data || []).forEach((item: { post_id: string; comment_count: number }) => {
        countMap[item.post_id] = item.comment_count;
      });

      // Ensure all requested post IDs have a count (0 if no comments)
      postIds.forEach(postId => {
        if (!(postId in countMap)) {
          countMap[postId] = 0;
        }
      });

      console.log('💬 Comment counts fetched:', countMap);
      return countMap;
    } catch (error) {
      console.error('Error fetching comment counts:', error);
      throw error;
    }
  }

  /**
   * Subscribe to comments for a specific post
   */
  subscribeToPostComments(
    postId: string,
    onCommentAdded: (comment: Comment) => void,
    onCommentUpdated: (comment: Comment) => void,
    onCommentDeleted: (commentId: string) => void
  ) {
    console.log('💬 Subscribing to comments for post:', postId);

    const subscription = supabase
      .channel(`comments:${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          console.log('💬 New comment:', payload.new);
          onCommentAdded(payload.new as Comment);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          console.log('💬 Updated comment:', payload.new);
          onCommentUpdated(payload.new as Comment);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          console.log('💬 Deleted comment:', payload.old);
          onCommentDeleted(payload.old.id);
        }
      )
      .subscribe();

    return subscription;
  }

  /**
   * Check if user can edit a comment
   */
  async canEditComment(commentId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('comments')
        .select('user_id')
        .eq('id', commentId)
        .single();

      if (error || !data) return false;

      return data.user_id === user.id;
    } catch (error) {
      console.error('Error checking edit permission:', error);
      return false;
    }
  }

  /**
   * Check if user can delete a comment (comment author or post owner)
   */
  async canDeleteComment(commentId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('comments')
        .select(`
          user_id,
          posts!inner(user_id)
        `)
        .eq('id', commentId)
        .single();

      if (error || !data) return false;

      // Can delete if user is comment author or post owner
      return data.user_id === user.id || data.posts.user_id === user.id;
    } catch (error) {
      console.error('Error checking delete permission:', error);
      return false;
    }
  }
}

// Export singleton instance
export const commentService = CommentService.getInstance();