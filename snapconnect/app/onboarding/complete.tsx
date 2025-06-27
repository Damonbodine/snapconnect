import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Alert, Image, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { GradientCard } from '../../src/components/ui/GradientCard';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/services/supabase';

export default function CompleteOnboardingScreen() {
  const { fitnessLevel, goals, dietaryPreferences, workoutFrequency } = useLocalSearchParams();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { createProfile, user, isLoading } = useAuthStore();

  // Debug: Log received parameters (only once)
  useEffect(() => {
    console.log('Onboarding params:', { fitnessLevel, goals, dietaryPreferences, workoutFrequency });
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string): Promise<string | null> => {
    try {
      setUploading(true);
      
      // Get file extension
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      
      console.log('Uploading avatar:', { fileName, userId: user?.id, uri });

      // Read the file as base64 using expo-file-system (as per Supabase docs)
      const base64 = await FileSystem.readAsStringAsync(uri, { 
        encoding: FileSystem.EncodingType.Base64 
      });

      console.log('Base64 string length:', base64.length);
      console.log('Base64 preview:', base64.substring(0, 50) + '...');

      // Decode base64 to ArrayBuffer
      const arrayBuffer = decode(base64);
      console.log('ArrayBuffer size:', arrayBuffer.byteLength);

      // Upload to Supabase Storage using ArrayBuffer directly
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true
        });

      if (error) {
        console.error('Avatar upload error:', error);
        Alert.alert('Upload Error', error.message);
        return null;
      }

      console.log('Upload successful:', data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrl);
      
      // Add cache buster to ensure fresh image
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
      return urlWithCacheBuster;
    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert('Upload Failed', 'Please try again');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

    try {
      // Upload avatar if selected
      let avatarUrl = null;
      if (avatarUri) {
        avatarUrl = await uploadAvatar(avatarUri);
      }

      const profileData = {
        username: username.trim(),
        full_name: fullName.trim() || null,
        avatar_url: avatarUrl,
        fitness_level: fitnessLevel as 'beginner' | 'intermediate' | 'advanced',
        goals: (goals as string)?.split(',') || [],
        dietary_preferences: (dietaryPreferences as string)?.split(',').filter(Boolean) || [],
        workout_frequency: parseInt(workoutFrequency as string) || 3,
      };

      console.log('Calling createProfile with:', profileData);
      await createProfile(profileData);
      console.log('Profile created, navigating to tabs');
      router.replace('/(tabs)/discover');
    } catch (error: any) {
      console.error('Profile creation failed:', error);
      Alert.alert('Error', error.message || 'Failed to create profile');
    }
  };

  // Auto-fill full name from user email if available
  useEffect(() => {
    if (user?.email && !fullName) {
      const emailName = user.email.split('@')[0];
      const formattedName = emailName
        .split(/[._-]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
      setFullName(formattedName);
    }
  }, [user]);

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F1F1F']}
      className="flex-1"
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <View className="items-center mb-8">
          <Text className="text-6xl mb-2">🎉</Text>
          <Text className="text-3xl font-bold text-white mb-2 text-center">
            Almost there!
          </Text>
          <Text className="text-gray-400 text-lg text-center">
            Just a few more details to complete your profile
          </Text>
        </View>

        {/* Profile Summary */}
        <View className="bg-gray-800/30 rounded-2xl p-6 mb-8">
          <Text className="text-white font-bold text-lg mb-4">Your Profile Summary:</Text>
          
          <View className="mb-3">
            <Text className="text-gray-400">Fitness Level:</Text>
            <Text className="text-white capitalize">{fitnessLevel}</Text>
          </View>
          
          <View className="mb-3">
            <Text className="text-gray-400">Goals:</Text>
            <Text className="text-white">
              {(goals as string).split(',').map(goal => 
                goal.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
              ).join(', ')}
            </Text>
          </View>
          
          <View className="mb-3">
            <Text className="text-gray-400">Workout Frequency:</Text>
            <Text className="text-white">{workoutFrequency} times per week</Text>
          </View>
        </View>

        {/* Profile Form */}
        <View className="mb-8">
          {/* Avatar Picker */}
          <View className="items-center mb-6 p-4 rounded-xl">
            <Text className="text-white font-bold text-lg mb-4">Profile Photo (Optional)</Text>
            <Pressable onPress={pickImage} className="mb-2">
              {avatarUri ? (
                <Image 
                  source={{ uri: avatarUri }} 
                  className="w-32 h-32 rounded-full"
                />
              ) : (
                <View className="w-32 h-32 rounded-full bg-gray-700 items-center justify-center border-2 border-dashed border-[#EC4899]">
                  <Text className="text-5xl">📸</Text>
                  <Text className="text-[#EC4899] text-sm font-medium mt-1">Add Photo</Text>
                </View>
              )}
            </Pressable>
            {uploading && <Text className="text-gray-400 text-sm">Uploading...</Text>}
            <Text className="text-gray-400 text-xs mt-2">Tap to add your profile picture</Text>
          </View>

          <View className="mb-4">
            <Text className="text-white font-medium mb-2">Username *</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Choose a unique username"
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
            />
          </View>

          <View className="mb-6">
            <Text className="text-white font-medium mb-2">Full Name (Optional)</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor="#6B7280"
              autoCapitalize="words"
              className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
            />
          </View>
        </View>

        {/* Complete Button */}
        <GradientCard
          gradient="primary"
          onPress={handleCompleteOnboarding}
          disabled={isLoading || uploading || !username.trim()}
          className={(!username.trim() || isLoading || uploading) ? 'opacity-50' : ''}
        >
          <Text className="text-white font-bold text-lg text-center">
            {isLoading || uploading ? 'Creating Profile...' : 'Start My Journey'}
          </Text>
        </GradientCard>

        <Text className="text-gray-400 text-center text-sm mt-4">
          You can update these preferences anytime in settings
        </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}