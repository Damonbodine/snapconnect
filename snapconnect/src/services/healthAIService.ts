/**
 * Health AI Service
 * Dedicated AI service for health coaching and fitness-related content generation
 * Separate from the main OpenAI service to avoid conflicts
 */

import OpenAI from 'openai';
import { HealthContext, WorkoutSuggestion, CoachingMessage } from '../types/health';

// Separate OpenAI client for health coaching
let healthOpenAI: OpenAI;

function getHealthOpenAIClient(): OpenAI {
  if (!healthOpenAI) {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key not configured for health coaching');
    }
    healthOpenAI = new OpenAI({ apiKey });
  }
  return healthOpenAI;
}

export interface HealthCoachingRequest {
  healthContext: HealthContext;
  messageType: 'motivation' | 'advice' | 'celebration' | 'suggestion' | 'check_in';
  userMessage?: string;
  maxTokens?: number;
  temperature?: number;
  additionalContext?: string; // Phase 1 Enhancement: Support for social, event, and conversation context
}

export class HealthAIService {
  private static instance: HealthAIService;

  public static getInstance(): HealthAIService {
    if (!HealthAIService.instance) {
      HealthAIService.instance = new HealthAIService();
    }
    return HealthAIService.instance;
  }

  /**
   * Generate health coaching message based on health context
   */
  async generateHealthCoachingMessage(request: HealthCoachingRequest): Promise<string> {
    try {
      console.log(`🏃‍♂️ Generating ${request.messageType} health coaching message`);

      const systemPrompt = this.buildHealthCoachingSystemPrompt();
      const userPrompt = this.buildHealthCoachingPrompt(request);
      
      const completion = await getHealthOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: request.maxTokens || 200,
        temperature: request.temperature || 0.8,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No health coaching message generated');
      }

      return content.trim();
    } catch (error) {
      console.error('❌ Health coaching message generation failed:', error);
      throw new Error(`Health coaching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate workout suggestion based on health metrics and recovery data
   */
  async generateWorkoutSuggestion(healthContext: HealthContext): Promise<WorkoutSuggestion> {
    try {
      console.log('💪 Generating workout suggestion based on health data');

      const prompt = this.buildWorkoutSuggestionPrompt(healthContext);
      
      const completion = await getHealthOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.buildWorkoutSuggestionSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No workout suggestion generated');
      }

      return this.parseWorkoutSuggestion(content, healthContext);
    } catch (error) {
      console.error('❌ Workout suggestion generation failed:', error);
      throw new Error(`Workout suggestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate celebration message for achievements
   */
  async generateCelebrationMessage(achievement: {
    type: string;
    title: string;
    value?: number;
    streak?: number;
  }, healthContext: HealthContext): Promise<string> {
    try {
      const prompt = `Celebrate this fitness achievement with enthusiasm and encouragement:
      
Achievement: ${achievement.title}
Type: ${achievement.type}
${achievement.value ? `Value: ${achievement.value}` : ''}
${achievement.streak ? `Streak: ${achievement.streak} days` : ''}

User's current fitness context:
- Current step streak: ${healthContext.currentStreak} days
- Today's steps: ${healthContext.todaysSteps}
- Fitness level: ${healthContext.fitnessLevel}
- Energy level: ${healthContext.energyLevel}

Create a celebratory message that:
1. Acknowledges the specific achievement
2. Relates it to their fitness journey
3. Encourages continued progress
4. Is enthusiastic but not overwhelming
5. Keeps it under 100 words

Use emojis sparingly and make it feel personal and genuine.`;

      const completion = await getHealthOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an enthusiastic but supportive fitness coach celebrating user achievements. Keep celebrations positive, personal, and motivating.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.9,
      });

      return completion.choices[0]?.message?.content?.trim() || 'Great job on your achievement!';
    } catch (error) {
      console.error('❌ Celebration message generation failed:', error);
      return 'Congratulations on your achievement! Keep up the great work! 🎉';
    }
  }

