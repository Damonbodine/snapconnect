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
   * Mark a message as viewed (starts 10-second expiration timer)
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
   * Get messages between current user and a friend
   */
  async getMessagesBetweenFriends(
    friendId: string, 
    limit: number = 50
  ): Promise<MessageWithUser[]> {
    try {
      console.log('💬 Fetching messages with friend:', friendId);
      
      const { data, error } = await supabase.rpc('get_messages_between_friends', {
        friend_id: friendId,
        limit_count: limit,
      });

      if (error) {
        console.error('❌ Error fetching messages:', error);
        throw new Error(error.message);
      }

      console.log(`✅ Fetched ${data?.length || 0} messages`);
      return data || [];
    } catch (error: any) {
      console.error('❌ Failed to fetch messages:', error);
      throw new Error(error.message || 'Failed to fetch messages');
    }
  }

  /**
   * Get conversation list for the current user
   */
  async getUserConversations(): Promise<Conversation[]> {
    try {
      console.log('💬 Fetching user conversations');
      
      const { data, error } = await supabase.rpc('get_user_conversations');

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
   * Delete expired messages (cleanup function)
   */
  async cleanupExpiredMessages(): Promise<number> {
    try {
      console.log('🧹 Cleaning up expired messages');
      
      const { data, error } = await supabase.rpc('cleanup_expired_messages');

      if (error) {
        console.error('❌ Error cleaning up messages:', error);
        throw new Error(error.message);
      }

      console.log(`✅ Cleaned up ${data || 0} expired messages`);
      return data || 0;
    } catch (error: any) {
      console.error('❌ Failed to cleanup messages:', error);
      throw new Error(error.message || 'Failed to cleanup messages');
    }
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
          console.log('📩 New message received:', payload.new);
          onNewMessage(payload.new as Message);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId},receiver_id=eq.${userId}`,
        },
        (payload) => {
          console.log('📝 Message updated:', payload.new);
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
   * Check if message is expired
   */
  isMessageExpired(message: Message): boolean {
    if (!message.expires_at) return false;
    return new Date(message.expires_at) < new Date();
  }

  /**
   * Get time remaining until message expires (in seconds)
   */
  getTimeUntilExpiration(message: Message): number {
    if (!message.expires_at) return 0;
    const expirationTime = new Date(message.expires_at).getTime();
    const currentTime = new Date().getTime();
    const timeRemaining = Math.max(0, Math.floor((expirationTime - currentTime) / 1000));
    return timeRemaining;
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
}

// Export singleton instance
export const messageService = new MessageService();
export default messageService;