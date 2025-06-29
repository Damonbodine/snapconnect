/**
 * Group Service
 * Simple service for managing groups and memberships
 */

import { supabase } from './supabase';

export interface Group {
  id: string;
  name: string;
  description?: string;
  category: string;
  member_count: number;
  last_activity?: string;
  created_at: string;
  user_is_member: boolean;
}

export interface GroupMember {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  joined_at: string;
  is_ai_user: boolean;
}

export class GroupService {
  private static instance: GroupService;

  public static getInstance(): GroupService {
    if (!GroupService.instance) {
      GroupService.instance = new GroupService();
    }
    return GroupService.instance;
  }

  /**
   * Get all groups with member counts and user membership status
   */
  async getGroups(): Promise<Group[]> {
    try {
      console.log('🏠 Fetching groups...');

      const { data, error } = await supabase.rpc('get_groups_with_member_count');

      if (error) {
        console.error('❌ Failed to fetch groups:', error);
        throw new Error('Failed to fetch groups');
      }

      console.log(`✅ Fetched ${data?.length || 0} groups`);
      return data || [];
    } catch (error) {
      console.error('❌ Failed to get groups:', error);
      throw error;
    }
  }

  /**
   * Join a group
   */
  async joinGroup(groupId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`👥 Joining group ${groupId}...`);

      const { data, error } = await supabase.rpc('join_group', {
        group_id_param: groupId
      });

      if (error) {
        console.error('❌ Failed to join group:', error);
        throw new Error('Failed to join group');
      }

      console.log('✅ Successfully joined group');
      return data;
    } catch (error) {
      console.error('❌ Failed to join group:', error);
      throw error;
    }
  }

  /**
   * Get members of a specific group
   */
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    try {
      console.log(`👥 Fetching members for group ${groupId}...`);

      const { data, error } = await supabase.rpc('get_group_members', {
        group_id_param: groupId
      });

      if (error) {
        console.error('❌ Failed to fetch group members:', error);
        throw new Error('Failed to fetch group members');
      }

      console.log(`✅ Fetched ${data?.length || 0} group members`);
      return data || [];
    } catch (error) {
      console.error('❌ Failed to get group members:', error);
      throw error;
    }
  }

  /**
   * Get groups that the current user is a member of
   */
  async getUserGroups(): Promise<Group[]> {
    try {
      const groups = await this.getGroups();
      return groups.filter(group => group.user_is_member);
    } catch (error) {
      console.error('❌ Failed to get user groups:', error);
      throw error;
    }
  }

  /**
   * Check if user is member of a specific group
   */
  async isUserMemberOfGroup(groupId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('group_memberships')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      return !error && !!data;
    } catch (error) {
      console.error('❌ Failed to check group membership:', error);
      return false;
    }
  }
}

// Export singleton instance
export const groupService = GroupService.getInstance();