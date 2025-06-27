import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../../src/components/ui/GradientCard';

type DietaryPreference = 'none' | 'vegetarian' | 'vegan' | 'keto' | 'paleo' | 'gluten_free' | 'dairy_free' | 'mediterranean';

export default function DietaryPreferencesScreen() {
  const { fitnessLevel, goals } = useLocalSearchParams();
  const [selectedPreferences, setSelectedPreferences] = useState<DietaryPreference[]>([]);

  const dietaryOptions = [
    {
      id: 'none' as DietaryPreference,
      title: 'No Restrictions',
      description: 'I eat everything',
      emoji: '🍽️',
    },
    {
      id: 'vegetarian' as DietaryPreference,
      title: 'Vegetarian',
      description: 'No meat, but dairy and eggs are okay',
      emoji: '🥗',
    },
    {
      id: 'vegan' as DietaryPreference,
      title: 'Vegan',
      description: 'No animal products',
      emoji: '🌱',
    },
    {
      id: 'keto' as DietaryPreference,
      title: 'Keto',
      description: 'High fat, low carb diet',
      emoji: '🥑',
    },
    {
      id: 'paleo' as DietaryPreference,
      title: 'Paleo',
      description: 'Whole foods, no processed items',
      emoji: '🥩',
    },
    {
      id: 'mediterranean' as DietaryPreference,
      title: 'Mediterranean',
      description: 'Fish, olive oil, vegetables, grains',
      emoji: '🐟',
    },
    {
      id: 'gluten_free' as DietaryPreference,
      title: 'Gluten-Free',
      description: 'No wheat, barley, or rye',
      emoji: '🌾',
    },
    {
      id: 'dairy_free' as DietaryPreference,
      title: 'Dairy-Free',
      description: 'No milk products',
      emoji: '🥛',
    },
  ];

  const togglePreference = (preferenceId: DietaryPreference) => {
    if (preferenceId === 'none') {
      setSelectedPreferences(['none']);
    } else {
      setSelectedPreferences(prev => {
        const filtered = prev.filter(id => id !== 'none');
        return filtered.includes(preferenceId)
          ? filtered.filter(id => id !== preferenceId)
          : [...filtered, preferenceId];
      });
    }
  };

  const handleContinue = () => {
    router.push({
      pathname: '/onboarding/workout-frequency',
      params: { 
        fitnessLevel: fitnessLevel as string,
        goals: goals as string,
        dietaryPreferences: selectedPreferences.join(','),
      },
    });
  };

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F1F1F']}
      className="flex-1"
    >
      <View className="flex-1 px-6 pt-16 pb-8">
        {/* Header */}
        <View className="mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Pressable onPress={() => router.back()}>
              <Text className="text-[#EC4899] font-medium text-lg">← Back</Text>
            </Pressable>
            <Text className="text-gray-400">3 of 4</Text>
          </View>
          
          <Text className="text-3xl font-bold text-white mb-2">
            Dietary preferences?
          </Text>
          <Text className="text-gray-400 text-lg">
            This helps us suggest better meal content
          </Text>
        </View>

        {/* Dietary Options */}
        <ScrollView className="flex-1 mb-8" showsVerticalScrollIndicator={false}>
          {dietaryOptions.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => togglePreference(option.id)}
              className="mb-4"
            >
              <View
                className={`bg-gray-800/50 border-2 rounded-2xl p-4 ${
                  selectedPreferences.includes(option.id)
                    ? 'border-[#EC4899]' 
                    : 'border-gray-700'
                }`}
              >
                <View className="flex-row items-center">
                  <Text className="text-3xl mr-4">{option.emoji}</Text>
                  <View className="flex-1">
                    <Text className="text-white font-bold text-lg mb-1">
                      {option.title}
                    </Text>
                    <Text className="text-gray-400 text-sm">
                      {option.description}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Continue Button */}
        <GradientCard
          gradient="primary"
          onPress={handleContinue}
        >
          <Text className="text-white font-bold text-lg text-center">
            Continue
          </Text>
        </GradientCard>
      </View>
    </LinearGradient>
  );
}