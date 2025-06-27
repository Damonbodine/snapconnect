/**
 * Health Store - Zustand store for health data, achievements, and streaks
 */

import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { healthService } from '../services/healthService';
import {
  StepData,
  Achievement,
  Streak,
  HealthContext,
  CoachingMessage,
  DailyHealthSummary,
} from '../types/health';

interface HealthStore {
  // Current state
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Daily data
  todaysSteps: number;
  stepGoalProgress: number;
  stepGoal: number;
  todaysCalories: number;
  
  // Streaks and achievements
  currentStreak: number;
  bestStreak: number;
  achievements: Achievement[];
  streaks: Streak[];
  
  // Weekly data
  weeklySteps: StepData[];
  weeklyAverage: number;
  
  // Health context for AI
  healthContext: HealthContext | null;
  
  // Coaching messages
  coachingMessages: CoachingMessage[];
  unreadCoachingMessages: number;
  
  // Dashboard summary
  dashboardData: {
    totalAchievements: number;
    recentAchievements: Achievement[];
    weeklyAverage: number;
    goalDaysThisWeek: number;
  };
  
  // Actions
  initialize: () => Promise<void>;
  syncHealthData: () => Promise<void>;
  updateDailySteps: (steps: number, date?: Date) => Promise<void>;
  loadAchievements: () => Promise<void>;
  loadStreaks: () => Promise<void>;
  generateHealthContext: () => Promise<HealthContext | null>;
  loadCoachingMessages: () => Promise<void>;
  markCoachingMessageAsRead: (messageId: string) => Promise<void>;
  addCoachingMessage: (message: Omit<CoachingMessage, 'id' | 'timestamp'>) => Promise<void>;
  getDashboardData: () => Promise<void>;
  
  // Health data permissions
  requestHealthPermissions: () => Promise<boolean>;
  getPermissionStatus: () => Promise<{
    isAvailable: boolean;
    hasPermissions: boolean;
    isInitialized: boolean;
    usingMockData: boolean;
  }>;
  
  // Utility actions
  refreshAllData: () => Promise<void>;
  clearError: () => void;
  
  // Mock data testing (only available in development)
  toggleMockData: () => void;
  useMockScenario: (scenario: string) => void;
}

