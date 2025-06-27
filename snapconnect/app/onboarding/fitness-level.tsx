import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../../src/components/ui/GradientCard';

type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';

export default function FitnessLevelScreen() {
  const [selectedLevel, setSelectedLevel] = useState<FitnessLevel | null>(null);
  const [selectedActivityLevel, setSelectedActivityLevel] = useState<ActivityLevel | null>(null);

  const fitnessLevels = [
    {
      id: 'beginner' as FitnessLevel,
      title: 'Beginner',
      description: 'Just starting out or getting back into fitness',
      emoji: '🌱',
      gradient: 'beginner' as const,
    },
    {
      id: 'intermediate' as FitnessLevel,
      title: 'Intermediate',
      description: 'Regular exercise routine, comfortable with basics',
      emoji: '🔥',
      gradient: 'intermediate' as const,
    },
    {
      id: 'advanced' as FitnessLevel,
      title: 'Advanced',
      description: 'Experienced athlete or fitness enthusiast',
      emoji: '⚡',
      gradient: 'advanced' as const,
    },
  ];

  const activityLevels = [
    {
      id: 'sedentary' as ActivityLevel,
      title: 'Sedentary',
      description: 'Mostly sitting, little to no exercise',
      emoji: '🪑',
    },
    {
      id: 'lightly_active' as ActivityLevel,
      title: 'Lightly Active',
      description: 'Light exercise 1-3 days per week',
      emoji: '🚶',
    },
    {
      id: 'moderately_active' as ActivityLevel,
      title: 'Moderately Active',
      description: 'Moderate exercise 3-5 days per week',
      emoji: '🏃',
    },
    {
      id: 'very_active' as ActivityLevel,
      title: 'Very Active',
      description: 'Hard exercise 6-7 days per week',
      emoji: '💪',
    },
    {
      id: 'extremely_active' as ActivityLevel,
      title: 'Extremely Active',
      description: 'Very hard exercise, physical job, or training',
      emoji: '🏆',
    },
  ];

  const handleContinue = () => {
    if (selectedLevel) {
      // Use activity level if selected, otherwise default to 'lightly_active'
      const activityLevel = selectedActivityLevel || 'lightly_active';
      
      // Try new enhanced flow first, fallback to original
      try {
        router.push({
          pathname: '/onboarding/health-baseline',
          params: { 
            fitnessLevel: selectedLevel,
            currentActivityLevel: activityLevel
          },
        });
      } catch (error) {
        // Fallback to original goals screen if health-baseline doesn't exist
        router.push({
          pathname: '/onboarding/goals',
          params: { 
            fitnessLevel: selectedLevel
          },
        });
      }
    }
  };

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F1F1F']}
      className="flex-1"
    >
      <View className="flex-1 px-6 pt-16 pb-8">
        {/* Header */}
        <View className="mb-12">
          <View className="flex-row items-center justify-between mb-4">
            <Pressable onPress={() => router.back()}>
              <Text className="text-[#EC4899] font-medium text-lg">← Back</Text>
            </Pressable>
            <Text className="text-gray-400">1 of 4</Text>
          </View>
          
          <Text className="text-3xl font-bold text-white mb-2">
            What's your fitness level?
          </Text>
          <Text className="text-gray-400 text-lg">
            This helps us personalize your experience and recommendations
          </Text>
        </View>

        {/* Fitness Level Options */}
        <ScrollView className="flex-1 mb-8" showsVerticalScrollIndicator={false}>
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-4">Experience Level</Text>
            {fitnessLevels.map((level) => (
              <Pressable
                key={level.id}
                onPress={() => setSelectedLevel(level.id)}
                className="mb-2"
              >
                <View
                  className={`bg-gray-800/50 border-2 rounded-xl p-3 ${
                    selectedLevel === level.id 
                      ? 'border-[#EC4899]' 
                      : 'border-gray-700'
                  }`}
                >
                  <View className="flex-row items-center">
                    <Text className="text-2xl mr-3">{level.emoji}</Text>
                    <View className="flex-1">
                      <Text className="text-white font-bold text-base">
                        {level.title}
                      </Text>
                      <Text className="text-gray-400 text-xs">
                        {level.description}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Current Activity Level (Optional) */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-2">Current Activity Level</Text>
            <Text className="text-gray-400 text-sm mb-4">
              How active are you right now? (Optional - helps us personalize better)
            </Text>
            {activityLevels.map((activity) => (
              <Pressable
                key={activity.id}
                onPress={() => setSelectedActivityLevel(activity.id)}
                className="mb-2"
              >
                <View
                  className={`bg-gray-800/50 border-2 rounded-xl p-3 ${
                    selectedActivityLevel === activity.id 
                      ? 'border-[#EC4899]' 
                      : 'border-gray-700'
                  }`}
                >
                  <View className="flex-row items-center">
                    <Text className="text-xl mr-3">{activity.emoji}</Text>
                    <View className="flex-1">
                      <Text className="text-white font-semibold text-sm">
                        {activity.title}
                      </Text>
                      <Text className="text-gray-400 text-xs">
                        {activity.description}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Continue Button */}
        <GradientCard
          gradient="primary"
          onPress={handleContinue}
          disabled={!selectedLevel}
          className={!selectedLevel ? 'opacity-50' : ''}
        >
          <Text className="text-white font-bold text-lg text-center">
            Continue
          </Text>
        </GradientCard>
      </View>
    </LinearGradient>
  );
}