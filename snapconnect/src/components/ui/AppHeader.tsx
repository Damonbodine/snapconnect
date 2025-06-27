import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  centerContent?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ 
  title, 
  subtitle, 
  centerContent 
}) => {
  const handleMessagesPress = () => {
    router.push('/(tabs)/messages');
  };

  return (
    <View className="px-6 py-4 border-b border-gray-800">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-white text-2xl font-bold">{title}</Text>
        
        {/* Center content (optional) */}
        {centerContent && (
          <View className="absolute left-1/2 transform -translate-x-1/2">
            {centerContent}
          </View>
        )}
        
        {/* Messages button in top right */}
        <Pressable 
          onPress={handleMessagesPress}
          className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
        >
          <LinearGradient
            colors={['#7C3AED', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="w-10 h-10 rounded-full items-center justify-center"
          >
            <Text className="text-white text-lg">💬</Text>
          </LinearGradient>
        </Pressable>
      </View>
      
      {subtitle && (
        <Text className="text-gray-400 text-sm">{subtitle}</Text>
      )}
    </View>
  );
};