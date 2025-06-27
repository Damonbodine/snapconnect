import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../../src/components/ui/GradientCard';
import { useAuthStore } from '../../src/stores/authStore';

export default function CoachingSetupScreen() {
  const params = useLocalSearchParams();
  const { createProfile } = useAuthStore();
  
  const [username, setUsername] = useState('');
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  const handleCompleteOnboarding = async () => {
    if (!username.trim()) {
      Alert.alert('Username Required', 'Please enter a username to continue.');
      return;
    }

    setIsCreatingProfile(true);

    try {
      // Parse parameters
      const goals = (params.goals as string)?.split(',') || [];
      const dietaryPreferences = (params.dietaryPreferences as string)?.split(',').filter(Boolean) || [];
      const exercisePreferences = (params.exercisePreferences as string)?.split(',').filter(Boolean) || [];
      const availableDays = (params.availableDays as string)?.split(',').filter(Boolean) || [];

      // Build profile data
      const profileData = {
        username: username.trim(),
        fitness_level: params.fitnessLevel as string || 'beginner',
        goals: goals,
        
        // Health baseline data
        current_weight_kg: parseFloat(params.currentWeightKg as string) || null,
        target_weight_kg: parseFloat(params.targetWeightKg as string) || null,
        height_cm: parseFloat(params.heightCm as string) || null,
        current_activity_level: params.currentActivityLevel as string || 'sedentary',
        daily_step_goal: parseInt(params.dailyStepGoal as string) || 10000,
        weekly_workout_goal: parseInt(params.weeklyWorkoutGoal as string) || 3,
        injuries_limitations: params.injuriesLimitations as string || null,
        
        // SMART goal data
        primary_goal: params.primaryGoal as string || goals[0],
        smart_goal_target: params.smartGoalTarget as string || null,
        smart_goal_value: params.smartGoalValue as string || null,
        smart_goal_unit: params.smartGoalUnit as string || null,
        smart_goal_timeframe: params.smartGoalTimeframe as string || null,
        smart_goal_why: params.smartGoalWhy as string || null,
        smart_goal_target_date: params.smartGoalTargetDate as string || null,
        
        // Lifestyle preferences
        dietary_preferences: dietaryPreferences,
        exercise_preferences: exercisePreferences,
        coaching_style: params.coachingStyle as string || 'gentle',
        available_workout_days: availableDays,
        has_equipment: params.hasEquipment === 'true',
        equipment_list: params.equipmentList as string || null,
        
        
        // Default values
        privacy_level: 'friends',
        measurement_system: 'metric',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      await createProfile(profileData);
      
      // Navigate to user profile after successful onboarding
      router.replace('/(tabs)/profile');
      
    } catch (error: any) {
      console.error('Profile creation error:', error);
      Alert.alert(
        'Setup Error', 
        error.message || 'Failed to complete setup. Please try again.'
      );
    } finally {
      setIsCreatingProfile(false);
    }
  };

  return (
    <LinearGradient colors={['#0F0F0F', '#1F1F1F']} className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32 }}>
        <View className="mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Pressable onPress={() => router.back()}>
              <Text className="text-[#EC4899] font-medium text-lg">← Back</Text>
            </Pressable>
            <Text className="text-gray-400">7 of 7</Text>
          </View>
          
          <Text className="text-3xl font-bold text-white mb-2">
            Final Setup
          </Text>
          <Text className="text-gray-400 text-lg">
            Choose your username and complete your profile
          </Text>
        </View>

        {/* Username */}
        <View className="mb-8">
          <Text className="text-white font-semibold text-xl mb-4">
            👤 Choose Your Username
          </Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Enter a unique username"
            placeholderTextColor="#6B7280"
            className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text className="text-gray-400 text-sm mt-2">
            This is how other users will find you on SnapConnect
          </Text>
        </View>


        {/* Summary */}
        <View className="bg-gray-800/30 rounded-2xl p-6 mb-8">
          <Text className="text-white font-semibold text-lg mb-3">🎉 You're All Set!</Text>
          <Text className="text-gray-400 text-base">
            We'll use your preferences to create personalized content, suggest workouts, and connect you with like-minded fitness enthusiasts. Your AI coach will help guide your fitness journey.
          </Text>
        </View>

        <GradientCard
          gradient="primary"
          onPress={handleCompleteOnboarding}
          disabled={!username.trim() || isCreatingProfile}
          className={(!username.trim() || isCreatingProfile) ? 'opacity-50' : ''}
        >
          <Text className="text-white font-bold text-lg text-center">
            {isCreatingProfile ? 'Creating Your Profile...' : 'Complete Setup'}
          </Text>
        </GradientCard>
      </ScrollView>
    </LinearGradient>
  );
}