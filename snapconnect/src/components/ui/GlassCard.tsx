import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { BlurView } from 'expo-blur';

interface GlassCardProps {
  children: ReactNode;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  className?: string;
  style?: any;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  intensity = 80,
  tint = 'light',
  className = '',
  style,
}) => {
  return (
    <BlurView
      intensity={intensity}
      tint={tint}
      className={`rounded-2xl overflow-hidden ${className}`}
      style={style}
    >
      <View className="bg-white/10 backdrop-blur-xl border border-white/20 p-4">
        {children}
      </View>
    </BlurView>
  );
};