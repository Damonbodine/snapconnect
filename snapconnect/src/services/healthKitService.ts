/**
 * HealthKit Service for iOS Health Integration
 * Handles permissions, data fetching, and health metrics calculation
 */

import AppleHealthKit from 'react-native-health';
import type {
  HealthKitPermissions,
  HealthValue,
  HealthInputOptions,
} from 'react-native-health';
import { Platform } from 'react-native';
import {
  StepData,
  HeartRateData,
  SleepData,
  WorkoutData,
  HealthContext,
  DailyHealthSummary,
  TrainingReadiness,
} from '../types/health';

export class HealthKitService {
  private static instance: HealthKitService;
  private isInitialized = false;

  public static getInstance(): HealthKitService {
    if (!HealthKitService.instance) {
      HealthKitService.instance = new HealthKitService();
    }
    return HealthKitService.instance;
  }

  /**
   * Initialize HealthKit with permissions
   */
  async initializeHealthKit(): Promise<boolean> {
    try {
      console.log(`🔍 Platform check: ${Platform.OS}`);
      console.log(`🔍 AppleHealthKit object:`, AppleHealthKit);
      console.log(`🔍 AppleHealthKit.isAvailable:`, AppleHealthKit?.isAvailable);
      
      if (Platform.OS !== 'ios') {
        console.log('ℹ️ HealthKit only available on iOS');
        return false;
      }

      if (!AppleHealthKit || typeof AppleHealthKit.isAvailable !== 'function') {
        console.error('❌ AppleHealthKit not properly imported or linked');
        return false;
      }

      // Check if HealthKit is available
      console.log('🔍 Checking HealthKit availability...');
      const isAvailable = await this.isHealthKitAvailable();
      console.log(`📱 HealthKit available: ${isAvailable}`);
      
      if (!isAvailable) {
        console.log('❌ HealthKit not available on this device');
        return false;
      }

      // Define permissions we need
      const permissions: HealthKitPermissions = {
        permissions: {
          read: [
            AppleHealthKit.Constants.Permissions.Steps,
            AppleHealthKit.Constants.Permissions.StepCount,
            AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
            AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
            AppleHealthKit.Constants.Permissions.BasalEnergyBurned,
            AppleHealthKit.Constants.Permissions.HeartRate,
            AppleHealthKit.Constants.Permissions.RestingHeartRate,
            AppleHealthKit.Constants.Permissions.HeartRateVariability,
            AppleHealthKit.Constants.Permissions.SleepAnalysis,
            AppleHealthKit.Constants.Permissions.Workout,
            AppleHealthKit.Constants.Permissions.Weight,
            AppleHealthKit.Constants.Permissions.Height,
          ],
          write: [
            AppleHealthKit.Constants.Permissions.Steps,
            AppleHealthKit.Constants.Permissions.Workout,
            AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          ],
        },
      };

      // Request permissions
      console.log('📱 Requesting HealthKit permissions from iOS...');
      return new Promise((resolve) => {
        AppleHealthKit.initHealthKit(permissions, (error: string) => {
          if (error) {
            console.error('❌ HealthKit initialization error:', error);
            resolve(false);
          } else {
            console.log('✅ HealthKit initialized successfully - user granted permissions');
            this.isInitialized = true;
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('❌ HealthKit initialization failed:', error);
      return false;
    }
  }

  /**
   * Check if HealthKit is available on device
   */
  private async isHealthKitAvailable(): Promise<boolean> {
    try {
      if (!AppleHealthKit || typeof AppleHealthKit.isAvailable !== 'function') {
        console.error('❌ AppleHealthKit.isAvailable not available');
        return false;
      }

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error('❌ HealthKit availability check timed out');
          resolve(false);
        }, 5000); // 5 second timeout

        AppleHealthKit.isAvailable((isAvailable: boolean) => {
          clearTimeout(timeout);
          console.log(`📱 HealthKit availability result: ${isAvailable}`);
          resolve(isAvailable);
        });
      });
    } catch (error) {
      console.error('❌ HealthKit availability check failed:', error);
      return false;
    }
  }

  /**
   * Request HealthKit permissions (alias for initializeHealthKit)
   */
  async requestPermissions(): Promise<boolean> {
    // Reset initialization state to allow re-requesting permissions
    this.isInitialized = false;
    console.log('📱 Requesting HealthKit permissions...');
    return this.initializeHealthKit();
  }

  /**
   * Check current permission status
   */
  async getPermissionStatus(): Promise<{
    isAvailable: boolean;
    hasPermissions: boolean;
    isInitialized: boolean;
  }> {
    const isAvailable = await this.isHealthKitAvailable();
    return {
      isAvailable,
      hasPermissions: this.isInitialized,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Get steps for a specific date
   */
  async getDailySteps(date: Date): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('HealthKit not initialized. Call initializeHealthKit() first.');
    }

    return new Promise((resolve, reject) => {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const options: HealthInputOptions = {
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
      };

      AppleHealthKit.getStepCount(options, (error: string, results: HealthValue) => {
        if (error) {
          console.error('❌ Error fetching steps:', error);
          reject(new Error(error));
        } else {
          resolve(results?.value || 0);
        }
      });
    });
  }

  /**
   * Get step data for the last N days
   */
  async getStepsForPeriod(days: number = 7): Promise<StepData[]> {
    const results: StepData[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      try {
        const steps = await this.getDailySteps(date);
        results.push({
          date: date.toISOString().split('T')[0],
          steps,
          goalReached: steps >= 10000,
        });
      } catch (error) {
        console.error(`❌ Error fetching steps for ${date.toDateString()}:`, error);
        results.push({
          date: date.toISOString().split('T')[0],
          steps: 0,
          goalReached: false,
        });
      }
    }

    return results;
  }

  /**
   * Get heart rate data for a specific date
   */
  async getHeartRateData(date: Date): Promise<HeartRateData | null> {
    if (!this.isInitialized) {
      throw new Error('HealthKit not initialized');
    }

    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const options: HealthInputOptions = {
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
      };

      // Get resting heart rate
      const restingHR = await new Promise<number | undefined>((resolve) => {
        AppleHealthKit.getRestingHeartRate(options, (error: string, results: HealthValue) => {
          if (error || !results) {
            resolve(undefined);
          } else {
            resolve(Math.round(results.value));
          }
        });
      });

      return {
        date: date.toISOString().split('T')[0],
        restingHeartRate: restingHR,
      };
    } catch (error) {
      console.error('❌ Error fetching heart rate data:', error);
      return null;
    }
  }

