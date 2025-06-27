import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { messageService, Message, MessageWithUser, Conversation, SendMessageParams } from '../services/messageService';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface MessagesState {
  // Conversations data
  conversations: Conversation[];
  currentConversation: MessageWithUser[];
  activeFriendId: string | null;
  
  // UI state
  isLoading: boolean;
  isRefreshing: boolean;
  isSendingMessage: boolean;
  isLoadingMessages: boolean;
  
  // Error handling
  error: string | null;
  hasError: boolean;
  
  // Real-time subscriptions
  messagesSubscription: RealtimeChannel | null;
  conversationsSubscription: RealtimeChannel | null;
  
  // Cache management
  lastFetchTime: number;
  messageCache: Map<string, MessageWithUser[]>; // friendId -> messages
  expiredMessageIds: Set<string>;
  
  // Metrics
  totalUnreadCount: number;
  conversationCount: number;
}

export interface MessagesActions {
  // Core messaging operations
  sendMessage: (params: SendMessageParams) => Promise<void>;
  markMessageAsViewed: (messageId: string) => Promise<void>;
  
  // Data fetching
  fetchConversations: () => Promise<void>;
  fetchMessagesWithFriend: (friendId: string, useCache?: boolean) => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshCurrentChat: () => Promise<void>;
  
  // Real-time operations
  setupRealTimeSubscriptions: (userId: string) => void;
  teardownRealTimeSubscriptions: () => void;
  
  // State management
  setActiveFriend: (friendId: string | null) => void;
  setError: (error: string) => void;
  clearError: () => void;
  resetStore: () => void;
  
  // Message lifecycle
  markMessageAsExpired: (messageId: string) => void;
  cleanupExpiredMessages: () => Promise<void>;
  
  // Optimistic updates
  optimisticallyAddMessage: (message: Partial<MessageWithUser>) => void;
  optimisticallyMarkAsViewed: (messageId: string) => void;
  
  // Cache management
  clearMessageCache: () => void;
  updateMessageCache: (friendId: string, messages: MessageWithUser[]) => void;
}

type MessagesStore = MessagesState & MessagesActions;

const initialState: MessagesState = {
  // Conversations data
  conversations: [],
  currentConversation: [],
  activeFriendId: null,
  
  // UI state
  isLoading: false,
  isRefreshing: false,
  isSendingMessage: false,
  isLoadingMessages: false,
  
  // Error handling
  error: null,
  hasError: false,
  
  // Real-time subscriptions
  messagesSubscription: null,
  conversationsSubscription: null,
  
  // Cache management
  lastFetchTime: 0,
  messageCache: new Map(),
  expiredMessageIds: new Set(),
  
  // Metrics
  totalUnreadCount: 0,
  conversationCount: 0,
};

