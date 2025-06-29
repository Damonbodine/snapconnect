import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Modal, SafeAreaView, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../ui/GlassCard';
import { GradientCard } from '../ui/GradientCard';
import { AppHeader } from '../ui/AppHeader';
import { Event } from '../../services/eventService';
import { eventService } from '../../services/eventService';
import { GeneratedWorkout } from '../../services/groqService';

interface EventDetailModalProps {
  visible: boolean;
  eventId: string | null;
  onClose: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  visible,
  eventId,
  onClose,
}) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'warmup' | 'main' | 'cooldown'>('main');

  useEffect(() => {
    if (visible && eventId) {
      loadEventDetails();
    }
  }, [visible, eventId]);

  const loadEventDetails = async () => {
    if (!eventId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const eventData = await eventService.getEventById(eventId);
      setEvent(eventData);
    } catch (err) {
      console.error('Error loading event details:', err);
      setError('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const getSectionData = (workout: GeneratedWorkout) => {
    switch (activeSection) {
      case 'warmup':
        return { title: 'Warm-Up', exercises: workout.warmUp, color: '#10B981' };
      case 'main':
        return { title: 'Main Workout', exercises: workout.mainWorkout, color: '#EC4899' };
      case 'cooldown':
        return { title: 'Cool-Down', exercises: workout.coolDown, color: '#7C3AED' };
    }
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatEventTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <LinearGradient
        colors={['#0F0F0F', '#1F2937']}
        className="flex-1"
      >
        <SafeAreaView className="flex-1">
          <AppHeader 
            title={event?.title || 'Event Details'}
            showBackButton={true}
            onBackPress={onClose}
          />
          
          {loading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#EC4899" />
              <Text className="text-white/70 text-sm mt-4">Loading event details...</Text>
            </View>
          ) : error ? (
            <View className="flex-1 justify-center items-center px-4">
              <Text className="text-red-400 text-center text-lg mb-4">⚠️ {error}</Text>
              <Pressable onPress={onClose}>
                <GradientCard gradient="secondary">
                  <Text className="text-white text-center font-semibold">Close</Text>
                </GradientCard>
              </Pressable>
            </View>
          ) : !event ? (
            <View className="flex-1 justify-center items-center px-4">
              <Text className="text-white/70 text-center text-lg">Event not found</Text>
              <Pressable onPress={onClose} className="mt-4">
                <GradientCard gradient="secondary">
                  <Text className="text-white text-center font-semibold">Close</Text>
                </GradientCard>
              </Pressable>
            </View>
          ) : (
            <ScrollView className="flex-1 px-4">
              {/* Basic Event Info */}
              <GlassCard className="mb-6">
                <Text className="text-white text-xl font-bold mb-3">{event.title}</Text>
                
                <View className="flex-row justify-between mb-4">
                  <View>
                    <Text className="text-white/60 text-xs mb-1">Date</Text>
                    <Text className="text-white font-medium">{formatEventDate(event.start_time)}</Text>
                  </View>
                  <View>
                    <Text className="text-white/60 text-xs mb-1">Time</Text>
                    <Text className="text-white font-medium">{formatEventTime(event.start_time)}</Text>
                  </View>
                  <View>
                    <Text className="text-white/60 text-xs mb-1">Participants</Text>
                    <Text className="text-white font-medium">{event.current_participants}</Text>
                  </View>
                </View>

                {event.location_name && (
                  <View className="mb-4">
                    <Text className="text-white/60 text-xs mb-1">Location</Text>
                    <Text className="text-white font-medium">{event.location_name}</Text>
                    {event.location_address && (
                      <Text className="text-white/70 text-sm">{event.location_address}</Text>
                    )}
                  </View>
                )}

                {event.description && (
                  <View>
                    <Text className="text-white/60 text-xs mb-2">Description</Text>
                    <Text className="text-white/80 text-sm leading-relaxed">{event.description}</Text>
                  </View>
                )}
              </GlassCard>

              {/* Workout Details */}
              {event.workout_details && (
                <>
                  <Text className="text-white text-lg font-semibold mb-4">
                    🏋️‍♀️ Workout Details
                  </Text>

                  {/* Workout Overview */}
                  <GlassCard className="mb-6">
                    <View className="flex-row justify-between">
                      <View className="items-center">
                        <Text className="text-white/60 text-xs">Duration</Text>
                        <Text className="text-white font-medium">{event.workout_details.duration}min</Text>
                      </View>
                      <View className="items-center">
                        <Text className="text-white/60 text-xs">Intensity</Text>
                        <Text className="text-white font-medium capitalize">{event.workout_details.intensity}</Text>
                      </View>
                      <View className="items-center">
                        <Text className="text-white/60 text-xs">Category</Text>
                        <Text className="text-white font-medium">{event.workout_details.category}</Text>
                      </View>
                    </View>
                  </GlassCard>

                  {/* Section Tabs */}
                  <View className="flex-row mb-4 space-x-2">
                    {['warmup', 'main', 'cooldown'].map((section) => (
                      <Pressable
                        key={section}
                        onPress={() => setActiveSection(section as any)}
                        className="flex-1"
                      >
                        <GlassCard 
                          className={`${activeSection === section ? 'border-white/40' : 'border-white/10'}`}
                        >
                          <Text className={`text-center text-sm font-medium ${
                            activeSection === section ? 'text-white' : 'text-white/60'
                          }`}>
                            {section === 'warmup' ? 'Warm-Up' : 
                             section === 'main' ? 'Main' : 'Cool-Down'}
                          </Text>
                        </GlassCard>
                      </Pressable>
                    ))}
                  </View>

                  {/* Exercise List */}
                  {(() => {
                    const sectionData = getSectionData(event.workout_details);
                    return (
                      <View className="mb-6">
                        <Text 
                          className="text-white text-lg font-semibold mb-4"
                          style={{ color: sectionData.color }}
                        >
                          {sectionData.title} ({sectionData.exercises.length} exercises)
                        </Text>
                        
                        <View className="space-y-3">
                          {sectionData.exercises.map((exercise, index) => (
                            <GlassCard key={index}>
                              <View className="flex-row items-start">
                                <View className="bg-white/20 w-8 h-8 rounded-full items-center justify-center mr-3 mt-1">
                                  <Text className="text-white font-bold text-sm">{index + 1}</Text>
                                </View>
                                <View className="flex-1">
                                  <Text className="text-white font-medium text-base mb-1">
                                    {exercise.name}
                                  </Text>
                                  <Text className="text-white/70 text-sm mb-2">
                                    {exercise.description}
                                  </Text>
                                  <View className="flex-row flex-wrap gap-2">
                                    {exercise.sets && (
                                      <View className="bg-blue-500/20 px-2 py-1 rounded">
                                        <Text className="text-blue-300 text-xs">{exercise.sets}</Text>
                                      </View>
                                    )}
                                    {exercise.duration && (
                                      <View className="bg-green-500/20 px-2 py-1 rounded">
                                        <Text className="text-green-300 text-xs">{exercise.duration}</Text>
                                      </View>
                                    )}
                                    {exercise.restTime && (
                                      <View className="bg-yellow-500/20 px-2 py-1 rounded">
                                        <Text className="text-yellow-300 text-xs">Rest: {exercise.restTime}</Text>
                                      </View>
                                    )}
                                    <View className="bg-purple-500/20 px-2 py-1 rounded">
                                      <Text className="text-purple-300 text-xs capitalize">{exercise.difficulty}</Text>
                                    </View>
                                  </View>
                                </View>
                              </View>
                            </GlassCard>
                          ))}
                        </View>
                      </View>
                    );
                  })()}

                  {/* Tips Section */}
                  {event.workout_details.tips.length > 0 && (
                    <View className="mb-6">
                      <Text className="text-white text-lg font-semibold mb-4">
                        💡 Tips & Guidelines
                      </Text>
                      <View className="space-y-2">
                        {event.workout_details.tips.map((tip, index) => (
                          <GlassCard key={index}>
                            <Text className="text-white/80 text-sm">{tip}</Text>
                          </GlassCard>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Modifications Section */}
                  {event.workout_details.modifications.length > 0 && (
                    <View className="mb-6">
                      <Text className="text-white text-lg font-semibold mb-4">
                        🔧 Modifications
                      </Text>
                      <View className="space-y-2">
                        {event.workout_details.modifications.map((mod, index) => (
                          <GlassCard key={index}>
                            <Text className="text-white/80 text-sm">{mod}</Text>
                          </GlassCard>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Benefits Section */}
                  {event.workout_details.expectedBenefits.length > 0 && (
                    <View className="mb-8">
                      <Text className="text-white text-lg font-semibold mb-4">
                        🎯 Expected Benefits
                      </Text>
                      <View className="space-y-2">
                        {event.workout_details.expectedBenefits.map((benefit, index) => (
                          <GlassCard key={index}>
                            <Text className="text-white/80 text-sm">{benefit}</Text>
                          </GlassCard>
                        ))}
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
};