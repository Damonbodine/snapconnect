/**
 * Health Context Service
 * Aggregates health data from multiple sources to create comprehensive context for AI coaching
 */

import { healthService } from './healthService';
import { supabase } from './supabase';
import { HealthContext, StepData, WorkoutData } from '../types/health';

export class HealthContextService {
  private static instance: HealthContextService;

  public static getInstance(): HealthContextService {
    if (!HealthContextService.instance) {
      HealthContextService.instance = new HealthContextService();
    }
    return HealthContextService.instance;
  }

  /**
   * Generate comprehensive health context by aggregating data from multiple sources
   */
  async generateHealthContext(): Promise<HealthContext> {
    try {
      console.log('🔍 Generating comprehensive health context');

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user profile and preferences
      const userProfile = await this.getUserProfile(user.id);

      // Get health data from HealthKit/mock service
      const baseHealthContext = await healthService.generateHealthContext(userProfile);

      // Enhance with database data
      const enhancedContext = await this.enhanceWithDatabaseData(baseHealthContext, user.id);

      // Calculate trends and insights
      const contextWithTrends = await this.calculateTrends(enhancedContext, user.id);

      console.log('✅ Health context generated successfully');
      return contextWithTrends;
    } catch (error) {
      console.error('❌ Failed to generate health context:', error);
      throw error;
    }
  }