export const useMessagesStore = create<MessagesStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Send a message
        sendMessage: async (params: SendMessageParams) => {
          try {
            set({ isSendingMessage: true, error: null });
            console.log('💬 Sending message:', params);

            // Validate message
            const validation = messageService.validateMessage(params);
            if (!validation.isValid) {
              throw new Error(validation.error);
            }

            // Optimistically add message to current conversation
            const tempMessage: Partial<MessageWithUser> = {
              id: 'temp-' + Date.now(),
              receiver_id: params.receiverId,
              content: params.content || null,
              media_url: params.mediaUrl || null,
              media_type: params.mediaType || null,
              message_type: params.mediaUrl ? (params.mediaType || 'photo') : 'text',
              sent_at: new Date().toISOString(),
              is_viewed: false,
              viewed_at: null,
              expires_at: null,
              is_expired: false,
            };
            
            get().optimisticallyAddMessage(tempMessage);
            
            // Send message to backend
            const messageId = await messageService.sendMessage(params);
            
            // Update the temporary message with real ID
            const { currentConversation } = get();
            const updatedConversation = currentConversation.map(msg => 
              msg.id === tempMessage.id ? { ...msg, id: messageId } : msg
            );
            
            set({ 
              currentConversation: updatedConversation,
              isSendingMessage: false 
            });
            
            // Refresh conversations to update last message
            await get().fetchConversations();
            
            console.log('✅ Message sent successfully');
            
          } catch (error: any) {
            console.error('❌ Error sending message:', error);
            set({ 
              error: error.message, 
              hasError: true, 
              isSendingMessage: false 
            });
            throw error;
          }
        },

        // Mark message as viewed (starts expiration timer)
        markMessageAsViewed: async (messageId: string) => {
          try {
            console.log('👁️ Marking message as viewed:', messageId);

            // Optimistically mark as viewed
            get().optimisticallyMarkAsViewed(messageId);
            
            // Update in backend
            await messageService.markMessageAsViewed(messageId);
            
            // Start local timer for expiration (10 seconds)
            setTimeout(() => {
              get().markMessageAsExpired(messageId);
            }, 10000);
            
            console.log('✅ Message marked as viewed');
            
          } catch (error: any) {
            console.error('❌ Error marking message as viewed:', error);
            set({ 
              error: error.message, 
              hasError: true 
            });
            throw error;
          }
        },

        // Fetch conversations list
        fetchConversations: async () => {
          try {
            set({ isLoading: true, error: null });
            console.log('💬 Fetching conversations');

            const conversations = await messageService.getUserConversations();
            
            const totalUnreadCount = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);
            
            set({ 
              conversations,
              conversationCount: conversations.length,
              totalUnreadCount,
              isLoading: false,
              lastFetchTime: Date.now()
            });
            
            console.log(`✅ Fetched ${conversations.length} conversations`);
            
          } catch (error: any) {
            console.error('❌ Error fetching conversations:', error);
            set({ 
              error: error.message, 
              hasError: true, 
              isLoading: false 
            });
            throw error;
          }
        },

        // Fetch messages with a specific friend
        fetchMessagesWithFriend: async (friendId: string, useCache: boolean = true) => {
          try {
            set({ isLoadingMessages: true, error: null });
            console.log('💬 Fetching messages with friend:', friendId);

            // Check cache first
            const { messageCache } = get();
            if (useCache && messageCache.has(friendId)) {
              const cachedMessages = messageCache.get(friendId) || [];
              set({ 
                currentConversation: cachedMessages,
                activeFriendId: friendId,
                isLoadingMessages: false
              });
              console.log(`✅ Loaded ${cachedMessages.length} messages from cache`);
              return;
            }

            const messages = await messageService.getMessagesBetweenFriends(friendId);
            
            // Update cache
            get().updateMessageCache(friendId, messages);
            
            set({ 
              currentConversation: messages,
              activeFriendId: friendId,
              isLoadingMessages: false
            });
            
            console.log(`✅ Fetched ${messages.length} messages`);
            
          } catch (error: any) {
            console.error('❌ Error fetching messages:', error);
            set({ 
              error: error.message, 
              hasError: true, 
              isLoadingMessages: false 
            });
            throw error;
          }
        },

        // Refresh conversations
        refreshConversations: async () => {
          try {
            set({ isRefreshing: true });
            await get().fetchConversations();
            set({ isRefreshing: false });
          } catch (error: any) {
            set({ isRefreshing: false });
            throw error;
          }
        },

        // Refresh current chat
        refreshCurrentChat: async () => {
          const { activeFriendId } = get();
          if (activeFriendId) {
            await get().fetchMessagesWithFriend(activeFriendId, false);
          }
        },

        // Setup real-time subscriptions
        setupRealTimeSubscriptions: (userId: string) => {
          console.log('🔔 Setting up real-time subscriptions for user:', userId);
          
          // Cleanup existing subscriptions
          get().teardownRealTimeSubscriptions();

          // Subscribe to new messages
          const messagesSubscription = messageService.subscribeToMessages(
            userId,
            (newMessage: Message) => {
              console.log('📩 New message received:', newMessage);
              
              // Add to current conversation if it's the active friend
              const { activeFriendId } = get();
              if (activeFriendId === newMessage.sender_id) {
                const messageWithUser: MessageWithUser = {
                  ...newMessage,
                  sender_username: '', // Will be filled by real fetch
                  receiver_username: '',
                  is_expired: false,
                };
                get().optimisticallyAddMessage(messageWithUser);
              }
              
              // Refresh conversations to update unread counts
              get().fetchConversations();
            },
            (updatedMessage: Message) => {
              console.log('📝 Message updated:', updatedMessage);
              
              // Update message in current conversation
              const { currentConversation } = get();
              const updatedConversation = currentConversation.map(msg => 
                msg.id === updatedMessage.id 
                  ? { ...msg, ...updatedMessage, is_expired: messageService.isMessageExpired(updatedMessage) }
                  : msg
              );
              
              set({ currentConversation: updatedConversation });
            }
          );

          // Subscribe to conversation updates
          const conversationsSubscription = messageService.subscribeToConversationUpdates(
            userId,
            () => {
              console.log('💬 Conversation updated, refreshing');
              get().fetchConversations();
            }
          );

          set({ 
            messagesSubscription,
            conversationsSubscription
          });
        },

        // Teardown real-time subscriptions
        teardownRealTimeSubscriptions: () => {
          const { messagesSubscription, conversationsSubscription } = get();
          
          if (messagesSubscription) {
            messagesSubscription.unsubscribe();
          }
          
          if (conversationsSubscription) {
            conversationsSubscription.unsubscribe();
          }
          
          set({
            messagesSubscription: null,
            conversationsSubscription: null
          });
        },

        // State management
        setActiveFriend: (friendId: string | null) => {
          set({ activeFriendId: friendId });
          if (!friendId) {
            set({ currentConversation: [] });
          }
        },

        setError: (error: string) => {
          set({ error, hasError: true });
        },

        clearError: () => {
          set({ error: null, hasError: false });
        },

        resetStore: () => {
          get().teardownRealTimeSubscriptions();
          set({ 
            ...initialState, 
            messageCache: new Map(),
            expiredMessageIds: new Set()
          });
        },

        // Mark message as expired and remove from UI
        markMessageAsExpired: (messageId: string) => {
          const { currentConversation, expiredMessageIds } = get();
          
          // Add to expired set
          const newExpiredIds = new Set(expiredMessageIds);
          newExpiredIds.add(messageId);
          
          // Remove from current conversation
          const filteredConversation = currentConversation.filter(msg => msg.id !== messageId);
          
          set({ 
            currentConversation: filteredConversation,
            expiredMessageIds: newExpiredIds
          });
          
          console.log('💨 Message expired and removed:', messageId);
        },

        // Cleanup expired messages
        cleanupExpiredMessages: async () => {
          try {
            const deletedCount = await messageService.cleanupExpiredMessages();
            console.log(`🧹 Cleaned up ${deletedCount} expired messages`);
            
            // Refresh current conversation to remove any expired messages
            await get().refreshCurrentChat();
            
          } catch (error: any) {
            console.error('❌ Error cleaning up messages:', error);
          }
        },

        // Optimistic updates
        optimisticallyAddMessage: (message: Partial<MessageWithUser>) => {
          const { currentConversation } = get();
          const newMessage: MessageWithUser = {
            sender_username: '',
            receiver_username: '',
            is_expired: false,
            created_at: new Date().toISOString(),
            sender_id: '',
            receiver_id: '',
            content: null,
            media_url: null,
            media_type: null,
            message_type: 'text',
            sent_at: new Date().toISOString(),
            expires_at: null,
            is_viewed: false,
            viewed_at: null,
            id: '',
            ...message,
          };
          
          set({ 
            currentConversation: [newMessage, ...currentConversation]
          });
        },

        optimisticallyMarkAsViewed: (messageId: string) => {
          const { currentConversation } = get();
          const updatedConversation = currentConversation.map(msg => 
            msg.id === messageId 
              ? { 
                  ...msg, 
                  is_viewed: true, 
                  viewed_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 10000).toISOString() // 10 seconds from now
                }
              : msg
          );
          
          set({ currentConversation: updatedConversation });
        },

        // Cache management
        clearMessageCache: () => {
          set({ messageCache: new Map() });
        },

        updateMessageCache: (friendId: string, messages: MessageWithUser[]) => {
          const { messageCache } = get();
          const newCache = new Map(messageCache);
          newCache.set(friendId, messages);
          set({ messageCache: newCache });
        },
      }),
      {
        name: 'messages-storage',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          // Only persist essential data, not UI state or subscriptions
          conversations: state.conversations,
          totalUnreadCount: state.totalUnreadCount,
          conversationCount: state.conversationCount,
          lastFetchTime: state.lastFetchTime,
          // Don't persist currentConversation as it's friend-specific
          // Don't persist cache as it may become stale
        }),
        merge: (persistedState, currentState) => {
          return {
            ...currentState,
            ...persistedState,
            messageCache: new Map(), // Always start with empty cache
            expiredMessageIds: new Set(), // Always start fresh
            messagesSubscription: null,
            conversationsSubscription: null,
          };
        },
      }
    ),
    {
      name: 'messages-store',
    }
  )
);

export default useMessagesStore;