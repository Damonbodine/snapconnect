import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../../src/components/ui/GradientCard';

type DietaryPreference = 'none' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';
type ExercisePreference = 'gym' | 'outdoor' | 'home' | 'classes' | 'sports';
type MotivationStyle = 'competitive' | 'supportive' | 'analytical' | 'fun';
type CoachingStyle = 'gentle' | 'firm' | 'motivational' | 'educational';

export default function LifestylePreferencesScreen() {
  const params = useLocalSearchParams();
  
  const [dietaryPreferences, setDietaryPreferences] = useState<DietaryPreference[]>([]);
  const [exercisePreferences, setExercisePreferences] = useState<ExercisePreference[]>([]);
  const [coachingStyle, setCoachingStyle] = useState<CoachingStyle | null>(null);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [hasEquipment, setHasEquipment] = useState<boolean | null>(null);
  const [equipmentList, setEquipmentList] = useState('');

  const dietaryOptions = [
    { id: 'none' as DietaryPreference, title: 'No Restrictions', emoji: '🍽️' },
    { id: 'vegetarian' as DietaryPreference, title: 'Vegetarian', emoji: '🥬' },
    { id: 'vegan' as DietaryPreference, title: 'Vegan', emoji: '🌱' },
    { id: 'pescatarian' as DietaryPreference, title: 'Pescatarian', emoji: '🐟' },
    { id: 'keto' as DietaryPreference, title: 'Keto', emoji: '🥑' },
    { id: 'paleo' as DietaryPreference, title: 'Paleo', emoji: '🥩' },
    { id: 'mediterranean' as DietaryPreference, title: 'Mediterranean', emoji: '🫒' },
  ];

  const exerciseOptions = [
    { id: 'gym' as ExercisePreference, title: 'Gym Workouts', emoji: '🏋️', description: 'Weight training, machines' },
    { id: 'outdoor' as ExercisePreference, title: 'Outdoor Activities', emoji: '🏃', description: 'Running, hiking, cycling' },
    { id: 'home' as ExercisePreference, title: 'Home Workouts', emoji: '🏠', description: 'Bodyweight, online classes' },
    { id: 'classes' as ExercisePreference, title: 'Fitness Classes', emoji: '🧘', description: 'Yoga, pilates, dance' },
    { id: 'sports' as ExercisePreference, title: 'Sports', emoji: '⚽', description: 'Team sports, racquet sports' },
  ];


  const coachingOptions = [
    { id: 'gentle' as CoachingStyle, title: 'Gentle', emoji: '💙', description: 'Encouraging, patient, understanding' },
    { id: 'firm' as CoachingStyle, title: 'Firm', emoji: '💪', description: 'Direct, structured, accountability' },
    { id: 'motivational' as CoachingStyle, title: 'Motivational', emoji: '🔥', description: 'Inspiring, energetic, push harder' },
    { id: 'educational' as CoachingStyle, title: 'Educational', emoji: '🎓', description: 'Informative, explanatory, teach why' },
  ];

  const weekDays = [
    { id: 'monday', title: 'Mon' },
    { id: 'tuesday', title: 'Tue' },
    { id: 'wednesday', title: 'Wed' },
    { id: 'thursday', title: 'Thu' },
    { id: 'friday', title: 'Fri' },
    { id: 'saturday', title: 'Sat' },
    { id: 'sunday', title: 'Sun' },
  ];

  const toggleDietaryPreference = (preference: DietaryPreference) => {
    if (preference === 'none') {
      setDietaryPreferences(['none']);
    } else {
      setDietaryPreferences(prev => {
        const filtered = prev.filter(p => p !== 'none');
        return prev.includes(preference) 
          ? filtered.filter(p => p !== preference)
          : [...filtered, preference];
      });
    }
  };

  const toggleExercisePreference = (preference: ExercisePreference) => {
    setExercisePreferences(prev => 
      prev.includes(preference)
        ? prev.filter(p => p !== preference)
        : [...prev, preference]
    );
  };

  const toggleDay = (day: string) => {
    setAvailableDays(prev => 
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const handleContinue = () => {
    router.push({
      pathname: '/onboarding/coaching-setup',
      params: {
        ...params,
        dietaryPreferences: dietaryPreferences.join(','),
        exercisePreferences: exercisePreferences.join(','),
        coachingStyle: coachingStyle || '',
        availableDays: availableDays.join(','),
        hasEquipment: hasEquipment?.toString() || '',
        equipmentList: equipmentList,
      },
    });
  };

  const canContinue = exercisePreferences.length > 0 && coachingStyle && availableDays.length > 0;

  return (
    <LinearGradient colors={['#0F0F0F', '#1F1F1F']} className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32 }}>
        <View className="mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Pressable onPress={() => router.back()}>
              <Text className="text-[#EC4899] font-medium text-lg">← Back</Text>
            </Pressable>
            <Text className="text-gray-400">4 of 7</Text>
          </View>
          
          <Text className="text-3xl font-bold text-white mb-2">
            Your Lifestyle
          </Text>
          <Text className="text-gray-400 text-lg">
            Help us understand your preferences and schedule
          </Text>
        </View>

        {/* Dietary Preferences */}
        <View className="mb-8">
          <Text className="text-white font-semibold text-xl mb-4">
            🍽️ Dietary Preferences
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {dietaryOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => toggleDietaryPreference(option.id)}
                className="w-[48%] mb-3"
              >
                <View
                  className={`bg-gray-800/50 border-2 rounded-xl p-3 min-h-[80px] justify-center ${
                    dietaryPreferences.includes(option.id)
                      ? 'border-[#EC4899]' 
                      : 'border-gray-700'
                  }`}
                >
                  <Text className="text-2xl text-center mb-1">{option.emoji}</Text>
                  <Text className="text-white font-medium text-center text-sm">
                    {option.title}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Exercise Preferences */}
        <View className="mb-8">
          <Text className="text-white font-semibold text-xl mb-4">
            💪 Exercise Preferences
          </Text>
          <Text className="text-gray-400 text-sm mb-4">Select all that interest you</Text>
          <View className="space-y-3">
            {exerciseOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => toggleExercisePreference(option.id)}
                className={`bg-gray-800/50 border-2 rounded-xl p-4 ${
                  exercisePreferences.includes(option.id)
                    ? 'border-[#EC4899]' 
                    : 'border-gray-700'
                }`}
              >
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-3">{option.emoji}</Text>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-lg">{option.title}</Text>
                    <Text className="text-gray-400 text-sm">{option.description}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>


        {/* Coaching Style */}
        <View className="mb-8">
          <Text className="text-white font-semibold text-xl mb-4">
            🗣️ Preferred Coaching Style
          </Text>
          <View className="space-y-3">
            {coachingOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => setCoachingStyle(option.id)}
                className={`bg-gray-800/50 border-2 rounded-xl p-4 ${
                  coachingStyle === option.id
                    ? 'border-[#EC4899]' 
                    : 'border-gray-700'
                }`}
              >
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-3">{option.emoji}</Text>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-lg">{option.title}</Text>
                    <Text className="text-gray-400 text-sm">{option.description}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Available Days */}
        <View className="mb-8">
          <Text className="text-white font-semibold text-xl mb-4">
            📅 Available Workout Days
          </Text>
          <Text className="text-gray-400 text-sm mb-4">Select all days you can typically work out</Text>
          <View className="flex-row flex-wrap justify-between">
            {weekDays.map((day) => (
              <Pressable
                key={day.id}
                onPress={() => toggleDay(day.id)}
                className={`w-[13%] aspect-square rounded-xl border-2 justify-center items-center mb-2 ${
                  availableDays.includes(day.id)
                    ? 'border-[#EC4899] bg-[#EC4899]/20' 
                    : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                <Text className="text-white font-semibold text-sm">{day.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Equipment */}
        <View className="mb-8">
          <Text className="text-white font-semibold text-xl mb-4">
            🏋️ Home Equipment
          </Text>
          <View className="flex-row mb-4">
            <Pressable
              onPress={() => setHasEquipment(false)}
              className={`flex-1 mr-2 p-4 rounded-xl border-2 ${
                hasEquipment === false
                  ? 'border-[#EC4899] bg-[#EC4899]/20' 
                  : 'border-gray-700 bg-gray-800/50'
              }`}
            >
              <Text className="text-white font-semibold text-center">No Equipment</Text>
            </Pressable>
            <Pressable
              onPress={() => setHasEquipment(true)}
              className={`flex-1 ml-2 p-4 rounded-xl border-2 ${
                hasEquipment === true
                  ? 'border-[#EC4899] bg-[#EC4899]/20' 
                  : 'border-gray-700 bg-gray-800/50'
              }`}
            >
              <Text className="text-white font-semibold text-center">I Have Equipment</Text>
            </Pressable>
          </View>
          
          {hasEquipment && (
            <TextInput
              value={equipmentList}
              onChangeText={setEquipmentList}
              placeholder="Dumbbells, resistance bands, yoga mat..."
              placeholderTextColor="#6B7280"
              className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white"
              multiline
            />
          )}
        </View>

        <GradientCard
          gradient="primary"
          onPress={handleContinue}
          disabled={!canContinue}
          className={!canContinue ? 'opacity-50' : ''}
        >
          <Text className="text-white font-bold text-lg text-center">
            Continue
          </Text>
        </GradientCard>
      </ScrollView>
    </LinearGradient>
  );
}