export const useHealthStore = create<HealthStore>((set, get) => ({
  // Initial state
  isInitialized: false,
  isLoading: false,
  error: null,
  
  todaysSteps: 0,
  stepGoalProgress: 0,
  stepGoal: 10000,
  todaysCalories: 0,
  
  currentStreak: 0,
  bestStreak: 0,
  achievements: [],
  streaks: [],
  
  weeklySteps: [],
  weeklyAverage: 0,
  
  healthContext: null,
  coachingMessages: [],
  unreadCoachingMessages: 0,
  
  dashboardData: {
    totalAchievements: 0,
    recentAchievements: [],
    weeklyAverage: 0,
    goalDaysThisWeek: 0,
  },

  // Initialize health tracking
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      
      // Initialize health service
      const initialized = await healthService.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize health service');
      }
      
      // Load all initial data
      await get().refreshAllData();
      
      set({ isInitialized: true, isLoading: false });
    } catch (error) {
      console.error('❌ Health store initialization failed:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Initialization failed',
        isLoading: false 
      });
    }
  },

  // Sync health data from HealthKit/mock service
  syncHealthData: async () => {
    try {
      set({ isLoading: true });
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get weekly step data
      const weeklySteps = await healthService.getStepsForPeriod(7);
      
      // Batch update step data in database
      const { data, error } = await supabase.rpc('batch_update_step_data', {
        target_user_id: user.id,
        step_data: weeklySteps,
      });
      
      if (error) throw error;
      
      console.log(`✅ Synced ${data.total} days of step data`);
      
      // Update local state
      const todaysSteps = weeklySteps[weeklySteps.length - 1]?.steps || 0;
      const weeklyAverage = Math.round(
        weeklySteps.reduce((sum, day) => sum + day.steps, 0) / weeklySteps.length
      );
      
      set({
        weeklySteps,
        todaysSteps,
        stepGoalProgress: Math.round((todaysSteps / get().stepGoal) * 100),
        weeklyAverage,
        isLoading: false,
      });
      
      // Load updated achievements and streaks
      await Promise.all([
        get().loadAchievements(),
        get().loadStreaks(),
      ]);
      
    } catch (error) {
      console.error('❌ Health data sync failed:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Sync failed',
        isLoading: false 
      });
    }
  },

  // Update daily steps manually
  updateDailySteps: async (steps: number, date = new Date()) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const goalReached = steps >= get().stepGoal;
      const dateString = date.toISOString().split('T')[0];
      
      // Update in database
      const { error } = await supabase
        .from('daily_step_logs')
        .upsert({
          user_id: user.id,
          date: dateString,
          step_count: steps,
          goal_reached: goalReached,
          calories_burned: Math.round(steps * 0.04), // Rough estimate
        });
      
      if (error) throw error;
      
      // Update local state if it's today
      const today = new Date().toISOString().split('T')[0];
      if (dateString === today) {
        set({
          todaysSteps: steps,
          stepGoalProgress: Math.round((steps / get().stepGoal) * 100),
          todaysCalories: Math.round(steps * 0.04),
        });
      }
      
      // Refresh achievements and streaks (they might have updated via triggers)
      setTimeout(() => {
        get().loadAchievements();
        get().loadStreaks();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Failed to update daily steps:', error);
      set({ error: error instanceof Error ? error.message : 'Update failed' });
    }
  },

  // Load user achievements
  loadAchievements: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', user.id)
        .order('earned_date', { ascending: false });
      
      if (error) throw error;
      
      const achievements: Achievement[] = data.map(achievement => ({
        id: achievement.id,
        type: achievement.achievement_type,
        title: achievement.title,
        description: achievement.description || '',
        earnedDate: achievement.earned_date,
        iconName: achievement.icon_name || 'trophy',
        level: achievement.level,
      }));
      
      set({ achievements });
      
    } catch (error) {
      console.error('❌ Failed to load achievements:', error);
    }
  },

  // Load user streaks
  loadStreaks: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      const streaks: Streak[] = data.map(streak => ({
        type: streak.streak_type,
        currentCount: streak.current_count,
        bestCount: streak.best_count,
        lastUpdated: streak.last_updated,
        isActive: streak.is_active,
      }));
      
      // Update current and best streaks for steps
      const stepStreak = streaks.find(s => s.type === 'daily_steps');
      if (stepStreak) {
        set({
          currentStreak: stepStreak.currentCount,
          bestStreak: stepStreak.bestCount,
        });
      }
      
      set({ streaks });
      
    } catch (error) {
      console.error('❌ Failed to load streaks:', error);
    }
  },

  // Generate health context for AI coaching
  generateHealthContext: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get user profile for context
      const { data: userProfile } = await supabase
        .from('users')
        .select('fitness_level, workout_frequency, primary_goals')
        .eq('id', user.id)
        .single();
      
      const profile = {
        fitnessLevel: userProfile?.fitness_level || 'beginner',
        goals: userProfile?.primary_goals || ['general_fitness'],
        preferredWorkouts: ['walking', 'running'], // TODO: Get from user preferences
      };
      
      const healthContext = await healthService.generateHealthContext(profile);
      set({ healthContext });
      
      return healthContext;
    } catch (error) {
      console.error('❌ Failed to generate health context:', error);
      return null;
    }
  },

  // Load coaching messages
  loadCoachingMessages: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('ai_coaching_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      const messages: CoachingMessage[] = data.map(msg => ({
        id: msg.id,
        message: msg.message_text,
        type: msg.message_type,
        timestamp: msg.created_at,
        healthContext: msg.health_context,
        actionable: msg.is_actionable,
        suggestedAction: msg.suggested_action,
      }));
      
      const unreadCount = messages.filter(msg => !msg.timestamp).length;
      
      set({ 
        coachingMessages: messages,
        unreadCoachingMessages: unreadCount,
      });
      
    } catch (error) {
      console.error('❌ Failed to load coaching messages:', error);
    }
  },

  // Mark coaching message as read
  markCoachingMessageAsRead: async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('ai_coaching_messages')
        .update({ 
          user_response: 'read',
          responded_at: new Date().toISOString(),
        })
        .eq('id', messageId);
      
      if (error) throw error;
      
      // Update local state
      const messages = get().coachingMessages.map(msg =>
        msg.id === messageId ? { ...msg, timestamp: new Date().toISOString() } : msg
      );
      
      set({ 
        coachingMessages: messages,
        unreadCoachingMessages: Math.max(0, get().unreadCoachingMessages - 1),
      });
      
    } catch (error) {
      console.error('❌ Failed to mark message as read:', error);
    }
  },

  // Add new coaching message
  addCoachingMessage: async (message: Omit<CoachingMessage, 'id' | 'timestamp'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('ai_coaching_messages')
        .insert({
          user_id: user.id,
          message_type: message.type,
          message_text: message.message,
          health_context: message.healthContext || {},
          is_actionable: message.actionable || false,
          suggested_action: message.suggestedAction,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newMessage: CoachingMessage = {
        id: data.id,
        message: data.message_text,
        type: data.message_type,
        timestamp: data.created_at,
        healthContext: data.health_context,
        actionable: data.is_actionable,
        suggestedAction: data.suggested_action,
      };
      
      set({
        coachingMessages: [newMessage, ...get().coachingMessages],
        unreadCoachingMessages: get().unreadCoachingMessages + 1,
      });
      
    } catch (error) {
      console.error('❌ Failed to add coaching message:', error);
    }
  },

  // Get dashboard data
  getDashboardData: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase.rpc('get_health_dashboard', {
        target_user_id: user.id,
      });
      
      if (error) throw error;
      
      set({
        dashboardData: {
          totalAchievements: data.totalAchievements,
          recentAchievements: data.recentAchievements,
          weeklyAverage: data.weeklyAverage,
          goalDaysThisWeek: data.goalDaysThisWeek || 0,
        },
      });
      
    } catch (error) {
      console.error('❌ Failed to load dashboard data:', error);
    }
  },

  // Request health permissions
  requestHealthPermissions: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const success = await healthService.requestPermissions();
      
      if (success) {
        // Reinitialize and refresh data
        await healthService.initialize();
        await get().refreshAllData();
        console.log('✅ Health permissions granted and data refreshed');
      } else {
        set({ error: 'Failed to grant health permissions' });
      }
      
      set({ isLoading: false });
      return success;
    } catch (error) {
      console.error('❌ Failed to request health permissions:', error);
      set({ isLoading: false, error: 'Failed to request health permissions' });
      return false;
    }
  },

  // Get permission status
  getPermissionStatus: async () => {
    try {
      return await healthService.getPermissionStatus();
    } catch (error) {
      console.error('❌ Failed to get permission status:', error);
      return {
        isAvailable: false,
        hasPermissions: false,
        isInitialized: false,
        usingMockData: true,
      };
    }
  },

  // Refresh all data
  refreshAllData: async () => {
    const promises = [
      get().syncHealthData(),
      get().loadAchievements(),
      get().loadStreaks(),
      get().generateHealthContext(),
      get().loadCoachingMessages(),
      get().getDashboardData(),
    ];
    
    await Promise.allSettled(promises);
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Development utilities
  toggleMockData: () => {
    if (__DEV__) {
      const currentlyUsingMock = healthService.isUsingMockData();
      healthService.setUseMockData(!currentlyUsingMock);
      console.log(`🔧 Switched to ${!currentlyUsingMock ? 'mock' : 'real'} health data`);
      get().refreshAllData();
    }
  },

  useMockScenario: (scenario: string) => {
    if (__DEV__) {
      const scenarios = healthService.getMockScenarios();
      if (scenarios && scenarios[scenario]) {
        const scenarioData = scenarios[scenario];
        set({
          todaysSteps: scenarioData.todaysSteps || get().todaysSteps,
          currentStreak: scenarioData.currentStreak || get().currentStreak,
          stepGoalProgress: scenarioData.todaysSteps 
            ? Math.round((scenarioData.todaysSteps / get().stepGoal) * 100)
            : get().stepGoalProgress,
        });
        console.log(`🎭 Applied mock scenario: ${scenario}`);
      }
    }
  },
}));