  /**
   * Get sleep data for a specific date
   */
  async getSleepData(date: Date): Promise<SleepData | null> {
    if (!this.isInitialized) {
      throw new Error('HealthKit not initialized');
    }

    return new Promise((resolve) => {
      const startOfDay = new Date(date);
      startOfDay.setDate(startOfDay.getDate() - 1); // Start from previous day evening
      startOfDay.setHours(18, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(12, 0, 0, 0); // End at noon next day

      const options: HealthInputOptions = {
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
      };

      AppleHealthKit.getSleepSamples(options, (error: string, results: any[]) => {
        if (error || !results || results.length === 0) {
          resolve(null);
        } else {
          // Calculate total sleep time
          const sleepSessions = results.filter(session => session.value === 'ASLEEP');
          const totalSleepMinutes = sleepSessions.reduce((total, session) => {
            const start = new Date(session.startDate);
            const end = new Date(session.endDate);
            return total + (end.getTime() - start.getTime()) / (1000 * 60);
          }, 0);

          // Get bed and wake times (simplified)
          const firstSession = sleepSessions[0];
          const lastSession = sleepSessions[sleepSessions.length - 1];

          resolve({
            date: date.toISOString().split('T')[0],
            totalSleepTime: Math.round(totalSleepMinutes),
            sleepQuality: this.calculateSleepQuality(totalSleepMinutes, sleepSessions.length),
            bedTime: firstSession?.startDate || '',
            wakeTime: lastSession?.endDate || '',
          });
        }
      });
    });
  }

  /**
   * Get recent workouts
   */
  async getRecentWorkouts(days: number = 7): Promise<WorkoutData[]> {
    if (!this.isInitialized) {
      throw new Error('HealthKit not initialized');
    }

    return new Promise((resolve) => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      AppleHealthKit.getSamples(options, (error: string, results: any[]) => {
        if (error || !results) {
          console.error('❌ Error fetching workouts:', error);
          resolve([]);
        } else {
          const workouts = results.map((workout, index) => ({
            id: `workout_${index}_${workout.startDate}`,
            type: this.mapWorkoutType(workout.activityType || 'Other'),
            duration: Math.round((new Date(workout.endDate).getTime() - new Date(workout.startDate).getTime()) / (1000 * 60)),
            calories: workout.totalEnergyBurned || undefined,
            startTime: workout.startDate,
            endTime: workout.endDate,
          }));
          resolve(workouts);
        }
      });
    });
  }

