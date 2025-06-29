/**
 * AI Proactive Messaging Service
 * Handles AIs initiating conversations with humans based on triggers
 */

import { supabase } from './supabase';
import { aiChatService, AIPersonaProfile } from './aiChatService';
import { AI_ARCHETYPES } from '../types/aiPersonality';

export interface ProactiveMessageTrigger {
  trigger_type: 'onboarding_welcome' | 'workout_streak' | 'milestone_celebration' | 'motivation_boost' | 'check_in' | 'random_social';
  priority: 'high' | 'medium' | 'low';
  max_frequency_days: number; // Minimum days between messages of this type
  requires_context?: boolean;
}

export interface ProactiveMessageContext {
  user_id: string;
  trigger: ProactiveMessageTrigger;
  user_fitness_level?: string;
  recent_activity?: any;
  milestone_data?: any;
  streak_data?: any;
}

class AIProactiveMessagingService {
  private static instance: AIProactiveMessagingService;
  
  // Proactive message triggers configuration
  private readonly MESSAGE_TRIGGERS: Record<string, ProactiveMessageTrigger> = {
    onboarding_welcome: {
      trigger_type: 'onboarding_welcome',
      priority: 'high',
      max_frequency_days: 30, // Once per month max
      requires_context: false,
    },
    workout_streak: {
      trigger_type: 'workout_streak',
      priority: 'medium',
      max_frequency_days: 7, // Once per week max
      requires_context: true,
    },
    milestone_celebration: {
      trigger_type: 'milestone_celebration',
      priority: 'high',
      max_frequency_days: 3, // Can celebrate multiple milestones
      requires_context: true,
    },
    motivation_boost: {
      trigger_type: 'motivation_boost',
      priority: 'medium',
      max_frequency_days: 5, // Twice per week max
      requires_context: false,
    },
    check_in: {
      trigger_type: 'check_in',
      priority: 'low',
      max_frequency_days: 14, // Bi-weekly check-ins
      requires_context: false,
    },
    random_social: {
      trigger_type: 'random_social',
      priority: 'low',
      max_frequency_days: 10, // Random social outreach
      requires_context: false,
    },
  };

  public static getInstance(): AIProactiveMessagingService {
    if (!AIProactiveMessagingService.instance) {
      AIProactiveMessagingService.instance = new AIProactiveMessagingService();
    }
    return AIProactiveMessagingService.instance;
  }

  /**
   * Check if a user should receive proactive messages from AIs
   */
  async checkProactiveMessageTriggers(userId: string): Promise<void> {
    try {
      console.log(`🔍 Checking proactive message triggers for user: ${userId}`);

      // Check each trigger type
      for (const [triggerKey, trigger] of Object.entries(this.MESSAGE_TRIGGERS)) {
        const shouldSend = await this.shouldSendProactiveMessage(userId, trigger);
        
        if (shouldSend) {
          console.log(`✨ Trigger activated: ${trigger.trigger_type} for user ${userId}`);
          await this.sendProactiveMessage(userId, trigger);
        }
      }
    } catch (error) {
      console.error('❌ Failed to check proactive triggers:', error);
    }
  }

  /**
   * Determine if a proactive message should be sent
   */
  private async shouldSendProactiveMessage(
    userId: string, 
    trigger: ProactiveMessageTrigger
  ): Promise<boolean> {
    try {
      // Check if user has received this type of message recently
      const recentMessage = await this.getLastProactiveMessage(userId, trigger.trigger_type);
      
      if (recentMessage) {
        const daysSinceLastMessage = this.daysBetween(new Date(recentMessage.sent_at), new Date());
        if (daysSinceLastMessage < trigger.max_frequency_days) {
          return false; // Too soon for another message of this type
        }
      }

      // Check specific trigger conditions
      switch (trigger.trigger_type) {
        case 'onboarding_welcome':
          return await this.checkOnboardingWelcomeTrigger(userId);
        
        case 'workout_streak':
          return await this.checkWorkoutStreakTrigger(userId);
        
        case 'milestone_celebration':
          return await this.checkMilestoneTrigger(userId);
        
        case 'motivation_boost':
          return await this.checkMotivationBoostTrigger(userId);
        
        case 'check_in':
          return await this.checkCheckInTrigger(userId);
        
        case 'random_social':
          return await this.checkRandomSocialTrigger(userId);
        
        default:
          return false;
      }
    } catch (error) {
      console.error(`❌ Failed to check trigger ${trigger.trigger_type}:`, error);
      return false;
    }
  }

