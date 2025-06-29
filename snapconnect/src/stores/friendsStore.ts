import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { friendService, Friend, FriendRequest, SentRequest } from '../services/friendService';

export interface FriendsState {
  // Friends data
  friends: Friend[];
  pendingRequests: FriendRequest[];
  sentRequests: SentRequest[];
  friendsCount: number;
  
  // UI state
  isLoading: boolean;
  isRefreshing: boolean;
  isSendingRequest: boolean;
  isAcceptingRequest: boolean;
  isDecliningRequest: boolean;
  
  // Error handling
  error: string | null;
  hasError: boolean;
  
  // Cache management
  lastFetchTime: number;
  friendshipStatuses: Map<string, string>; // userId -> status cache
  
  // Metrics
  totalFriendsCount: number;
  pendingCount: number;
  sentCount: number;
}

export interface FriendsActions {
  // Core friendship operations
  sendFriendRequest: (friendId: string) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  declineFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  
  // Data fetching
  fetchFriends: () => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  fetchSentRequests: () => Promise<void>;
  fetchFriendsCount: (userId?: string) => Promise<number>;
  refreshAllData: () => Promise<void>;
  
  // Friendship status
  getFriendshipStatus: (friendId: string) => Promise<string>;
  checkFriendshipStatusCached: (friendId: string) => string | null;
  
  // State management
  setError: (error: string) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  resetStore: () => void;
  
  // Optimistic updates
  optimisticallyAddFriend: (friendId: string, userData: any) => void;
  optimisticallyRemoveFriend: (friendId: string) => void;
  optimisticallyUpdateRequest: (friendshipId: string, newStatus: 'accepted' | 'declined') => void;
  
  // Cache management
  updateFriendshipStatusCache: (friendId: string, status: string) => void;
  clearStatusCache: () => void;
}

type FriendsStore = FriendsState & FriendsActions;

const initialState: FriendsState = {
  // Friends data
  friends: [],
  pendingRequests: [],
  sentRequests: [],
  friendsCount: 0,
  
  // UI state
  isLoading: false,
  isRefreshing: false,
  isSendingRequest: false,
  isAcceptingRequest: false,
  isDecliningRequest: false,
  
  // Error handling
  error: null,
  hasError: false,
  
  // Cache management
  lastFetchTime: 0,
  friendshipStatuses: new Map(),
  
  // Metrics
  totalFriendsCount: 0,
  pendingCount: 0,
  sentCount: 0,
};

