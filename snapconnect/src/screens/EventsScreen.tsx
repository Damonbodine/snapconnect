import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, Modal, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { GradientCard } from '../components/ui/GradientCard';
import { GlassCard } from '../components/ui/GlassCard';
import { AppHeader } from '../components/ui/AppHeader';
import { RSVPButton } from '../components/events/RSVPButton';
import { CreateEventModal } from '../components/events/CreateEventModal';
import { WalkSuggestionCard } from '../components/events/WalkSuggestionCard';
import { WorkoutCreator } from '../components/events/WorkoutCreator';
import { WalkGenerator } from '../components/events/WalkGenerator';
import { RouteMap } from '../components/events/RouteMap';
import { EventParticipants } from '../components/events/EventParticipants';
import { useEventStore } from '../stores/eventStore';
import { useAuthStore } from '../stores/authStore';
import { eventService } from '../services/eventService';
import { WalkSuggestion } from '../types/walkSuggestion';


export const EventsScreen = () => {
  const { user } = useAuthStore();
  const {
    events,
    userCreatedEvents,
    userRSVPEvents,
    walkSuggestions,
    activeTab,
    isLoading,
    isLoadingSuggestions,
    error,
    suggestionError,
    userLocation,
    loadEvents,
    loadUserCreatedEvents,
    loadUserRSVPEvents,
    generateWalkSuggestions,
    getCurrentLocation,
    setActiveTab,
    clearError,
  } = useEventStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEvents();
    if (user) {
      loadUserRSVPEvents(user.id);
    }
  }, [user]);

  // Initialize location and suggestions for authenticated users
  useEffect(() => {
    if (user && !userLocation) {
      getCurrentLocation().catch(() => {
        console.log('Could not get current location');
      });
    }
  }, [user, userLocation]);

  // Generate walk suggestions when user and location are available
  useEffect(() => {
    if (user && userLocation && walkSuggestions.length === 0) {
      generateWalkSuggestions(user.id).catch(() => {
        console.log('Could not generate walk suggestions');
      });
    }
  }, [user, userLocation, walkSuggestions.length]);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    
    // Refresh user RSVP events
    if (user) {
      await loadUserRSVPEvents(user.id);
    }
    
    // Also refresh walk suggestions if user and location are available
    if (user && userLocation) {
      try {
        await generateWalkSuggestions(user.id, { 
          count: 3, 
          diversityFactor: 0.7, 
          useCache: false, 
          forceRefresh: true 
        });
      } catch (error) {
        console.log('Could not refresh walk suggestions:', error);
      }
    }
    
    setRefreshing(false);
  };

  const handleCreateEvent = () => {
    if (!user) {
      // Could show login prompt
      return;
    }
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    // Refresh events list to show newly created event
    handleRefresh();
  };


  const getCurrentEvents = () => {
    return events;
  };

  const getGradientForCategory = (categoryName?: string): any => {
    if (!categoryName) return 'primary';
    
    const name = categoryName.toLowerCase();
    switch (name) {
      case 'workout':
      case 'strength':
        return 'strength';
      case 'running':
      case 'cardio':
        return 'cardio';
      case 'yoga':
      case 'flexibility':
        return 'flexibility';
      case 'cycling':
        return 'primary';
      case 'swimming':
        return 'recovery';
      case 'sports':
        return 'danger';
      case 'hiking':
        return 'success';
      case 'dance':
        return 'secondary';
      default:
        return 'primary';
    }
  };

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F2937']}
      className="flex-1"
    >
      <SafeAreaView className="flex-1">
        <AppHeader title="Events" />
        
        <ScrollView 
          className="flex-1 px-4 pb-24"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFFFFF"
            />
          }
        >

        {/* Error Display */}
        {error && (
          <GlassCard className="mb-4 border-red-500/30">
            <View className="flex-row items-center justify-between">
              <Text className="text-red-400 text-sm flex-1">
                ⚠️ {error}
              </Text>
              <Pressable onPress={clearError}>
                <Text className="text-red-400 text-lg">✕</Text>
              </Pressable>
            </View>
          </GlassCard>
        )}


        {/* AI Walk Generator */}
        {user && userLocation && (
          <WalkGenerator />
        )}

        {/* AI Workout Generator */}
        {user && (
          <WorkoutCreator />
        )}

        {/* Create Event Section */}
        {user && (
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-lg font-semibold">
                📅 Create Event
              </Text>
            </View>

            <Pressable onPress={handleCreateEvent}>
              <GlassCard>
                <View className="flex-row items-center justify-between py-4">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-2xl mr-3">📝</Text>
                    <View>
                      <Text className="text-white font-medium">
                        + Create Event
                      </Text>
                      <Text className="text-white/60 text-sm">
                        Create your own fitness event
                      </Text>
                    </View>
                  </View>
                  <Text className="text-white/60 text-lg">›</Text>
                </View>
              </GlassCard>
            </Pressable>
          </View>
        )}

        {/* My RSVP'd Events */}
        {user && (
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-lg font-semibold">
                🎟️ My RSVP'd Events
              </Text>
            </View>

            {/* Loading State for User Events */}
            {isLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator size="large" color="#EC4899" />
                <Text className="text-white/70 text-sm mt-2">Loading your events...</Text>
              </View>
            ) : (
              <>
                {/* User's RSVP'd Events */}
                <View className="space-y-4">
                  {userRSVPEvents.map((event) => (
                    <GradientCard 
                      key={event.id} 
                      gradient={getGradientForCategory(event.category?.name)}
                      className="w-full"
                    >
                      <View className="flex-row justify-between items-start mb-3">
                        <View className="flex-1">
                          <Text className="text-white text-lg font-semibold mb-1">
                            {event.title}
                          </Text>
                          <Text className="text-white/80 text-sm">
                            📍 {event.location_name}
                          </Text>
                          <Text className="text-white/80 text-sm">
                            🕐 {eventService.formatEventDate(event.start_time)} at {eventService.formatEventTime(event.start_time)}
                          </Text>
                          {event.cost_cents > 0 && (
                            <Text className="text-white/80 text-sm">
                              💰 {eventService.formatEventCost(event.cost_cents, event.cost_currency)}
                            </Text>
                          )}
                        </View>
                        <View className="items-end">
                          <Text className="text-white/60 text-xs">
                            {event.current_participants}
                            {event.max_participants ? `/${event.max_participants}` : ''} going
                          </Text>
                          {event.category && (
                            <View className="bg-white/20 px-2 py-1 rounded-full mt-1">
                              <Text className="text-white text-xs font-medium">
                                {event.category.icon} {event.category.name}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Participants */}
                      <View className="mb-3">
                        <EventParticipants 
                          eventId={event.id}
                          maxVisible={4}
                        />
                      </View>

                      {/* RSVP Button */}
                      <RSVPButton 
                        event={event}
                        onRSVPChange={() => handleRefresh()}
                      />
                    </GradientCard>
                  ))}
                </View>

                {/* Empty State for User Events */}
                {userRSVPEvents.length === 0 && !isLoading && (
                  <View className="items-center py-8">
                    <Text className="text-4xl mb-4">🎯</Text>
                    <Text className="text-white text-lg font-semibold mb-2">
                      No RSVP'd Events
                    </Text>
                    <Text className="text-white/70 text-center">
                      Generate AI workouts or walks to automatically RSVP to events!
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* All Community Events */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-white text-lg font-semibold">
              🌍 Community Events
            </Text>
          </View>

          {/* Loading State */}
          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#EC4899" />
              <Text className="text-white/70 text-sm mt-2">Loading community events...</Text>
            </View>
          ) : (
            <>
              {/* Events List */}
              <View className="space-y-4">
                {getCurrentEvents().map((event) => (
                  <GradientCard 
                    key={event.id} 
                    gradient={getGradientForCategory(event.category?.name)}
                    className="w-full"
                  >
                    <View className="flex-row justify-between items-start mb-3">
                      <View className="flex-1">
                        <Text className="text-white text-lg font-semibold mb-1">
                          {event.title}
                        </Text>
                        <Text className="text-white/80 text-sm">
                          📍 {event.location_name}
                        </Text>
                        <Text className="text-white/80 text-sm">
                          🕐 {eventService.formatEventDate(event.start_time)} at {eventService.formatEventTime(event.start_time)}
                        </Text>
                        {event.cost_cents > 0 && (
                          <Text className="text-white/80 text-sm">
                            💰 {eventService.formatEventCost(event.cost_cents, event.cost_currency)}
                          </Text>
                        )}
                      </View>
                      <View className="items-end">
                        <Text className="text-white/60 text-xs">
                          {event.current_participants}
                          {event.max_participants ? `/${event.max_participants}` : ''} going
                        </Text>
                        {event.category && (
                          <View className="bg-white/20 px-2 py-1 rounded-full mt-1">
                            <Text className="text-white text-xs font-medium">
                              {event.category.icon} {event.category.name}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Participants */}
                    <View className="mb-3">
                      <EventParticipants 
                        eventId={event.id}
                        maxVisible={4}
                      />
                    </View>

                    {/* RSVP Button */}
                    <RSVPButton 
                      event={event}
                      onRSVPChange={() => handleRefresh()}
                    />
                  </GradientCard>
                ))}
              </View>

              {/* Empty State */}
              {getCurrentEvents().length === 0 && !isLoading && (
                <View className="items-center py-12">
                  <Text className="text-6xl mb-4">📅</Text>
                  <Text className="text-white text-xl font-semibold mb-2">
                    No community events found
                  </Text>
                  <Text className="text-white/70 text-center mb-6">
                    Be the first to create a fitness event in your community!
                  </Text>
                  {user && (
                    <Pressable onPress={handleCreateEvent}>
                      <GradientCard gradient="primary">
                        <Text className="text-white font-semibold">
                          + Create First Event
                        </Text>
                      </GradientCard>
                    </Pressable>
                  )}
                </View>
              )}
            </>
          )}
        </View>

        {/* Location prompt for unauthenticated or no-location users */}
        {user && !userLocation && (
          <View className="mt-8">
            <GlassCard>
              <View className="items-center py-6">
                <Text className="text-4xl mb-2">📍</Text>
                <Text className="text-white text-center font-medium mb-2">
                  Enable Location for AI Suggestions
                </Text>
                <Text className="text-white/70 text-center text-sm mb-4">
                  Allow location access to get personalized walking suggestions in your area.
                </Text>
                <Pressable onPress={getCurrentLocation}>
                  <GradientCard gradient="primary">
                    <Text className="text-white font-semibold">
                      Enable Location
                    </Text>
                  </GradientCard>
                </Pressable>
              </View>
            </GlassCard>
          </View>
        )}

        {/* Login Prompt for unauthenticated users */}
        {!user && (
          <View className="mt-8">
            <GlassCard>
              <Text className="text-white text-center font-semibold mb-2">
                Join the Community!
              </Text>
              <Text className="text-white/70 text-center text-sm">
                Sign in to create events, RSVP to activities, and connect with other fitness enthusiasts.
              </Text>
            </GlassCard>
          </View>
        )}
      </ScrollView>

      {/* Create Event Modal */}
      <CreateEventModal 
        visible={showCreateModal}
        onClose={handleCloseModal}
      />

      </SafeAreaView>
    </LinearGradient>
  );
};