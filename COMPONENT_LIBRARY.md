# SnapConnect Component Library

*Design System Documentation for AI Assistant Development*

## Table of Contents
1. [Overview](#overview)
2. [Design Tokens & Theme System](#design-tokens--theme-system)
3. [Base Components](#base-components)
4. [Animation Standards](#animation-standards)
5. [Component Props Interface](#component-props-interface)
6. [Usage Examples](#usage-examples)
7. [Accessibility Guidelines](#accessibility-guidelines)
8. [Best Practices](#best-practices)
9. [Component Development Guide](#component-development-guide)

---

## Overview

The SnapConnect component library provides a consistent design system built on gradient-first principles, optimized for fitness social interactions. All components follow React Native patterns with TypeScript support and are designed for seamless integration with NativeWind styling.

### Core Principles
- **Gradient-First Design**: Every component leverages our fitness-themed gradient system
- **Animation-Ready**: Built-in Reanimated 3 support for smooth 60fps interactions
- **Accessibility-First**: WCAG 2.1 AA compliance built into every component
- **TypeScript Native**: Full type safety and IntelliSense support
- **Performance Optimized**: Minimal re-renders and efficient animations

---

## Design Tokens & Theme System

### Color Gradients

Our gradient system is defined in `src/styles/gradients.ts` and provides semantic meaning for fitness contexts:

```typescript
// Primary Application Gradients
primary: ['#7C3AED', '#EC4899']    // Purple to Pink - Main brand
secondary: ['#F472B6', '#FBBF24']  // Pink to Yellow - Secondary actions
success: ['#10B981', '#34D399']    // Green variants - Success states
danger: ['#EF4444', '#F87171']     // Red variants - Error/Warning states

// Fitness Activity Gradients
cardio: ['#F87171', '#FBBF24']     // Red to Yellow - Cardio workouts
strength: ['#7C3AED', '#6366F1']   // Purple to Blue - Strength training
flexibility: ['#10B981', '#34D399'] // Green variants - Yoga/Stretching
recovery: ['#06B6D4', '#3B82F6']   // Cyan to Blue - Rest/Recovery

// Progress Level Gradients
beginner: ['#34D399', '#10B981']   // Light to Dark Green
intermediate: ['#FBBF24', '#F59E0B'] // Yellow to Orange
advanced: ['#EC4899', '#7C3AED']   // Pink to Purple
```

### Gradient Angles

```typescript
diagonal: 135°        // Default diagonal (bottom-left to top-right)
horizontal: 90°       // Left to right
vertical: 180°        // Top to bottom
diagonalReverse: 45°  // Top-left to bottom-right
```

### Spacing & Sizing

Following 8px grid system with NativeWind classes:

```typescript
// Padding/Margin Scale
p-1: 4px    p-2: 8px    p-3: 12px   p-4: 16px   p-6: 24px   p-8: 32px

// Border Radius
rounded-xl: 12px    rounded-2xl: 16px    rounded-3xl: 24px

// Shadow Depths
shadow-sm: Subtle depth        shadow-md: Medium depth
shadow-lg: Prominent depth     shadow-xl: Maximum depth
```

### Typography Scale

```typescript
// Text Sizes (NativeWind)
text-xs: 12px     text-sm: 14px     text-base: 16px
text-lg: 18px     text-xl: 20px     text-2xl: 24px
text-3xl: 30px    text-4xl: 36px

// Font Weights
font-light: 300   font-normal: 400   font-medium: 500
font-semibold: 600   font-bold: 700   font-extrabold: 800
```

---

## Base Components

### GradientCard

Primary container component with built-in gradient backgrounds and press animations.

**File Location**: `src/components/ui/GradientCard.tsx`

**Key Features**:
- Automatic press animations with scale and opacity effects
- Configurable gradient backgrounds
- Optional onPress handling with disabled states
- Full NativeWind className support
- Built-in shadow effects

**Props Interface**:
```typescript
interface GradientCardProps {
  children: ReactNode;           // Content to render inside the card
  gradient?: GradientName;       // Gradient theme (default: 'primary')
  onPress?: () => void;          // Optional press handler
  className?: string;            // Additional NativeWind classes
  disabled?: boolean;            // Disable press interactions
  style?: ViewStyle;             // Additional inline styles
}
```

**Animation Behavior**:
- **Press In**: Scale to 95%, slight opacity reduction if disabled
- **Press Out**: Return to 100% scale, full opacity
- **Spring Config**: Uses `springConfigs.gentle` for smooth feel

### GlassCard

Glassmorphism container with blur effects for overlays and modals.

**File Location**: `src/components/ui/GlassCard.tsx`

**Key Features**:
- Expo BlurView integration
- Configurable blur intensity and tint
- Semi-transparent background with border
- Rounded corners with overflow handling

**Props Interface**:
```typescript
interface GlassCardProps {
  children: ReactNode;           // Content to render inside
  intensity?: number;            // Blur intensity (default: 80)
  tint?: 'light' | 'dark' | 'default'; // Blur tint (default: 'light')
  className?: string;            // Additional NativeWind classes
  style?: ViewStyle;             // Additional inline styles
}
```

**Visual Effects**:
- Background: `bg-white/10` (10% white overlay)
- Border: `border-white/20` (20% white border)
- Backdrop: `backdrop-blur-xl` effect
- Padding: `p-4` (16px) default

---

## Animation Standards

### Spring Configurations

Defined in `src/utils/animations/springs.ts` for consistent animation feel:

```typescript
// Gentle Spring - UI Transitions
gentle: {
  damping: 15,      // Smooth settling
  stiffness: 150,   // Moderate responsiveness  
  mass: 1,          // Standard weight
}

// Bouncy Spring - Playful Interactions
bouncy: {
  damping: 10,      // More oscillation
  stiffness: 200,   // Higher responsiveness
  mass: 0.8,        // Lighter feel
}

// Stiff Spring - Quick Feedback
stiff: {
  damping: 20,      // Quick settling
  stiffness: 300,   // Very responsive
  mass: 0.5,        // Light weight
}

// Slow Spring - Dramatic Reveals
slow: {
  damping: 20,      // Controlled settling
  stiffness: 80,    // Slower response
  mass: 1.5,        // Heavier feel
}
```

### Timing Configurations

```typescript
fast: { duration: 200 }     // Quick interactions
medium: { duration: 300 }   // Standard transitions
slow: { duration: 500 }     // Dramatic effects
```

### Animation Patterns

**Standard Press Animation**:
```typescript
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{
    scale: withSpring(
      interpolate(pressed.value, [0, 1], [1, 0.95]),
      springConfigs.gentle
    ),
  }],
}));
```

**Fade In/Out Pattern**:
```typescript
const opacity = useSharedValue(0);

// Entrance
opacity.value = withSpring(1, springConfigs.gentle);

// Exit  
opacity.value = withSpring(0, springConfigs.fast);
```

---

## Component Props Interface

### Standard Props Pattern

All components follow this consistent props structure:

```typescript
interface BaseComponentProps {
  // Content
  children?: ReactNode;
  
  // Styling
  className?: string;           // NativeWind classes
  style?: ViewStyle;            // Inline styles (use sparingly)
  
  // Interaction
  onPress?: () => void;         // Primary action
  disabled?: boolean;           // Disabled state
  
  // Accessibility
  accessibilityLabel?: string;  // Screen reader label
  accessibilityHint?: string;   // Screen reader hint
  testID?: string;              // Testing identifier
}
```

### Gradient-Specific Props

```typescript
interface GradientProps {
  gradient?: GradientName;      // Semantic gradient name
  gradientAngle?: GradientAngle; // Direction override
}
```

### Animation Props

```typescript
interface AnimationProps {
  springConfig?: SpringConfig;  // Custom spring settings
  disabled?: boolean;           // Disable animations
  duration?: number;            // Custom timing
}
```

---

## Usage Examples

### Basic GradientCard

```typescript
import { GradientCard } from '@/components/ui/GradientCard';

// Simple container
<GradientCard gradient="primary" className="mx-4 mb-6">
  <Text className="text-white font-bold text-xl">Workout Complete!</Text>
  <Text className="text-white/80 mt-2">Great job on your cardio session</Text>
</GradientCard>

// Interactive button
<GradientCard 
  gradient="cardio" 
  onPress={() => startWorkout()}
  className="mx-4"
>
  <View className="flex-row items-center justify-between">
    <Text className="text-white font-semibold">Start Cardio</Text>
    <Icon name="play" color="white" size={20} />
  </View>
</GradientCard>
```

### Advanced GradientCard with Animation

```typescript
// Custom spring configuration
<GradientCard 
  gradient="strength"
  onPress={handlePress}
  className="mx-4 mb-4"
  disabled={isLoading}
>
  <View className="items-center py-2">
    {isLoading ? (
      <ActivityIndicator color="white" />
    ) : (
      <>
        <Text className="text-white font-bold text-lg">Log Workout</Text>
        <Text className="text-white/70 text-sm mt-1">Tap to record</Text>
      </>
    )}
  </View>
</GradientCard>
```

### GlassCard Usage

```typescript
import { GlassCard } from '@/components/ui/GlassCard';

// Modal overlay
<GlassCard 
  intensity={60} 
  tint="dark" 
  className="absolute inset-x-4 top-20"
>
  <Text className="text-white font-semibold text-lg mb-4">Quick Stats</Text>
  <View className="space-y-2">
    <Text className="text-white/80">Calories: 245</Text>
    <Text className="text-white/80">Duration: 32 min</Text>
  </View>
</GlassCard>

// Settings panel
<GlassCard className="mx-4 mt-6">
  <Text className="text-gray-800 font-semibold mb-3">Preferences</Text>
  {/* Settings content */}
</GlassCard>
```

### Fitness-Specific Patterns

```typescript
// Progress level indicator
<GradientCard 
  gradient={user.fitnessLevel} // 'beginner' | 'intermediate' | 'advanced'
  className="flex-1 mx-2"
>
  <Text className="text-white font-semibold">{user.fitnessLevel}</Text>
  <Text className="text-white/70 text-sm">{user.level}% Complete</Text>
</GradientCard>

// Workout type selection
const workoutTypes = ['cardio', 'strength', 'flexibility', 'recovery'];

{workoutTypes.map(type => (
  <GradientCard 
    key={type}
    gradient={type}
    onPress={() => selectWorkout(type)}
    className="flex-1 mx-1"
  >
    <Text className="text-white font-medium capitalize">{type}</Text>
  </GradientCard>
))}
```

---

## Accessibility Guidelines

### Screen Reader Support

**Essential Attributes**:
```typescript
<GradientCard 
  accessibilityLabel="Start cardio workout"
  accessibilityHint="Begins a new cardio session with timer"
  accessibilityRole="button"
  onPress={startCardio}
>
  <Text className="text-white">Start Cardio</Text>
</GradientCard>
```

**State Announcements**:
```typescript
<GradientCard 
  accessibilityLabel={`Workout ${isActive ? 'active' : 'paused'}`}
  accessibilityState={{ selected: isActive, disabled: !canStart }}
>
  {/* Content */}
</GradientCard>
```

### Color Contrast

All gradient combinations meet WCAG 2.1 AA standards:
- **White text on gradients**: Minimum 4.5:1 contrast ratio
- **Interactive elements**: Clear visual focus indicators
- **Disabled states**: 50% opacity with clear visual feedback

### Touch Targets

- **Minimum size**: 44x44 points for interactive elements
- **Spacing**: 8px minimum between adjacent touch targets
- **Feedback**: Immediate visual/haptic response to touches

### Focus Management

```typescript
// Auto-focus for modals
<GlassCard accessibilityElementsHidden={false}>
  <Text 
    accessible 
    accessibilityRole="header"
    className="text-lg font-semibold mb-4"
  >
    Modal Title
  </Text>
  {/* Additional content */}
</GlassCard>
```

---

## Best Practices

### Performance Optimization

**Minimize Re-renders**:
```typescript
// ✅ Good - Memoized components
const MemoizedCard = React.memo(GradientCard);

// ✅ Good - Stable onPress references
const handlePress = useCallback(() => {
  // Action logic
}, [dependencies]);

// ❌ Avoid - Inline functions
<GradientCard onPress={() => doSomething()} />
```

**Efficient Animations**:
```typescript
// ✅ Good - Single shared value for related animations
const progress = useSharedValue(0);

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: interpolate(progress.value, [0, 1], [0.8, 1]) }],
  opacity: interpolate(progress.value, [0, 1], [0, 1]),
}));

// ❌ Avoid - Multiple shared values for same animation
const scale = useSharedValue(0.8);
const opacity = useSharedValue(0);
```

### Component Composition

**Prefer Composition over Props**:
```typescript
// ✅ Good - Flexible composition
<GradientCard gradient="primary">
  <View className="flex-row items-center">
    <Icon name="heart" color="white" />
    <Text className="text-white ml-2">Health Score</Text>
  </View>
  <Text className="text-white font-bold text-2xl mt-2">92</Text>
</GradientCard>

// ❌ Avoid - Too many specific props
<HealthScoreCard 
  icon="heart" 
  title="Health Score" 
  value={92} 
  gradient="primary"
  showIcon={true}
  iconSize={20}
  // ... many more props
/>
```

### State Management

**Local State for UI, Global for Data**:
```typescript
// ✅ Good - Local state for press interactions
const [isPressed, setIsPressed] = useState(false);

// ✅ Good - Global state for user data
const { user, updateFitnessLevel } = useAuthStore();

// ❌ Avoid - Global state for UI interactions
const { cardPressState, setCardPressState } = useUIStore();
```

### Error Boundaries

```typescript
// Wrap complex components in error boundaries
<ErrorBoundary fallback={<ErrorCard />}>
  <GradientCard gradient="primary" onPress={riskyAction}>
    <ComplexContent />
  </GradientCard>
</ErrorBoundary>
```

---

## Component Development Guide

### Creating New Components

**File Structure**:
```
src/components/ui/
├── NewComponent.tsx        # Component implementation
├── NewComponent.test.tsx   # Unit tests
└── index.ts               # Export barrel
```

**Component Template**:
```typescript
import React, { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { springConfigs } from '@/utils/animations/springs';

interface NewComponentProps {
  children: ReactNode;
  className?: string;
  style?: ViewStyle;
  onPress?: () => void;
  disabled?: boolean;
  // Component-specific props
}

export const NewComponent: React.FC<NewComponentProps> = ({
  children,
  className = '',
  style,
  onPress,
  disabled = false,
}) => {
  const pressed = useSharedValue(0);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: withSpring(
        pressed.value ? 0.95 : 1,
        springConfigs.gentle
      ),
    }],
  }));

  // Component logic here

  return (
    <Animated.View 
      style={[animatedStyle, style]}
      className={`${className}`}
    >
      {children}
    </Animated.View>
  );
};
```

### Testing Components

**Basic Test Structure**:
```typescript
import { render, fireEvent } from '@testing-library/react-native';
import { NewComponent } from './NewComponent';

describe('NewComponent', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <NewComponent>
        <Text>Test Content</Text>
      </NewComponent>
    );
    
    expect(getByText('Test Content')).toBeTruthy();
  });

  it('handles press events', () => {
    const mockPress = jest.fn();
    const { getByTestId } = render(
      <NewComponent onPress={mockPress} testID="test-component">
        <Text>Pressable</Text>
      </NewComponent>
    );
    
    fireEvent.press(getByTestId('test-component'));
    expect(mockPress).toHaveBeenCalledTimes(1);
  });
});
```

### Documentation Requirements

Every new component must include:
1. **TypeScript interfaces** with JSDoc comments
2. **Usage examples** in component file header
3. **Accessibility considerations** documented
4. **Animation behavior** described
5. **Test coverage** above 80%

---

## Component Status

### ✅ Production Ready
- **GradientCard**: Full feature set with animations
- **GlassCard**: Basic glassmorphism effects

### 🚧 In Development
- **AnimatedText**: Text with entrance animations
- **ProgressBar**: Gradient progress indicators
- **FitnessCard**: Specialized workout cards

### 📋 Planned Components
- **ActionSheet**: Gradient-themed bottom sheets
- **TabBar**: Custom tab navigation
- **FloatingButton**: Animated FAB with gradients
- **StoryCard**: Ephemeral content containers
- **MetricCard**: Fitness stat displays

---

*Last Updated: June 23, 2025*  
*For AI Assistants: This component library follows strict TypeScript patterns and gradient-first design principles. Always reference the gradients.ts and springs.ts files for consistent theming and animations.*