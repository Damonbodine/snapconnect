/**
 * Discover Users Service
 * Gets all users (AI and human) that the current user isn't friends with
 */

import { supabase } from './supabase';

export interface DiscoverableUser {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  fitness_level?: string;
  bio?: string;
  is_ai_user: boolean;
}

export class DiscoverUsersService {
  private static instance: DiscoverUsersService;

  public static getInstance(): DiscoverUsersService {
    if (!DiscoverUsersService.instance) {
      DiscoverUsersService.instance = new DiscoverUsersService();
    }
    return DiscoverUsersService.instance;
  }

  /**
   * Get all users that the current user can discover (not friends with)
   */
  async getDiscoverableUsers(currentUserId: string, limit: number = 20): Promise<DiscoverableUser[]> {
    try {
      console.log('🔍 Fetching discoverable users for:', currentUserId);

      // Get users that are NOT the current user and NOT already friends
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, username, full_name, avatar_url, fitness_level, bio, is_mock_user
        `)
        .neq('id', currentUserId) // Not the current user
        .not('id', 'in', `(
          SELECT CASE 
            WHEN user_id = '${currentUserId}' THEN friend_id 
            WHEN friend_id = '${currentUserId}' THEN user_id 
          END
          FROM friendships 
          WHERE (user_id = '${currentUserId}' OR friend_id = '${currentUserId}') 
          AND status = 'accepted'
        )`)
        .limit(limit);

      if (error) {
        console.error('❌ Failed to fetch discoverable users:', error);
        throw error;
      }

      // Transform the data to include is_ai_user flag
      const transformedUsers: DiscoverableUser[] = (data || []).map(user => ({
        ...user,
        is_ai_user: user.is_mock_user || false
      }));

      console.log(`✅ Found ${transformedUsers.length} discoverable users`);
      return transformedUsers;
    } catch (error) {
      console.error('❌ Error fetching discoverable users:', error);
      throw error;
    }
  }

  /**
   * Get a simpler version that doesn't check friendships (fallback)
   */
  async getAllUsersExceptCurrent(currentUserId: string, limit: number = 20): Promise<DiscoverableUser[]> {
    try {
      console.log('🔍 Fetching all users except current for:', currentUserId);

      const { data, error } = await supabase
        .from('users')
        .select(`
          id, username, full_name, avatar_url, fitness_level, bio, is_mock_user
        `)
        .neq('id', currentUserId)
        .limit(limit);

      if (error) {
        console.error('❌ Failed to fetch users:', error);
        throw error;
      }

      // Transform the data
      const transformedUsers: DiscoverableUser[] = (data || []).map(user => ({
        ...user,
        is_ai_user: user.is_mock_user || false
      }));

      console.log(`✅ Found ${transformedUsers.length} total users`);
      return transformedUsers;
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const discoverUsersService = DiscoverUsersService.getInstance();