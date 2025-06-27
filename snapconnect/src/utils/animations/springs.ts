import { WithSpringConfig } from 'react-native-reanimated';

export const springConfigs = {
  // Gentle spring for smooth UI transitions
  gentle: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  } as WithSpringConfig,
  
  // Bouncy spring for playful interactions
  bouncy: {
    damping: 10,
    stiffness: 200,
    mass: 0.8,
  } as WithSpringConfig,
  
  // Stiff spring for quick, responsive feedback
  stiff: {
    damping: 20,
    stiffness: 300,
    mass: 0.5,
  } as WithSpringConfig,
  
  // Slow spring for dramatic reveals
  slow: {
    damping: 20,
    stiffness: 80,
    mass: 1.5,
  } as WithSpringConfig,
} as const;

export const timingConfigs = {
  fast: {
    duration: 200,
  },
  medium: {
    duration: 300,
  },
  slow: {
    duration: 500,
  },
} as const;