import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../../src/components/ui/GradientCard';

export default function OnboardingWelcome() {
  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F1F1F']}
      className="flex-1"
    >
      <View className="flex-1 px-6 pt-20 pb-8 justify-between">
        {/* Header */}
        <View className="items-center">
          <Text className="text-5xl font-bold text-white mb-4 text-center">
            Welcome to{'\n'}SnapConnect
          </Text>
          <Text className="text-xl text-gray-400 text-center mb-12">
            Let's personalize your fitness journey
          </Text>
          
          {/* Fitness Emoji */}
          <Text className="text-8xl mb-12">💪</Text>
        </View>

        {/* Benefits */}
        <View className="mb-12">
          <View className="mb-6">
            <Text className="text-white text-lg font-medium mb-2">
              🎯 Personalized content just for you
            </Text>
            <Text className="text-gray-400">
              AI-powered recommendations based on your fitness level and goals
            </Text>
          </View>
          
          <View className="mb-6">
            <Text className="text-white text-lg font-medium mb-2">
              🤝 Connect with like-minded people
            </Text>
            <Text className="text-gray-400">
              Find workout buddies and join fitness events in your area
            </Text>
          </View>
          
          <View className="mb-6">
            <Text className="text-white text-lg font-medium mb-2">
              📈 Track your progress
            </Text>
            <Text className="text-gray-400">
              Share your fitness journey and celebrate achievements
            </Text>
          </View>
        </View>

        {/* Get Started Button */}
        <View>
          <GradientCard
            gradient="primary"
            onPress={() => router.push('/onboarding/fitness-level')}
            className="mb-4"
          >
            <Text className="text-white font-bold text-xl text-center">
              Get Started
            </Text>
          </GradientCard>
          
          <Text className="text-gray-400 text-center text-sm">
            This will only take a few minutes
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}