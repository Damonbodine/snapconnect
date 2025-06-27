/**
 * AI Coach Service
 * High-level service for health coaching that orchestrates health data and AI responses
 */

import { healthAIService, HealthCoachingRequest } from './healthAIService';
import { healthService } from './healthService';
import { healthContextService } from './healthContextService';
import { supabase } from './supabase';
import {
  HealthContext,
  WorkoutSuggestion,
  CoachingMessage,
  Achievement,
} from '../types/health';

export class AICoachService {
  private static instance: AICoachService;

  public static getInstance(): AICoachService {
    if (!AICoachService.instance) {
      AICoachService.instance = new AICoachService();
    }
    return AICoachService.instance;
  }

  /**
   * Generate personalized daily check-in message with enhanced context
   */
  async generateDailyCheckIn(healthContext?: HealthContext): Promise<string> {
    try {
      console.log('🏃‍♂️ Generating enhanced daily check-in message');

      // Get enhanced context if not provided
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const enhancedContext = await healthContextService.generateCoachingContext(user.id);
      const finalHealthContext = healthContext || enhancedContext.healthMetrics;

      // Build enhanced coaching prompt with all contexts
      const enhancedPrompt = this.buildEnhancedPrompt('check_in', {
        healthContext: finalHealthContext,
        socialContext: enhancedContext.socialContext,
        eventContext: enhancedContext.eventContext,
        conversationContext: enhancedContext.conversationContext,
        behavioralInsights: enhancedContext.behavioralInsights,
      });

      const request: HealthCoachingRequest = {
        healthContext: finalHealthContext,
        messageType: 'check_in',
        maxTokens: 150,
        temperature: 0.8,
        additionalContext: enhancedPrompt,
      };

      const message = await healthAIService.generateHealthCoachingMessage(request);
      
      // Store interaction with enhanced context
      await this.storeEnhancedCoachingInteraction('check_in', message, enhancedContext);
      
      return message;
    } catch (error) {
      console.error('❌ Failed to generate daily check-in:', error);
      return healthContext ? this.getFallbackMessage('check_in', healthContext) : 
        "Good morning! How are you feeling about your fitness journey today? 🌟";
    }
  }

  /**
   * Generate motivational message based on current progress with enhanced context
   */
  async generateMotivationalMessage(healthContext?: HealthContext): Promise<string> {
    try {
      console.log('💪 Generating enhanced motivational message');

      // Get enhanced context if not provided
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const enhancedContext = await healthContextService.generateCoachingContext(user.id);
      const finalHealthContext = healthContext || enhancedContext.healthMetrics;

      // Build enhanced coaching prompt with motivation-specific context
      const enhancedPrompt = this.buildEnhancedPrompt('motivation', {
        healthContext: finalHealthContext,
        socialContext: enhancedContext.socialContext,
        eventContext: enhancedContext.eventContext,
        conversationContext: enhancedContext.conversationContext,
        behavioralInsights: enhancedContext.behavioralInsights,
      });

      const request: HealthCoachingRequest = {
        healthContext: finalHealthContext,
        messageType: 'motivation',
        maxTokens: 120,
        temperature: 0.9,
        additionalContext: enhancedPrompt,
      };

      const message = await healthAIService.generateHealthCoachingMessage(request);
      
      // Store interaction with enhanced context
      await this.storeEnhancedCoachingInteraction('motivation', message, enhancedContext);
      
      return message;
    } catch (error) {
      console.error('❌ Failed to generate motivational message:', error);
      return healthContext ? this.getFallbackMessage('motivation', healthContext) : 
        "You're doing amazing! Every step forward is progress worth celebrating. Keep going! 💪";
    }
  }

  /**
   * Generate advice based on health patterns and concerns
   */
  async generateAdviceMessage(
    healthContext: HealthContext, 
    concern?: string
  ): Promise<string> {
    try {
      console.log('🎯 Generating advice message');

      const request: HealthCoachingRequest = {
        healthContext,
        messageType: 'advice',
        userMessage: concern,
        maxTokens: 180,
        temperature: 0.7,
      };

      return await healthAIService.generateHealthCoachingMessage(request);
    } catch (error) {
      console.error('❌ Failed to generate advice message:', error);
      return this.getFallbackMessage('advice', healthContext);
    }
  }

  /**
   * Generate celebration message for achievements
   */
  async generateCelebrationMessage(
    achievement: Achievement,
    healthContext: HealthContext
  ): Promise<string> {
    try {
      console.log('🎉 Generating celebration message');

      return await healthAIService.generateCelebrationMessage(
        {
          type: achievement.type,
          title: achievement.title,
          streak: healthContext.currentStreak,
        },
        healthContext
      );
    } catch (error) {
      console.error('❌ Failed to generate celebration message:', error);
      return `Congratulations on earning "${achievement.title}"! Your dedication to fitness is paying off. Keep up the amazing work! 🎉`;
    }
  }

