import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { GradientCard } from '../components/ui/GradientCard';
import { GlassCard } from '../components/ui/GlassCard';
import { AppHeader } from '../components/ui/AppHeader';
import { useAuthStore } from '../stores/authStore';
import { workoutNotesService, WorkoutNote } from '../services/workoutNotesService';
import { AddWorkoutNoteModal } from '../components/workout/AddWorkoutNoteModal';
import { workoutBuddyService, WorkoutBuddy } from '../services/workoutBuddyService';
import { groupService, Group } from '../services/groupService';
import { GroupMembersModal } from '../components/groups/GroupMembersModal';
import { discoverUsersService, DiscoverableUser } from '../services/discoverUsersService';
import { supabase } from '../services/supabase';

export const CliqueScreen = () => {
  const { user } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);
  const [workoutNotes, setWorkoutNotes] = useState<WorkoutNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [workoutBuddies, setWorkoutBuddies] = useState<WorkoutBuddy[]>([]);
  const [buddiesLoading, setBuddiesLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [discoverableUsers, setDiscoverableUsers] = useState<DiscoverableUser[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  // Fetch workout notes, buddies, groups, and discoverable users when user is available
  useEffect(() => {
    if (user) {
      fetchWorkoutNotes();
      fetchWorkoutBuddies();
      fetchGroups();
      fetchDiscoverableUsers();
    }
  }, [user]);

  const fetchWorkoutNotes = async () => {
    try {
      setNotesLoading(true);
      const notes = await workoutNotesService.getUserNotes(10);
      setWorkoutNotes(notes);
    } catch (error) {
      console.error('Failed to fetch workout notes:', error);
    } finally {
      setNotesLoading(false);
    }
  };

  const fetchWorkoutBuddies = async () => {
    try {
      setBuddiesLoading(true);
      const buddies = await workoutBuddyService.getWorkoutBuddies(6);
      setWorkoutBuddies(buddies);
    } catch (error) {
      console.error('Failed to fetch workout buddies:', error);
    } finally {
      setBuddiesLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      setGroupsLoading(true);
      const groupsData = await groupService.getGroups();
      setGroups(groupsData);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    } finally {
      setGroupsLoading(false);
    }
  };

  const fetchDiscoverableUsers = async () => {
    if (!user?.id) {
      console.log('❌ No user ID available for discoverable users');
      return;
    }
    
    try {
      console.log('🔍 Fetching discoverable users for:', user.id);
      setDiscoverLoading(true);
      
      // Try to get users excluding friends first, fallback to all users
      let users: DiscoverableUser[] = [];
      try {
        users = await discoverUsersService.getDiscoverableUsers(user.id, 6);
      } catch (friendshipError) {
        console.log('⚠️ Friendship query failed, falling back to all users');
        users = await discoverUsersService.getAllUsersExceptCurrent(user.id, 6);
      }
      
      setDiscoverableUsers(users);
      console.log('✅ Found discoverable users:', users.length);
    } catch (error) {
      console.error('❌ Failed to fetch discoverable users:', error);
      setDiscoverableUsers([]);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchWorkoutNotes(),
      fetchWorkoutBuddies(),
      fetchGroups(),
      fetchDiscoverableUsers(),
    ]);
    setRefreshing(false);
  };



  const handleAddNote = () => {
    setShowAddNoteModal(true);
  };

  const handleNoteAdded = () => {
    // Refresh the notes feed
    fetchWorkoutNotes();
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await workoutNotesService.deleteNote(noteId);
      // Refresh the notes feed
      fetchWorkoutNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleBuddyPress = (buddy: WorkoutBuddy) => {
    console.log('Navigating to workout buddy profile:', buddy.username);
    router.push(`/user/${buddy.id}`);
  };

  const handleGroupPress = async (group: Group) => {
    if (group.user_is_member) {
      // Show group members
      setSelectedGroup(group);
      setShowGroupMembers(true);
    } else {
      try {
        await groupService.joinGroup(group.id);
        console.log('Joined group:', group.name);
        // Refresh groups to update membership status
        fetchGroups();
      } catch (error) {
        console.error('Failed to join group:', error);
      }
    }
  };

  const handleDiscoverableUserPress = (discoverableUser: DiscoverableUser) => {
    console.log('Navigating to discoverable user profile:', discoverableUser.username);
    router.push(`/user/${discoverableUser.id}`);
  };


  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F2937']}
      className="flex-1"
    >
      <SafeAreaView className="flex-1">
        <AppHeader title="Clique" />
        
        <ScrollView 
          className="flex-1 px-4 pb-24"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#ffffff"
            />
          }
        >
        <View className="mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white text-lg font-semibold">
              📝 My Workout Notes
            </Text>
            <Pressable
              onPress={handleAddNote}
              className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 rounded-full"
            >
              <Text className="text-white font-bold text-sm">+ Add Note</Text>
            </Pressable>
          </View>
          
          {notesLoading && (
            <View className="items-center py-4">
              <ActivityIndicator size="small" color="#EC4899" />
              <Text className="text-white/70 text-sm mt-2">Loading notes...</Text>
            </View>
          )}
          
          {!notesLoading && workoutNotes.length === 0 && (
            <GlassCard>
              <View className="items-center py-6">
                <Text className="text-4xl mb-2">📝</Text>
                <Text className="text-white font-semibold mb-2">No workout notes yet</Text>
                <Text className="text-white/70 text-center text-sm mb-4">
                  Start tracking your workouts with quick notes!
                </Text>
                <Pressable
                  onPress={handleAddNote}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 rounded-full"
                >
                  <Text className="text-white font-bold text-sm">Add Your First Note</Text>
                </Pressable>
              </View>
            </GlassCard>
          )}
          
          <View className="space-y-3">
            {workoutNotes.map((note) => (
              <GlassCard key={note.id}>
                <View className="flex-row items-start">
                  <View className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full items-center justify-center mr-3">
                    <Text className="text-white text-lg">
                      {workoutNotesService.getWorkoutEmoji(note.workout_type)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white font-semibold">
                        {note.workout_type}
                      </Text>
                      <Text className="text-white/60 text-xs">
                        {workoutNotesService.formatTimeAgo(note.created_at)}
                      </Text>
                    </View>
                    <Text className="text-white/80 text-sm mt-1">
                      {note.note}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleDeleteNote(note.id)}
                    className="ml-2 p-1"
                  >
                    <Text className="text-white/40 text-xs">✕</Text>
                  </Pressable>
                </View>
              </GlassCard>
            ))}
          </View>
        </View>

        <View className="mb-8">
          <Text className="text-white text-lg font-semibold mb-4">
            💪 Workout Buddies
          </Text>
          
          {buddiesLoading && (
            <View className="items-center py-4">
              <ActivityIndicator size="small" color="#EC4899" />
              <Text className="text-white/70 text-sm mt-2">Loading buddies...</Text>
            </View>
          )}
          
          {!buddiesLoading && workoutBuddies.length === 0 && (
            <GlassCard>
              <View className="items-center py-4">
                <Text className="text-white/70 text-center">
                  No workout buddies available right now
                </Text>
              </View>
            </GlassCard>
          )}
          
          <View className="space-y-3">
            {workoutBuddies.map((buddy) => (
              <Pressable key={buddy.id} onPress={() => handleBuddyPress(buddy)}>
                <GlassCard>
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full items-center justify-center mr-3">
                      <Text className="text-white font-bold text-sm">
                        {buddy.name.split(' ').map(n => n[0]).join('')}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <Text className="text-white font-semibold">
                          {buddy.name}
                        </Text>
                        <Text className="text-white/50 text-xs ml-2">
                          @{buddy.username}
                        </Text>
                      </View>
                      <Text className="text-white/80 text-sm mt-1">
                        {buddy.status}
                      </Text>
                      <Text className="text-white/60 text-xs mt-1">
                        {buddy.time}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <View className="bg-white/10 px-2 py-1 rounded-full mr-2">
                        <Text className="text-white/70 text-xs capitalize">
                          {buddy.archetype?.name?.replace('_', ' ') || 'AI User'}
                        </Text>
                      </View>
                      <Text className="text-white/40 text-lg">›</Text>
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mb-8">
          <Text className="text-white text-lg font-semibold mb-4">
            👥 Groups
          </Text>
          
          {groupsLoading && (
            <View className="items-center py-4">
              <ActivityIndicator size="small" color="#EC4899" />
              <Text className="text-white/70 text-sm mt-2">Loading groups...</Text>
            </View>
          )}
          
          {!groupsLoading && groups.length === 0 && (
            <GlassCard>
              <View className="items-center py-4">
                <Text className="text-white/70 text-center">
                  No groups available right now
                </Text>
              </View>
            </GlassCard>
          )}
          
          <View className="space-y-3">
            {groups.map((group) => (
              <GradientCard 
                key={group.id} 
                gradient="primary" 
                className="w-full"
                onPress={() => handleGroupPress(group)}
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-white text-lg font-semibold mb-1">
                      {group.name}
                    </Text>
                    <Text className="text-white/80 text-sm mb-2">
                      {group.member_count} members
                    </Text>
                    {group.last_activity && (
                      <Text className="text-white/70 text-sm">
                        💬 {group.last_activity}
                      </Text>
                    )}
                  </View>
                  <View className={`px-3 py-1 rounded-full ${
                    group.user_is_member 
                      ? 'bg-green-500/20' 
                      : 'bg-white/20'
                  }`}>
                    <Text className="text-white text-xs font-medium">
                      {group.user_is_member ? 'Joined' : 'Join'}
                    </Text>
                  </View>
                </View>
              </GradientCard>
            ))}
          </View>
        </View>

        <View>
          <Text className="text-white text-lg font-semibold mb-4">
            ✨ Find Your Tribe
          </Text>
          
          {discoverLoading && (
            <View className="items-center py-4">
              <ActivityIndicator size="small" color="#EC4899" />
              <Text className="text-white/70 text-sm mt-2">Finding people...</Text>
            </View>
          )}
          
          {!discoverLoading && discoverableUsers.length === 0 && (
            <GlassCard>
              <View className="items-center py-4">
                <Text className="text-4xl mb-2">👥</Text>
                <Text className="text-white font-semibold mb-2">No users to discover</Text>
                <Text className="text-white/70 text-center text-sm">
                  Invite friends to join your fitness journey!
                </Text>
              </View>
            </GlassCard>
          )}
          
          <View className="space-y-3">
            {discoverableUsers.map((user) => (
              <Pressable key={user.id} onPress={() => handleDiscoverableUserPress(user)}>
                <GlassCard>
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full items-center justify-center mr-3">
                      <Text className="text-white font-bold text-sm">
                        {user.full_name 
                          ? user.full_name.split(' ').map(n => n[0]).join('')
                          : user.username.slice(0, 2).toUpperCase()
                        }
                      </Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <Text className="text-white font-semibold">
                          {user.full_name || user.username}
                        </Text>
                        <Text className="text-white/50 text-xs ml-2">
                          @{user.username}
                        </Text>
                        {user.is_ai_user && (
                          <View className="bg-blue-500/20 px-2 py-1 rounded-full ml-2">
                            <Text className="text-blue-300 text-xs font-medium">
                              AI
                            </Text>
                          </View>
                        )}
                      </View>
                      {user.fitness_level && (
                        <Text className="text-white/60 text-xs mt-1 capitalize">
                          {user.fitness_level} level
                        </Text>
                      )}
                      {user.bio && (
                        <Text className="text-white/60 text-xs mt-1" numberOfLines={1}>
                          {user.bio}
                        </Text>
                      )}
                    </View>
                    <View className="ml-2">
                      <Text className="text-white/40 text-lg">›</Text>
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        </View>
        </ScrollView>
        
        {/* Add Workout Note Modal */}
        <AddWorkoutNoteModal
          visible={showAddNoteModal}
          onClose={() => setShowAddNoteModal(false)}
          onNoteAdded={handleNoteAdded}
        />
        
        {/* Group Members Modal */}
        {selectedGroup && (
          <GroupMembersModal
            visible={showGroupMembers}
            onClose={() => setShowGroupMembers(false)}
            groupId={selectedGroup.id}
            groupName={selectedGroup.name}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};