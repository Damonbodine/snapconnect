import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../components/ui/GradientCard';
import { GlassCard } from '../components/ui/GlassCard';

export const ProfileScreen = () => {
  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F2937']}
      className="flex-1"
    >
      <ScrollView className="flex-1 px-4 pt-16 pb-24">
        <View className="items-center mb-8">
          <View className="w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full items-center justify-center mb-4">
            <Text className="text-white text-2xl font-bold">DM</Text>
          </View>
          <Text className="text-white text-xl font-bold">Damon B.</Text>
          <Text className="text-white/60 text-sm">@damonbodine</Text>
          <Text className="text-white/80 text-sm mt-2">
            Intermediate • 5 months on SnapConnect
          </Text>
        </View>

        <View className="flex-row justify-between mb-8">
          <GlassCard className="flex-1 mr-2">
            <Text className="text-white text-2xl font-bold text-center">127</Text>
            <Text className="text-white/60 text-xs text-center">Workouts</Text>
          </GlassCard>
          <GlassCard className="flex-1 mx-1">
            <Text className="text-white text-2xl font-bold text-center">43</Text>
            <Text className="text-white/60 text-xs text-center">Events</Text>
          </GlassCard>
          <GlassCard className="flex-1 ml-2">
            <Text className="text-white text-2xl font-bold text-center">89</Text>
            <Text className="text-white/60 text-xs text-center">Buddies</Text>
          </GlassCard>
        </View>

        <View className="mb-8">
          <Text className="text-white text-lg font-semibold mb-4">
            🎯 Current Goals
          </Text>
          <View className="space-y-3">
            <GradientCard gradient="success" className="w-full">
              <Text className="text-white text-sm font-semibold mb-1">
                Weight Loss Journey
              </Text>
              <View className="flex-row justify-between items-center">
                <Text className="text-white/80 text-xs">Progress: 8/15 lbs</Text>
                <Text className="text-white/80 text-xs">53% complete</Text>
              </View>
            </GradientCard>
            
            <GradientCard gradient="strength" className="w-full">
              <Text className="text-white text-sm font-semibold mb-1">
                Bench Press Goal
              </Text>
              <View className="flex-row justify-between items-center">
                <Text className="text-white/80 text-xs">Current: 185 lbs</Text>
                <Text className="text-white/80 text-xs">Target: 225 lbs</Text>
              </View>
            </GradientCard>
          </View>
        </View>

        <View className="mb-8">
          <Text className="text-white text-lg font-semibold mb-4">
            📊 Recent Activity
          </Text>
          <GlassCard>
            <Text className="text-white/80 text-sm mb-2">This Week:</Text>
            <Text className="text-white text-sm">🏃‍♂️ 3 cardio sessions</Text>
            <Text className="text-white text-sm">💪 2 strength workouts</Text>
            <Text className="text-white text-sm">🧘 1 yoga session</Text>
            <Text className="text-white text-sm">📅 Attended 2 events</Text>
          </GlassCard>
        </View>

        <View className="mb-8">
          <Text className="text-white text-lg font-semibold mb-4">
            ✨ AI Insights
          </Text>
          <GlassCard>
            <Text className="text-white text-sm font-medium mb-2">
              Your Fitness Journey Analysis
            </Text>
            <Text className="text-white/80 text-xs mb-1">
              • Consistency improved 23% this month
            </Text>
            <Text className="text-white/80 text-xs mb-1">
              • Best workout time: 6-8 AM
            </Text>
            <Text className="text-white/80 text-xs mb-1">
              • Strength gains trending upward
            </Text>
            <Text className="text-white/80 text-xs">
              • Consider adding 1 more rest day
            </Text>
          </GlassCard>
        </View>

        <View>
          <Text className="text-white text-lg font-semibold mb-4">
            ⚙️ Settings
          </Text>
          <View className="space-y-3">
            <Pressable>
              <GlassCard>
                <Text className="text-white">Edit Profile</Text>
              </GlassCard>
            </Pressable>
            <Pressable>
              <GlassCard>
                <Text className="text-white">AI Preferences</Text>
              </GlassCard>
            </Pressable>
            <Pressable>
              <GlassCard>
                <Text className="text-white">Privacy Settings</Text>
              </GlassCard>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};