  /**
   * Generate comprehensive health context for AI coaching
   */
  async generateHealthContext(userProfile: {
    fitnessLevel: string;
    goals: string[];
    preferredWorkouts: string[];
  }): Promise<HealthContext> {
    try {
      const [
        todaysSteps,
        weeklySteps,
        todaysHeartRate,
        todaysSleep,
        recentWorkouts,
      ] = await Promise.all([
        this.getDailySteps(new Date()),
        this.getStepsForPeriod(7),
        this.getHeartRateData(new Date()),
        this.getSleepData(new Date()),
        this.getRecentWorkouts(7),
      ]);

      // Calculate metrics
      const weeklyAverageSteps = Math.round(
        weeklySteps.reduce((sum, day) => sum + day.steps, 0) / weeklySteps.length
      );

      const currentStreak = this.calculateCurrentStreak(weeklySteps);
      const stepGoalProgress = Math.round((todaysSteps / 10000) * 100);
      
      // Activity level calculation
      const activityLevel = this.calculateActivityLevel(todaysSteps, recentWorkouts.length);
      const energyLevel = this.calculateEnergyLevel(todaysSleep, todaysHeartRate);
      
      // Recovery metrics
      const daysSinceRest = this.calculateDaysSinceRest(recentWorkouts);
      const recoveryScore = this.calculateRecoveryScore(todaysSleep, todaysHeartRate, daysSinceRest);

      return {
        // Daily metrics
        todaysSteps,
        stepGoalProgress,
        todaysCalories: 0, // TODO: Implement calorie tracking
        
        // Streaks and achievements
        currentStreak,
        bestStreak: currentStreak, // TODO: Get from database
        totalBadges: 0, // TODO: Get from database
        
        // Weekly averages
        weeklyAverageSteps,
        weeklyWorkouts: recentWorkouts,
        
        // Recovery indicators
        averageSleepHours: todaysSleep ? todaysSleep.totalSleepTime / 60 : 7.5,
        sleepQuality: todaysSleep?.sleepQuality || 7,
        restingHeartRate: todaysHeartRate?.restingHeartRate,
        heartRateVariability: undefined, // TODO: Implement HRV
        
        // Activity patterns
        recentWorkouts,
        activityLevel,
        energyLevel,
        
        // User context
        fitnessLevel: userProfile.fitnessLevel,
        userGoals: {
          primary: userProfile.goals[0] || 'general_fitness',
          secondary: userProfile.goals.slice(1),
        },
        preferredWorkoutTypes: userProfile.preferredWorkouts,
        availableTime: 30, // TODO: Get from user preferences
        
        // Trends
        heartRateTrends: 'stable', // TODO: Calculate trends
        stepTrends: 'stable', // TODO: Calculate trends
        workoutFrequencyTrend: 'stable', // TODO: Calculate trends
        
        // Recovery
        daysSinceRest,
        lastWorkoutIntensity: this.getLastWorkoutIntensity(recentWorkouts),
        recoveryScore,
      };
    } catch (error) {
      console.error('❌ Error generating health context:', error);
      throw error;
    }
  }

