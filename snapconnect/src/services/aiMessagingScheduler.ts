/**
 * AI Messaging Scheduler Service
 * Handles periodic checks and initialization of AI messaging systems
 */

import { aiMessageHandler } from './aiMessageHandler';
import { aiProactiveMessagingService } from './aiProactiveMessaging';

class AIMessagingSchedulerService {
  private static instance: AIMessagingSchedulerService;
  private proactiveMessageInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  public static getInstance(): AIMessagingSchedulerService {
    if (!AIMessagingSchedulerService.instance) {
      AIMessagingSchedulerService.instance = new AIMessagingSchedulerService();
    }
    return AIMessagingSchedulerService.instance;
  }

  /**
   * Initialize the complete AI messaging system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🤖 AI Messaging Scheduler already initialized');
      return;
    }

    try {
      console.log('🤖 Initializing AI Messaging System...');

      // Initialize AI message handler for reactive responses
      await aiMessageHandler.initialize();

      // Start proactive message checking
      this.startProactiveMessageScheduler();

      this.isInitialized = true;
      console.log('✅ AI Messaging System fully initialized');

    } catch (error) {
      console.error('❌ Failed to initialize AI Messaging System:', error);
      throw error;
    }
  }

  /**
   * Start the proactive message scheduler
   */
  private startProactiveMessageScheduler(): void {
    // Clear existing interval if any
    if (this.proactiveMessageInterval) {
      clearInterval(this.proactiveMessageInterval);
    }

    console.log('📅 Starting proactive message scheduler...');

    // Run proactive message checks every 30 minutes
    const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

    this.proactiveMessageInterval = setInterval(async () => {
      try {
        console.log('⏰ Running scheduled proactive message check...');
        await aiProactiveMessagingService.runProactiveMessageScan();
      } catch (error) {
        console.error('❌ Scheduled proactive message check failed:', error);
      }
    }, CHECK_INTERVAL_MS);

    // Run an initial check after 2 minutes (to avoid startup rush)
    setTimeout(async () => {
      try {
        console.log('🚀 Running initial proactive message check...');
        await aiProactiveMessagingService.runProactiveMessageScan();
      } catch (error) {
        console.error('❌ Initial proactive message check failed:', error);
      }
    }, 2 * 60 * 1000); // 2 minutes

    console.log('✅ Proactive message scheduler started (30-minute intervals)');
  }

  /**
   * Stop the proactive message scheduler
   */
  private stopProactiveMessageScheduler(): void {
    if (this.proactiveMessageInterval) {
      clearInterval(this.proactiveMessageInterval);
      this.proactiveMessageInterval = null;
      console.log('🛑 Proactive message scheduler stopped');
    }
  }

  /**
   * Cleanup all AI messaging services
   */
  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up AI Messaging System...');

      // Stop scheduler
      this.stopProactiveMessageScheduler();

      // Cleanup AI message handler
      await aiMessageHandler.cleanup();

      this.isInitialized = false;
      console.log('✅ AI Messaging System cleaned up');

    } catch (error) {
      console.error('❌ Failed to cleanup AI Messaging System:', error);
    }
  }

  /**
   * Get system status
   */
  getStatus(): {
    initialized: boolean;
    messageHandlerStatus: any;
    schedulerRunning: boolean;
  } {
    return {
      initialized: this.isInitialized,
      messageHandlerStatus: aiMessageHandler.getStatus(),
      schedulerRunning: !!this.proactiveMessageInterval,
    };
  }

  /**
   * Manually trigger proactive message scan (for testing)
   */
  async triggerProactiveMessageScan(): Promise<void> {
    try {
      console.log('🧪 Manual proactive message scan triggered');
      await aiProactiveMessagingService.runProactiveMessageScan();
    } catch (error) {
      console.error('❌ Manual proactive message scan failed:', error);
      throw error;
    }
  }

  /**
   * Manually send a proactive message to a specific user (for testing)
   */
  async triggerProactiveMessageForUser(
    userId: string, 
    triggerType: 'onboarding_welcome' | 'workout_streak' | 'milestone_celebration' | 'motivation_boost' | 'check_in' | 'random_social'
  ): Promise<boolean> {
    try {
      console.log(`🧪 Manual proactive message: ${triggerType} for user ${userId}`);
      return await aiProactiveMessagingService.triggerProactiveMessageForUser(userId, triggerType);
    } catch (error) {
      console.error('❌ Manual proactive message failed:', error);
      return false;
    }
  }

  /**
   * Test AI response system
   */
  async testAIResponse(humanUserId: string, aiUserId: string, testMessage: string): Promise<void> {
    return await aiMessageHandler.testAIResponse(humanUserId, aiUserId, testMessage);
  }

  /**
   * Start conversation with AI manually
   */
  async startConversationWithAI(humanUserId: string, aiUserId: string): Promise<any> {
    return await aiMessageHandler.startConversationWithAI(humanUserId, aiUserId);
  }

  /**
   * Get available AI users
   */
  async getAvailableAIUsers(): Promise<any[]> {
    return await aiMessageHandler.getAvailableAIUsers();
  }
}

// Export singleton instance
export const aiMessagingSchedulerService = AIMessagingSchedulerService.getInstance();
export default aiMessagingSchedulerService;