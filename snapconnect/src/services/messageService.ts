import { supabase, Database } from './supabase';

// Type definitions for messages
export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type MessageUpdate = Database['public']['Tables']['messages']['Update'];
export type MessageView = Database['public']['Tables']['message_views']['Row'];

// Extended types for UI components
export interface MessageWithUser extends Message {
  sender_username: string;
  receiver_username: string;
  is_expired: boolean;
  is_ai_sender?: boolean; // New field to indicate if sender is AI
  ai_personality_type?: string; // New field for AI personality type
}

export interface Conversation {
  friend_id: string;
  friend_username: string;
  friend_full_name: string | null;
  friend_avatar_url: string | null;
  last_message_id: string | null;
  last_message_content: string | null;
  last_message_type: string | null;
  last_message_sent_at: string | null;
  unread_count: number;
  is_sender: boolean;
  is_ai_conversation?: boolean; // New field to indicate AI conversation
}

export interface SendMessageParams {
  receiverId: string;
  content?: string;
  mediaUrl?: string;
  mediaType?: 'photo' | 'video';
}

class MessageService {
  /**
   * Send a message to a friend
   */
  async sendMessage({ 
    receiverId, 
    content, 
    mediaUrl, 
    mediaType 
  }: SendMessageParams): Promise<string> {
    try {
      console.log('📤 Sending message to:', receiverId);
      
      const { data, error } = await supabase.rpc('send_message', {
        receiver_user_id: receiverId,
        message_content: content || null,
        message_media_url: mediaUrl || null,
        message_media_type: mediaType || null,
      });

      if (error) {
        console.error('❌ Error sending message:', error);
        throw new Error(error.message);
      }

      console.log('✅ Message sent successfully, ID:', data);
      return data;
    } catch (error: any) {
      console.error('❌ Failed to send message:', error);
      throw new Error(error.message || 'Failed to send message');
    }
  }

  /**
   * Mark a message as viewed (messages now persist permanently)
   */
  async markMessageAsViewed(messageId: string): Promise<boolean> {
    try {
      console.log('👁️ Marking message as viewed:', messageId);
      
      const { data, error } = await supabase.rpc('mark_message_viewed', {
        message_id: messageId,
      });

      if (error) {
        console.error('❌ Error marking message as viewed:', error);
        throw new Error(error.message);
      }

      console.log('✅ Message marked as viewed successfully');
      return data;
    } catch (error: any) {
      console.error('❌ Failed to mark message as viewed:', error);
      throw new Error(error.message || 'Failed to mark message as viewed');
    }
  }

  /**
   * Get messages between current user and another user (friend or AI)
   */
  async getMessagesBetweenFriends(
    friendId: string, 
    limit: number = 50
  ): Promise<MessageWithUser[]> {
    try {
      console.log('💬 Fetching messages with user:', friendId);
      
      // Use the new AI-supported function that works with both friends and AI users
      const { data, error } = await supabase.rpc('get_messages_with_ai_support', {
        other_user_id: friendId,
        limit_count: limit,
      });

      if (error) {
        console.error('❌ Error fetching messages:', error);
        throw new Error(error.message);
      }

      console.log(`✅ Fetched ${data?.length || 0} messages`);
      
      // 🔍 DIAGNOSTIC LOGGING - Analyze fetched message data
      if (data && data.length > 0) {
        console.log('🔍 Message Data Analysis:');
        data.forEach((msg: any, index: number) => {
          console.log(`  Message ${index + 1}:`, {
            id: msg.id,
            content: msg.content?.substring(0, 20) + '...',
            sender_id: msg.sender_id,
            receiver_id: msg.receiver_id,
            is_ai_sender: msg.is_ai_sender,
            sender_username: msg.sender_username,
            receiver_username: msg.receiver_username,
            data_integrity: {
              has_sender_id: msg.sender_id !== null,
              has_receiver_id: msg.receiver_id !== null,
              ai_flag_set: msg.is_ai_sender === true,
              expected_ai_pattern: msg.is_ai_sender ? 'sender_id should be null' : 'sender_id should have value',
              actual_pattern: msg.sender_id === null ? 'sender_id is null' : 'sender_id has value'
            }
          });
        });
      }
      
      return data || [];
    } catch (error: any) {
      console.error('❌ Failed to fetch messages:', error);
      throw new Error(error.message || 'Failed to fetch messages');
    }
  }

