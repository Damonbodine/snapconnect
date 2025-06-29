import { supabase } from './supabase';

// Types for friendship-related data
export interface FriendshipStatus {
  status: 'none' | 'sent' | 'received' | 'friends' | 'blocked' | 'self';
}

export interface Friend {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  fitness_level: 'beginner' | 'intermediate' | 'advanced';
  created_at: string;
  friendship_id: string;
  friendship_created_at: string;
  is_mock_user?: boolean; // Flag to identify AI users
}

export interface FriendRequest {
  friendship_id: string;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  fitness_level: 'beginner' | 'intermediate' | 'advanced';
  request_date: string;
}

export interface SentRequest {
  friendship_id: string;
  friend_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  fitness_level: 'beginner' | 'intermediate' | 'advanced';
  request_date: string;
}

class FriendService {
  /**
   * Send a friend request to another user
   */
  async sendFriendRequest(friendId: string): Promise<string> {
    try {
      console.log('🤝 Sending friend request to:', friendId);
      
      const { data, error } = await supabase.rpc('send_friend_request', {
        friend_user_id: friendId
      });

      if (error) {
        console.error('❌ Error sending friend request:', error);
        throw new Error(error.message);
      }

      console.log('✅ Friend request sent successfully, ID:', data);
      return data;
    } catch (error: any) {
      console.error('❌ Error in sendFriendRequest:', error);
      throw error;
    }
  }

  /**
   * Accept a received friend request
   */
  async acceptFriendRequest(friendshipId: string): Promise<boolean> {
    try {
      console.log('✅ Accepting friend request:', friendshipId);
      
      const { data, error } = await supabase.rpc('accept_friend_request', {
        friendship_id: friendshipId
      });

      if (error) {
        console.error('❌ Error accepting friend request:', error);
        throw new Error(error.message);
      }

      console.log('✅ Friend request accepted successfully');
      return data;
    } catch (error: any) {
      console.error('❌ Error in acceptFriendRequest:', error);
      throw error;
    }
  }

  /**
   * Decline a received friend request or cancel a sent request
   */
  async declineFriendRequest(friendshipId: string): Promise<boolean> {
    try {
      console.log('❌ Declining friend request:', friendshipId);
      
      const { data, error } = await supabase.rpc('decline_friend_request', {
        friendship_id: friendshipId
      });

      if (error) {
        console.error('❌ Error declining friend request:', error);
        throw new Error(error.message);
      }

      console.log('✅ Friend request declined successfully');
      return data;
    } catch (error: any) {
      console.error('❌ Error in declineFriendRequest:', error);
      throw error;
    }
  }

  /**
   * Remove an existing friend (unfriend)
   */
  async removeFriend(friendId: string): Promise<boolean> {
    try {
      console.log('💔 Removing friend:', friendId);
      
      // Find the friendship ID first
      const { data: friendships, error: findError } = await supabase
        .from('friendships')
        .select('id')
        .or(`user_id.eq.${friendId},friend_id.eq.${friendId}`)
        .eq('status', 'accepted')
        .limit(1);

      if (findError) {
        console.error('❌ Error finding friendship:', findError);
        throw new Error('Failed to find friendship');
      }

      if (!friendships || friendships.length === 0) {
        throw new Error('Friendship not found');
      }

      // Use the decline function to remove the friendship
      return await this.declineFriendRequest(friendships[0].id);
    } catch (error: any) {
      console.error('❌ Error in removeFriend:', error);
      throw error;
    }
  }

  /**
   * Get friendship status with another user
   */
  async getFriendshipStatus(friendId: string): Promise<string> {
    try {
      console.log('🔍 Getting friendship status with:', friendId);
      
      const { data, error } = await supabase.rpc('get_friendship_status', {
        friend_user_id: friendId
      });

      if (error) {
        console.error('❌ Error getting friendship status:', error);
        throw new Error(error.message);
      }

      console.log('✅ Friendship status:', data);
      return data || 'none';
    } catch (error: any) {
      console.error('❌ Error in getFriendshipStatus:', error);
      throw error;
    }
  }

  /**
   * Get list of current user's friends
   */
  async getFriends(): Promise<Friend[]> {
    try {
      console.log('👥 Fetching friends list');
      
      const { data, error } = await supabase.rpc('get_friends_list');

      if (error) {
        console.error('❌ Error fetching friends:', error);
        throw new Error(error.message);
      }

      console.log('✅ Friends fetched:', data?.length || 0);
      return data || [];
    } catch (error: any) {
      console.error('❌ Error in getFriends:', error);
      throw error;
    }
  }

  /**
   * Get list of received friend requests (pending)
   */
  async getPendingRequests(): Promise<FriendRequest[]> {
    try {
      console.log('📬 Fetching pending friend requests');
      
      const { data, error } = await supabase.rpc('get_pending_requests');

      if (error) {
        console.error('❌ Error fetching pending requests:', error);
        throw new Error(error.message);
      }

      console.log('✅ Pending requests fetched:', data?.length || 0);
      return data || [];
    } catch (error: any) {
      console.error('❌ Error in getPendingRequests:', error);
      throw error;
    }
  }

  /**
   * Get list of sent friend requests (pending)
   */
  async getSentRequests(): Promise<SentRequest[]> {
    try {
      console.log('📤 Fetching sent friend requests');
      
      const { data, error } = await supabase.rpc('get_sent_requests');

      if (error) {
        console.error('❌ Error fetching sent requests:', error);
        throw new Error(error.message);
      }

      console.log('✅ Sent requests fetched:', data?.length || 0);
      return data || [];
    } catch (error: any) {
      console.error('❌ Error in getSentRequests:', error);
      throw error;
    }
  }

  /**
   * Get friends count for current user or specified user
   */
  async getFriendsCount(userId?: string): Promise<number> {
    try {
      console.log('🔢 Getting friends count for user:', userId || 'current user');
      
      const { data, error } = await supabase.rpc('get_friends_count', {
        target_user_id: userId || null
      });

      if (error) {
        console.error('❌ Error getting friends count:', error);
        throw new Error(error.message);
      }

      console.log('✅ Friends count:', data);
      return data || 0;
    } catch (error: any) {
      console.error('❌ Error in getFriendsCount:', error);
      throw error;
    }
  }

  /**
   * Get friends list for a specific user (public method)
   */
  async getUserFriends(userId: string): Promise<Friend[]> {
    try {
      console.log('👥 Fetching friends list for user:', userId);
      
      const { data, error } = await supabase.rpc('get_friends_list', {
        target_user_id: userId
      });

      if (error) {
        console.error('❌ Error fetching user friends:', error);
        throw new Error(error.message);
      }

      console.log('✅ User friends fetched:', data?.length || 0);
      return data || [];
    } catch (error: any) {
      console.error('❌ Error in getUserFriends:', error);
      throw error;
    }
  }

  /**
   * Search for potential friends by username
   */
  async searchUsers(query: string, limit: number = 10): Promise<any[]> {
    try {
      console.log('🔍 Searching users with query:', query);
      
      if (query.trim().length < 2) {
        return [];
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url, fitness_level')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(limit);

      if (error) {
        console.error('❌ Error searching users:', error);
        throw new Error(error.message);
      }

      console.log('✅ Search results:', data?.length || 0);
      return data || [];
    } catch (error: any) {
      console.error('❌ Error in searchUsers:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const friendService = new FriendService();
export default friendService;