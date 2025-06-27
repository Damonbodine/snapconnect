import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../ui/GradientCard';
import { GlassCard } from '../ui/GlassCard';
import { WalkSuggestion, WalkDifficulty, WalkType } from '../../types/walkSuggestion';
import { useEventStore } from '../../stores/eventStore';
import { autoEventService } from '../../services/autoEventService';
import { useAuthStore } from '../../stores/authStore';

interface WalkSuggestionCardProps {
  suggestion: WalkSuggestion;
  onCreateEvent?: (suggestion: WalkSuggestion) => void;
  onViewRoute?: (suggestion: WalkSuggestion) => void;
  className?: string;
}

export const WalkSuggestionCard: React.FC<WalkSuggestionCardProps> = ({
  suggestion,
  onCreateEvent,
  onViewRoute,
  className = '',
}) => {
  const { createEventFromSuggestion, dismissSuggestion, isCreating } = useEventStore();
  const { user } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [eventCreated, setEventCreated] = useState(false);

  const getGradientForWalkType = (walkType: WalkType) => {
    const gradients = {
      park_loop: 'success',
      trail_hike: 'primary',
      urban_exploration: 'secondary',
      scenic_route: 'cardio',
      fitness_circuit: 'strength',
      social_walk: 'recovery',
    };
    return gradients[walkType] || 'primary';
  };

  const getDifficultyColor = (difficulty: WalkDifficulty) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-400';
      case 'moderate':
        return 'text-yellow-400';
      case 'challenging':
        return 'text-red-400';
      default:
        return 'text-white';
    }
  };

  const getDifficultyIcon = (difficulty: WalkDifficulty) => {
    switch (difficulty) {
      case 'easy':
        return '🚶‍♀️';
      case 'moderate':
        return '🚶‍♂️';
      case 'challenging':
        return '🏃‍♀️';
      default:
        return '🚶‍♀️';
    }
  };

  const getWalkTypeIcon = (walkType: WalkType) => {
    const icons = {
      park_loop: '🌳',
      trail_hike: '🥾',
      urban_exploration: '🏙️',
      scenic_route: '🌅',
      fitness_circuit: '💪',
      social_walk: '👥',
    };
    return icons[walkType] || '🚶‍♀️';
  };

  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return km < 1 ? `${Math.round(meters)}m` : `${km.toFixed(1)}km`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const handleRSVPAndJoin = async () => {
    if (!suggestion.canCreateEvent || !user) return;

    try {
      setIsCreatingEvent(true);
      console.log('🚶‍♀️ Creating event and RSVPing to walk:', suggestion.title);
      
      // Use auto-event service to create event and RSVP
      const result = await autoEventService.createEventFromWalkSuggestion(
        suggestion,
        user.id,
        {
          visibility: 'public',
          maxParticipants: suggestion.suggestedGroupSize || 6,
        }
      );
      
      console.log('✅ Walk event created successfully:', result.event.id);
      setEventCreated(true);
      
      // Show success state briefly
      setTimeout(() => {
        setEventCreated(false);
      }, 3000);
      
    } catch (error) {
      console.error('❌ Failed to create walk event:', error);
      Alert.alert(
        'Error',
        'Failed to create walk event. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const handleDismiss = () => {
    Alert.alert(
      'Dismiss Suggestion',
      'Are you sure you want to dismiss this walking suggestion?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: () => dismissSuggestion(suggestion.id),
        },
      ]
    );
  };

  const handleViewRoute = () => {
    if (onViewRoute) {
      onViewRoute(suggestion);
    }
  };

  if (suggestion.status === 'dismissed') {
    return null;
  }

  return (
    <GradientCard
      gradient={getGradientForWalkType(suggestion.walkType)}
      className={`w-full ${className}`}
    >
      <View className="space-y-4">
        {/* Header */}
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <View className="flex-row items-center mb-2">
              <Text className="text-2xl mr-2">
                {getWalkTypeIcon(suggestion.walkType)}
              </Text>
              <Text className="text-white text-lg font-bold flex-1">
                {suggestion.title}
              </Text>
              <Pressable onPress={handleDismiss} className="p-1">
                <Text className="text-white/60 text-lg">✕</Text>
              </Pressable>
            </View>
            
            {/* Quick Stats */}
            <View className="flex-row items-center space-x-4">
              <View className="flex-row items-center">
                <Text className="text-xl mr-1">
                  {getDifficultyIcon(suggestion.difficulty)}
                </Text>
                <Text className={`text-sm font-medium ${getDifficultyColor(suggestion.difficulty)}`}>
                  {suggestion.difficulty}
                </Text>
              </View>
              
              <View className="flex-row items-center">
                <Text className="text-white/80 text-sm">
                  📏 {formatDistance(suggestion.distance)}
                </Text>
              </View>
              
              <View className="flex-row items-center">
                <Text className="text-white/80 text-sm">
                  ⏱️ {formatDuration(suggestion.estimatedDuration)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Description */}
        <View>
          <Text className="text-white/90 text-sm leading-5">
            {isExpanded ? suggestion.aiGeneratedContent : suggestion.description}
          </Text>
          
          {suggestion.aiGeneratedContent !== suggestion.description && (
            <Pressable onPress={() => setIsExpanded(!isExpanded)} className="mt-2">
              <Text className="text-white/60 text-xs">
                {isExpanded ? 'Show less' : 'Read more'} {isExpanded ? '▲' : '▼'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Points of Interest */}
        {suggestion.pointsOfInterest.length > 0 && (
          <View>
            <Text className="text-white/80 text-sm font-medium mb-2">
              📍 You'll discover:
            </Text>
            <View className="flex-row flex-wrap">
              {suggestion.pointsOfInterest.slice(0, 3).map((place, index) => (
                <View key={place.place_id} className="bg-white/20 px-2 py-1 rounded-full mr-2 mb-2">
                  <Text className="text-white text-xs">
                    {place.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Social Prompt */}
        {suggestion.socialPrompt && suggestion.suggestedGroupSize && suggestion.suggestedGroupSize > 1 && (
          <GlassCard className="bg-white/10">
            <View className="flex-row items-start">
              <Text className="text-lg mr-2">👥</Text>
              <View className="flex-1">
                <Text className="text-white/90 text-sm italic">
                  "{suggestion.socialPrompt}"
                </Text>
                <Text className="text-white/60 text-xs mt-1">
                  Suggested group size: {suggestion.suggestedGroupSize} people
                </Text>
              </View>
            </View>
          </GlassCard>
        )}

        {/* Action Buttons */}
        <View className="flex-row space-x-3">
          {/* View Route Button */}
          <Pressable onPress={handleViewRoute} className="flex-1">
            <GlassCard className="bg-white/20">
              <View className="flex-row items-center justify-center py-2">
                <Text className="text-white text-sm font-medium">
                  🗺️ View Route
                </Text>
              </View>
            </GlassCard>
          </Pressable>

          {/* RSVP & Join Button */}
          {suggestion.canCreateEvent && (
            <Pressable
              onPress={handleRSVPAndJoin}
              disabled={isCreatingEvent || isCreating || eventCreated}
              className="flex-1"
            >
              <LinearGradient
                colors={
                  eventCreated 
                    ? ['#10B981', '#059669'] 
                    : isCreatingEvent || isCreating 
                      ? ['#6B7280', '#6B7280'] 
                      : ['#EC4899', '#BE185D']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="rounded-lg"
              >
                <View className="flex-row items-center justify-center py-3 px-4">
                  {eventCreated ? (
                    <Text className="text-white text-sm font-medium mr-1">🎉</Text>
                  ) : isCreatingEvent || isCreating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />
                  ) : (
                    <Text className="text-white text-sm font-medium mr-1">✅</Text>
                  )}
                  <Text className="text-white text-sm font-medium">
                    {eventCreated 
                      ? "You're Going!" 
                      : isCreatingEvent || isCreating 
                        ? 'Creating...' 
                        : 'RSVP & Join'
                    }
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          )}
        </View>

        {/* AI Badge */}
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <View className="bg-gradient-to-r from-purple-500 to-pink-500 px-2 py-1 rounded-full">
              <Text className="text-white text-xs font-medium">
                ✨ AI Suggested
              </Text>
            </View>
          </View>
          
          <Text className="text-white/50 text-xs">
            {suggestion.timeOfDay && `Best for ${suggestion.timeOfDay}`}
          </Text>
        </View>

        {/* Status Indicators */}
        {suggestion.status !== 'generated' && (
          <View className="flex-row items-center">
            {suggestion.status === 'saved' && (
              <View className="bg-green-500/20 px-2 py-1 rounded-full">
                <Text className="text-green-400 text-xs">
                  ✓ Event Created
                </Text>
              </View>
            )}
            
            {suggestion.status === 'completed' && suggestion.userRating && (
              <View className="bg-yellow-500/20 px-2 py-1 rounded-full">
                <Text className="text-yellow-400 text-xs">
                  ⭐ {suggestion.userRating}/5 - Completed
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </GradientCard>
  );
};