/**
 * Mock Health Service for Development Testing
 * Provides realistic health data for testing without requiring real HealthKit integration
 */

import {
  StepData,
  HeartRateData,
  SleepData,
  WorkoutData,
  HealthContext,
  DailyHealthSummary,
} from '../types/health';

export class MockHealthService {
  private static instance: MockHealthService;
  private mockUserProfile = {
    fitnessLevel: 'intermediate',
    goals: ['weight_loss', 'strength_building'],
    preferredWorkouts: ['running', 'strength', 'yoga'],
  };

  // Simulated user state that persists during session
  private currentStreak = 5;
  private bestStreak = 12;
  private totalBadges = 8;

  public static getInstance(): MockHealthService {
    if (!MockHealthService.instance) {
      MockHealthService.instance = new MockHealthService();
    }
    return MockHealthService.instance;
  }

  /**
   * Initialize mock service (always succeeds)
   */
  async initializeHealthKit(): Promise<boolean> {
    console.log('🔧 Mock HealthKit initialized - using test data');
    return true;
  }

  /**
   * Generate realistic step count for a given date
   */
  async getDailySteps(date: Date): Promise<number> {
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    // Generate consistent but realistic step counts based on date
    const seed = date.getDate() + date.getMonth() * 31;
    const baseSteps = 8000;
    const variance = Math.sin(seed) * 3000; // Predictable variance
    
    // More recent days have slightly higher activity
    const recencyBonus = Math.max(0, (7 - daysDiff) * 200);
    
    // Weekend effect (slightly lower on weekends)
    const weekendPenalty = (date.getDay() === 0 || date.getDay() === 6) ? -500 : 0;
    
    const steps = Math.max(0, Math.round(baseSteps + variance + recencyBonus + weekendPenalty));
    
    // Add some randomness for realism but keep it consistent per date
    const randomFactor = ((seed * 17) % 100) / 100;
    return Math.round(steps + (randomFactor * 1000));
  }

  /**
   * Get step data for multiple days
   */
  async getStepsForPeriod(days: number = 7): Promise<StepData[]> {
    const results: StepData[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const steps = await this.getDailySteps(date);
      results.push({
        date: date.toISOString().split('T')[0],
        steps,
        goalReached: steps >= 10000,
      });
    }

    return results;
  }

  /**
   * Generate mock heart rate data
   */
  async getHeartRateData(date: Date): Promise<HeartRateData | null> {
    const seed = date.getDate() + date.getMonth() * 31;
    const baseRHR = 65;
    const variance = Math.sin(seed) * 8;
    
    return {
      date: date.toISOString().split('T')[0],
      restingHeartRate: Math.round(baseRHR + variance),
      averageHeartRate: Math.round(baseRHR + variance + 25),
      maxHeartRate: Math.round(baseRHR + variance + 85),
    };
  }

  /**
   * Generate mock sleep data
   */
  async getSleepData(date: Date): Promise<SleepData | null> {
    const seed = date.getDate() + date.getMonth() * 31;
    const baseSleep = 7.5 * 60; // 7.5 hours in minutes
    const variance = Math.sin(seed) * 60; // ±1 hour variance
    
    const totalSleepTime = Math.max(360, Math.round(baseSleep + variance)); // At least 6 hours
    const sleepQuality = Math.max(4, Math.min(10, Math.round(7 + Math.sin(seed + 1) * 2)));
    
    // Generate realistic bed/wake times
    const bedHour = 22 + Math.round(Math.sin(seed + 2) * 1.5); // 22:00 ± 1.5 hours
    const bedTime = `${bedHour.toString().padStart(2, '0')}:${Math.round(Math.random() * 60).toString().padStart(2, '0')}`;
    
    const wakeHour = bedHour + Math.round(totalSleepTime / 60);
    const actualWakeHour = wakeHour > 24 ? wakeHour - 24 : wakeHour;
    const wakeTime = `${actualWakeHour.toString().padStart(2, '0')}:${Math.round(Math.random() * 60).toString().padStart(2, '0')}`;
    
    return {
      date: date.toISOString().split('T')[0],
      totalSleepTime,
      sleepQuality,
      bedTime,
      wakeTime,
    };
  }

  /**
   * Generate mock recent workouts
   */
  async getRecentWorkouts(days: number = 7): Promise<WorkoutData[]> {
    const workouts: WorkoutData[] = [];
    const workoutTypes = ['running', 'strength', 'yoga', 'cycling', 'swimming'];
    const today = new Date();
    
    // Generate 3-5 workouts over the past week
    const workoutCount = 3 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < workoutCount; i++) {
      const daysAgo = Math.floor(Math.random() * days);
      const workoutDate = new Date(today);
      workoutDate.setDate(workoutDate.getDate() - daysAgo);
      
      const workoutType = workoutTypes[Math.floor(Math.random() * workoutTypes.length)];
      const duration = 20 + Math.floor(Math.random() * 40); // 20-60 minutes
      const calories = duration * (3 + Math.random() * 7); // 3-10 calories per minute
      
      workouts.push({
        id: `mock_workout_${i}_${workoutDate.getTime()}`,
        type: workoutType,
        duration,
        calories: Math.round(calories),
        startTime: workoutDate.toISOString(),
        endTime: new Date(workoutDate.getTime() + duration * 60 * 1000).toISOString(),
        averageHeartRate: 120 + Math.floor(Math.random() * 40),
        maxHeartRate: 150 + Math.floor(Math.random() * 30),
      });
    }
    
