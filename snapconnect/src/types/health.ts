/**
 * Health data types for HealthKit integration and AI coaching
 */

export interface HealthKitPermissions {
  read: string[];
  write: string[];
}

export interface StepData {
  date: string;
  steps: number;
  goalReached: boolean;
}

export interface HeartRateData {
  date: string;
  restingHeartRate?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
}

export interface SleepData {
  date: string;
  totalSleepTime: number; // in minutes
  sleepQuality: number; // 1-10 scale
  bedTime: string;
  wakeTime: string;
}

export interface WorkoutData {
  id: string;
  type: string;
  duration: number; // in minutes
  intensity?: 'low' | 'moderate' | 'high';
  calories?: number;
  startTime: string;
  endTime: string;
  averageHeartRate?: number;
  maxHeartRate?: number;
}

export interface HealthContext {
  // Daily metrics
  todaysSteps: number;
  stepGoalProgress: number; // percentage
  todaysCalories?: number;
  
  // Streaks and achievements
  currentStreak: number;
  bestStreak: number;
  totalBadges: number;
  
  // Weekly averages
  weeklyAverageSteps: number;
  weeklyWorkouts: WorkoutData[];
  
  // Recovery indicators
  averageSleepHours: number;
  sleepQuality: number;
  restingHeartRate?: number;
  heartRateVariability?: number;
  
  // Activity patterns
  recentWorkouts: WorkoutData[];
  activityLevel: 'low' | 'moderate' | 'high';
  energyLevel: 'low' | 'moderate' | 'high';
  
  // User context
  fitnessLevel: string;
  userGoals: {
    primary: string;
    secondary?: string[];
  };
  preferredWorkoutTypes: string[];
  availableTime: number; // minutes
  
  // Trends
  heartRateTrends: 'improving' | 'stable' | 'declining';
  stepTrends: 'improving' | 'stable' | 'declining';
  workoutFrequencyTrend: 'improving' | 'stable' | 'declining';
  
  // Recovery
  daysSinceRest: number;
  lastWorkoutIntensity: 'low' | 'moderate' | 'high';
  recoveryScore: number; // 1-10
}

export interface Achievement {
  id: string;
  type: 'steps' | 'streak' | 'workout' | 'milestone';
  title: string;
  description: string;
  earnedDate: string;
  iconName: string;
  level?: number;
}

export interface Streak {
  type: 'daily_steps' | 'weekly_workouts' | 'meditation';
  currentCount: number;
  bestCount: number;
  lastUpdated: string;
  isActive: boolean;
}

export interface WorkoutSuggestion {
  type: 'cardio' | 'strength' | 'flexibility' | 'rest' | 'mixed';
  intensity: 'low' | 'moderate' | 'high';
  duration: number; // minutes
  exercises?: string[];
  reasoning: string;
  timing: 'now' | 'morning' | 'evening' | 'later';
  recoveryFocus?: boolean;
}

export interface CoachingMessage {
  id: string;
  message: string;
  type: 'motivation' | 'advice' | 'celebration' | 'suggestion' | 'check_in';
  timestamp: string;
  healthContext: Partial<HealthContext>;
  actionable?: boolean;
  suggestedAction?: string;
}

export interface TrainingReadiness {
  readinessScore: number; // 0-1
  factors: {
    heartRateVariability: number;
    sleepRecovery: number;
    previousWorkloadImpact: number;
    stepActivity: number;
  };
  recommendation: WorkoutSuggestion;
}

export interface DailyHealthSummary {
  date: string;
  steps: number;
  stepGoal: number;
  calories?: number;
  activeMinutes?: number;
  sleepHours?: number;
  workouts: WorkoutData[];
  achievements: Achievement[];
  coachingMessages: CoachingMessage[];
}

export interface WeeklyHealthSummary {
  weekStarting: string;
  totalSteps: number;
  averageDailySteps: number;
  goalDaysReached: number;
  totalWorkouts: number;
  totalActiveMinutes: number;
  averageSleepHours: number;
  newAchievements: Achievement[];
  weeklyInsight: string;
}