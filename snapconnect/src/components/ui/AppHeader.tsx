import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  centerContent?: React.ReactNode;
  showBackButton?: boolean;
  onBackPress?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ 
  title, 
  subtitle, 
  centerContent,
  showBackButton = false,
  onBackPress
}) => {
  const handleMessagesPress = () => {
    router.push('/(tabs)/messages');
  };

  return (
    <View className="px-6 py-4 border-b border-gray-800">
      <View className="flex-row items-center justify-between mb-2">
        {/* Back button (left side) */}
        <View className="w-10">
          {showBackButton && onBackPress && (
            <Pressable 
              onPress={onBackPress}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
            >
              <LinearGradient
                colors={['#374151', '#6B7280']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="w-10 h-10 rounded-full items-center justify-center"
              >
                <Text className="text-white text-lg">‹</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>

        {/* Title (left when centerContent exists, otherwise center) */}
        <Text className={`text-white text-2xl font-bold flex-1 ${centerContent ? 'text-left' : 'text-center'}`}>{title}</Text>
        
        {/* Center content (optional) - positioned absolutely */}
        {centerContent && (
          <View className="absolute left-1/2 transform -translate-x-1/2">
            {centerContent}
          </View>
        )}
        
        {/* Messages button (right side) */}
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