  /**
   * Send a proactive message from a compatible AI to the user
   */
  private async sendProactiveMessage(
    userId: string, 
    trigger: ProactiveMessageTrigger
  ): Promise<void> {
    try {
      console.log(`📤 Sending proactive message (${trigger.trigger_type}) to user: ${userId}`);

      // Get user's complete profile for AI matching
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      const userContext = {
        profile: {
          fitness_level: userProfile?.fitness_level || 'intermediate',
          goals: userProfile?.goals || ['general_fitness'],
          full_name: userProfile?.full_name || 'User'
        }
      };
      
      // Find compatible AI for this trigger
      const selectedAI = await this.selectCompatibleAI(userId, trigger, userContext);
      
      if (!selectedAI) {
        console.log('❌ No compatible AI found for proactive message');
        return;
      }

      // Generate proactive message context
      const messageContext = await this.buildProactiveMessageContext(userId, trigger, userContext);
      
      // Generate the proactive message
      const response = await aiChatService.generateAIResponse({
        ai_user_id: selectedAI.id,
        human_user_id: userId,
        human_message: messageContext,
      });

      // Log the proactive message for tracking
      await this.logProactiveMessage(userId, selectedAI.id, trigger.trigger_type, response.message_id);

      console.log(`✅ Proactive message sent from ${selectedAI.username} to user ${userId}`);
      console.log(`   Message: "${response.content.substring(0, 100)}..."`);

    } catch (error) {
      console.error('❌ Failed to send proactive message:', error);
    }
  }

  /**
   * Select the most compatible AI for sending a proactive message
   */
  private async selectCompatibleAI(
    userId: string, 
    trigger: ProactiveMessageTrigger,
    userContext: any
  ): Promise<AIPersonaProfile | null> {
    try {
      const availableAIs = await aiChatService.getAvailableAIUsers();
      
      if (availableAIs.length === 0) {
        return null;
      }

      // Filter AIs that haven't messaged this user recently
      const eligibleAIs = [];
      
      for (const ai of availableAIs) {
        const lastMessage = await this.getLastMessageFromAI(userId, ai.id);
        
        // Don't message if this AI messaged the user in the last 3 days
        if (lastMessage) {
          const daysSinceLastMessage = this.daysBetween(new Date(lastMessage.sent_at), new Date());
          if (daysSinceLastMessage < 3) {
            continue; // This AI messaged too recently
          }
        }
        
        eligibleAIs.push(ai);
      }

      if (eligibleAIs.length === 0) {
        return null;
      }

      // Select AI based on compatibility and trigger type
      const fitnessLevel = userContext.profile?.fitness_level || 'beginner';
      
      // Match AI archetype to trigger and user level
      let preferredArchetypes: string[] = [];
      
      switch (trigger.trigger_type) {
        case 'onboarding_welcome':
          preferredArchetypes = ['fitness_newbie', 'zen_master']; // Friendly, welcoming
          break;
        case 'workout_streak':
          preferredArchetypes = ['strength_warrior', 'cardio_queen']; // Motivational
          break;
        case 'milestone_celebration':
          preferredArchetypes = ['cardio_queen', 'outdoor_adventurer']; // Celebratory
          break;
        case 'motivation_boost':
          preferredArchetypes = fitnessLevel === 'beginner' ? ['fitness_newbie', 'zen_master'] : ['strength_warrior', 'cardio_queen'];
          break;
        case 'check_in':
          preferredArchetypes = ['zen_master', 'fitness_newbie']; // Caring, supportive
          break;
        case 'random_social':
          preferredArchetypes = ['cardio_queen', 'outdoor_adventurer']; // Social, outgoing
          break;
      }

      // Find AI with preferred archetype
      for (const archetype of preferredArchetypes) {
        const matchingAI = eligibleAIs.find(ai => ai.archetype_id === archetype);
        if (matchingAI) {
          return matchingAI;
        }
      }

      // If no preferred archetype found, return a random eligible AI
      return eligibleAIs[Math.floor(Math.random() * eligibleAIs.length)];

    } catch (error) {
      console.error('❌ Failed to select compatible AI:', error);
      return null;
    }
  }

  /**
   * Build context for generating proactive messages
   */
  private buildProactiveMessageContext(
    userId: string, 
    trigger: ProactiveMessageTrigger,
    userContext: any
  ): string {
    const archetype = AI_ARCHETYPES.find(a => a.id === trigger.trigger_type);
    
    switch (trigger.trigger_type) {
      case 'onboarding_welcome':
        return `Generate a friendly welcome message for a new user. Be encouraging about their fitness journey and offer to help with any questions. Keep it warm but not overwhelming.`;
      
      case 'workout_streak':
        return `Generate a motivational message congratulating the user on their workout consistency. Be enthusiastic and encourage them to keep going. Reference their dedication to fitness.`;
      
      case 'milestone_celebration':
        return `Generate a celebratory message for a user who has achieved a fitness milestone. Be genuinely excited for their progress and acknowledge their hard work.`;
      
      case 'motivation_boost':
        return `Generate an encouraging message to boost someone's motivation. Be supportive and remind them why fitness is worth it. Keep it uplifting and energizing.`;
      
      case 'check_in':
        return `Generate a friendly check-in message asking how the user's fitness journey is going. Be genuinely interested and offer support if needed. Keep it casual and caring.`;
      
      case 'random_social':
        return `Generate a casual, friendly message to connect with the user. Maybe share a fitness tip, ask about their workout preference, or just say hi. Keep it light and social.`;
      
      default:
        return `Generate a friendly, encouraging message to connect with the user about their fitness journey.`;
    }
  }

  // Trigger condition checkers