  /**
   * Build health coaching system prompt
   */
  private buildHealthCoachingSystemPrompt(): string {
    return `You are Alex, a knowledgeable and supportive fitness coach with expertise in health data analysis and personalized guidance. Your personality is:

- Encouraging and positive, but realistic
- Data-driven in your recommendations
- Adaptable to different fitness levels and goals
- Focused on sustainable, long-term progress
- Knowledgeable about exercise science and recovery

Your responses should:
1. Be conversational and supportive
2. Reference specific health data when relevant
3. Provide actionable advice
4. Consider the user's fitness level and goals
5. Prioritize safety and proper recovery
6. Keep messages concise (under 150 words unless specifically asked for more)
7. Use occasional emojis but don't overdo it

You have access to the user's:
- Daily step counts and streaks
- Sleep quality and duration
- Heart rate data and trends
- Recent workout history
- Energy levels and recovery metrics
- Fitness goals and preferences

Always consider the user's current state and provide advice that's appropriate for their situation.`;
  }

  /**
   * Build health coaching prompt with enhanced context - Phase 1 Enhancement
   */
  private buildHealthCoachingPrompt(request: HealthCoachingRequest): string {
    const { healthContext, messageType, userMessage, additionalContext } = request;
    
    const baseContext = `Current Health Data:
- Today's steps: ${healthContext.todaysSteps} (${healthContext.stepGoalProgress}% of goal)
- Current streak: ${healthContext.currentStreak} days (best: ${healthContext.bestStreak})
- Sleep: ${healthContext.averageSleepHours} hours (quality: ${healthContext.sleepQuality}/10)
- Energy level: ${healthContext.energyLevel}
- Activity level: ${healthContext.activityLevel}
- Recovery score: ${healthContext.recoveryScore}/10
- Days since rest: ${healthContext.daysSinceRest}
- Recent workouts: ${healthContext.recentWorkouts.map(w => w.type).join(', ') || 'None'}

User Profile:
- Fitness level: ${healthContext.fitnessLevel}
- Primary goal: ${healthContext.userGoals.primary}
- Preferred workouts: ${healthContext.preferredWorkoutTypes.join(', ')}
- Available time: ${healthContext.availableTime} minutes`;

    // Add enhanced context from Phase 1 implementation
    const enhancedContextSection = additionalContext ? `

ENHANCED BEHAVIORAL CONTEXT:${additionalContext}

Use this context to personalize your message - reference social activities, upcoming events, conversation history, and motivational triggers as appropriate.` : '';

    const messageTypes = {
      motivation: `Generate a motivational message that encourages the user based on their current progress and helps them stay committed to their fitness goals. Use social and event context to make it more personal and relevant.`,
      
      advice: `Provide helpful fitness advice based on their health data and behavioral context. Focus on actionable recommendations that consider their social habits, event participation, and past conversation patterns.`,
      
      celebration: `Celebrate their recent progress! Acknowledge their achievements and encourage them to keep up the momentum. Reference their social sharing or event participation if relevant.`,
      
      suggestion: `Suggest a specific action they could take today based on their health data, social activity, and upcoming events. Consider their response patterns and preferred communication style.`,
      
      check_in: `Check in on how they're feeling and progressing. Ask a thoughtful question about their fitness journey that considers their social engagement and event participation. Use their preferred response timing and communication style.`,
    };

    let prompt = `${baseContext}${enhancedContextSection}

Task: ${messageTypes[messageType]}`;

    if (userMessage) {
      prompt += `

The user said: "${userMessage}"

Please respond to their message while incorporating the health coaching guidance and enhanced behavioral context above.`;
    }

    return prompt;
  }

  /**
   * Build workout suggestion system prompt
   */
  private buildWorkoutSuggestionSystemPrompt(): string {
    return `You are a fitness expert specializing in personalized workout recommendations based on health data and recovery metrics.

Analyze the user's current state and recommend an appropriate workout that considers:
1. Recovery indicators (sleep, heart rate, previous workouts)
2. Current energy and activity levels
3. Fitness goals and preferences
4. Available time
5. Injury prevention and progressive overload

Respond in this exact format:
TYPE: [cardio/strength/flexibility/rest/mixed]
INTENSITY: [low/moderate/high]
DURATION: [number in minutes]
REASONING: [brief explanation of why this workout is appropriate]
EXERCISES: [list 3-5 specific exercises or activities]
TIMING: [now/morning/evening/later]

Always prioritize safety and appropriate recovery. If the user shows signs of overtraining or fatigue, recommend rest or low-intensity activity.`;
  }

