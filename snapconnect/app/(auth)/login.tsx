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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, isLoading } = useAuthStore();

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await signIn(email, password);
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
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
                Welcome Back
              </Text>
              <Text className="text-gray-400 text-lg text-center">
                Sign in to continue your fitness journey
              </Text>
            </View>

            {/* Login Form */}
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
              <View className="mb-6">
                <Text className="text-white font-medium mb-2">Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#6B7280"
                  secureTextEntry
                  autoComplete="password"
                  className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
                />
              </View>

              {/* Forgot Password Link */}
              <View className="items-end mb-6">
                <Link href="/(auth)/forgot-password" asChild>
                  <Pressable>
                    <Text className="text-[#EC4899] font-medium">
                      Forgot Password?
                    </Text>
                  </Pressable>
                </Link>
              </View>

              {/* Sign In Button */}
              <GradientCard
                gradient="primary"
                onPress={handleEmailLogin}
                disabled={isLoading}
                className="mb-6"
              >
                <Text className="text-white font-bold text-lg text-center">
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Text>
              </GradientCard>

            </View>

            {/* Sign Up Link */}
            <View className="flex-row justify-center items-center">
              <Text className="text-gray-400">Don't have an account? </Text>
              <Link href="/(auth)/signup" asChild>
                <Pressable>
                  <Text className="text-[#EC4899] font-medium">Sign Up</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}