  /**
   * Generate workout suggestion with reasoning
   */
  async generateWorkoutSuggestion(healthContext: HealthContext): Promise<WorkoutSuggestion> {
    try {
      console.log('💪 Generating workout suggestion');

      return await healthAIService.generateWorkoutSuggestion(healthContext);
    } catch (error) {
      console.error('❌ Failed to generate workout suggestion:', error);
      return this.getFallbackWorkoutSuggestion(healthContext);
    }
  }

  /**
   * Handle user message and generate contextual response
   */
  async handleUserMessage(
    userMessage: string,
    healthContext: HealthContext
  ): Promise<string> {
    try {
      console.log('💬 Handling user message with health context');

      // Determine message type based on content
      const messageType = this.classifyUserMessage(userMessage);

      const request: HealthCoachingRequest = {
        healthContext,
        messageType,
        userMessage,
        maxTokens: 200,
        temperature: 0.8,
      };

      return await healthAIService.generateHealthCoachingMessage(request);
    } catch (error) {
      console.error('❌ Failed to handle user message:', error);
      return "I understand you're reaching out! I'm here to help with your fitness journey. Can you tell me more about what you'd like to know or how you're feeling today?";
    }
  }

  /**
   * Generate smart suggestions based on current context
   */
  async generateSmartSuggestions(healthContext: HealthContext): Promise<{
    primary: string;
    secondary: string[];
    workout?: WorkoutSuggestion;
  }> {
    try {
      console.log('🧠 Generating smart suggestions');

      // Generate primary suggestion
      const primaryRequest: HealthCoachingRequest = {
        healthContext,
        messageType: 'suggestion',
        maxTokens: 100,
        temperature: 0.7,
      };

      const primarySuggestion = await healthAIService.generateHealthCoachingMessage(primaryRequest);

      // Generate secondary suggestions based on context
      const secondarySuggestions = this.generateSecondarySuggestions(healthContext);

      // Generate workout suggestion if appropriate
      let workoutSuggestion: WorkoutSuggestion | undefined;
      if (this.shouldSuggestWorkout(healthContext)) {
        workoutSuggestion = await this.generateWorkoutSuggestion(healthContext);
      }

      return {
        primary: primarySuggestion,
        secondary: secondarySuggestions,
        workout: workoutSuggestion,
      };
    } catch (error) {
      console.error('❌ Failed to generate smart suggestions:', error);
      return {
        primary: "Keep up the great work on your fitness journey!",
        secondary: ["Stay hydrated", "Get quality sleep", "Listen to your body"],
      };
    }
  }

  /**
   * Analyze health trends and provide insights
   */
  async analyzeHealthTrends(healthContext: HealthContext): Promise<{
    insights: string[];
    recommendations: string[];
    concernLevel: 'low' | 'medium' | 'high';
  }> {
    try {
      const insights: string[] = [];
      const recommendations: string[] = [];
      let concernLevel: 'low' | 'medium' | 'high' = 'low';

      // Analyze step trends
      if (healthContext.stepTrends === 'declining') {
        insights.push('Your daily step count has been trending downward recently');
        recommendations.push('Try setting reminders to take short walks throughout the day');
        concernLevel = 'medium';
      } else if (healthContext.stepTrends === 'improving') {
        insights.push('Great progress! Your daily activity has been increasing');
      }

      // Analyze sleep quality
      if (healthContext.sleepQuality < 6) {
        insights.push('Your sleep quality has been below optimal levels');
        recommendations.push('Consider establishing a consistent bedtime routine');
        concernLevel = Math.max(concernLevel === 'low' ? 1 : concernLevel === 'medium' ? 2 : 3, 2) === 2 ? 'medium' : 'high';
      }

      // Analyze recovery
      if (healthContext.recoveryScore < 5) {
        insights.push('Your recovery metrics suggest you may need more rest');
        recommendations.push('Consider taking a rest day or doing light stretching');
        concernLevel = 'high';
      }

      // Analyze streaks
      if (healthContext.currentStreak >= 7) {
        insights.push(`Impressive ${healthContext.currentStreak}-day step goal streak!`);
      }

      return { insights, recommendations, concernLevel };
    } catch (error) {
      console.error('❌ Failed to analyze health trends:', error);
      return {
        insights: ['Unable to analyze trends at this time'],
        recommendations: ['Continue monitoring your progress'],
        concernLevel: 'low',
      };
    }
  }

