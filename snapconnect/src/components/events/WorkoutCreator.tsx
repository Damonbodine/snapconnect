import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Modal, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../ui/GlassCard';
import { GradientCard } from '../ui/GradientCard';
import { groqService, WORKOUT_CATEGORIES, GeneratedWorkout, WorkoutCategory } from '../../services/groqService';
import { autoEventService } from '../../services/autoEventService';
import { useAuthStore } from '../../stores/authStore';
import { locationService } from '../../services/locationService';
import { AppHeader } from '../ui/AppHeader';

// Workout Category Selector Component
const WorkoutCategorySelector: React.FC<{
  categories: WorkoutCategory[];
  selectedCategory: WorkoutCategory | null;
  onSelectCategory: (category: WorkoutCategory) => void;
  onClose: () => void;
}> = ({ categories, selectedCategory, onSelectCategory, onClose }) => {
  const getCategoryGradient = (category: WorkoutCategory): string => {
    const gradientMap: { [key: string]: string } = {
      'upper_body_strength': 'strength',
      'lower_body_power': 'cardio',
      'functional_flow': 'primary',
      'hiit': 'danger',
      'endurance_circuit': 'success',
      'mobility_flexibility': 'flexibility',
      'core_stability': 'secondary',
      'calisthenics': 'strength',
      'yoga_strength': 'flexibility',
      'sport_specific': 'cardio',
      'recovery_protocol': 'recovery',
      'hybrid_equipment': 'primary',
    };
    return gradientMap[category.id] || 'primary';
  };

  const getCategoryIcon = (category: WorkoutCategory): string => {
    const iconMap: { [key: string]: string } = {
      'upper_body_strength': '💪',
      'lower_body_power': '🦵',
      'functional_flow': '🤸‍♀️',
      'hiit': '🔥',
      'endurance_circuit': '⏱️',
      'mobility_flexibility': '🧘‍♀️',
      'core_stability': '⚖️',
      'calisthenics': '🏃‍♂️',
      'yoga_strength': '🕉️',
      'sport_specific': '⚽',
      'recovery_protocol': '🌿',
      'hybrid_equipment': '🏋️‍♀️',
    };
    return iconMap[category.id] || '💪';
  };

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F2937']}
      className="flex-1"
    >
      <SafeAreaView className="flex-1">
        <AppHeader 
          title="Choose Workout Type"
          showBackButton={true}
          onBackPress={onClose}
        />
        
        <ScrollView className="flex-1 px-4">
          <Text className="text-white/70 text-sm text-center mb-6">
            Select a workout category to generate a personalized training session
          </Text>
          
          <View className="space-y-3">
            {categories.map((category) => (
              <Pressable 
                key={category.id}
                onPress={() => onSelectCategory(category)}
              >
                <GradientCard gradient={getCategoryGradient(category)}>
                  <View className="flex-row items-start">
                    <Text className="text-3xl mr-4">
                      {getCategoryIcon(category)}
                    </Text>
                    <View className="flex-1">
                      <Text className="text-white text-lg font-semibold mb-2">
                        {category.name}
                      </Text>
                      <Text className="text-white/80 text-sm mb-3">
                        {category.description}
                      </Text>
                      <View className="flex-row items-center">
                        <View className="bg-white/20 px-2 py-1 rounded-full mr-2">
                          <Text className="text-white text-xs capitalize">
                            {category.intensity} intensity
                          </Text>
                        </View>
                        <Text className="text-white/60 text-xs">
                          Focus: {category.primaryFocus.slice(0, 2).join(', ')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </GradientCard>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// Generated Workout Display Component
const WorkoutDisplay: React.FC<{
  workout: GeneratedWorkout;
  onClose: () => void;
  onRSVPToWorkout: () => void;
  isCreatingEvent: boolean;
  eventCreated: boolean;
}> = ({ workout, onClose, onRSVPToWorkout, isCreatingEvent, eventCreated }) => {
  const [activeSection, setActiveSection] = useState<'warmup' | 'main' | 'cooldown'>('main');

  const getSectionData = () => {
    switch (activeSection) {
      case 'warmup':
        return { title: 'Warm-Up', exercises: workout.warmUp, color: '#10B981' };
      case 'main':
        return { title: 'Main Workout', exercises: workout.mainWorkout, color: '#EC4899' };
      case 'cooldown':
        return { title: 'Cool-Down', exercises: workout.coolDown, color: '#7C3AED' };
    }
  };

  const sectionData = getSectionData();

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F2937']}
      className="flex-1"
    >
      <SafeAreaView className="flex-1">
        <AppHeader 
          title={workout.title}
          showBackButton={true}
          onBackPress={onClose}
        />
        
        <ScrollView className="flex-1 px-4">
          {/* Workout Overview */}
          <GlassCard className="mb-6">
            <Text className="text-white text-lg font-semibold mb-3">
              {workout.title}
            </Text>
            <Text className="text-white/80 text-sm mb-4">
              {workout.description}
            </Text>
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-white/60 text-xs">Duration</Text>
                <Text className="text-white font-medium">{workout.duration}min</Text>
              </View>
              <View className="items-center">
                <Text className="text-white/60 text-xs">Intensity</Text>
                <Text className="text-white font-medium capitalize">{workout.intensity}</Text>
              </View>
              <View className="items-center">
                <Text className="text-white/60 text-xs">Category</Text>
                <Text className="text-white font-medium">{workout.category}</Text>
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

          {/* Tips Section */}
          {workout.tips.length > 0 && (
            <View className="mb-6">
              <Text className="text-white text-lg font-semibold mb-4">
                💡 Tips & Guidelines
              </Text>
              <View className="space-y-2">
                {workout.tips.map((tip, index) => (
                  <GlassCard key={index}>
                    <Text className="text-white/80 text-sm">{tip}</Text>
                  </GlassCard>
                ))}
              </View>
            </View>
          )}

          {/* Modifications Section */}
          {workout.modifications.length > 0 && (
            <View className="mb-6">
              <Text className="text-white text-lg font-semibold mb-4">
                🔧 Modifications
              </Text>
              <View className="space-y-2">
                {workout.modifications.map((mod, index) => (
                  <GlassCard key={index}>
                    <Text className="text-white/80 text-sm">{mod}</Text>
                  </GlassCard>
                ))}
              </View>
            </View>
          )}

          {/* Benefits Section */}
          {workout.expectedBenefits.length > 0 && (
            <View className="mb-6">
              <Text className="text-white text-lg font-semibold mb-4">
                🎯 Expected Benefits
              </Text>
              <View className="space-y-2">
                {workout.expectedBenefits.map((benefit, index) => (
                  <GlassCard key={index}>
                    <Text className="text-white/80 text-sm">{benefit}</Text>
                  </GlassCard>
                ))}
              </View>
            </View>
          )}

          {/* RSVP & Join Button */}
          <View className="mb-8">
            {eventCreated ? (
              <GradientCard gradient="success">
                <Text className="text-white text-center font-semibold text-lg">
                  🎉 Event Created! You're Going!
                </Text>
              </GradientCard>
            ) : (
              <Pressable onPress={onRSVPToWorkout} disabled={isCreatingEvent}>
                <GradientCard gradient={isCreatingEvent ? "secondary" : "primary"}>
                  {isCreatingEvent ? (
                    <View className="flex-row items-center justify-center">
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text className="text-white text-center font-semibold text-lg ml-2">
                        Creating Event...
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-white text-center font-semibold text-lg">
                      ✅ RSVP & Join Event
                    </Text>
                  )}
                </GradientCard>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// Main Workout Creator Component (Preview)
export const WorkoutCreator: React.FC = () => {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [showWorkoutDisplay, setShowWorkoutDisplay] = useState(false);
  const [eventCreated, setEventCreated] = useState<boolean>(false);

  const handleGenerateWorkout = async (category: WorkoutCategory) => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    setShowCategorySelector(false);
    
    try {
      console.log('🎯 Generating workout for category:', category.name);
      
      const workout = await groqService.generateWorkout({
        category,
        userFitnessLevel: 'intermediate', // TODO: Get from user profile
        availableTime: 30, // TODO: Allow user to customize
        equipment: ['bodyweight'], // TODO: Get from user preferences
        goals: ['fitness', 'strength'], // TODO: Get from user profile
      });
      
      setGeneratedWorkout(workout);
      setShowWorkoutDisplay(true);
    } catch (err) {
      console.error('❌ Workout generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate workout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRSVPToWorkout = async () => {
    if (!user || !generatedWorkout) return;
    
    setIsCreatingEvent(true);
    setError(null);
    
    try {
      console.log('🎯 Creating event and RSVPing to workout:', generatedWorkout.title);
      
      // Get user's current location for the event
      let userLocation;
      try {
        userLocation = await locationService.getCurrentLocation();
      } catch (locationError) {
        console.log('Could not get user location, using default');
        // Continue without location - service will handle fallback
      }
      
      // Create event and auto-RSVP user
      const result = await autoEventService.createEventFromWorkout(
        generatedWorkout,
        user.id,
        {
          userLocation,
          visibility: 'public',
          maxParticipants: 8,
        }
      );
      
      console.log('✅ Event created successfully:', result.event.id);
      setEventCreated(true);
      
      // Show success and close after delay
      setTimeout(() => {
        setShowWorkoutDisplay(false);
        setGeneratedWorkout(null);
        setEventCreated(false);
      }, 2000);
      
    } catch (err) {
      console.error('❌ Failed to create workout event:', err);
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setIsCreatingEvent(false);
    }
  };


  if (isLoading) {
    return (
      <View className="mb-6">
        <GlassCard>
          <View className="flex-row items-center py-4">
            <ActivityIndicator size="small" color="#EC4899" />
            <Text className="text-white/70 text-sm ml-3">
              🤖 Generating your workout with AI...
            </Text>
          </View>
        </GlassCard>
      </View>
    );
  }

  if (error) {
    return (
      <View className="mb-6">
        <GlassCard className="border-red-500/30">
          <View className="flex-row items-center justify-between">
            <Text className="text-red-400 text-sm flex-1">
              ⚠️ {error}
            </Text>
            <Pressable onPress={() => setError(null)}>
              <Text className="text-red-400 text-lg ml-2">✕</Text>
            </Pressable>
          </View>
        </GlassCard>
      </View>
    );
  }

  return (
    <>
      <View className="mb-6">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-white text-lg font-semibold">
            🤖 Workout Generator
          </Text>
        </View>

        <Pressable onPress={() => setShowCategorySelector(true)}>
          <GlassCard>
            <View className="flex-row items-center justify-between py-4">
              <View className="flex-row items-center flex-1">
                <Text className="text-2xl mr-3">🏋️‍♀️</Text>
                <View>
                  <Text className="text-white font-medium">
                    🤖 Generate Workout
                  </Text>
                  <Text className="text-white/60 text-sm">
                    Create AI workout events to join
                  </Text>
                </View>
              </View>
              <Text className="text-white/60 text-lg">›</Text>
            </View>
          </GlassCard>
        </Pressable>
      </View>

      {/* Category Selector Modal */}
      <Modal
        visible={showCategorySelector}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <WorkoutCategorySelector
          categories={WORKOUT_CATEGORIES}
          selectedCategory={null}
          onSelectCategory={handleGenerateWorkout}
          onClose={() => setShowCategorySelector(false)}
        />
      </Modal>

      {/* Workout Display Modal */}
      <Modal
        visible={showWorkoutDisplay}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        {generatedWorkout && (
          <WorkoutDisplay
            workout={generatedWorkout}
            onClose={() => {
              setShowWorkoutDisplay(false);
              setGeneratedWorkout(null);
              setEventCreated(false);
            }}
            onRSVPToWorkout={handleRSVPToWorkout}
            isCreatingEvent={isCreatingEvent}
            eventCreated={eventCreated}
          />
        )}
      </Modal>
    </>
  );
};