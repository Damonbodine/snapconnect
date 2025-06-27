import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/stores/authStore';
import { GradientCard } from '../src/components/ui/GradientCard';
import { getWorkoutIntensityEmoji, getWorkoutIntensityLabel } from '../src/types/user';

export default function EditProfileScreen() {
  const { profile, updateProfile } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [city, setCity] = useState(profile?.city || '');
  const [workoutIntensity, setWorkoutIntensity] = useState<'chill' | 'moderate' | 'intense'>(profile?.workout_intensity || 'moderate');
  
  // Character limits
  const BIO_MAX_LENGTH = 150;
  
  // Workout intensity options
  const intensityOptions: Array<{value: 'chill' | 'moderate' | 'intense', label: string, emoji: string}> = [
    { value: 'chill', label: getWorkoutIntensityLabel('chill'), emoji: getWorkoutIntensityEmoji('chill') },
    { value: 'moderate', label: getWorkoutIntensityLabel('moderate'), emoji: getWorkoutIntensityEmoji('moderate') },
    { value: 'intense', label: getWorkoutIntensityLabel('intense'), emoji: getWorkoutIntensityEmoji('intense') },
  ];

  const handleSave = async () => {
    // Validate bio length
    if (bio.length > BIO_MAX_LENGTH) {
      Alert.alert('Error', `Bio must be ${BIO_MAX_LENGTH} characters or less`);
      return;
    }
    
    setIsLoading(true);
    try {
      const updates: any = {};
      
      // Only include fields that have changed
      if (fullName !== profile?.full_name) {
        updates.full_name = fullName || null;
      }
      
      if (bio !== profile?.bio) {
        updates.bio = bio || null;
      }
      
      if (city !== profile?.city) {
        updates.city = city || null;
      }
      
      if (workoutIntensity !== profile?.workout_intensity) {
        updates.workout_intensity = workoutIntensity;
      }
      
      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await updateProfile(updates);
        Alert.alert('Success', 'Profile updated successfully!');
      }
      
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F1F1F']}
      className="flex-1"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-16 pb-4">
        <Pressable 
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        
        <Text className="text-white text-xl font-bold">
          Edit Profile
        </Text>
        
        <Pressable 
          onPress={handleSave}
          disabled={isLoading}
          className="w-10 h-10 items-center justify-center"
        >
          <Text className="text-[#EC4899] font-semibold">
            {isLoading ? '...' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Full Name Field */}
        <View className="mb-6">
          <Text className="text-white text-lg font-semibold mb-3">
            Full Name
          </Text>
          <View className="bg-gray-800/30 rounded-2xl p-4">
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor="#9CA3AF"
              className="text-white text-base"
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Bio Field */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white text-lg font-semibold">
              ✨ Bio
            </Text>
            <Text className={`text-sm ${bio.length > BIO_MAX_LENGTH ? 'text-red-400' : bio.length > BIO_MAX_LENGTH * 0.8 ? 'text-yellow-400' : 'text-gray-500'}`}>
              {bio.length}/{BIO_MAX_LENGTH}
            </Text>
          </View>
          <View className="bg-gray-800/30 rounded-2xl p-4">
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Share your fitness motto or what motivates you..."
              placeholderTextColor="#9CA3AF"
              className="text-white text-base"
              multiline
              numberOfLines={3}
              maxLength={BIO_MAX_LENGTH}
              textAlignVertical="top"
            />
          </View>
          <Text className="text-gray-500 text-sm mt-2">
            Let others know what drives your fitness journey! Keep it under {BIO_MAX_LENGTH} characters.
          </Text>
        </View>

        {/* City Field */}
        <View className="mb-6">
          <Text className="text-white text-lg font-semibold mb-3">
            📍 City
          </Text>
          <View className="bg-gray-800/30 rounded-2xl p-4">
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Enter your city"
              placeholderTextColor="#9CA3AF"
              className="text-white text-base"
              autoCapitalize="words"
            />
          </View>
          <Text className="text-gray-500 text-sm mt-2">
            Let others know where you're based for local fitness events and connections
          </Text>
        </View>

        {/* Workout Intensity Field */}
        <View className="mb-6">
          <Text className="text-white text-lg font-semibold mb-3">
            ⚡ Workout Intensity
          </Text>
          <View className="space-y-3">
            {intensityOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setWorkoutIntensity(option.value)}
                className={`bg-gray-800/30 rounded-2xl p-4 border-2 ${
                  workoutIntensity === option.value 
                    ? 'border-[#EC4899]' 
                    : 'border-transparent'
                }`}
              >
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-3">{option.emoji}</Text>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-base">
                      {option.label}
                    </Text>
                    <Text className="text-gray-400 text-sm">
                      {option.value === 'chill' && 'Relaxed pace, focus on form and flexibility'}
                      {option.value === 'moderate' && 'Balanced approach, steady progress'}
                      {option.value === 'intense' && 'High energy, pushing limits, max effort'}
                    </Text>
                  </View>
                  {workoutIntensity === option.value && (
                    <Ionicons name="checkmark-circle" size={24} color="#EC4899" />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
          <Text className="text-gray-500 text-sm mt-2">
            Help others find workout partners with matching energy levels
          </Text>
        </View>

        {/* Current Profile Info */}
        <View className="bg-gray-800/20 rounded-2xl p-4 mb-6">
          <Text className="text-white text-lg font-semibold mb-3">
            Current Profile
          </Text>
          <Text className="text-gray-400 text-sm mb-1">
            Username: @{profile?.username}
          </Text>
          <Text className="text-gray-400 text-sm mb-1">
            Email: {profile?.email}
          </Text>
          {profile?.bio && (
            <Text className="text-gray-400 text-sm mb-1">
              Bio: "{profile.bio}"
            </Text>
          )}
          {profile?.city && (
            <Text className="text-gray-400 text-sm mb-1">
              City: {profile.city}
            </Text>
          )}
          <Text className="text-gray-400 text-sm mb-1">
            Fitness Level: {profile?.fitness_level?.charAt(0).toUpperCase() + profile?.fitness_level?.slice(1)}
          </Text>
          <Text className="text-gray-400 text-sm mb-1">
            Intensity: {getWorkoutIntensityEmoji(profile?.workout_intensity || 'moderate')} {getWorkoutIntensityLabel(profile?.workout_intensity || 'moderate')}
          </Text>
          <Text className="text-gray-400 text-sm">
            Goals: {profile?.goals?.join(', ')}
          </Text>
        </View>

        {/* Note about other fields */}
        <View className="bg-blue-900/20 rounded-2xl p-4 mb-6">
          <Text className="text-blue-300 text-sm">
            💡 To update your fitness goals, level, or other preferences, complete the onboarding flow again from settings.
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}