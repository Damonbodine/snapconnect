/**
 * App Initialization Service
 * Handles startup initialization of all app services including AI messaging
 */

import { aiMessagingSchedulerService } from './aiMessagingScheduler';
import { aiMessageHandler } from './aiMessageHandler';

class AppInitializationService {
  private static instance: AppInitializationService;
  private isInitialized = false;

  public static getInstance(): AppInitializationService {
    if (!AppInitializationService.instance) {
      AppInitializationService.instance = new AppInitializationService();
    }
    return AppInitializationService.instance;
  }

  /**
   * Initialize all app services
   */
  async initializeApp(): Promise<void> {
    if (this.isInitialized) {
      console.log('📱 App already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing SnapConnect App Services...');

      // Initialize AI messaging system
      await this.initializeAIMessaging();

      // Add other service initializations here
      // await this.initializeHealthTracking();
      // await this.initializePushNotifications();
      // etc.

      this.isInitialized = true;
      console.log('✅ SnapConnect App Services initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize app services:', error);
      throw error;
    }
  }

  /**
   * Initialize AI messaging system
   */
  private async initializeAIMessaging(): Promise<void> {
    try {
      console.log('🤖 Initializing AI Messaging System...');
      
      // Initialize AI message handler for real-time responses
      await aiMessageHandler.initialize();
      console.log('✅ AI Message Handler initialized');
      
      // Initialize AI messaging scheduler for proactive messages
      await aiMessagingSchedulerService.initialize();
      console.log('✅ AI Messaging Scheduler initialized');
      
      console.log('✅ AI Messaging System ready');
    } catch (error) {
      console.error('❌ Failed to initialize AI messaging:', error);
      // Don't throw - allow app to continue without AI messaging
    }
  }

  /**
   * Cleanup app services
   */
  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up app services...');

      // Cleanup AI messaging
      await aiMessageHandler.cleanup();
      await aiMessagingSchedulerService.cleanup();

      // Add other service cleanups here

      this.isInitialized = false;
      console.log('✅ App services cleaned up');

    } catch (error) {
      console.error('❌ Failed to cleanup app services:', error);
    }
  }

  /**
   * Get initialization status
   */
  isAppInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get detailed system status
   */
  getSystemStatus(): {
    appInitialized: boolean;
    aiMessageHandlerStatus: any;
    aiMessagingStatus: any;
  } {
    return {
      appInitialized: this.isInitialized,
      aiMessageHandlerStatus: aiMessageHandler.getStatus(),
      aiMessagingStatus: aiMessagingSchedulerService.getStatus(),
    };
  }

  /**
   * Manual test functions for development
   */
  async testAIMessaging(): Promise<void> {
    console.log('🧪 Testing AI Messaging System...');
    
    try {
      // Test getting AI users
      const aiUsers = await aiMessagingSchedulerService.getAvailableAIUsers();
      console.log(`📊 Found ${aiUsers.length} AI users available`);

      // Test proactive message scan
      await aiMessagingSchedulerService.triggerProactiveMessageScan();
      console.log('📤 Proactive message scan completed');

      console.log('✅ AI Messaging test completed successfully');
    } catch (error) {
      console.error('❌ AI Messaging test failed:', error);
    }
  }

  /**
   * Send test proactive message to specific user
   */
  async sendTestProactiveMessage(
    userId: string,
    triggerType: 'onboarding_welcome' | 'workout_streak' | 'milestone_celebration' | 'motivation_boost' | 'check_in' | 'random_social'
  ): Promise<boolean> {
    try {
      console.log(`🧪 Sending test proactive message: ${triggerType} to user ${userId}`);
      
      const success = await aiMessagingSchedulerService.triggerProactiveMessageForUser(userId, triggerType);
      
      if (success) {
        console.log('✅ Test proactive message sent successfully');
      } else {
        console.log('❌ Test proactive message failed');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Test proactive message error:', error);
      return false;
    }
  }

  /**
   * Test AI conversation
   */
  async testAIConversation(humanUserId: string, aiUserId: string): Promise<void> {
    try {
      console.log(`🧪 Testing AI conversation: ${humanUserId} with AI ${aiUserId}`);
      
      const response = await aiMessagingSchedulerService.startConversationWithAI(humanUserId, aiUserId);
      
      console.log('✅ AI conversation test successful');
      console.log(`   Response: "${response.content}"`);
      console.log(`   Message ID: ${response.message_id}`);
    } catch (error) {
      console.error('❌ AI conversation test failed:', error);
    }
  }
}

// Export singleton instance
export const appInitializationService = AppInitializationService.getInstance();
export default appInitializationService;