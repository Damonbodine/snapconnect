import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../components/ui/GradientCard';

export const DiscoverScreen = () => {
  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F2937']}
      className="flex-1"
    >
      <ScrollView className="flex-1 px-4 pt-16 pb-24">
        <Text className="text-white text-2xl font-bold mb-6">
          Discover Fitness Content
        </Text>
        
        <View className="space-y-4">
          <GradientCard gradient="cardio" className="w-full">
            <Text className="text-white text-lg font-semibold mb-2">
              🔥 Morning Cardio Challenge
            </Text>
            <Text className="text-white/80 text-sm">
              Join Sarah's 30-minute HIIT workout this morning at Central Park
            </Text>
          </GradientCard>

          <GradientCard gradient="strength" className="w-full">
            <Text className="text-white text-lg font-semibold mb-2">
              💪 Strength Training Tips
            </Text>
            <Text className="text-white/80 text-sm">
              AI-generated workout plan based on your recent progress
            </Text>
          </GradientCard>

          <GradientCard gradient="flexibility" className="w-full">
            <Text className="text-white text-lg font-semibold mb-2">
              🧘 Evening Yoga Flow
            </Text>
            <Text className="text-white/80 text-sm">
              Relax and unwind with this 20-minute guided session
            </Text>
          </GradientCard>

          <GradientCard gradient="recovery" className="w-full">
            <Text className="text-white text-lg font-semibold mb-2">
              🛀 Recovery Day Routine
            </Text>
            <Text className="text-white/80 text-sm">
              Personalized recovery tips based on your workout intensity
            </Text>
          </GradientCard>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};