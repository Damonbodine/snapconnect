import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../ui/GlassCard';
import { eventService } from '../../services/eventService';

interface EventParticipantsProps {
  eventId: string;
  showFullList?: boolean;
  maxVisible?: number;
  className?: string;
}

interface ParticipantWithProfile {
  id: string;
  event_id: string;
  user_id: string;
  status: 'going' | 'maybe' | 'not_going' | 'waitlist';
  created_at: string;
  user: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    is_mock_user: boolean;
  };
}

export const EventParticipants: React.FC<EventParticipantsProps> = ({
  eventId,
  showFullList = false,
  maxVisible = 6,
  className = '',
}) => {
  const [participants, setParticipants] = useState<ParticipantWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadParticipants();
  }, [eventId]);

  const loadParticipants = async () => {
    try {
      setIsLoading(true);
      const data = await eventService.getEventParticipantsWithProfiles(eventId);
      setParticipants(data);
    } catch (error) {
      console.error('Error loading participants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayName = (user: ParticipantWithProfile['user']) => {
    return user.full_name || user.username || 'Anonymous';
  };

  const getAvatarInitials = (user: ParticipantWithProfile['user']) => {
    const name = getDisplayName(user);
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getParticipantTypeIcon = (user: ParticipantWithProfile['user']) => {
    return user.is_mock_user ? '🤖' : '👤';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'going':
        return ['#10B981', '#059669']; // Green
      case 'maybe':
        return ['#F59E0B', '#D97706']; // Yellow/Orange
      default:
        return ['#6B7280', '#4B5563']; // Gray
    }
  };

  const visibleParticipants = showFullList || showAll 
    ? participants 
    : participants.slice(0, maxVisible);

  const hiddenCount = Math.max(0, participants.length - maxVisible);

  if (isLoading) {
    return (
      <View className={`${className}`}>
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color="#EC4899" />
          <Text className="text-white/70 text-sm ml-2">Loading participants...</Text>
        </View>
      </View>
    );
  }

  if (participants.length === 0) {
    return (
      <View className={`${className}`}>
        <Text className="text-white/70 text-sm">No participants yet</Text>
      </View>
    );
  }

  if (showFullList) {
    return (
      <View className={className}>
        <Text className="text-white font-semibold text-lg mb-4">
          Participants ({participants.length})
        </Text>
        
        <ScrollView className="max-h-80">
          <View className="space-y-3">
            {participants.map((participant) => (
              <GlassCard key={participant.id}>
                <View className="flex-row items-center p-2">
                  {/* Avatar */}
                  <View className="w-10 h-10 rounded-full items-center justify-center mr-3">
                    <LinearGradient
                      colors={getStatusColor(participant.status)}
                      className="w-10 h-10 rounded-full items-center justify-center"
                    >
                      <Text className="text-white font-bold text-sm">
                        {getAvatarInitials(participant.user)}
                      </Text>
                    </LinearGradient>
                  </View>

                  {/* User Info */}
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-white font-medium">
                        {getDisplayName(participant.user)}
                      </Text>
                      <Text className="text-white/60 text-xs ml-2">
                        {getParticipantTypeIcon(participant.user)}
                      </Text>
                    </View>
                    <Text className="text-white/60 text-xs">
                      @{participant.user.username}
                    </Text>
                  </View>

                  {/* Status Badge */}
                  <View className="items-end">
                    <View className="bg-white/20 px-2 py-1 rounded-full">
                      <Text className="text-white text-xs font-medium capitalize">
                        {participant.status}
                      </Text>
                    </View>
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // Compact view for event cards
  return (
    <View className={className}>
      <View className="flex-row items-center">
        {/* Participant Avatars */}
        <View className="flex-row -space-x-2 mr-3">
          {visibleParticipants.map((participant, index) => (
            <View
              key={participant.id}
              className="w-8 h-8 rounded-full border-2 border-gray-800"
              style={{ zIndex: visibleParticipants.length - index }}
            >
              <LinearGradient
                colors={getStatusColor(participant.status)}
                className="w-full h-full rounded-full items-center justify-center"
              >
                <Text className="text-white font-bold text-xs">
                  {getAvatarInitials(participant.user)}
                </Text>
              </LinearGradient>
            </View>
          ))}

          {/* Show hidden count */}
          {hiddenCount > 0 && (
            <Pressable
              onPress={() => setShowAll(true)}
              className="w-8 h-8 rounded-full border-2 border-gray-800"
              style={{ zIndex: 0 }}
            >
              <View className="w-full h-full rounded-full bg-gray-600 items-center justify-center">
                <Text className="text-white font-bold text-xs">
                  +{hiddenCount}
                </Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* Participant Summary */}
        <View className="flex-1">
          <Text className="text-white/80 text-sm">
            {participants.filter(p => p.status === 'going').length} going
            {participants.filter(p => p.status === 'maybe').length > 0 && 
              `, ${participants.filter(p => p.status === 'maybe').length} maybe`
            }
          </Text>
          
          {/* AI vs Human breakdown */}
          <View className="flex-row items-center mt-1">
            <Text className="text-white/60 text-xs mr-3">
              👤 {participants.filter(p => !p.user.is_mock_user).length} humans
            </Text>
            <Text className="text-white/60 text-xs">
              🤖 {participants.filter(p => p.user.is_mock_user).length} AI
            </Text>
          </View>
        </View>

        {/* Expand Button */}
        {participants.length > 0 && !showFullList && (
          <Pressable onPress={() => setShowAll(!showAll)}>
            <Text className="text-white/60 text-sm">
              {showAll ? '‹' : '›'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Expanded List */}
      {showAll && !showFullList && (
        <View className="mt-4 space-y-2">
          {participants.map((participant) => (
            <View key={participant.id} className="flex-row items-center">
              <View className="w-6 h-6 rounded-full mr-2">
                <LinearGradient
                  colors={getStatusColor(participant.status)}
                  className="w-full h-full rounded-full items-center justify-center"
                >
                  <Text className="text-white font-bold text-xs">
                    {getAvatarInitials(participant.user)}
                  </Text>
                </LinearGradient>
              </View>
              
              <Text className="text-white/80 text-sm flex-1">
                {getDisplayName(participant.user)}
              </Text>
              
              <Text className="text-white/60 text-xs mr-2">
                {getParticipantTypeIcon(participant.user)}
              </Text>
              
              <Text className="text-white/60 text-xs capitalize">
                {participant.status}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};