  /**
   * Store coaching interaction in database
   */
  async storeCoachingInteraction(
    messageType: CoachingMessage['type'],
    message: string,
    healthContext: Partial<HealthContext>,
    userMessage?: string
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('ai_coaching_messages').insert({
        user_id: user.id,
        message_type: messageType,
        message_text: message,
        health_context: healthContext,
        is_actionable: messageType === 'suggestion' || messageType === 'advice',
        suggested_action: messageType === 'suggestion' ? message : null,
      });
    } catch (error) {
      console.error('❌ Failed to store coaching interaction:', error);
    }
  }

  // Private helper methods

  /**
   * Classify user message to determine response type
   */
  private classifyUserMessage(message: string): CoachingMessage['type'] {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('motivat') || lowerMessage.includes('inspire')) {
      return 'motivation';
    }
    if (lowerMessage.includes('advice') || lowerMessage.includes('help') || lowerMessage.includes('should')) {
      return 'advice';
    }
    if (lowerMessage.includes('workout') || lowerMessage.includes('exercise') || lowerMessage.includes('suggest')) {
      return 'suggestion';
    }
    if (lowerMessage.includes('celebrate') || lowerMessage.includes('achieved') || lowerMessage.includes('proud')) {
      return 'celebration';
    }

    return 'check_in';
  }

  /**
   * Generate secondary suggestions based on context
   */
  private generateSecondarySuggestions(healthContext: HealthContext): string[] {
    const suggestions: string[] = [];

    // Sleep-based suggestions
    if (healthContext.sleepQuality < 7) {
      suggestions.push('Aim for 7-8 hours of quality sleep tonight');
    }

    // Activity-based suggestions
    if (healthContext.stepGoalProgress < 80) {
      suggestions.push('Take a 10-minute walk to boost your steps');
    }

    // Recovery-based suggestions
    if (healthContext.daysSinceRest === 0) {
      suggestions.push('Consider some light stretching or yoga');
    }

    // Hydration and nutrition
    suggestions.push('Stay hydrated throughout the day');
    
    // Streak motivation
    if (healthContext.currentStreak > 0) {
      suggestions.push(`Keep your ${healthContext.currentStreak}-day streak going!`);
    }

    return suggestions.slice(0, 3); // Return max 3 suggestions
  }

  /**
   * Determine if a workout should be suggested
   */
  private shouldSuggestWorkout(healthContext: HealthContext): boolean {
    // Don't suggest workout if recovery score is very low
    if (healthContext.recoveryScore < 4) return false;
    
    // Don't suggest if they just worked out today and it was high intensity
    if (healthContext.daysSinceRest === 0 && healthContext.lastWorkoutIntensity === 'high') return false;
    
    // Suggest if they haven't worked out in a while
    if (healthContext.daysSinceRest >= 2) return true;
    
    // Suggest if they have high energy and good recovery
    if (healthContext.energyLevel === 'high' && healthContext.recoveryScore >= 7) return true;

    return false;
  }

  /**
   * Get fallback messages when AI generation fails
   */
  private getFallbackMessage(type: CoachingMessage['type'], healthContext: HealthContext): string {
    const fallbacks = {
      motivation: `You're on day ${healthContext.currentStreak} of your step streak - that's fantastic! Every step counts toward your fitness goals. Keep moving forward! 💪`,
      advice: `Based on your current activity level, focus on consistency. Small, regular efforts add up to big results over time. Listen to your body and stay committed to your goals.`,
      celebration: `Congratulations on your achievement! Your dedication to fitness is inspiring. Celebrate this milestone and keep up the excellent work! 🎉`,
      suggestion: `Consider taking a short walk today to boost your activity. Even 10-15 minutes can make a difference in how you feel and your overall progress.`,
      check_in: `How are you feeling about your fitness journey today? Remember, every day is a new opportunity to take care of your health and well-being.`,
    };

    return fallbacks[type];
  }

  /**
   * Get fallback workout suggestion when AI generation fails
   */
  private getFallbackWorkoutSuggestion(healthContext: HealthContext): WorkoutSuggestion {
    if (healthContext.energyLevel === 'low' || healthContext.recoveryScore < 6) {
      return {
        type: 'flexibility',
        intensity: 'low',
        duration: 15,
        reasoning: 'Light stretching to promote recovery and maintain movement',
        exercises: ['Gentle stretching', 'Deep breathing', 'Light walking'],
        timing: 'now',
        recoveryFocus: true,
      };
    }

    if (healthContext.stepGoalProgress < 50) {
      return {
        type: 'cardio',
        intensity: 'moderate',
        duration: 20,
        reasoning: 'Moderate cardio to boost daily activity and work toward step goal',
        exercises: ['Brisk walking', 'Stair climbing', 'Dancing'],
        timing: 'now',
      };
    }

    return {
      type: 'mixed',
      intensity: 'moderate',
      duration: 30,
      reasoning: 'Balanced workout combining cardio and strength for overall fitness',
      exercises: ['Walking', 'Bodyweight squats', 'Push-ups', 'Stretching'],
      timing: 'now',
    };
  }

  /**
   * Build enhanced coaching prompt with Phase 1 context - NEW FEATURE
   */
  private buildEnhancedPrompt(messageType: string, context: {
    healthContext: any;
    socialContext: any;
    eventContext: any;
    conversationContext: any;
    behavioralInsights: any;
  }): string {
    const { socialContext, eventContext, conversationContext, behavioralInsights } = context;
    
    let enhancedPrompt = '';

    // Add social context insights
    if (socialContext.posting_frequency !== 'inactive') {
      enhancedPrompt += `\nSOCIAL CONTEXT: User has ${socialContext.posting_frequency} social posting activity with ${socialContext.posts_with_workout_content} workout-related posts recently. `;
      
      if (socialContext.workout_sharing_consistency) {
        enhancedPrompt += `They consistently share fitness content. `;
      }
      
      if (socialContext.friend_interaction_level === 'high') {
        enhancedPrompt += `Strong friend engagement on posts suggests social motivation. `;
      } else if (socialContext.friend_interaction_level === 'low') {
        enhancedPrompt += `Low friend interaction - may benefit from community encouragement. `;
      }
    } else {
      enhancedPrompt += `\nSOCIAL CONTEXT: User is not currently active on social feeds - may benefit from social activation encouragement. `;
    }

    // Add event context insights
    if (eventContext.upcoming_events.length > 0) {
      const nextEvent = eventContext.upcoming_events[0];
      enhancedPrompt += `\nEVENT CONTEXT: User has upcoming ${nextEvent.event_type} event "${nextEvent.title}" in ${nextEvent.days_until} days. `;
      
      if (eventContext.attendance_reliability > 80) {
        enhancedPrompt += `High attendance reliability (${eventContext.attendance_reliability}%) shows commitment. `;
      } else if (eventContext.attendance_reliability < 50) {
        enhancedPrompt += `Low attendance reliability (${eventContext.attendance_reliability}%) - focus on accountability. `;
      }
    } else {
      enhancedPrompt += `\nEVENT CONTEXT: No upcoming events - consider encouraging social fitness activities. `;
    }

    // Add conversation context insights
    if (conversationContext.recent_messages_count > 0) {
      enhancedPrompt += `\nCONVERSATION CONTEXT: User has ${conversationContext.user_response_rate}% response rate to coaching. `;
      enhancedPrompt += `Most effective message type: ${conversationContext.most_effective_message_type}. `;
      enhancedPrompt += `Engagement trend: ${conversationContext.user_engagement_trend}. `;
      enhancedPrompt += `Prefers responses in the ${conversationContext.preferred_response_time}. `;
    }

    // Add behavioral insights
    if (behavioralInsights.motivationalTriggers.length > 0) {
      enhancedPrompt += `\nMOTIVATIONAL TRIGGERS: Focus on ${behavioralInsights.motivationalTriggers.join(', ')}. `;
    }

    // Add coaching readiness and strategy
    enhancedPrompt += `\nCOACHING STRATEGY: User readiness is ${behavioralInsights.coachingReadiness}. `;
    enhancedPrompt += `Use ${behavioralInsights.personalizedApproach.tone} tone with ${behavioralInsights.personalizedApproach.motivationStyle} motivation style. `;

    return enhancedPrompt;
  }

  /**
   * Store enhanced coaching interaction - NEW FEATURE
   */
  private async storeEnhancedCoachingInteraction(
    messageType: CoachingMessage['type'],
    message: string,
    enhancedContext: any
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Store in the main coaching messages table with enhanced context
      await supabase.from('ai_coaching_messages').insert({
        user_id: user.id,
        message_type: messageType,
        message_text: message,
        health_context: {
          ...enhancedContext.healthMetrics,
          social_context: enhancedContext.socialContext,
          event_context: enhancedContext.eventContext,
          conversation_context: enhancedContext.conversationContext,
          behavioral_insights: enhancedContext.behavioralInsights,
        },
        is_actionable: messageType === 'suggestion' || messageType === 'advice',
        suggested_action: messageType === 'suggestion' ? message : null,
      });

      console.log(`✅ Stored enhanced coaching interaction: ${messageType}`);
    } catch (error) {
      console.error('❌ Failed to store enhanced coaching interaction:', error);
    }
  }
}

// Export singleton instance
export const aiCoachService = AICoachService.getInstance();