  /**
   * Get quick health summary for immediate UI updates
   */
  async getQuickHealthSummary(): Promise<{
    todaysSteps: number;
    stepGoalProgress: number;
    currentStreak: number;
    energyLevel: 'low' | 'moderate' | 'high';
    recoveryScore: number;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get today's steps
      const todaysSteps = await healthService.getDailySteps(new Date());
      const stepGoalProgress = Math.round((todaysSteps / 10000) * 100);

      // Get current streak from database
      const { data: streakData } = await supabase
        .from('user_streaks')
        .select('current_count')
        .eq('user_id', user.id)
        .eq('streak_type', 'daily_steps')
        .eq('is_active', true)
        .single();

      const currentStreak = streakData?.current_count || 0;

      // Get recent sleep and heart rate for energy calculation
      const [sleepData, heartRateData] = await Promise.all([
        healthService.getSleepData(new Date()),
        healthService.getHeartRateData(new Date()),
      ]);

      const energyLevel = this.calculateEnergyLevel(sleepData, heartRateData);
      const recoveryScore = this.calculateRecoveryScore(sleepData, heartRateData, 1);

      return {
        todaysSteps,
        stepGoalProgress,
        currentStreak,
        energyLevel,
        recoveryScore,
      };
    } catch (error) {
      console.error('❌ Failed to get quick health summary:', error);
      return {
        todaysSteps: 0,
        stepGoalProgress: 0,
        currentStreak: 0,
        energyLevel: 'moderate',
        recoveryScore: 5,
      };
    }
  }

  /**
   * Update health context with new step data
   */
  async updateStepData(steps: number, date: Date = new Date()): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const goalReached = steps >= 10000;
      const dateString = date.toISOString().split('T')[0];

      // Update in database
      await supabase
        .from('daily_step_logs')
        .upsert({
          user_id: user.id,
          date: dateString,
          step_count: steps,
          goal_reached: goalReached,
          calories_burned: Math.round(steps * 0.04),
          distance_km: steps * 0.0008, // Rough estimate: 1250 steps = 1km
        });

      console.log(`✅ Updated step data: ${steps} steps for ${dateString}`);
    } catch (error) {
      console.error('❌ Failed to update step data:', error);
      throw error;
    }
  }

  /**
   * Add workout data to context
   */
  async addWorkoutData(workout: Omit<WorkoutData, 'id'>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      await supabase
        .from('workout_logs')
        .insert({
          user_id: user.id,
          workout_type: workout.type,
          duration_minutes: workout.duration,
          calories_burned: workout.calories || 0,
          start_time: workout.startTime,
          end_time: workout.endTime,
          average_heart_rate: workout.averageHeartRate,
          max_heart_rate: workout.maxHeartRate,
          source: 'app',
        });

      console.log(`✅ Added workout: ${workout.type} for ${workout.duration} minutes`);
    } catch (error) {
      console.error('❌ Failed to add workout data:', error);
      throw error;
    }
  }

  /**
   * Get health trends for the past month
   */
  async getHealthTrends(): Promise<{
    stepTrends: { date: string; steps: number; goalReached: boolean }[];
    workoutTrends: { date: string; workouts: number; totalMinutes: number }[];
    streakHistory: { date: string; streakCount: number }[];
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get step trends for last 30 days
      const { data: stepData } = await supabase
        .from('daily_step_logs')
        .select('date, step_count, goal_reached')
        .eq('user_id', user.id)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: true });

      // Get workout trends
      const { data: workoutData } = await supabase
        .from('workout_logs')
        .select('start_time, duration_minutes')
        .eq('user_id', user.id)
        .gte('start_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('start_time', { ascending: true });

      // Process workout data by date
      const workoutsByDate = new Map<string, { count: number; totalMinutes: number }>();
      workoutData?.forEach(workout => {
        const date = workout.start_time.split('T')[0];
        const existing = workoutsByDate.get(date) || { count: 0, totalMinutes: 0 };
        workoutsByDate.set(date, {
          count: existing.count + 1,
          totalMinutes: existing.totalMinutes + workout.duration_minutes,
        });
      });

      return {
        stepTrends: stepData?.map(item => ({
          date: item.date,
          steps: item.step_count,
          goalReached: item.goal_reached,
        })) || [],
        workoutTrends: Array.from(workoutsByDate.entries()).map(([date, data]) => ({
          date,
          workouts: data.count,
          totalMinutes: data.totalMinutes,
        })),
        streakHistory: [], // TODO: Implement streak history tracking
      };
    } catch (error) {
      console.error('❌ Failed to get health trends:', error);
      return { stepTrends: [], workoutTrends: [], streakHistory: [] };
    }
  }

  // Private helper methods

  /**
   * Get comprehensive user profile and preferences for AI coaching
   */
  private async getUserProfile(userId: string): Promise<{
    fitnessLevel: string;
    goals: string[];
    preferredWorkouts: string[];
    // Enhanced profile data
    physicalBaseline?: {
      currentWeight: number;
      targetWeight: number;
      height: number;
      bmi: number;
      dailyStepGoal: number;
      weeklyWorkoutGoal: number;
      weightGoalDirection?: 'lose' | 'gain' | 'maintain';
    };
    smartGoals?: {
      primaryGoal: string;
      specificTarget: string;
      whyImportant: string;
      targetDate: string;
      timeframe: string;
      targetValue?: number;
      targetUnit?: string;
      progressPercentage?: number;
      daysRemaining?: number;
    };
    healthLimitations?: string[];
    coachingPreferences?: {
      style: string;
      frequency: string;
      motivationStyle: string;
    };
    activityLevel?: string;
    // Behavioral learning context
    coachingHistory?: {
      totalMessages: number;
      lastInteractionDate?: string;
      responsiveness: 'high' | 'moderate' | 'low';
      preferredMessageTypes: string[];
    };
    goalProgress?: {
      activeGoalsCount: number;
      averageProgress: number;
      goalsNeedingAttention: number;
      recentProgressUpdates: any[];
    };
  }> {
    try {
      console.log('🔍 Loading enhanced user profile for coaching...');
      
      // Get comprehensive user data
      const { data: userData } = await supabase
        .from('users')
        .select(`
          fitness_level, workout_frequency, goals, primary_goal,
          current_weight_kg, target_weight_kg, height_cm,
          daily_step_goal, weekly_workout_goal,
          injuries_limitations, current_activity_level,
          coaching_style, motivation_style,
          smart_goal_target, smart_goal_why, smart_goal_target_date, smart_goal_timeframe,
          exercise_preferences, preferred_workout_times
        `)
        .eq('id', userId)
        .single();

      // Get active SMART goals from user_goals table with detailed progress
      const { data: activeGoals } = await supabase
        .from('user_goals')
        .select(`
          title, specific_target, why_important, target_date, timeframe,
          category, progress_percentage, coaching_frequency, priority,
          target_value, target_unit, current_value, created_at,
          last_progress_update, difficulty_level
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('priority', { ascending: false });

      // Get goal insights for coaching intelligence
      const { data: goalInsights } = await supabase.rpc('get_goal_insights_for_coaching', {
        target_user_id: userId
      });

      // Get recent coaching interaction data
      const { data: recentCoaching } = await supabase
        .from('goal_coaching_messages')
        .select('created_at, user_response, effectiveness_score, led_to_action')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      console.log(`✅ Loaded enhanced profile: ${activeGoals?.length || 0} active goals, ${recentCoaching?.length || 0} recent coaching interactions`);

      // Calculate BMI and weight goal direction
      let bmi = 0;
      let weightGoalDirection: 'lose' | 'gain' | 'maintain' = 'maintain';
      if (userData?.current_weight_kg && userData?.height_cm) {
        const heightM = userData.height_cm / 100;
        bmi = Math.round((userData.current_weight_kg / (heightM * heightM)) * 10) / 10;
        
        if (userData.target_weight_kg) {
          const weightDiff = userData.target_weight_kg - userData.current_weight_kg;
          if (weightDiff < -1) weightGoalDirection = 'lose';
          else if (weightDiff > 1) weightGoalDirection = 'gain';
        }
      }

      // Analyze coaching interaction patterns
      const coachingHistory = this.analyzeCoachingHistory(recentCoaching || []);
      
      // Calculate days remaining for primary goal
      const primaryGoal = activeGoals?.[0];
      let daysRemaining = 0;
      if (primaryGoal?.target_date) {
        const targetDate = new Date(primaryGoal.target_date);
        const today = new Date();
        daysRemaining = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        fitnessLevel: userData?.fitness_level || 'beginner',
        goals: userData?.goals || ['general_fitness'],
        preferredWorkouts: userData?.exercise_preferences || ['walking', 'running'],
        
        physicalBaseline: userData?.current_weight_kg ? {
          currentWeight: userData.current_weight_kg,
          targetWeight: userData.target_weight_kg || userData.current_weight_kg,
          height: userData.height_cm || 170,
          bmi: bmi,
          dailyStepGoal: userData.daily_step_goal || 10000,
          weeklyWorkoutGoal: userData.weekly_workout_goal || 3,
          weightGoalDirection,
        } : undefined,
        
        smartGoals: primaryGoal ? {
          primaryGoal: primaryGoal.title || userData?.smart_goal_target || userData?.primary_goal || 'general_fitness',
          specificTarget: primaryGoal.specific_target || userData?.smart_goal_target || 'Improve overall fitness',
          whyImportant: primaryGoal.why_important || userData?.smart_goal_why || 'To feel healthier and more energetic',
          targetDate: primaryGoal.target_date || userData?.smart_goal_target_date || '',
          timeframe: primaryGoal.timeframe || userData?.smart_goal_timeframe || '3months',
          targetValue: primaryGoal.target_value,
          targetUnit: primaryGoal.target_unit,
          progressPercentage: primaryGoal.progress_percentage || 0,
          daysRemaining,
        } : undefined,
        
        healthLimitations: userData?.injuries_limitations ? [userData.injuries_limitations] : [],
        
        coachingPreferences: {
          style: userData?.coaching_style || 'motivational',
          frequency: activeGoals?.[0]?.coaching_frequency || 'weekly',
          motivationStyle: userData?.motivation_style || 'encouragement',
        },
        
        activityLevel: userData?.current_activity_level || 'moderate',
        
        coachingHistory,
        
        goalProgress: goalInsights ? {
          activeGoalsCount: goalInsights.active_goals_count || 0,
          averageProgress: goalInsights.average_progress || 0,
          goalsNeedingAttention: goalInsights.goals_needing_attention || 0,
          recentProgressUpdates: goalInsights.recent_progress || [],
        } : undefined,
      };
    } catch (error) {
      console.error('❌ Could not load enhanced user profile:', error);
      return {
        fitnessLevel: 'beginner',
        goals: ['general_fitness'],
        preferredWorkouts: ['walking', 'running'],
        coachingHistory: {
          totalMessages: 0,
          responsiveness: 'moderate',
          preferredMessageTypes: ['encouragement'],
        },
      };
    }
  }

  /**
   * Enhance health context with database data
   */
  private async enhanceWithDatabaseData(
    baseContext: HealthContext,
    userId: string
  ): Promise<HealthContext> {
    try {
      // Get accurate streak data from database
      const { data: streakData } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', userId);

      const stepStreak = streakData?.find(s => s.streak_type === 'daily_steps');

      // Get achievement count
      const { count: achievementCount } = await supabase
        .from('user_achievements')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Get recent workouts from database
      const { data: workoutData } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('start_time', { ascending: false });

      const recentWorkouts: WorkoutData[] = workoutData?.map(workout => ({
        id: workout.id,
        type: workout.workout_type,
        duration: workout.duration_minutes,
        calories: workout.calories_burned,
        startTime: workout.start_time,
        endTime: workout.end_time,
        averageHeartRate: workout.average_heart_rate,
        maxHeartRate: workout.max_heart_rate,
      })) || [];

      return {
        ...baseContext,
        currentStreak: stepStreak?.current_count || 0,
        bestStreak: stepStreak?.best_count || 0,
        totalBadges: achievementCount || 0,
        recentWorkouts,
        weeklyWorkouts: recentWorkouts,
      };
    } catch (error) {
      console.error('❌ Failed to enhance with database data:', error);
      return baseContext;
    }
  }

  /**
   * Calculate trends based on historical data
   */
  private async calculateTrends(
    context: HealthContext,
    userId: string
  ): Promise<HealthContext> {
    try {
      // Get step data for trend calculation (last 14 days)
      const { data: stepData } = await supabase
        .from('daily_step_logs')
        .select('step_count, date')
        .eq('user_id', userId)
        .gte('date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: true });

      const stepTrends = this.calculateStepTrend(stepData || []);
      const workoutFrequencyTrend = this.calculateWorkoutFrequencyTrend(context.recentWorkouts);

      return {
        ...context,
        stepTrends,
        workoutFrequencyTrend,
        heartRateTrends: 'stable', // TODO: Implement heart rate trend calculation
      };
    } catch (error) {
      console.error('❌ Failed to calculate trends:', error);
      return context;
    }
  }

  /**
   * Calculate step trend from historical data
   */
  private calculateStepTrend(stepData: { step_count: number; date: string }[]): 'improving' | 'stable' | 'declining' {
    if (stepData.length < 7) return 'stable';

    const firstHalf = stepData.slice(0, Math.floor(stepData.length / 2));
    const secondHalf = stepData.slice(Math.floor(stepData.length / 2));

    const firstAvg = firstHalf.reduce((sum, day) => sum + day.step_count, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, day) => sum + day.step_count, 0) / secondHalf.length;

    const difference = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (difference > 10) return 'improving';
    if (difference < -10) return 'declining';
    return 'stable';
  }

  /**
   * Calculate workout frequency trend
   */
  private calculateWorkoutFrequencyTrend(workouts: WorkoutData[]): 'improving' | 'stable' | 'declining' {
    if (workouts.length === 0) return 'declining';

    // Compare this week vs last week
    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);

    const thisWeek = workouts.filter(w => new Date(w.startTime) >= thisWeekStart).length;
    const lastWeek = workouts.filter(w => {
      const workoutDate = new Date(w.startTime);
      const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      return workoutDate >= lastWeekStart && workoutDate < thisWeekStart;
    }).length;

    if (thisWeek > lastWeek) return 'improving';
    if (thisWeek < lastWeek) return 'declining';
    return 'stable';
  }

  /**
   * Calculate energy level based on sleep and heart rate
   */
  private calculateEnergyLevel(
    sleep: any,
    heartRate: any
  ): 'low' | 'moderate' | 'high' {
    let score = 5; // baseline

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

  /**
   * Calculate recovery score
   */
  private calculateRecoveryScore(
    sleep: any,
    heartRate: any,
    daysSinceRest: number
  ): number {
    let score = 5; // baseline

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

  /**
   * Analyze coaching interaction history for behavioral learning
   */
  private analyzeCoachingHistory(recentCoaching: any[]): {
    totalMessages: number;
    lastInteractionDate?: string;
    responsiveness: 'high' | 'moderate' | 'low';
    preferredMessageTypes: string[];
  } {
    if (recentCoaching.length === 0) {
      return {
        totalMessages: 0,
        responsiveness: 'moderate',
        preferredMessageTypes: ['encouragement'],
      };
    }

    // Calculate responsiveness based on user responses and actions taken
    const responseRate = recentCoaching.filter(msg => msg.user_response).length / recentCoaching.length;
    const actionRate = recentCoaching.filter(msg => msg.led_to_action).length / recentCoaching.length;
    const avgEffectiveness = recentCoaching
      .filter(msg => msg.effectiveness_score)
      .reduce((sum, msg) => sum + msg.effectiveness_score, 0) / 
      recentCoaching.filter(msg => msg.effectiveness_score).length || 0.5;

    let responsiveness: 'high' | 'moderate' | 'low' = 'moderate';
    const overallScore = (responseRate * 0.3) + (actionRate * 0.4) + (avgEffectiveness * 0.3);
    
    if (overallScore >= 0.7) responsiveness = 'high';
    else if (overallScore < 0.4) responsiveness = 'low';

    // Determine preferred message types based on effectiveness
    const messageTypeEffectiveness = new Map<string, number>();
    recentCoaching.forEach(msg => {
      if (msg.effectiveness_score && msg.message_type) {
        const current = messageTypeEffectiveness.get(msg.message_type) || 0;
        messageTypeEffectiveness.set(msg.message_type, current + msg.effectiveness_score);
      }
    });

    const preferredMessageTypes = Array.from(messageTypeEffectiveness.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);

    if (preferredMessageTypes.length === 0) {
      preferredMessageTypes.push('encouragement');
    }

    return {
      totalMessages: recentCoaching.length,
      lastInteractionDate: recentCoaching[0]?.created_at,
      responsiveness,
      preferredMessageTypes,
    };
  }

  /**
   * Generate coaching context for AI with enhanced user intelligence
   */
  async generateCoachingContext(userId: string): Promise<{
    userProfile: any;
    healthMetrics: any;
    behavioralInsights: any;
    goalContext: any;
    socialContext: any;
    eventContext: any;
    conversationContext: any;
  }> {
    try {
      console.log('🧠 Generating enhanced coaching context with behavioral learning...');
      
      const userProfile = await this.getUserProfile(userId);
      const healthMetrics = await this.getQuickHealthSummary();
      const goalInsights = await supabase.rpc('get_goal_insights_for_coaching', {
        target_user_id: userId
      });

      // Phase 1 Enhancements: Get social, event, and conversation contexts
      const [socialContext, eventContext, conversationContext] = await Promise.all([
        this.getSocialContext(userId),
        this.getEventContext(userId),
        this.getConversationContext(userId)
      ]);

      // Generate behavioral insights for personalized coaching
      const behavioralInsights = {
        coachingReadiness: this.assessCoachingReadiness(userProfile),
        optimalTimingStrategy: this.determineOptimalCoachingTiming(userProfile),
        personalizedApproach: this.generatePersonalizedApproach(userProfile),
        motivationalTriggers: this.identifyMotivationalTriggers(userProfile, socialContext, eventContext),
      };

      const goalContext = {
        primaryGoalUrgency: this.assessGoalUrgency(userProfile.smartGoals),
        progressMomentum: this.calculateProgressMomentum(userProfile.goalProgress),
        strategicFocus: this.determineStrategicFocus(userProfile),
      };

      console.log('✅ Enhanced coaching context generated with social, event, and conversation intelligence');
      
      return {
        userProfile,
        healthMetrics,
        behavioralInsights,
        goalContext,
        socialContext,
        eventContext,
        conversationContext,
      };
    } catch (error) {
      console.error('❌ Failed to generate coaching context:', error);
      throw error;
    }
  }

  /**
   * Get social context for coaching - Phase 1 Enhancement
   */
  private async getSocialContext(userId: string): Promise<{
    posting_frequency: 'high' | 'moderate' | 'low' | 'inactive';
    last_post_date: string | null;
    content_engagement_score: number;
    social_motivation_level: number;
    workout_sharing_consistency: boolean;
    recent_posts_count: number;
    posts_with_workout_content: number;
    avg_post_views: number;
    friend_interaction_level: 'high' | 'moderate' | 'low';
  }> {
    try {
      console.log('📱 Analyzing social context for coaching...');
      
      // Get user's posts from last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('id, created_at, workout_type, content')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });

      // Get post engagement data
      const postIds = recentPosts?.map(p => p.id) || [];
      const [postViews, comments] = await Promise.all([
        postIds.length > 0 ? supabase
          .from('post_views')
          .select('post_id, view_duration')
          .in('post_id', postIds) : { data: [] },
        postIds.length > 0 ? supabase
          .from('comments')
          .select('post_id')
          .in('post_id', postIds) : { data: [] }
      ]);

      // Get friend interaction data
      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      const friendIds = friendships?.map(f => f.friend_id) || [];
      const { data: friendComments } = friendIds.length > 0 ? await supabase
        .from('comments')
        .select('user_id, created_at')
        .in('post_id', postIds)
        .in('user_id', friendIds)
        .gte('created_at', thirtyDaysAgo) : { data: [] };

      // Calculate metrics
      const recentPostsCount = recentPosts?.length || 0;
      const workoutPosts = recentPosts?.filter(p => p.workout_type || 
        (p.content && (p.content.toLowerCase().includes('workout') || 
                      p.content.toLowerCase().includes('gym') ||
                      p.content.toLowerCase().includes('exercise')))) || [];
      
      const totalViews = postViews?.data?.reduce((sum, pv) => sum + (pv.view_duration || 0), 0) || 0;
      const totalComments = comments?.data?.length || 0;
      const friendCommentsCount = friendComments?.data?.length || 0;

      // Determine posting frequency
      let posting_frequency: 'high' | 'moderate' | 'low' | 'inactive' = 'inactive';
      if (recentPostsCount >= 15) posting_frequency = 'high';
      else if (recentPostsCount >= 8) posting_frequency = 'moderate';
      else if (recentPostsCount >= 3) posting_frequency = 'low';

      // Calculate engagement score (0-10)
      const avgViewsPerPost = recentPostsCount > 0 ? totalViews / recentPostsCount : 0;
      const avgCommentsPerPost = recentPostsCount > 0 ? totalComments / recentPostsCount : 0;
      const content_engagement_score = Math.min(10, Math.round(
        (avgViewsPerPost / 30) * 5 + (avgCommentsPerPost / 2) * 5
      ));

      // Social motivation level (1-10)
      const social_motivation_level = Math.min(10, Math.round(
        (recentPostsCount / 15) * 4 + 
        (workoutPosts.length / Math.max(1, recentPostsCount)) * 3 +
        (friendCommentsCount / Math.max(1, recentPostsCount)) * 3
      ));

      // Friend interaction level
      let friend_interaction_level: 'high' | 'moderate' | 'low' = 'low';
      const friendInteractionRate = recentPostsCount > 0 ? friendCommentsCount / recentPostsCount : 0;
      if (friendInteractionRate >= 0.5) friend_interaction_level = 'high';
      else if (friendInteractionRate >= 0.2) friend_interaction_level = 'moderate';

      const result = {
        posting_frequency,
        last_post_date: recentPosts?.[0]?.created_at || null,
        content_engagement_score,
        social_motivation_level,
        workout_sharing_consistency: workoutPosts.length >= recentPostsCount * 0.3,
        recent_posts_count: recentPostsCount,
        posts_with_workout_content: workoutPosts.length,
        avg_post_views: avgViewsPerPost,
        friend_interaction_level,
      };

      console.log(`✅ Social context analyzed: ${posting_frequency} posting, ${social_motivation_level}/10 motivation`);
      return result;
    } catch (error) {
      console.error('❌ Failed to get social context:', error);
      return {
        posting_frequency: 'inactive',
        last_post_date: null,
        content_engagement_score: 0,
        social_motivation_level: 5,
        workout_sharing_consistency: false,
        recent_posts_count: 0,
        posts_with_workout_content: 0,
        avg_post_views: 0,
        friend_interaction_level: 'low',
      };
    }
  }

  /**
   * Get event context for coaching - Phase 1 Enhancement
   */
  private async getEventContext(userId: string): Promise<{
    upcoming_events: Array<{
      event_id: string;
      title: string;
      event_type: string;
      days_until: number;
      rsvp_status: string;
    }>;
    attendance_reliability: number;
    preferred_event_types: string[];
    recent_no_shows: number;
    events_attended_last_month: number;
    social_accountability_score: number;
    next_event_motivation_opportunity: string | null;
  }> {
    try {
      console.log('📅 Analyzing event context for coaching...');
      
      const now = new Date();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Get user's event participations
      const { data: participations } = await supabase
        .from('event_participants')
        .select(`
          event_id, status, checked_in, no_show, created_at,
          events!inner (
            id, title, start_time, category_id,
            event_categories (name)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!participations || participations.length === 0) {
        return {
          upcoming_events: [],
          attendance_reliability: 0,
          preferred_event_types: [],
          recent_no_shows: 0,
          events_attended_last_month: 0,
          social_accountability_score: 0,
          next_event_motivation_opportunity: null,
        };
      }

      // Process upcoming events
      const upcoming_events = participations
        .filter(p => new Date(p.events.start_time) > now && new Date(p.events.start_time) <= thirtyDaysFromNow)
        .map(p => ({
          event_id: p.event_id,
          title: p.events.title,
          event_type: p.events.event_categories?.name || 'fitness',
          days_until: Math.ceil((new Date(p.events.start_time).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          rsvp_status: p.status,
        }))
        .sort((a, b) => a.days_until - b.days_until);

      // Calculate attendance reliability (last 10 events)
      const recentEvents = participations
        .filter(p => new Date(p.events.start_time) < now && p.status === 'attending')
        .slice(0, 10);

      const attendedEvents = recentEvents.filter(p => p.checked_in && !p.no_show).length;
      const attendance_reliability = recentEvents.length > 0 ? 
        Math.round((attendedEvents / recentEvents.length) * 100) : 0;

      // Count recent no-shows
      const recent_no_shows = participations
        .filter(p => 
          new Date(p.events.start_time) >= thirtyDaysAgo &&
          new Date(p.events.start_time) < now &&
          p.no_show
        ).length;

      // Events attended last month
      const events_attended_last_month = participations
        .filter(p => 
          new Date(p.events.start_time) >= thirtyDaysAgo &&
          new Date(p.events.start_time) < now &&
          p.checked_in && !p.no_show
        ).length;

      // Preferred event types
      const eventTypeCounts = new Map<string, number>();
      participations.forEach(p => {
        if (p.checked_in && !p.no_show) {
          const type = p.events.event_categories?.name || 'fitness';
          eventTypeCounts.set(type, (eventTypeCounts.get(type) || 0) + 1);
        }
      });
      const preferred_event_types = Array.from(eventTypeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type]) => type);

      // Social accountability score (0-10)
      const social_accountability_score = Math.min(10, Math.round(
        (attendance_reliability / 100) * 5 +
        (events_attended_last_month / 8) * 3 +
        (upcoming_events.length > 0 ? 2 : 0)
      ));

      // Next motivation opportunity
      const next_event_motivation_opportunity = upcoming_events.length > 0 ?
        `Upcoming ${upcoming_events[0].event_type} event "${upcoming_events[0].title}" in ${upcoming_events[0].days_until} days` :
        null;

      const result = {
        upcoming_events,
        attendance_reliability,
        preferred_event_types,
        recent_no_shows,
        events_attended_last_month,
        social_accountability_score,
        next_event_motivation_opportunity,
      };

      console.log(`✅ Event context analyzed: ${attendance_reliability}% reliability, ${events_attended_last_month} events attended`);
      return result;
    } catch (error) {
      console.error('❌ Failed to get event context:', error);
      return {
        upcoming_events: [],
        attendance_reliability: 0,
        preferred_event_types: [],
        recent_no_shows: 0,
        events_attended_last_month: 0,
        social_accountability_score: 0,
        next_event_motivation_opportunity: null,
      };
    }
  }

  /**
   * Get conversation context for coaching - Phase 1 Enhancement
   */
  private async getConversationContext(userId: string): Promise<{
    recent_messages_count: number;
    last_interaction_date: string | null;
    user_response_rate: number;
    most_effective_message_type: string;
    conversation_topics_discussed: string[];
    user_engagement_trend: 'increasing' | 'stable' | 'declining';
    preferred_response_time: string;
    coaching_effectiveness_score: number;
  }> {
    try {
      console.log('💬 Analyzing conversation context for coaching...');
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      // Get recent coaching messages
      const { data: recentMessages } = await supabase
        .from('ai_coaching_messages')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });

      if (!recentMessages || recentMessages.length === 0) {
        return {
          recent_messages_count: 0,
          last_interaction_date: null,
          user_response_rate: 0,
          most_effective_message_type: 'encouragement',
          conversation_topics_discussed: [],
          user_engagement_trend: 'stable',
          preferred_response_time: 'morning',
          coaching_effectiveness_score: 5,
        };
      }

      // Calculate response rate
      const messagesWithResponse = recentMessages.filter(m => m.user_response).length;
      const user_response_rate = Math.round((messagesWithResponse / recentMessages.length) * 100);

      // Find most effective message type
      const messageTypeEffectiveness = new Map<string, { count: number; responses: number }>();
      recentMessages.forEach(msg => {
        const type = msg.message_type;
        const current = messageTypeEffectiveness.get(type) || { count: 0, responses: 0 };
        messageTypeEffectiveness.set(type, {
          count: current.count + 1,
          responses: current.responses + (msg.user_response ? 1 : 0)
        });
      });

      let most_effective_message_type = 'encouragement';
      let highestEffectiveness = 0;
      messageTypeEffectiveness.forEach((data, type) => {
        const effectiveness = data.count > 0 ? data.responses / data.count : 0;
        if (effectiveness > highestEffectiveness) {
          highestEffectiveness = effectiveness;
          most_effective_message_type = type;
        }
      });

      // Extract conversation topics
      const conversation_topics_discussed = [...new Set(
        recentMessages.map(m => m.message_type).filter(Boolean)
      )];

      // Calculate engagement trend
      const recentHalf = recentMessages.slice(0, Math.floor(recentMessages.length / 2));
      const olderHalf = recentMessages.slice(Math.floor(recentMessages.length / 2));
      
      const recentEngagement = recentHalf.filter(m => m.user_response).length / Math.max(1, recentHalf.length);
      const olderEngagement = olderHalf.filter(m => m.user_response).length / Math.max(1, olderHalf.length);
      
      let user_engagement_trend: 'increasing' | 'stable' | 'declining' = 'stable';
      if (recentEngagement > olderEngagement + 0.2) user_engagement_trend = 'increasing';
      else if (recentEngagement < olderEngagement - 0.2) user_engagement_trend = 'declining';

      // Determine preferred response time based on when user responds
      const responseTimes = recentMessages
        .filter(m => m.responded_at)
        .map(m => new Date(m.responded_at!).getHours());
      
      let preferred_response_time = 'morning';
      if (responseTimes.length > 0) {
        const avgHour = responseTimes.reduce((sum, hour) => sum + hour, 0) / responseTimes.length;
        if (avgHour >= 6 && avgHour < 12) preferred_response_time = 'morning';
        else if (avgHour >= 12 && avgHour < 18) preferred_response_time = 'afternoon';
        else preferred_response_time = 'evening';
      }

      // Overall coaching effectiveness score (1-10)
      const coaching_effectiveness_score = Math.min(10, Math.round(
        (user_response_rate / 100) * 4 +
        (highestEffectiveness * 3) +
        (recentMessages.length / 20) * 2 +
        (user_engagement_trend === 'increasing' ? 1 : user_engagement_trend === 'declining' ? -1 : 0)
      ));

      const result = {
        recent_messages_count: recentMessages.length,
        last_interaction_date: recentMessages[0]?.created_at || null,
        user_response_rate,
        most_effective_message_type,
        conversation_topics_discussed,
        user_engagement_trend,
        preferred_response_time,
        coaching_effectiveness_score: Math.max(1, coaching_effectiveness_score),
      };

      console.log(`✅ Conversation context analyzed: ${user_response_rate}% response rate, ${user_engagement_trend} trend`);
      return result;
    } catch (error) {
      console.error('❌ Failed to get conversation context:', error);
      return {
        recent_messages_count: 0,
        last_interaction_date: null,
        user_response_rate: 0,
        most_effective_message_type: 'encouragement',
        conversation_topics_discussed: [],
        user_engagement_trend: 'stable',
        preferred_response_time: 'morning',
        coaching_effectiveness_score: 5,
      };
    }
  }

  /**
   * Assess user's readiness for coaching intervention
   */
  private assessCoachingReadiness(userProfile: any): 'high' | 'moderate' | 'low' {
    let readinessScore = 0;
    
    // Recent goal activity
    if (userProfile.goalProgress?.recentProgressUpdates?.length > 0) readinessScore += 3;
    
    // Responsiveness to coaching
    if (userProfile.coachingHistory?.responsiveness === 'high') readinessScore += 3;
    else if (userProfile.coachingHistory?.responsiveness === 'moderate') readinessScore += 1;
    
    // Goal urgency (close deadlines)
    if (userProfile.smartGoals?.daysRemaining && userProfile.smartGoals.daysRemaining < 30) readinessScore += 2;
    
    // Progress stalling
    if (userProfile.goalProgress?.goalsNeedingAttention > 0) readinessScore += 2;
    
    if (readinessScore >= 6) return 'high';
    if (readinessScore >= 3) return 'moderate';
    return 'low';
  }

  /**
   * Determine optimal timing strategy for coaching
   */
  private determineOptimalCoachingTiming(userProfile: any): 'immediate' | 'scheduled' | 'milestone_based' {
    if (userProfile.coachingHistory?.responsiveness === 'high') {
      return 'immediate';
    }
    
    if (userProfile.goalProgress?.goalsNeedingAttention > 0) {
      return 'immediate';
    }
    
    if (userProfile.smartGoals?.progressPercentage >= 25) {
      return 'milestone_based';
    }
    
    return 'scheduled';
  }

  /**
   * Generate personalized coaching approach
   */
  private generatePersonalizedApproach(userProfile: any): {
    tone: string;
    focusArea: string;
    motivationStyle: string;
    communicationFrequency: string;
  } {
    return {
      tone: userProfile.coachingPreferences?.style || 'motivational',
      focusArea: this.determineFocusArea(userProfile),
      motivationStyle: userProfile.coachingPreferences?.motivationStyle || 'encouragement',
      communicationFrequency: userProfile.coachingPreferences?.frequency || 'weekly',
    };
  }

  /**
   * Identify what motivates this specific user - Enhanced with social and event context
   */
  private identifyMotivationalTriggers(userProfile: any, socialContext: any, eventContext: any): string[] {
    const triggers: string[] = [];
    
    // Goal-based triggers
    if (userProfile.smartGoals?.whyImportant) {
      triggers.push('personal_why');
    }
    
    if (userProfile.physicalBaseline?.weightGoalDirection === 'lose') {
      triggers.push('weight_progress');
    }
    
    if (userProfile.healthLimitations?.length > 0) {
      triggers.push('health_improvement');
    }
    
    if (userProfile.goalProgress?.averageProgress > 50) {
      triggers.push('achievement_momentum');
    }
    
    // Social-based triggers (Phase 1 Enhancement)
    if (socialContext.posting_frequency === 'high' || socialContext.posts_with_workout_content > 3) {
      triggers.push('social_sharing_validation');
    }
    
    if (socialContext.friend_interaction_level === 'high') {
      triggers.push('peer_support');
    }
    
    if (socialContext.posting_frequency === 'low' || socialContext.posting_frequency === 'inactive') {
      triggers.push('social_activation');
    }
    
    // Event-based triggers (Phase 1 Enhancement)
    if (eventContext.upcoming_events.length > 0) {
      triggers.push('event_preparation');
    }
    
    if (eventContext.attendance_reliability > 80) {
      triggers.push('consistency_reinforcement');
    }
    
    if (eventContext.attendance_reliability < 50 && eventContext.upcoming_events.length > 0) {
      triggers.push('accountability_focus');
    }
    
    if (eventContext.events_attended_last_month === 0 && eventContext.upcoming_events.length === 0) {
      triggers.push('social_engagement_encouragement');
    }
    
    if (triggers.length === 0) {
      triggers.push('general_encouragement');
    }
    
    return triggers;
  }

  /**
   * Assess urgency of primary goal
   */
  private assessGoalUrgency(smartGoals: any): 'high' | 'moderate' | 'low' {
    if (!smartGoals?.daysRemaining) return 'low';
    
    const daysRemaining = smartGoals.daysRemaining;
    const progressPercentage = smartGoals.progressPercentage || 0;
    
    // High urgency: close deadline with low progress
    if (daysRemaining < 30 && progressPercentage < 50) return 'high';
    
    // Moderate urgency: approaching deadline or behind pace
    if (daysRemaining < 60 || progressPercentage < 25) return 'moderate';
    
    return 'low';
  }

  /**
   * Calculate momentum of goal progress
   */
  private calculateProgressMomentum(goalProgress: any): 'accelerating' | 'steady' | 'stalling' {
    if (!goalProgress?.recentProgressUpdates) return 'stalling';
    
    const recentUpdates = goalProgress.recentProgressUpdates;
    if (recentUpdates.length >= 2) {
      const recent = recentUpdates[0]?.progress_percentage || 0;
      const previous = recentUpdates[1]?.progress_percentage || 0;
      
      if (recent > previous + 5) return 'accelerating';
      if (recent >= previous) return 'steady';
    }
    
    return 'stalling';
  }

  /**
   * Determine strategic focus area for coaching
   */
  private determineStrategicFocus(userProfile: any): string {
    if (userProfile.goalProgress?.goalsNeedingAttention > 0) {
      return 'accountability';
    }
    
    if (userProfile.smartGoals?.progressPercentage < 25) {
      return 'motivation';
    }
    
    if (userProfile.physicalBaseline?.bmi && (userProfile.physicalBaseline.bmi < 18.5 || userProfile.physicalBaseline.bmi > 25)) {
      return 'health_optimization';
    }
    
    return 'progress_acceleration';
  }

  /**
   * Determine focus area based on user profile
   */
  private determineFocusArea(userProfile: any): string {
    if (userProfile.healthLimitations?.length > 0) {
      return 'safety_first';
    }
    
    if (userProfile.physicalBaseline?.weightGoalDirection === 'lose') {
      return 'weight_management';
    }
    
    if (userProfile.smartGoals?.primaryGoal?.toLowerCase().includes('strength')) {
      return 'strength_building';
    }
    
    if (userProfile.smartGoals?.primaryGoal?.toLowerCase().includes('endurance')) {
      return 'cardiovascular_fitness';
    }
    
    return 'general_fitness';
  }
}

// Export singleton instance
export const healthContextService = HealthContextService.getInstance();