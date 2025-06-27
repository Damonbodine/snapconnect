import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { GradientCard } from '../ui/GradientCard';
import { GlassCard } from '../ui/GlassCard';
import { useEventStore } from '../../stores/eventStore';
import { Event } from '../../services/eventService';
import { eventService } from '../../services/eventService';

interface MyEventsSectionProps {
  userId: string;
  className?: string;
}

type EventTab = 'upcoming' | 'created' | 'past';

export const MyEventsSection: React.FC<MyEventsSectionProps> = ({ 
  userId, 
  className = '' 
}) => {
  const { getUpcomingUserEvents, getUserEventHistory, loadUserCreatedEvents, userCreatedEvents } = useEventStore();
  
  const [activeTab, setActiveTab] = useState<EventTab>('upcoming');
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllEvents();
  }, [userId]);

  const loadAllEvents = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [upcoming, past] = await Promise.all([
        getUpcomingUserEvents(userId),
        getUserEventHistory(userId),
      ]);
      
      // Also load created events
      await loadUserCreatedEvents(userId);
      
      setUpcomingEvents(upcoming);
      setPastEvents(past);
    } catch (err) {
      console.error('Failed to load events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllEvents();
    setRefreshing(false);
  };

  const getCurrentEvents = (): Event[] => {
    switch (activeTab) {
      case 'upcoming':
        return upcomingEvents;
      case 'created':
        return userCreatedEvents;
      case 'past':
        return pastEvents;
      default:
        return [];
    }
  };

  const getTabCounts = () => ({
    upcoming: upcomingEvents.length,
    created: userCreatedEvents.length,
    past: pastEvents.length,
  });

  const formatEventDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 0 && diffDays < 7) return `${diffDays}d`;
    if (diffDays > 0) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Past dates
    const pastDays = Math.abs(diffDays);
    if (pastDays === 1) return 'Yesterday';
    if (pastDays < 7) return `${pastDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatEventTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getEventIcon = (event: Event): string => {
    if (!event.category?.name) return '📅';
    
    const categoryName = event.category.name.toLowerCase();
    if (categoryName.includes('workout') || categoryName.includes('fitness')) return '💪';
    if (categoryName.includes('run')) return '🏃‍♀️';
    if (categoryName.includes('yoga')) return '🧘‍♀️';
    if (categoryName.includes('walk') || categoryName.includes('hik')) return '🚶‍♀️';
    if (categoryName.includes('cycle') || categoryName.includes('bike')) return '🚴‍♀️';
    if (categoryName.includes('swim')) return '🏊‍♀️';
    if (categoryName.includes('dance')) return '💃';
    return '📅';
  };

  const counts = getTabCounts();

  return (
    <View className={className}>
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-white text-lg font-semibold">
          📅 My Events
        </Text>
        {!isLoading && (
          <Text className="text-white/60 text-sm">
            {counts.upcoming + counts.created + counts.past} total
          </Text>
        )}
      </View>

      {/* Tab Navigation */}
      <View className="flex-row mb-4 space-x-2">
        <Pressable
          onPress={() => setActiveTab('upcoming')}
          className="flex-1"
        >
          <GlassCard 
            className={`${activeTab === 'upcoming' ? 'border-white/40' : 'border-white/10'}`}
          >
            <View className="py-2">
              <Text className={`text-center text-sm font-medium ${
                activeTab === 'upcoming' ? 'text-white' : 'text-white/60'
              }`}>
                Upcoming ({counts.upcoming})
              </Text>
            </View>
          </GlassCard>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('created')}
          className="flex-1"
        >
          <GlassCard 
            className={`${activeTab === 'created' ? 'border-white/40' : 'border-white/10'}`}
          >
            <View className="py-2">
              <Text className={`text-center text-sm font-medium ${
                activeTab === 'created' ? 'text-white' : 'text-white/60'
              }`}>
                Created ({counts.created})
              </Text>
            </View>
          </GlassCard>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('past')}
          className="flex-1"
        >
          <GlassCard 
            className={`${activeTab === 'past' ? 'border-white/40' : 'border-white/10'}`}
          >
            <View className="py-2">
              <Text className={`text-center text-sm font-medium ${
                activeTab === 'past' ? 'text-white' : 'text-white/60'
              }`}>
                Past ({counts.past})
              </Text>
            </View>
          </GlassCard>
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="#EC4899" />
          <Text className="text-white/70 text-sm mt-2">Loading events...</Text>
        </View>
      ) : error ? (
        <GlassCard className="border-red-500/30">
          <View className="py-4">
            <Text className="text-red-400 text-sm text-center mb-2">
              {error}
            </Text>
            <Pressable onPress={loadAllEvents}>
              <Text className="text-white/60 text-xs text-center">Tap to retry</Text>
            </Pressable>
          </View>
        </GlassCard>
      ) : (
        <ScrollView
          className="max-h-80"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFFFFF"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View className="space-y-3">
            {getCurrentEvents().length === 0 ? (
              <GlassCard>
                <View className="py-6 items-center">
                  <Text className="text-4xl mb-2">
                    {activeTab === 'upcoming' ? '📅' : activeTab === 'created' ? '🎯' : '📖'}
                  </Text>
                  <Text className="text-white font-medium mb-1">
                    No {activeTab} events
                  </Text>
                  <Text className="text-white/60 text-sm text-center">
                    {activeTab === 'upcoming' 
                      ? 'RSVP to some events to see them here!'
                      : activeTab === 'created'
                        ? 'Create your first event to get started!'
                        : 'Your event history will appear here.'
                    }
                  </Text>
                </View>
              </GlassCard>
            ) : (
              getCurrentEvents().map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  showStatus={activeTab !== 'created'}
                  isPast={activeTab === 'past'}
                  isCreated={activeTab === 'created'}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

// Individual Event Card Component
const EventCard: React.FC<{
  event: Event;
  showStatus?: boolean;
  isPast?: boolean;
  isCreated?: boolean;
}> = ({ event, showStatus = true, isPast = false, isCreated = false }) => {
  const getEventIcon = (event: Event): string => {
    if (!event.category?.name) return '📅';
    
    const categoryName = event.category.name.toLowerCase();
    if (categoryName.includes('workout') || categoryName.includes('fitness')) return '💪';
    if (categoryName.includes('run')) return '🏃‍♀️';
    if (categoryName.includes('yoga')) return '🧘‍♀️';
    if (categoryName.includes('walk') || categoryName.includes('hik')) return '🚶‍♀️';
    if (categoryName.includes('cycle') || categoryName.includes('bike')) return '🚴‍♀️';
    if (categoryName.includes('swim')) return '🏊‍♀️';
    if (categoryName.includes('dance')) return '💃';
    return '📅';
  };

  const formatEventDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 0 && diffDays < 7) return `${diffDays}d`;
    if (diffDays > 0) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Past dates
    const pastDays = Math.abs(diffDays);
    if (pastDays === 1) return 'Yesterday';
    if (pastDays < 7) return `${pastDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatEventTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <GlassCard className={isPast ? 'border-white/5' : 'border-white/10'}>
      <View className="flex-row items-start space-x-3">
        <View className="items-center pt-1">
          <Text className="text-2xl">{getEventIcon(event)}</Text>
          {isCreated && (
            <View className="bg-purple-500/20 px-1 py-0.5 rounded-full mt-1">
              <Text className="text-purple-300 text-xs">👑</Text>
            </View>
          )}
        </View>
        
        <View className="flex-1">
          <Text className={`font-medium text-base ${isPast ? 'text-white/60' : 'text-white'}`} numberOfLines={2}>
            {event.title}
          </Text>
          
          <View className="flex-row items-center mt-1 space-x-4">
            <View className="flex-row items-center">
              <Text className="text-white/60 text-xs">
                📅 {formatEventDate(event.start_time)}
              </Text>
            </View>
            
            <View className="flex-row items-center">
              <Text className="text-white/60 text-xs">
                🕐 {formatEventTime(event.start_time)}
              </Text>
            </View>
          </View>
          
          {event.location_name && (
            <View className="flex-row items-center mt-1">
              <Text className="text-white/50 text-xs" numberOfLines={1}>
                📍 {event.location_name}
              </Text>
            </View>
          )}
          
          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center space-x-2">
              {event.category && (
                <View className="bg-white/10 px-2 py-1 rounded-full">
                  <Text className="text-white/80 text-xs">
                    {event.category.name}
                  </Text>
                </View>
              )}
              
              {showStatus && !isCreated && (
                <View className="bg-green-500/20 px-2 py-1 rounded-full">
                  <Text className="text-green-400 text-xs">
                    ✅ Going
                  </Text>
                </View>
              )}
            </View>
            
            <Text className="text-white/40 text-xs">
              {event.current_participants} going
            </Text>
          </View>
        </View>
      </View>
    </GlassCard>
  );
};