  private async checkOnboardingWelcomeTrigger(userId: string): Promise<boolean> {
    try {
      // Check if user is new (created within last 7 days) and hasn't received welcome
      const { data: user, error } = await supabase
        .from('users')
        .select('created_at')
        .eq('id', userId)
        .single();

      if (error || !user) return false;

      const daysSinceRegistration = this.daysBetween(new Date(user.created_at), new Date());
      return daysSinceRegistration <= 7; // New user within 7 days

    } catch (error) {
      console.error('Failed to check onboarding trigger:', error);
      return false;
    }
  }

  private async checkWorkoutStreakTrigger(userId: string): Promise<boolean> {
    // Placeholder: Check if user has a good workout streak (3+ days)
    // You would integrate with your workout tracking system here
    return Math.random() < 0.1; // 10% chance for demo
  }

  private async checkMilestoneTrigger(userId: string): Promise<boolean> {
    // Placeholder: Check if user achieved a milestone
    // You would integrate with your progress tracking system here
    return Math.random() < 0.05; // 5% chance for demo
  }

  private async checkMotivationBoostTrigger(userId: string): Promise<boolean> {
    // Placeholder: Check if user seems to need motivation (no recent activity)
    return Math.random() < 0.15; // 15% chance for demo
  }

  private async checkCheckInTrigger(userId: string): Promise<boolean> {
    // Check if it's been a while since any interaction
    const lastMessage = await this.getLastMessageToUser(userId);
    if (!lastMessage) return true; // No previous messages
    
    const daysSinceLastMessage = this.daysBetween(new Date(lastMessage.sent_at), new Date());
    return daysSinceLastMessage >= 7; // Weekly check-ins
  }

  private async checkRandomSocialTrigger(userId: string): Promise<boolean> {
    // Random social outreach with low probability
    return Math.random() < 0.05; // 5% chance for demo
  }

  // Helper methods

  private async getLastProactiveMessage(userId: string, triggerType: string) {
    try {
      const { data, error } = await supabase
        .from('ai_proactive_messages')
        .select('*')
        .eq('user_id', userId)
        .eq('trigger_type', triggerType)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return error ? null : data;
    } catch (error) {
      console.error('Failed to get last proactive message:', error);
      return null;
    }
  }

  private async getLastMessageFromAI(userId: string, aiUserId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('sent_at')
        .eq('sender_id', aiUserId)
        .eq('receiver_id', userId)
        .eq('is_ai_sender', true)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return error ? null : data;
    } catch (error) {
      console.error('Failed to get last AI message:', error);
      return null;
    }
  }

  private async getLastMessageToUser(userId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('sent_at')
        .eq('receiver_id', userId)
        .eq('is_ai_sender', true)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return error ? null : data;
    } catch (error) {
      console.error('Failed to get last message to user:', error);
      return null;
    }
  }

  private async logProactiveMessage(
    userId: string, 
    aiUserId: string, 
    triggerType: string, 
    messageId: string
  ): Promise<void> {
    try {
      // Create table if it doesn't exist (you may want to add this as a migration)
      await supabase.rpc('create_proactive_messages_log_if_not_exists');
      
      await supabase
        .from('ai_proactive_messages')
        .insert({
          user_id: userId,
          ai_user_id: aiUserId,
          trigger_type: triggerType,
          message_id: messageId,
          sent_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Failed to log proactive message:', error);
      // Don't throw - logging failure shouldn't break the flow
    }
  }

  private daysBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Manual trigger for testing
   */
  async triggerProactiveMessageForUser(
    userId: string, 
    triggerType: keyof typeof this.MESSAGE_TRIGGERS
  ): Promise<boolean> {
    try {
      console.log(`🧪 Manual trigger: ${triggerType} for user ${userId}`);
      
      const trigger = this.MESSAGE_TRIGGERS[triggerType];
      if (!trigger) {
        console.error('Invalid trigger type:', triggerType);
        return false;
      }

      await this.sendProactiveMessage(userId, trigger);
      return true;
    } catch (error) {
      console.error('Failed to manually trigger proactive message:', error);
      return false;
    }
  }

  /**
   * Run proactive message checks for all active users
   */
  async runProactiveMessageScan(): Promise<void> {
    try {
      console.log('🔄 Running proactive message scan for all users...');

      // Get active users (simplified - just get non-AI users for now)
      const { data: activeUsers, error } = await supabase
        .from('users')
        .select('id')
        .eq('is_mock_user', false) // Only real users
        .limit(100); // Process in batches

      if (error || !activeUsers) {
        console.error('Failed to get active users:', error);
        return;
      }

      console.log(`📊 Checking proactive triggers for ${activeUsers.length} active users`);

      // Check triggers for each user with a small delay to avoid overwhelming the system
      for (const user of activeUsers) {
        await this.checkProactiveMessageTriggers(user.id);
        
        // Small delay between users
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('✅ Proactive message scan completed');
    } catch (error) {
      console.error('❌ Failed to run proactive message scan:', error);
    }
  }
}

// Export singleton instance
export const aiProactiveMessagingService = AIProactiveMessagingService.getInstance();
export default aiProactiveMessagingService;