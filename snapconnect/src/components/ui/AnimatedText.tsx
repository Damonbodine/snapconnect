import React, { useEffect } from 'react';
import { Text, TextProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface AnimatedTextProps extends TextProps {
  text: string;
  duration?: number;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({ text, duration = 500, style, ...props }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration });
  }, [opacity, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return (
    <Animated.Text style={[style, animatedStyle]} {...props}>
      {text}
    </Animated.Text>
  );
};