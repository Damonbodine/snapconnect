export const gradients = {
  primary: ['#7C3AED', '#EC4899'],
  secondary: ['#F472B6', '#FBBF24'],
  success: ['#10B981', '#34D399'],
  danger: ['#EF4444', '#F87171'],
  dark: ['#1F2937', '#374151'],
  light: ['#F3F4F6', '#E5E7EB'],
  
  // Fitness-specific gradients
  cardio: ['#F87171', '#FBBF24'],
  strength: ['#7C3AED', '#6366F1'],
  flexibility: ['#10B981', '#34D399'],
  recovery: ['#06B6D4', '#3B82F6'],
  
  // Progress gradients
  beginner: ['#34D399', '#10B981'],
  intermediate: ['#FBBF24', '#F59E0B'],
  advanced: ['#EC4899', '#7C3AED'],
} as const;

export const gradientAngles = {
  diagonal: 135,
  horizontal: 90,
  vertical: 180,
  diagonalReverse: 45,
} as const;

export type GradientName = keyof typeof gradients;
export type GradientAngle = keyof typeof gradientAngles;