  // Helper methods
  private calculateSleepQuality(totalMinutes: number, sessionCount: number): number {
    // Simple sleep quality calculation (1-10 scale)
    const optimalSleep = 7.5 * 60; // 7.5 hours in minutes
    const sleepRatio = Math.min(totalMinutes / optimalSleep, 1.2);
    
    // Penalize fragmented sleep
    const fragmentationPenalty = Math.max(0, (sessionCount - 2) * 0.5);
    
    const quality = (sleepRatio * 10) - fragmentationPenalty;
    return Math.max(1, Math.min(10, Math.round(quality)));
  }

  private mapWorkoutType(healthKitType: string): string {
    const typeMap: { [key: string]: string } = {
      'Walking': 'walking',
      'Running': 'running',
      'Cycling': 'cycling',
      'Swimming': 'swimming',
      'WeightLifting': 'strength',
      'Yoga': 'yoga',
      'Pilates': 'pilates',
      'HIIT': 'hiit',
      'Other': 'other',
    };
    return typeMap[healthKitType] || 'other';
  }

  private calculateCurrentStreak(weeklySteps: StepData[]): number {
    let streak = 0;
    for (let i = weeklySteps.length - 1; i >= 0; i--) {
      if (weeklySteps[i].goalReached) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  private calculateActivityLevel(steps: number, workoutCount: number): 'low' | 'moderate' | 'high' {
    if (steps >= 12000 || workoutCount >= 5) return 'high';
    if (steps >= 8000 || workoutCount >= 3) return 'moderate';
    return 'low';
  }

  private calculateEnergyLevel(
    sleep: SleepData | null,
    heartRate: HeartRateData | null
  ): 'low' | 'moderate' | 'high' {
    let score = 5; // baseline moderate
    
    if (sleep) {
      if (sleep.sleepQuality >= 8) score += 2;
      else if (sleep.sleepQuality >= 6) score += 1;
      else score -= 1;
    }
    
    if (heartRate?.restingHeartRate) {
      if (heartRate.restingHeartRate <= 60) score += 1;
      else if (heartRate.restingHeartRate >= 80) score -= 1;
    }
    
    if (score >= 7) return 'high';
    if (score >= 5) return 'moderate';
    return 'low';
  }

  private calculateDaysSinceRest(workouts: WorkoutData[]): number {
    if (workouts.length === 0) return 7; // Assume long time since workout
    
    const today = new Date();
    const lastWorkout = new Date(Math.max(...workouts.map(w => new Date(w.startTime).getTime())));
    
    return Math.floor((today.getTime() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24));
  }

  private calculateRecoveryScore(
    sleep: SleepData | null,
    heartRate: HeartRateData | null,
    daysSinceRest: number
  ): number {
    let score = 5; // baseline
    
    // Sleep contribution (40%)
    if (sleep) {
      score += (sleep.sleepQuality - 5) * 0.4;
    }
    
    // Heart rate contribution (30%)
    if (heartRate?.restingHeartRate) {
      if (heartRate.restingHeartRate <= 60) score += 1.5;
      else if (heartRate.restingHeartRate >= 80) score -= 1.5;
    }
    
    // Rest days contribution (30%)
    if (daysSinceRest >= 2) score += 1.5;
    else if (daysSinceRest === 0) score -= 1;
    
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  private getLastWorkoutIntensity(workouts: WorkoutData[]): 'low' | 'moderate' | 'high' {
    if (workouts.length === 0) return 'low';
    
    const lastWorkout = workouts.reduce((latest, workout) => 
      new Date(workout.startTime) > new Date(latest.startTime) ? workout : latest
    );
    
    // Simple intensity calculation based on duration and type
    if (lastWorkout.duration >= 60 || lastWorkout.type.includes('hiit')) return 'high';
    if (lastWorkout.duration >= 30) return 'moderate';
    return 'low';
  }
}

// Export singleton instance
export const healthKitService = HealthKitService.getInstance();