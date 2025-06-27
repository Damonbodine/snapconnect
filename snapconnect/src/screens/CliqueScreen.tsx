import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../components/ui/GradientCard';
import { GlassCard } from '../components/ui/GlassCard';
import { AppHeader } from '../components/ui/AppHeader';
import { useAuthStore } from '../stores/authStore';
import { workoutNotesService, WorkoutNote } from '../services/workoutNotesService';
import { AddWorkoutNoteModal } from '../components/workout/AddWorkoutNoteModal';
import { workoutBuddyService, WorkoutBuddy } from '../services/workoutBuddyService';

export const CliqueScreen = () => {
  const { user } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);
  const [workoutNotes, setWorkoutNotes] = useState<WorkoutNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [workoutBuddies, setWorkoutBuddies] = useState<WorkoutBuddy[]>([]);
  const [buddiesLoading, setBuddiesLoading] = useState(false);

  // Fetch workout notes and buddies when user is available
  useEffect(() => {
    if (user) {
      fetchWorkoutNotes();
      fetchWorkoutBuddies();
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

  const groups = [
    { id: '1', name: 'Running Club', members: 24, activity: 'Planning weekend 10K' },
    { id: '2', name: 'Gym Buddies', members: 12, activity: 'Sharing workout splits' },
    { id: '3', name: 'Yoga Flow', members: 18, activity: 'New morning routine' },
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchWorkoutNotes(),
      fetchWorkoutBuddies(),
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
    console.log('Buddy pressed:', buddy.username);
    // TODO: Navigate to user profile or send message
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
                    <View className="bg-white/10 px-2 py-1 rounded-full">
                      <Text className="text-white/70 text-xs capitalize">
                        {buddy.archetype?.name?.replace('_', ' ') || 'AI User'}
                      </Text>
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
          <View className="space-y-3">
            {groups.map((group) => (
              <GradientCard 
                key={group.id} 
                gradient="primary" 
                className="w-full"
                onPress={() => console.log('Group pressed:', group.name)}
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-white text-lg font-semibold mb-1">
                      {group.name}
                    </Text>
                    <Text className="text-white/80 text-sm mb-2">
                      {group.members} members
                    </Text>
                    <Text className="text-white/70 text-sm">
                      💬 {group.activity}
                    </Text>
                  </View>
                  <View className="bg-white/20 px-3 py-1 rounded-full">
                    <Text className="text-white text-xs font-medium">
                      Active
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
          <GlassCard>
            <Text className="text-white text-sm mb-3 font-medium">
              AI-Powered Workout Buddy Matching
            </Text>
            <Text className="text-white/80 text-sm mb-2">
              • Found 3 runners with similar pace in your area
            </Text>
            <Text className="text-white/80 text-sm mb-2">
              • 2 gym partners looking for morning workout buddies
            </Text>
            <Text className="text-white/80 text-sm">
              • Join "Beginner Yoga" group - perfect match for your goals
            </Text>
          </GlassCard>
        </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};