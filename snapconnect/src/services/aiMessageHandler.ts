/**
 * AI Message Handler
 * Handles automatic AI responses to incoming messages
 * Separate from messageService to avoid circular dependencies
 */

import { supabase } from './supabase';
import { aiChatService } from './aiChatService';
import type { Message } from './messageService';

class AIMessageHandler {
  private static instance: AIMessageHandler;
  private isInitialized = false;
  private subscription: any = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastCheckedAt: Date = new Date();

  public static getInstance(): AIMessageHandler {
    if (!AIMessageHandler.instance) {
      AIMessageHandler.instance = new AIMessageHandler();
    }
    return AIMessageHandler.instance;
  }

  /**
   * Initialize AI message response handling
   * Sets up real-time subscriptions to trigger AI responses
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🤖 AI Message Handler already initialized');
      return;
    }

    try {
      console.log('🤖 Initializing AI Message Handler...');

      // Try real-time subscriptions first, fallback to polling if not available
      try {
        this.subscription = supabase
          .channel('ai_message_handler')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
            },
            async (payload) => {
              console.log('🔥 AI Handler received message event (real-time):', payload);
              const message = payload.new as Message;
              await this.handleNewMessage(message);
            }
          )
          .subscribe((status) => {
            console.log('🔥 AI Handler subscription status:', status);
            if (status === 'SUBSCRIBED') {
              console.log('✅ Real-time subscriptions working!');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.log('⚠️  Real-time not available, starting polling fallback...');
              this.startPollingFallback();
            }
          });

        // Also start polling as a backup (will be more reliable)
        this.startPollingFallback();
      } catch (error) {
        console.log('⚠️  Real-time subscriptions failed, using polling only:', error);
        this.startPollingFallback();
      }

      this.isInitialized = true;
      console.log('✅ AI Message Handler initialized and listening for messages');

    } catch (error) {
      console.error('❌ Failed to initialize AI Message Handler:', error);
      throw error;
    }
  }

  /**
   * Handle new incoming message and trigger AI response if needed
   */
  private async handleNewMessage(message: Message): Promise<void> {
    try {
      // Skip if no content or self-message
      if (!message.content || message.sender_id === message.receiver_id) {
        return;
      }

      // Skip if message is already from an AI (prevent AI-to-AI loops)
      if (message.is_ai_sender) {
        return;
      }

      console.log(`📨 New message detected: ${message.sender_id} → ${message.receiver_id}`);
      console.log(`   Content: "${message.content.substring(0, 50)}..."`);

      // Check if receiver is an AI user
      const receiverIsAI = await this.isAIUser(message.receiver_id);
      
      if (!receiverIsAI) {
        console.log('   → Not an AI user, skipping response');
        return;
      }

      console.log(`🤖 Triggering AI response for AI user: ${message.receiver_id}`);

      // Add a small delay to make it feel more natural
      setTimeout(async () => {
        try {
          // Generate AI response
          const response = await aiChatService.generateAIResponse({
            ai_user_id: message.receiver_id,
            human_user_id: message.sender_id,
            human_message: message.content,
          });

          console.log(`✅ AI response generated and sent:`);
          console.log(`   Response: "${response.content.substring(0, 100)}..."`);
          console.log(`   Message ID: ${response.message_id}`);
          console.log(`   Typing delay was: ${response.typing_delay_ms}ms`);

        } catch (error) {
          console.error('❌ Failed to generate AI response:', error);
        }
      }, 1000); // 1 second delay to feel natural

    } catch (error) {
      console.error('❌ Failed to handle AI message response:', error);
      // Don't throw - this is a background operation
    }
  }

  /**
   * Check if a user is an AI user
   */
  private async isAIUser(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_mock_user')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Failed to check if user is AI:', error);
        return false;
      }

      return data?.is_mock_user === true;
    } catch (error) {
      console.error('❌ Failed to check AI user status:', error);
      return false;
    }
  }

  /**
   * Test AI response system manually
   */
  async testAIResponse(humanUserId: string, aiUserId: string, testMessage: string): Promise<void> {
    try {
      console.log('🧪 Testing AI response system...');
      console.log(`   Human: ${humanUserId}`);
      console.log(`   AI: ${aiUserId}`);
      console.log(`   Message: "${testMessage}"`);
      
      const response = await aiChatService.generateAIResponse({
        ai_user_id: aiUserId,
        human_user_id: humanUserId,
        human_message: testMessage,
      });

      console.log('✅ Test AI response successful:');
      console.log(`   Response: "${response.content}"`);
      console.log(`   Message ID: ${response.message_id}`);
      console.log(`   Typing delay: ${response.typing_delay_ms}ms`);

    } catch (error) {
      console.error('❌ AI response test failed:', error);
      throw error;
    }
  }

  /**
   * Start conversation with AI manually
   */
  async startConversationWithAI(humanUserId: string, aiUserId: string): Promise<any> {
    try {
      console.log(`💬 Starting conversation: ${humanUserId} with AI ${aiUserId}`);
      
      const response = await aiChatService.startConversationWithAI(aiUserId, humanUserId);
      
      console.log('✅ Conversation started successfully');
      return response;
    } catch (error) {
      console.error('❌ Failed to start AI conversation:', error);
      throw error;
    }
  }

  /**
   * Get available AI users
   */
  async getAvailableAIUsers(): Promise<any[]> {
    try {
      return await aiChatService.getAvailableAIUsers();
    } catch (error) {
      console.error('❌ Failed to get AI users:', error);
      return [];
    }
  }

  /**
   * Start polling fallback when real-time isn't available
   */
  private startPollingFallback(): void {
    if (this.pollingInterval) {
      return; // Already running
    }

    console.log('🔄 Starting AI message polling fallback (checks every 3 seconds)...');
    
    this.pollingInterval = setInterval(async () => {
      try {
        await this.checkForNewMessages();
      } catch (error) {
        console.error('❌ Polling check failed:', error);
      }
    }, 3000); // Check every 3 seconds
  }

  /**
   * Check for new messages since last check
   */
  private async checkForNewMessages(): Promise<void> {
    try {
      const { data: newMessages, error } = await supabase
        .from('messages')
        .select('*')
        .gte('sent_at', this.lastCheckedAt.toISOString())
        .eq('is_ai_sender', false) // Only check human messages
        .order('sent_at', { ascending: true });

      if (error) {
        console.error('❌ Failed to check for new messages:', error);
        return;
      }

      if (newMessages && newMessages.length > 0) {
        console.log(`🔄 Polling found ${newMessages.length} new messages`);
        
        for (const message of newMessages) {
          console.log('🔥 AI Handler received message event (polling):', message);
          await this.handleNewMessage(message as Message);
        }
        
        // Update last checked time
        this.lastCheckedAt = new Date();
      }
    } catch (error) {
      console.error('❌ Error checking for new messages:', error);
    }
  }

  /**
   * Cleanup subscriptions and polling
   */
  async cleanup(): Promise<void> {
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
    }
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.isInitialized = false;
    console.log('🤖 AI Message Handler cleaned up');
  }

  /**
   * Get handler status
   */
  getStatus(): { initialized: boolean; hasSubscription: boolean } {
    return {
      initialized: this.isInitialized,
      hasSubscription: !!this.subscription,
    };
  }
}

// Export singleton instance
export const aiMessageHandler = AIMessageHandler.getInstance();
export default aiMessageHandler;