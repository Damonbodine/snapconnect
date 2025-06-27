import React from 'react';
import { View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ProgressBarProps extends ViewProps {
  progress: number;
  gradient: string[];
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, gradient, style, ...props }) => {
  return (
    <View style={[{ height: 10, backgroundColor: '#e0e0e0', borderRadius: 5 }, style]} {...props}>
      <LinearGradient
        colors={gradient}
        style={{ width: `${progress}%`, height: 10, borderRadius: 5 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
    </View>
  );
};