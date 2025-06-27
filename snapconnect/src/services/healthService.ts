/**
 * Unified Health Service
 * Provides a single interface that can switch between real HealthKit and mock data
 */

import { Platform } from 'react-native';
import { healthKitService } from './healthKitService';
import { mockHealthService } from './mockHealthService';
import {
  StepData,
  HeartRateData,
  SleepData,
  WorkoutData,
  HealthContext,
} from '../types/health';

export class HealthService {
  private static instance: HealthService;
  private useMockData: boolean;
  private isInitialized = false;

  constructor() {
    // Temporarily force mock data until HealthKit library is properly linked
    this.useMockData = true;
    console.log('🔧 Health service initialized with mock data (HealthKit temporarily disabled)');
  }

  public static getInstance(): HealthService {
    if (!HealthService.instance) {
      HealthService.instance = new HealthService();
    }
    return HealthService.instance;
  }

  /**
   * Toggle between mock and real data (useful for testing)
   */
  setUseMockData(useMock: boolean): void {
    this.useMockData = useMock;
    console.log(`🔧 Health service switched to ${useMock ? 'mock' : 'real'} data`);
  }

  /**
   * Check if currently using mock data
   */
  isUsingMockData(): boolean {
    return this.useMockData;
  }

  /**
   * Initialize the appropriate health service
   */
  async initialize(): Promise<boolean> {
    try {
      let success: boolean;
      
      if (this.useMockData) {
        success = await mockHealthService.initializeHealthKit();
        console.log('🔧 Initialized with mock health data');
      } else {
        success = await healthKitService.initializeHealthKit();
        console.log('✅ Initialized with real HealthKit data');
      }
      
      this.isInitialized = success;
      return success;
    } catch (error) {
      console.error('❌ Health service initialization failed:', error);
      // Fallback to mock data
      this.useMockData = true;
      this.isInitialized = await mockHealthService.initializeHealthKit();
      return this.isInitialized;
    }
  }

  /**
   * Request HealthKit permissions
   */
  async requestPermissions(): Promise<boolean> {
    // Only try HealthKit on iOS
    if (Platform.OS !== 'ios') {
      console.log('🔧 HealthKit not available on this platform - staying with mock data');
      return false;
    }
    
    try {
      console.log('📱 Requesting HealthKit permissions...');
      const success = await healthKitService.requestPermissions();
      
      if (success) {
        this.useMockData = false;
        this.isInitialized = true;
        console.log('✅ HealthKit permissions granted - switching to real data');
      } else {
        console.log('❌ HealthKit permissions denied - staying with mock data');
        this.useMockData = true;
      }
      
      return success;
    } catch (error) {
      console.error('❌ Failed to request HealthKit permissions:', error);
      this.useMockData = true;
      return false;
    }
  }

  /**
   * Get current permission status
   */
  async getPermissionStatus(): Promise<{
    isAvailable: boolean;
    hasPermissions: boolean;
    isInitialized: boolean;
    usingMockData: boolean;
  }> {
    if (this.useMockData) {
      return {
        isAvailable: true,
        hasPermissions: true,
        isInitialized: this.isInitialized,
        usingMockData: true,
      };
    }
    
    try {
      const status = await healthKitService.getPermissionStatus();
      return {
        ...status,
        usingMockData: false,
      };
    } catch (error) {
      console.error('❌ Failed to get permission status:', error);
      return {
        isAvailable: false,
        hasPermissions: false,
        isInitialized: false,
        usingMockData: this.useMockData,
      };
    }
  }

  /**
   * Get daily steps for a specific date
   */
  async getDailySteps(date: Date): Promise<number> {
    this.ensureInitialized();
    
    if (this.useMockData) {
      return mockHealthService.getDailySteps(date);
    } else {
      return healthKitService.getDailySteps(date);
    }
  }

  /**
   * Get step data for multiple days
   */
  async getStepsForPeriod(days: number = 7): Promise<StepData[]> {
    this.ensureInitialized();
    
    if (this.useMockData) {
      return mockHealthService.getStepsForPeriod(days);
    } else {
      return healthKitService.getStepsForPeriod(days);
    }
  }

