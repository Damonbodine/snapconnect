import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';

export default function Index() {
  const { user, isLoading, isOnboardingComplete } = useAuthStore();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <View className="flex-1 bg-[#0F0F0F] items-center justify-center">
        <ActivityIndicator size="large" color="#EC4899" />
      </View>
    );
  }

  // Not authenticated - redirect to auth
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // Authenticated but not onboarded - redirect to onboarding
  if (!isOnboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  // Authenticated and onboarded - redirect to main app
  return <Redirect href="/(tabs)/discover" />;
}