export const useFriendsStore = create<FriendsStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Send friend request
        sendFriendRequest: async (friendId: string) => {
          try {
            set({ isSendingRequest: true, error: null });
            console.log('🤝 Sending friend request to:', friendId);

            const friendshipId = await friendService.sendFriendRequest(friendId);
            
            // Update status cache
            get().updateFriendshipStatusCache(friendId, 'sent');
            
            // Refresh sent requests to show the new request
            await get().fetchSentRequests();
            
            set({ isSendingRequest: false });
            console.log('✅ Friend request sent successfully');
            
          } catch (error: any) {
            console.error('❌ Error sending friend request:', error);
            set({ 
              error: error.message, 
              hasError: true, 
              isSendingRequest: false 
            });
            throw error;
          }
        },

        // Accept friend request
        acceptFriendRequest: async (friendshipId: string) => {
          try {
            set({ isAcceptingRequest: true, error: null });
            console.log('✅ Accepting friend request:', friendshipId);

            await friendService.acceptFriendRequest(friendshipId);
            
            // Optimistically update UI
            get().optimisticallyUpdateRequest(friendshipId, 'accepted');
            
            // Refresh all friend data
            await Promise.all([
              get().fetchFriends(),
              get().fetchPendingRequests()
            ]);
            
            set({ isAcceptingRequest: false });
            console.log('✅ Friend request accepted successfully');
            
          } catch (error: any) {
            console.error('❌ Error accepting friend request:', error);
            set({ 
              error: error.message, 
              hasError: true, 
              isAcceptingRequest: false 
            });
            throw error;
          }
        },

        // Decline friend request
        declineFriendRequest: async (friendshipId: string) => {
          try {
            set({ isDecliningRequest: true, error: null });
            console.log('❌ Declining friend request:', friendshipId);

            await friendService.declineFriendRequest(friendshipId);
            
            // Optimistically update UI
            get().optimisticallyUpdateRequest(friendshipId, 'declined');
            
            // Refresh requests data
            await Promise.all([
              get().fetchPendingRequests(),
              get().fetchSentRequests()
            ]);
            
            set({ isDecliningRequest: false });
            console.log('✅ Friend request declined successfully');
            
          } catch (error: any) {
            console.error('❌ Error declining friend request:', error);
            set({ 
              error: error.message, 
              hasError: true, 
              isDecliningRequest: false 
            });
            throw error;
          }
        },

        // Remove friend
        removeFriend: async (friendId: string) => {
          try {
            set({ isLoading: true, error: null });
            console.log('💔 Removing friend:', friendId);

            // Optimistically remove from UI
            get().optimisticallyRemoveFriend(friendId);
            
            await friendService.removeFriend(friendId);
            
            // Update status cache
            get().updateFriendshipStatusCache(friendId, 'none');
            
            // Refresh friends list
            await get().fetchFriends();
            
            set({ isLoading: false });
            console.log('✅ Friend removed successfully');
            
          } catch (error: any) {
            console.error('❌ Error removing friend:', error);
            set({ 
              error: error.message, 
              hasError: true, 
              isLoading: false 
            });
            // Refresh to restore UI state
            await get().fetchFriends();
            throw error;
          }
        },

        // Fetch friends
        fetchFriends: async () => {
          try {
            set({ isLoading: true, error: null });
            console.log('👥 Fetching friends list');

            // Get regular friends
            const friends = await friendService.getFriends();
            const friendsCount = await friendService.getFriendsCount();
            
            // Also get AI users and add them as available contacts
            try {
              console.log('🤖 Attempting to fetch AI users with get_ai_users...');
              const { data: aiUsers, error: aiError } = await supabase.rpc('get_ai_users');
              console.log('🤖 AI users fetch result:', { error: aiError, dataLength: aiUsers?.length });
              
              if (aiError) {
                console.error('❌ AI users fetch error:', aiError);
              }
              
              if (!aiError && aiUsers && aiUsers.length > 0) {
                console.log('🤖 Adding AI users to friends list:', aiUsers.length);
                console.log('🤖 Sample AI user:', aiUsers[0]);
                
                // Convert AI users to Friend format
                const aiFriends: Friend[] = aiUsers.map((aiUser: any) => ({
                  id: aiUser.user_id,
                  username: aiUser.username,
                  full_name: aiUser.full_name,
                  avatar_url: aiUser.avatar_url,
                  fitness_level: 'intermediate', // Default level for AI users
                  created_at: aiUser.created_at,
                  friendship_id: 'ai-user-' + aiUser.user_id, // Special ID for AI users
                  friendship_created_at: aiUser.created_at,
                  is_mock_user: true, // Flag to identify AI users
                }));
                
                // Add AI users to friends list
                const combinedFriends = [...friends, ...aiFriends];
                
                set({ 
                  friends: combinedFriends, 
                  friendsCount: combinedFriends.length,
                  totalFriendsCount: combinedFriends.length,
                  isLoading: false,
                  lastFetchTime: Date.now()
                });
                
                console.log('✅ Combined friends fetched:', combinedFriends.length, '(including', aiFriends.length, 'AI users)');
              } else {
                // Fallback to regular friends only
                set({ 
                  friends, 
                  friendsCount,
                  totalFriendsCount: friendsCount,
                  isLoading: false,
                  lastFetchTime: Date.now()
                });
                
                console.log('✅ Friends fetched:', friends.length, '(no AI users available)');
              }
            } catch (aiError) {
              console.warn('⚠️ Could not fetch AI users, using regular friends only:', aiError);
              set({ 
                friends, 
                friendsCount,
                totalFriendsCount: friendsCount,
                isLoading: false,
                lastFetchTime: Date.now()
              });
            }
            
          } catch (error: any) {
            console.error('❌ Error fetching friends:', error);
            set({ 
              error: error.message, 
              hasError: true, 
              isLoading: false 
            });
            throw error;
          }
        },

        // Fetch pending requests
        fetchPendingRequests: async () => {
          try {
            console.log('📬 Fetching pending requests');

            const pendingRequests = await friendService.getPendingRequests();
            
            set({ 
              pendingRequests,
              pendingCount: pendingRequests.length
            });
            
            console.log('✅ Pending requests fetched:', pendingRequests.length);
            
          } catch (error: any) {
            console.error('❌ Error fetching pending requests:', error);
            set({ 
              error: error.message, 
              hasError: true 
            });
            throw error;
          }
        },

        // Fetch sent requests
        fetchSentRequests: async () => {
          try {
            console.log('📤 Fetching sent requests');

            const sentRequests = await friendService.getSentRequests();
            
            set({ 
              sentRequests,
              sentCount: sentRequests.length
            });
            
            console.log('✅ Sent requests fetched:', sentRequests.length);
            
          } catch (error: any) {
            console.error('❌ Error fetching sent requests:', error);
            set({ 
              error: error.message, 
              hasError: true 
            });
            throw error;
          }
        },

        // Fetch friends count
        fetchFriendsCount: async (userId?: string) => {
          try {
            const count = await friendService.getFriendsCount(userId);
            
            if (!userId) {
              // Update own friends count
              set({ friendsCount: count, totalFriendsCount: count });
            }
            
            return count;
          } catch (error: any) {
            console.error('❌ Error fetching friends count:', error);
            throw error;
          }
        },

        // Refresh all data
        refreshAllData: async () => {
          try {
            set({ isRefreshing: true, error: null });
            console.log('🔄 Refreshing all friends data');

            await Promise.all([
              get().fetchFriends(),
              get().fetchPendingRequests(),
              get().fetchSentRequests()
            ]);
            
            set({ isRefreshing: false });
            console.log('✅ All friends data refreshed');
            
          } catch (error: any) {
            console.error('❌ Error refreshing friends data:', error);
            set({ 
              error: error.message, 
              hasError: true, 
              isRefreshing: false 
            });
            throw error;
          }
        },

        // Get friendship status
        getFriendshipStatus: async (friendId: string) => {
          try {
            const status = await friendService.getFriendshipStatus(friendId);
            get().updateFriendshipStatusCache(friendId, status);
            return status;
          } catch (error: any) {
            console.error('❌ Error getting friendship status:', error);
            throw error;
          }
        },

        // Check cached friendship status
        checkFriendshipStatusCached: (friendId: string) => {
          const { friendshipStatuses } = get();
          return friendshipStatuses.get(friendId) || null;
        },

        // State management
        setError: (error: string) => {
          set({ error, hasError: true });
        },

        clearError: () => {
          set({ error: null, hasError: false });
        },

        setLoading: (isLoading: boolean) => {
          set({ isLoading });
        },

        resetStore: () => {
          set({ ...initialState, friendshipStatuses: new Map() });
        },

        // Optimistic updates
        optimisticallyAddFriend: (friendId: string, userData: any) => {
          const { friends } = get();
          const newFriend: Friend = {
            id: friendId,
            username: userData.username,
            full_name: userData.full_name,
            avatar_url: userData.avatar_url,
            fitness_level: userData.fitness_level,
            created_at: userData.created_at,
            friendship_id: 'temp-' + Date.now(),
            friendship_created_at: new Date().toISOString()
          };
          
          set({ 
            friends: [newFriend, ...friends],
            friendsCount: friends.length + 1,
            totalFriendsCount: friends.length + 1
          });
        },

        optimisticallyRemoveFriend: (friendId: string) => {
          const { friends } = get();
          const updatedFriends = friends.filter(friend => friend.id !== friendId);
          
          set({ 
            friends: updatedFriends,
            friendsCount: updatedFriends.length,
            totalFriendsCount: updatedFriends.length
          });
        },

        optimisticallyUpdateRequest: (friendshipId: string, newStatus: 'accepted' | 'declined') => {
          const { pendingRequests, sentRequests } = get();
          
          if (newStatus === 'declined') {
            // Remove from both pending and sent requests
            set({
              pendingRequests: pendingRequests.filter(req => req.friendship_id !== friendshipId),
              sentRequests: sentRequests.filter(req => req.friendship_id !== friendshipId),
              pendingCount: Math.max(0, pendingRequests.length - 1),
              sentCount: Math.max(0, sentRequests.length - 1)
            });
          } else if (newStatus === 'accepted') {
            // Remove from pending requests, user becomes friend
            const acceptedRequest = pendingRequests.find(req => req.friendship_id === friendshipId);
            if (acceptedRequest) {
              get().optimisticallyAddFriend(acceptedRequest.user_id, acceptedRequest);
              set({
                pendingRequests: pendingRequests.filter(req => req.friendship_id !== friendshipId),
                pendingCount: Math.max(0, pendingRequests.length - 1)
              });
            }
          }
        },

        // Cache management
        updateFriendshipStatusCache: (friendId: string, status: string) => {
          const { friendshipStatuses } = get();
          const newStatusMap = new Map(friendshipStatuses);
          newStatusMap.set(friendId, status);
          set({ friendshipStatuses: newStatusMap });
        },

        clearStatusCache: () => {
          set({ friendshipStatuses: new Map() });
        },
      }),
      {
        name: 'friends-storage',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          // Only persist essential data, not UI state
          friends: state.friends,
          friendsCount: state.friendsCount,
          totalFriendsCount: state.totalFriendsCount,
          lastFetchTime: state.lastFetchTime,
          // Note: Don't persist pending/sent requests as they change frequently
        }),
        merge: (persistedState, currentState) => {
          // Handle Map serialization/deserialization
          return {
            ...currentState,
            ...persistedState,
            friendshipStatuses: new Map(), // Always start with empty cache
          };
        },
      }
    ),
    {
      name: 'friends-store',
    }
  )
);

export default useFriendsStore;