    // Sort by date (most recent first)
    return workouts.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  /**
   * Generate comprehensive mock health context
   */
  async generateHealthContext(userProfile?: {
    fitnessLevel: string;
    goals: string[];
    preferredWorkouts: string[];
  }): Promise<HealthContext> {
    const profile = userProfile || this.mockUserProfile;
    
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

    const stepGoalProgress = Math.round((todaysSteps / 10000) * 100);
    
    // Update streak based on recent data
    this.currentStreak = this.calculateCurrentStreak(weeklySteps);
    
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
      todaysCalories: Math.round(todaysSteps * 0.04), // Rough calorie estimate
      
      // Streaks and achievements
      currentStreak: this.currentStreak,
      bestStreak: this.bestStreak,
      totalBadges: this.totalBadges,
      
      // Weekly averages
      weeklyAverageSteps,
      weeklyWorkouts: recentWorkouts,
      
      // Recovery indicators
      averageSleepHours: todaysSleep ? todaysSleep.totalSleepTime / 60 : 7.5,
      sleepQuality: todaysSleep?.sleepQuality || 7,
      restingHeartRate: todaysHeartRate?.restingHeartRate,
      heartRateVariability: 35 + Math.round(Math.random() * 15), // Mock HRV
      
      // Activity patterns
      recentWorkouts,
      activityLevel,
      energyLevel,
      
      // User context
      fitnessLevel: profile.fitnessLevel,
      userGoals: {
        primary: profile.goals[0] || 'general_fitness',
        secondary: profile.goals.slice(1),
      },
      preferredWorkoutTypes: profile.preferredWorkouts,
      availableTime: 30, // Mock 30 minutes available
      
      // Trends (mock some trends)
      heartRateTrends: this.mockTrend(),
      stepTrends: this.mockTrend(),
      workoutFrequencyTrend: this.mockTrend(),
      
      // Recovery
      daysSinceRest,
      lastWorkoutIntensity: this.getLastWorkoutIntensity(recentWorkouts),
      recoveryScore,
    };
  }

  /**
   * Simulate streak updates for testing
   */
  updateStreak(achieved: boolean): void {
    if (achieved) {
      this.currentStreak++;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
    } else {
      this.currentStreak = 0;
    }
  }

  /**
   * Simulate earning badges
   */
  earnBadge(): void {
    this.totalBadges++;
  }

  /**
   * Get mock scenarios for testing different conditions
   */
  getMockScenarios(): { [key: string]: Partial<HealthContext> } {
    return {
      'high_achiever': {
        todaysSteps: 15000,
        currentStreak: 14,
        sleepQuality: 9,
        energyLevel: 'high',
        recoveryScore: 9,
      },
      'struggling_beginner': {
        todaysSteps: 3500,
        currentStreak: 0,
        sleepQuality: 4,
        energyLevel: 'low',
        recoveryScore: 3,
        daysSinceRest: 0,
      },
      'consistent_intermediate': {
        todaysSteps: 9500,
        currentStreak: 8,
        sleepQuality: 7,
        energyLevel: 'moderate',
        recoveryScore: 7,
      },
      'overtraining': {
        todaysSteps: 18000,
        currentStreak: 21,
        sleepQuality: 5,
        energyLevel: 'low',
        recoveryScore: 4,
        daysSinceRest: 0,
      },
    };
  }

  // Helper methods (similar to HealthKitService)
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
    let score = 5;
    
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
    if (workouts.length === 0) return 3;
    
    const today = new Date();
    const lastWorkout = new Date(Math.max(...workouts.map(w => new Date(w.startTime).getTime())));
    
    return Math.floor((today.getTime() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24));
  }

  private calculateRecoveryScore(
    sleep: SleepData | null,
    heartRate: HeartRateData | null,
    daysSinceRest: number
  ): number {
    let score = 5;
    
    if (sleep) {
      score += (sleep.sleepQuality - 5) * 0.4;
    }
    
    if (heartRate?.restingHeartRate) {
      if (heartRate.restingHeartRate <= 60) score += 1.5;
      else if (heartRate.restingHeartRate >= 80) score -= 1.5;
    }
    
    if (daysSinceRest >= 2) score += 1.5;
    else if (daysSinceRest === 0) score -= 1;
    
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  private getLastWorkoutIntensity(workouts: WorkoutData[]): 'low' | 'moderate' | 'high' {
    if (workouts.length === 0) return 'low';
    
    const lastWorkout = workouts.reduce((latest, workout) => 
      new Date(workout.startTime) > new Date(latest.startTime) ? workout : latest
    );
    
    if (lastWorkout.duration >= 60 || lastWorkout.type.includes('running')) return 'high';
    if (lastWorkout.duration >= 30) return 'moderate';
    return 'low';
  }

  private mockTrend(): 'improving' | 'stable' | 'declining' {
    const trends = ['improving', 'stable', 'declining'] as const;
    return trends[Math.floor(Math.random() * trends.length)];
  }
}

// Export singleton instance
export const mockHealthService = MockHealthService.getInstance();