  /**
   * Get messages with AI support (alternative method name for clarity)
   */
  async getMessagesWithUser(
    userId: string, 
    limit: number = 50
  ): Promise<MessageWithUser[]> {
    return this.getMessagesBetweenFriends(userId, limit);
  }

  /**
   * Get conversation list for the current user (includes AI conversations)
   */
  async getUserConversations(): Promise<Conversation[]> {
    try {
      console.log('💬 Fetching user conversations (including AI)');
      
      // Use the new AI-supported function that includes both friends and AI users
      const { data, error } = await supabase.rpc('get_user_conversations_with_ai');

      if (error) {
        console.error('❌ Error fetching conversations:', error);
        throw new Error(error.message);
      }

      console.log(`✅ Fetched ${data?.length || 0} conversations`);
      return data || [];
    } catch (error: any) {
      console.error('❌ Failed to fetch conversations:', error);
      throw new Error(error.message || 'Failed to fetch conversations');
    }
  }

  /**
   * Cleanup function (no longer needed as messages don't expire)
   */
  async cleanupExpiredMessages(): Promise<number> {
    // Messages no longer expire, so nothing to cleanup
    console.log('ℹ️ Cleanup skipped - messages no longer expire');
    return 0;
  }

  /**
   * Subscribe to new messages for real-time updates
   */
  subscribeToMessages(
    userId: string,
    onNewMessage: (message: Message) => void,
    onMessageUpdate: (message: Message) => void
  ) {
    console.log('🔔 Subscribing to messages for user:', userId);

    const subscription = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          console.log('📩 New message received (as receiver):', payload.new);
          const message = payload.new as Message;
          onNewMessage(message);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId}`,
        },
        (payload) => {
          console.log('📩 New message received (as sender):', payload.new);
          const message = payload.new as Message;
          onNewMessage(message);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId}`,
        },
        (payload) => {
          console.log('📝 Message updated (as sender):', payload.new);
          onMessageUpdate(payload.new as Message);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          console.log('📝 Message updated (as receiver):', payload.new);
          onMessageUpdate(payload.new as Message);
        }
      )
      .subscribe();

    return subscription;
  }

  /**
   * Subscribe to conversation updates for real-time conversation list
   */
  subscribeToConversationUpdates(
    userId: string,
    onConversationUpdate: () => void
  ) {
    console.log('🔔 Subscribing to conversation updates for user:', userId);

    const subscription = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId},receiver_id=eq.${userId}`,
        },
        () => {
          console.log('💬 Conversation updated, refreshing list');
          onConversationUpdate();
        }
      )
      .subscribe();

    return subscription;
  }

  /**
   * Check if message is expired (always returns false now)
   */
  isMessageExpired(message: Message): boolean {
    // Messages no longer expire
    return false;
  }

  /**
   * Get time remaining until message expires (always returns 0 now)
   */
  getTimeUntilExpiration(message: Message): number {
    // Messages no longer expire
    return 0;
  }

  /**
   * Format message time for display
   */
  formatMessageTime(sentAt: string): string {
    const now = new Date();
    const messageDate = new Date(sentAt);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    // For older messages, show date
    return messageDate.toLocaleDateString();
  }

  /**
   * Get message preview text for conversation list
   */
  getMessagePreview(message: Conversation): string {
    if (!message.last_message_content && !message.last_message_type) {
      return 'No messages yet';
    }

    if (message.last_message_type === 'photo') {
      return '📸 Photo';
    }
    
    if (message.last_message_type === 'video') {
      return '🎥 Video';
    }
    
    if (message.last_message_type === 'mixed') {
      return '📎 Media + text';
    }

    // Text message
    const content = message.last_message_content || '';
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  }

  /**
   * Validate message content before sending
   */
  validateMessage(params: SendMessageParams): { isValid: boolean; error?: string } {
    const { content, mediaUrl, receiverId } = params;

    if (!receiverId) {
      return { isValid: false, error: 'Receiver ID is required' };
    }

    if (!content && !mediaUrl) {
      return { isValid: false, error: 'Message must have content or media' };
    }

    if (content && content.trim().length === 0) {
      return { isValid: false, error: 'Text content cannot be empty' };
    }

    if (content && content.length > 1000) {
      return { isValid: false, error: 'Message too long (max 1000 characters)' };
    }

    return { isValid: true };
  }

  // AI-related methods moved to separate services to avoid circular dependencies
  // Use aiChatService directly for AI interactions
}

// Export singleton instance
export const messageService = new MessageService();
export default messageService;