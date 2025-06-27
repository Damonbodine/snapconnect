import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../../src/components/ui/GradientCard';

type Goal = 'weight_loss' | 'muscle_gain' | 'endurance' | 'wellness' | 'strength' | 'flexibility';

export default function GoalsScreen() {
  const { fitnessLevel } = useLocalSearchParams();
  const [selectedGoals, setSelectedGoals] = useState<Goal[]>([]);

  const goals = [
    {
      id: 'weight_loss' as Goal,
      title: 'Weight Loss',
      description: 'Burn calories and lose weight',
      emoji: '🎯',
    },
    {
      id: 'muscle_gain' as Goal,
      title: 'Muscle Gain',
      description: 'Build muscle and strength',
      emoji: '💪',
    },
    {
      id: 'endurance' as Goal,
      title: 'Endurance',
      description: 'Improve cardiovascular fitness',
      emoji: '🏃',
    },
    {
      id: 'strength' as Goal,
      title: 'Strength',
      description: 'Increase overall strength',
      emoji: '🏋️',
    },
    {
      id: 'flexibility' as Goal,
      title: 'Flexibility',
      description: 'Improve mobility and flexibility',
      emoji: '🧘',
    },
    {
      id: 'wellness' as Goal,
      title: 'Overall Wellness',
      description: 'Focus on mental and physical health',
      emoji: '✨',
    },
  ];

  const toggleGoal = (goalId: Goal) => {
    setSelectedGoals(prev => 
      prev.includes(goalId)
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    );
  };

  const handleContinue = () => {
    if (selectedGoals.length > 0) {
      router.push({
        pathname: '/onboarding/dietary-preferences',
        params: { 
          fitnessLevel: fitnessLevel as string,
          goals: selectedGoals.join(','),
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
            <Text className="text-gray-400">2 of 4</Text>
          </View>
          
          <Text className="text-3xl font-bold text-white mb-2">
            What are your goals?
          </Text>
          <Text className="text-gray-400 text-lg">
            Select all that apply (you can change these later)
          </Text>
        </View>

        {/* Goals Grid */}
        <View className="flex-1 mb-8">
          <View className="flex-row flex-wrap justify-between">
            {goals.map((goal) => (
              <Pressable
                key={goal.id}
                onPress={() => toggleGoal(goal.id)}
                className="w-[48%] mb-4"
              >
                <View
                  className={`bg-gray-800/50 border-2 rounded-2xl p-4 ${
                    selectedGoals.includes(goal.id)
                      ? 'border-[#EC4899]' 
                      : 'border-gray-700'
                  }`}
                >
                  <Text className="text-3xl mb-2 text-center">{goal.emoji}</Text>
                  <Text className="text-white font-bold text-lg text-center mb-1">
                    {goal.title}
                  </Text>
                  <Text className="text-gray-400 text-sm text-center">
                    {goal.description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Selected Goals Count */}
        {selectedGoals.length > 0 && (
          <Text className="text-gray-400 text-center mb-4">
            {selectedGoals.length} goal{selectedGoals.length !== 1 ? 's' : ''} selected
          </Text>
        )}

        {/* Continue Button */}
        <GradientCard
          gradient="primary"
          onPress={handleContinue}
          disabled={selectedGoals.length === 0}
          className={selectedGoals.length === 0 ? 'opacity-50' : ''}
        >
          <Text className="text-white font-bold text-lg text-center">
            Continue
          </Text>
        </GradientCard>
      </View>
    </LinearGradient>
  );
}