  /**
   * Build workout suggestion prompt
   */
  private buildWorkoutSuggestionPrompt(healthContext: HealthContext): string {
    return `Analyze this user's health data and recommend an appropriate workout:

Recovery Indicators:
- Sleep: ${healthContext.averageSleepHours} hours, quality ${healthContext.sleepQuality}/10
- Resting heart rate: ${healthContext.restingHeartRate || 'Unknown'} bpm
- Recovery score: ${healthContext.recoveryScore}/10
- Days since last rest: ${healthContext.daysSinceRest}
- Last workout intensity: ${healthContext.lastWorkoutIntensity}

Current State:
- Energy level: ${healthContext.energyLevel}
- Activity level: ${healthContext.activityLevel}
- Today's steps: ${healthContext.todaysSteps}
- Step goal progress: ${healthContext.stepGoalProgress}%

User Profile:
- Fitness level: ${healthContext.fitnessLevel}
- Primary goal: ${healthContext.userGoals.primary}
- Preferred workouts: ${healthContext.preferredWorkoutTypes.join(', ')}
- Available time: ${healthContext.availableTime} minutes

Recent Activity:
- Recent workouts: ${healthContext.recentWorkouts.slice(0, 3).map(w => 
    `${w.type} (${w.duration}min, ${w.intensity || 'unknown'} intensity)`
  ).join(', ') || 'None this week'}

Trends:
- Step trend: ${healthContext.stepTrends}
- Workout frequency: ${healthContext.workoutFrequencyTrend}

Current time context: It's currently ${new Date().getHours()}:00

Recommend a workout that's appropriate for their current state and goals.`;
  }

  /**
   * Parse workout suggestion response
   */
  private parseWorkoutSuggestion(response: string, healthContext: HealthContext): WorkoutSuggestion {
    const lines = response.split('\n');
    const suggestion: Partial<WorkoutSuggestion> = {};

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('TYPE:')) {
        const type = trimmedLine.replace('TYPE:', '').trim().toLowerCase();
        suggestion.type = ['cardio', 'strength', 'flexibility', 'rest', 'mixed'].includes(type) 
          ? type as WorkoutSuggestion['type'] 
          : 'cardio';
      } else if (trimmedLine.startsWith('INTENSITY:')) {
        const intensity = trimmedLine.replace('INTENSITY:', '').trim().toLowerCase();
        suggestion.intensity = ['low', 'moderate', 'high'].includes(intensity)
          ? intensity as WorkoutSuggestion['intensity']
          : 'moderate';
      } else if (trimmedLine.startsWith('DURATION:')) {
        const duration = trimmedLine.replace('DURATION:', '').trim();
        suggestion.duration = parseInt(duration) || healthContext.availableTime;
      } else if (trimmedLine.startsWith('REASONING:')) {
        suggestion.reasoning = trimmedLine.replace('REASONING:', '').trim();
      } else if (trimmedLine.startsWith('EXERCISES:')) {
        const exercises = trimmedLine.replace('EXERCISES:', '').trim();
        suggestion.exercises = exercises.split(',').map(e => e.trim());
      } else if (trimmedLine.startsWith('TIMING:')) {
        const timing = trimmedLine.replace('TIMING:', '').trim().toLowerCase();
        suggestion.timing = ['now', 'morning', 'evening', 'later'].includes(timing)
          ? timing as WorkoutSuggestion['timing']
          : 'now';
      }
    }

    // Provide defaults for any missing fields
    return {
      type: suggestion.type || 'cardio',
      intensity: suggestion.intensity || 'moderate',
      duration: suggestion.duration || healthContext.availableTime,
      reasoning: suggestion.reasoning || 'Recommended based on your current health data',
      exercises: suggestion.exercises || ['Walking', 'Stretching', 'Light movement'],
      timing: suggestion.timing || 'now',
      recoveryFocus: healthContext.recoveryScore < 6,
    };
  }
}

// Export singleton instance
export const healthAIService = HealthAIService.getInstance();