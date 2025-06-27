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
import { supabase } from '../../src/services/supabase';
import { GradientCard } from '../../src/components/ui/GradientCard';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) throw error;

      Alert.alert(
        'Check Your Email',
        'We sent you a password reset link. Please check your email and follow the instructions.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
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
            {/* Back Button */}
            <Pressable
              onPress={() => router.back()}
              className="mb-8"
            >
              <Text className="text-[#EC4899] font-medium text-lg">← Back</Text>
            </Pressable>

            {/* Header */}
            <View className="items-center mb-12">
              <Text className="text-4xl font-bold text-white mb-2">
                Reset Password
              </Text>
              <Text className="text-gray-400 text-lg text-center">
                Enter your email to receive a password reset link
              </Text>
            </View>

            {/* Reset Form */}
            <View className="mb-8">
              {/* Email Input */}
              <View className="mb-6">
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

              {/* Reset Button */}
              <GradientCard
                gradient="primary"
                onPress={handleResetPassword}
                disabled={isLoading}
                className="mb-6"
              >
                <Text className="text-white font-bold text-lg text-center">
                  {isLoading ? 'Sending Reset Link...' : 'Send Reset Link'}
                </Text>
              </GradientCard>
            </View>

            {/* Sign In Link */}
            <View className="flex-row justify-center items-center">
              <Text className="text-gray-400">Remember your password? </Text>
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