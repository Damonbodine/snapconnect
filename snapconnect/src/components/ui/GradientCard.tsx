import React, { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { gradients, GradientName } from '../../styles/gradients';
import { springConfigs } from '../../utils/animations/springs';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface GradientCardProps {
  children: ReactNode;
  gradient?: GradientName | string[];
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
  style?: any;
}

export const GradientCard: React.FC<GradientCardProps> = ({
  children,
  gradient = 'primary',
  onPress,
  className = '',
  disabled = false,
  style,
}) => {
  const pressed = useSharedValue(0);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(
          interpolate(pressed.value, [0, 1], [1, 0.95]),
          springConfigs.gentle
        ),
      },
    ],
    opacity: withSpring(
      interpolate(opacity.value, [0, 1], [0.6, 1]),
      springConfigs.gentle
    ),
  }));

  const handlePressIn = () => {
    pressed.value = 1;
    if (disabled) {
      opacity.value = 0.5;
    }
  };

  const handlePressOut = () => {
    pressed.value = 0;
    opacity.value = 1;
  };

  const gradientColors = Array.isArray(gradient) ? gradient : gradients[gradient as GradientName];

  if (!onPress) {
    return (
      <View className={`rounded-2xl shadow-lg ${className}`} style={style}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="rounded-2xl"
        >
          <View className="p-4">
            {children}
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <AnimatedPressable
      style={[animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      className={`rounded-2xl shadow-lg ${className}`}
    >
      <AnimatedLinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-2xl"
      >
        <View className="p-4">
          {children}
        </View>
      </AnimatedLinearGradient>
    </AnimatedPressable>
  );
};