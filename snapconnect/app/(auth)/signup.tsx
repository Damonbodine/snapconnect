import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/stores/authStore';
import { GradientCard } from '../../src/components/ui/GradientCard';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { signUp, isLoading } = useAuthStore();

  const handleEmailSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      await signUp(email, password);
      // Email verification disabled for now - go directly to app
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message);
    }
  };

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F1F1F']}
      className="flex-1"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="flex-1 px-6 pt-20 pb-8">
            {/* Header */}
            <View className="items-center mb-12">
              <Text className="text-4xl font-bold text-white mb-2">
                Join SnapConnect
              </Text>
              <Text className="text-gray-400 text-lg text-center">
                Start your fitness journey with friends
              </Text>
            </View>

            {/* Signup Form */}
            <View className="mb-8">
              {/* Email Input */}
              <View className="mb-4">
                <Text className="text-white font-medium mb-2">Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#6B7280"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
                />
              </View>

              {/* Password Input */}
              <View className="mb-4">
                <Text className="text-white font-medium mb-2">Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Create a password (min. 6 characters)"
                  placeholderTextColor="#6B7280"
                  secureTextEntry
                  autoComplete="new-password"
                  className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
                />
              </View>

              {/* Confirm Password Input */}
              <View className="mb-6">
                <Text className="text-white font-medium mb-2">Confirm Password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your password"
                  placeholderTextColor="#6B7280"
                  secureTextEntry
                  autoComplete="new-password"
                  className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
                />
              </View>

              {/* Sign Up Button */}
              <GradientCard
                gradient="primary"
                onPress={handleEmailSignup}
                disabled={isLoading}
                className="mb-6"
              >
                <Text className="text-white font-bold text-lg text-center">
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Text>
              </GradientCard>


              {/* Terms Text */}
              <Text className="text-gray-400 text-sm text-center mb-6">
                By creating an account, you agree to our{' '}
                <Text className="text-[#EC4899]">Terms of Service</Text> and{' '}
                <Text className="text-[#EC4899]">Privacy Policy</Text>
              </Text>
            </View>

            {/* Sign In Link */}
            <View className="flex-row justify-center items-center">
              <Text className="text-gray-400">Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text className="text-[#EC4899] font-medium">Sign In</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}