import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { GradientCard } from '../ui/GradientCard';
import { useEventStore } from '../../stores/eventStore';
import { useAuthStore } from '../../stores/authStore';
import { Event, EventParticipant } from '../../services/eventService';

interface RSVPButtonProps {
  event: Event;
  onRSVPChange?: (status: 'going' | 'maybe' | 'not_going') => void;
  className?: string;
}

export const RSVPButton: React.FC<RSVPButtonProps> = ({
  event,
  onRSVPChange,
  className = '',
}) => {
  const { rsvpToEvent, getUserEventRSVP } = useEventStore();
  const { user } = useAuthStore();
  
  const [currentRSVP, setCurrentRSVP] = useState<EventParticipant | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserRSVP();
    }
  }, [user, event.id]);

  const loadUserRSVP = async () => {
    if (!user) return;
    
    try {
      const rsvp = await getUserEventRSVP(event.id, user.id);
      setCurrentRSVP(rsvp);
    } catch (error) {
      console.error('Error loading user RSVP:', error);
    }
  };

  const handleRSVP = async (status: 'going' | 'maybe' | 'not_going') => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await rsvpToEvent(event.id, user.id, status);
      await loadUserRSVP(); // Refresh RSVP status
      setShowOptions(false);
      
      if (onRSVPChange) {
        onRSVPChange(status);
      }
    } catch (error) {
      console.error('Error updating RSVP:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'going':
        return { text: 'Going', emoji: '✅', gradient: 'success' as const };
      case 'maybe':
        return { text: 'Maybe', emoji: '🤔', gradient: 'secondary' as const };
      case 'not_going':
        return { text: 'Not Going', emoji: '❌', gradient: 'danger' as const };
      case 'waitlist':
        return { text: 'Waitlisted', emoji: '⏳', gradient: 'dark' as const };
      default:
        return { text: 'RSVP', emoji: '📝', gradient: 'primary' as const };
    }
  };

  const canRSVP = () => {
    if (!user) return false;
    if (event.creator_id === user.id) return false; // Creator doesn't need to RSVP
    
    const eventDate = new Date(event.start_time);
    const now = new Date();
    return eventDate > now; // Can only RSVP to future events
  };

  const isEventFull = () => {
    return event.max_participants && event.current_participants >= event.max_participants;
  };

  const getParticipantText = () => {
    if (event.max_participants) {
      return `${event.current_participants}/${event.max_participants} going`;
    }
    return `${event.current_participants} going`;
  };

  if (!user) {
    return (
      <GlassCard className={className}>
        <Text className="text-white/70 text-center text-sm">
          Sign in to RSVP
        </Text>
      </GlassCard>
    );
  }

  if (event.creator_id === user.id) {
    return (
      <GlassCard className={className}>
        <View className="flex-row items-center justify-center">
          <Text className="text-white/70 text-sm mr-2">👑</Text>
          <Text className="text-white/70 text-sm">Your Event</Text>
        </View>
        <Text className="text-white/50 text-xs text-center mt-1">
          {getParticipantText()}
        </Text>
      </GlassCard>
    );
  }

  if (!canRSVP()) {
    return (
      <GlassCard className={className}>
        <Text className="text-white/70 text-center text-sm">
          Event has passed
        </Text>
        <Text className="text-white/50 text-xs text-center mt-1">
          {getParticipantText()}
        </Text>
      </GlassCard>
    );
  }

  const statusDisplay = getStatusDisplay(currentRSVP?.status || '');

  if (showOptions) {
    return (
      <View className={className}>
        <Text className="text-white/70 text-sm mb-2 text-center">
          {getParticipantText()}
        </Text>
        
        <View className="space-y-2">
          {/* Going */}
          <Pressable
            onPress={() => handleRSVP('going')}
            disabled={isLoading || (isEventFull() && currentRSVP?.status !== 'going')}
          >
            <GradientCard
              gradient="success"
              className={isEventFull() && currentRSVP?.status !== 'going' ? 'opacity-50' : ''}
            >
              <View className="flex-row items-center justify-center">
                <Text className="text-white text-lg mr-2">✅</Text>
                <Text className="text-white font-semibold">
                  Going {isEventFull() && currentRSVP?.status !== 'going' ? '(Waitlist)' : ''}
                </Text>
                {isLoading && <ActivityIndicator size="small" color="#FFFFFF" className="ml-2" />}
              </View>
            </GradientCard>
          </Pressable>

          {/* Maybe */}
          <Pressable onPress={() => handleRSVP('maybe')} disabled={isLoading}>
            <GradientCard gradient="secondary">
              <View className="flex-row items-center justify-center">
                <Text className="text-white text-lg mr-2">🤔</Text>
                <Text className="text-white font-semibold">Maybe</Text>
                {isLoading && <ActivityIndicator size="small" color="#FFFFFF" className="ml-2" />}
              </View>
            </GradientCard>
          </Pressable>

          {/* Not Going */}
          <Pressable onPress={() => handleRSVP('not_going')} disabled={isLoading}>
            <GlassCard>
              <View className="flex-row items-center justify-center">
                <Text className="text-white text-lg mr-2">❌</Text>
                <Text className="text-white/70">Not Going</Text>
                {isLoading && <ActivityIndicator size="small" color="#FFFFFF" className="ml-2" />}
              </View>
            </GlassCard>
          </Pressable>

          {/* Cancel */}
          <Pressable onPress={() => setShowOptions(false)}>
            <GlassCard>
              <Text className="text-white/70 text-center">Cancel</Text>
            </GlassCard>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className={className}>
      <Text className="text-white/70 text-sm mb-2 text-center">
        {getParticipantText()}
      </Text>
      
      <Pressable onPress={() => setShowOptions(true)} disabled={isLoading}>
        <GradientCard gradient={statusDisplay.gradient}>
          <View className="flex-row items-center justify-center">
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text className="text-white text-lg mr-2">
                  {statusDisplay.emoji}
                </Text>
                <Text className="text-white font-semibold">
                  {statusDisplay.text}
                </Text>
              </>
            )}
          </View>
          
          {currentRSVP?.status === 'waitlist' && (
            <Text className="text-white/70 text-xs text-center mt-1">
              You're on the waitlist
            </Text>
          )}
        </GradientCard>
      </Pressable>
    </View>
  );
};