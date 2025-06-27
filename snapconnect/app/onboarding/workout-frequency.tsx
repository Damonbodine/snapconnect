import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../../src/components/ui/GradientCard';

export default function WorkoutFrequencyScreen() {
  const { fitnessLevel, goals, dietaryPreferences } = useLocalSearchParams();
  const [selectedFrequency, setSelectedFrequency] = useState<number | null>(null);

  const frequencyOptions = [
    {
      value: 1,
      title: '1-2 times per week',
      description: 'Just getting started or maintaining',
      emoji: '🌱',
    },
    {
      value: 3,
      title: '3-4 times per week',
      description: 'Regular fitness routine',
      emoji: '💪',
    },
    {
      value: 5,
      title: '5-6 times per week',
      description: 'Very active lifestyle',
      emoji: '🔥',
    },
    {
      value: 7,
      title: 'Daily workouts',
      description: 'Fitness is life!',
      emoji: '⚡',
    },
  ];

  const handleContinue = () => {
    if (selectedFrequency !== null) {
      router.push({
        pathname: '/onboarding/complete',
        params: { 
          fitnessLevel: fitnessLevel as string,
          goals: goals as string,
          dietaryPreferences: dietaryPreferences as string,
          workoutFrequency: selectedFrequency.toString(),
        },
      });
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
            <Text className="text-gray-400">4 of 4</Text>
          </View>
          
          <Text className="text-3xl font-bold text-white mb-2">
            How often do you work out?
          </Text>
          <Text className="text-gray-400 text-lg">
            This helps us tailor your content frequency
          </Text>
        </View>

        {/* Frequency Options */}
        <View className="flex-1 mb-8">
          {frequencyOptions.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setSelectedFrequency(option.value)}
              className="mb-4"
            >
              <View
                className={`bg-gray-800/50 border-2 rounded-2xl p-6 ${
                  selectedFrequency === option.value 
                    ? 'border-[#EC4899]' 
                    : 'border-gray-700'
                }`}
              >
                <View className="flex-row items-center mb-3">
                  <Text className="text-4xl mr-4">{option.emoji}</Text>
                  <Text className="text-white font-bold text-xl">
                    {option.title}
                  </Text>
                </View>
                <Text className="text-gray-400 text-base">
                  {option.description}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Continue Button */}
        <GradientCard
          gradient="primary"
          onPress={handleContinue}
          disabled={selectedFrequency === null}
          className={selectedFrequency === null ? 'opacity-50' : ''}
        >
          <Text className="text-white font-bold text-lg text-center">
            Complete Setup
          </Text>
        </GradientCard>
      </View>
    </LinearGradient>
  );
}