  /**
   * Get heart rate data for a specific date
   */
  async getHeartRateData(date: Date): Promise<HeartRateData | null> {
    this.ensureInitialized();
    
    if (this.useMockData) {
      return mockHealthService.getHeartRateData(date);
    } else {
      return healthKitService.getHeartRateData(date);
    }
  }

  /**
   * Get sleep data for a specific date
   */
  async getSleepData(date: Date): Promise<SleepData | null> {
    this.ensureInitialized();
    
    if (this.useMockData) {
      return mockHealthService.getSleepData(date);
    } else {
      return healthKitService.getSleepData(date);
    }
  }

  /**
   * Get recent workouts
   */
  async getRecentWorkouts(days: number = 7): Promise<WorkoutData[]> {
    this.ensureInitialized();
    
    if (this.useMockData) {
      return mockHealthService.getRecentWorkouts(days);
    } else {
      return healthKitService.getRecentWorkouts(days);
    }
  }

  /**
   * Generate comprehensive health context for AI coaching
   */
  async generateHealthContext(userProfile: {
    fitnessLevel: string;
    goals: string[];
    preferredWorkouts: string[];
  }): Promise<HealthContext> {
    this.ensureInitialized();
    
    if (this.useMockData) {
      return mockHealthService.generateHealthContext(userProfile);
    } else {
      return healthKitService.generateHealthContext(userProfile);
    }
  }

  /**
   * Get current step goal progress for today
   */
  async getTodaysProgress(): Promise<{
    steps: number;
    goal: number;
    percentage: number;
    goalReached: boolean;
  }> {
    const steps = await this.getDailySteps(new Date());
    const goal = 10000;
    const percentage = Math.round((steps / goal) * 100);
    
    return {
      steps,
      goal,
      percentage,
      goalReached: steps >= goal,
    };
  }

  /**
   * Get quick health summary for dashboard
   */
  async getQuickSummary(): Promise<{
    todaysSteps: number;
    stepGoalProgress: number;
    currentStreak: number;
    weeklyAverage: number;
    lastWorkout?: WorkoutData;
    sleepLastNight?: SleepData;
  }> {
    const [todaysSteps, weeklySteps, recentWorkouts, sleepData] = await Promise.all([
      this.getDailySteps(new Date()),
      this.getStepsForPeriod(7),
      this.getRecentWorkouts(3),
      this.getSleepData(new Date()),
    ]);

    const weeklyAverage = Math.round(
      weeklySteps.reduce((sum, day) => sum + day.steps, 0) / weeklySteps.length
    );

    const currentStreak = this.calculateCurrentStreak(weeklySteps);
    const stepGoalProgress = Math.round((todaysSteps / 10000) * 100);

    return {
      todaysSteps,
      stepGoalProgress,
      currentStreak,
      weeklyAverage,
      lastWorkout: recentWorkouts[0],
      sleepLastNight: sleepData,
    };
  }

  /**
   * Mock data specific methods (only available when using mock data)
   */
  getMockScenarios(): { [key: string]: Partial<HealthContext> } | null {
    if (this.useMockData) {
      return mockHealthService.getMockScenarios();
    }
    return null;
  }

  updateMockStreak(achieved: boolean): void {
    if (this.useMockData) {
      mockHealthService.updateStreak(achieved);
    }
  }

  earnMockBadge(): void {
    if (this.useMockData) {
      mockHealthService.earnBadge();
    }
  }

  // Helper methods
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Health service not initialized. Call initialize() first.');
    }
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

  /**
   * Health service status for debugging
   */
  getStatus(): {
    isInitialized: boolean;
    usingMockData: boolean;
    platform: string;
    isDevelopment: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      usingMockData: this.useMockData,
      platform: Platform.OS,
      isDevelopment: __DEV__,
    };
  }
}

// Export singleton instance
export const healthService = HealthService.getInstance();