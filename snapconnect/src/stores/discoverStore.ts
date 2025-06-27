import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { Platform } from 'react-native'; // Not used in this file
import { postService, PostWithUser, ViewRecord } from '../services/postService';
import { ScoredPost } from '../services/feedRankingService';
import { feedPrefetchService } from '../services/feedPrefetchService';

export interface DiscoverState {
  // Posts and viewing state
  posts: PostWithUser[];
  rankedPosts: ScoredPost[];
  viewedPostIds: Set<string>;
  
  // Feed settings
  useAlgorithmicRanking: boolean;
  
  // UI state
  isLoading: boolean;
  isRefreshing: boolean;
  hasError: boolean;
  errorMessage: string | null;
  
  // Pagination
  hasMore: boolean;
  currentPage: number;
  lastFetchTime: number;
  postsPerPage: number;
  
  // View tracking
  viewQueue: ViewRecord[];
  lastSyncTime: number;
  maxQueueSize: number;
  syncInterval: number;
  
  // Metrics
  allPostsViewed: boolean;
  totalPostsViewed: number;
  sessionViewCount: number;
}

export interface DiscoverActions {
  // Core fetching
  fetchPosts: () => Promise<void>;
  refreshPosts: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  
  // Feed settings
  toggleAlgorithmicRanking: () => void;
  setAlgorithmicRanking: (enabled: boolean) => void;
  
  // Smart prefetching
  triggerSmartPrefetch: (currentIndex: number, scrollVelocity: number) => Promise<void>;
  triggerPredictivePrefetch: (scrollHistory: number[], currentPosition: number) => Promise<void>;
  
  // View tracking
  markPostAsViewed: (postId: string) => void;
  batchMarkViewed: (viewRecords: ViewRecord[]) => Promise<void>;
  addToViewQueue: (viewRecord: ViewRecord) => void;
  syncViewQueue: () => Promise<void>;
  
  // State management
  clearPosts: () => void;
  resetStore: () => void;
  setError: (error: string) => void;
  clearError: () => void;
  
  // Utility
  getUnviewedPosts: () => PostWithUser[];
  isPostViewed: (postId: string) => boolean;
  getViewStats: () => { viewed: number; total: number; percentage: number };
}

type DiscoverStore = DiscoverState & DiscoverActions;

const initialState: DiscoverState = {
  posts: [],
  rankedPosts: [],
  viewedPostIds: new Set(),
  useAlgorithmicRanking: true, // Enable by default
  isLoading: false,
  isRefreshing: false,
  hasError: false,
  errorMessage: null,
  hasMore: true,
  currentPage: 0,
  lastFetchTime: 0,
  postsPerPage: 20,
  viewQueue: [],
  lastSyncTime: 0,
  maxQueueSize: 10,
  syncInterval: 5000, // 5 seconds
  allPostsViewed: false,
  totalPostsViewed: 0,
  sessionViewCount: 0,
};

export const useDiscoverStore = create<DiscoverStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        // Fetch initial posts
        fetchPosts: async () => {
          const state = get();
          if (state.isLoading) return;
          
          set({ isLoading: true, hasError: false, errorMessage: null });
          
          try {
            // Get current user from auth (you'll need to import your auth store)
            // For now, we'll assume you have a way to get the current user ID
            const userId = await getCurrentUserId();
            if (!userId) {
              throw new Error('User not authenticated');
            }
            
            console.log(`🔍 Fetching ${state.useAlgorithmicRanking ? 'ranked' : 'chronological'} posts for user:`, userId);
            
            // Fetch posts from server (ranked or chronological)
            if (state.useAlgorithmicRanking) {
              const rankedPosts = await postService.getRankedUnviewedPosts(userId, state.postsPerPage);
              
              console.log(`🎯 Fetched ${rankedPosts.length} ranked posts`);
              
              set({
                rankedPosts,
                posts: rankedPosts, // Also populate regular posts for backward compatibility
                isLoading: false,
                currentPage: 1,
                lastFetchTime: Date.now(),
                hasMore: rankedPosts.length === state.postsPerPage,
                allPostsViewed: rankedPosts.length === 0,
              });
            } else {
              const posts = await postService.getUnviewedPosts(userId, state.postsPerPage);
              
              console.log(`🔍 Fetched ${posts.length} chronological posts`);
              
              set({
                posts,
                rankedPosts: [], // Clear ranked posts when using chronological
                isLoading: false,
                currentPage: 1,
                lastFetchTime: Date.now(),
                hasMore: posts.length === state.postsPerPage,
                allPostsViewed: posts.length === 0,
              });
            }
            
          } catch (error) {
            console.error('❌ Failed to fetch posts:', error);
            set({
              isLoading: false,
              hasError: true,
              errorMessage: error instanceof Error ? error.message : 'Failed to fetch posts',
            });
          }
        },
        
        // Refresh posts (pull-to-refresh)
        refreshPosts: async () => {
          const state = get();
          if (state.isRefreshing) return;
          
          set({ isRefreshing: true, hasError: false });
          
          try {
            const userId = await getCurrentUserId();
            if (!userId) throw new Error('User not authenticated');
            
            console.log('🔄 Refreshing posts...');
            
            // Sync view queue before refreshing
            await get().syncViewQueue();
            
            // Fetch fresh posts
            const posts = await postService.getUnviewedPosts(userId, state.postsPerPage);
            
            console.log(`🔄 Refreshed with ${posts.length} unviewed posts`);
            
            // Clear local viewed state on refresh to show fresh content
            console.log('🧹 Clearing local viewed state for fresh content');
            
            set({
              posts,
              isRefreshing: false,
              currentPage: 1,
              lastFetchTime: Date.now(),
              hasMore: posts.length === state.postsPerPage,
              allPostsViewed: posts.length === 0,
              viewedPostIds: new Set(), // Clear viewed state on refresh
            });
            
          } catch (error) {
            console.error('❌ Failed to refresh posts:', error);
            set({
              isRefreshing: false,
              hasError: true,
              errorMessage: error instanceof Error ? error.message : 'Failed to refresh posts',
            });
          }
        },
        
        // Load more posts (pagination)
        loadMorePosts: async () => {
          const state = get();
          if (state.isLoading || !state.hasMore) return;
          
          set({ isLoading: true });
          
          try {
            const userId = await getCurrentUserId();
            if (!userId) throw new Error('User not authenticated');
            
            const offset = state.currentPage * state.postsPerPage;
            console.log(`📄 Loading more posts (page ${state.currentPage + 1}, offset ${offset})`);
            
            const newPosts = await postService.getUnviewedPosts(
              userId, 
              state.postsPerPage, 
              offset
            );
            
            console.log(`📄 Loaded ${newPosts.length} more posts`);
            
            set({
              posts: [...state.posts, ...newPosts],
              isLoading: false,
              currentPage: state.currentPage + 1,
              hasMore: newPosts.length === state.postsPerPage,
            });
            
          } catch (error) {
            console.error('❌ Failed to load more posts:', error);
            set({
              isLoading: false,
              hasError: true,
              errorMessage: error instanceof Error ? error.message : 'Failed to load more posts',
            });
          }
        },
        
        // Mark single post as viewed (optimistic update)
        markPostAsViewed: (postId: string) => {
          const state = get();
          
          // Don't mark twice
          if (state.viewedPostIds.has(postId)) {
            console.log(`👁️ Post ${postId} already marked as viewed`);
            return;
          }
          
          console.log(`👁️ Marking post ${postId} as viewed (optimistic)`);
          
          const newViewedIds = new Set(state.viewedPostIds);
          newViewedIds.add(postId);
          
          set({
            viewedPostIds: newViewedIds,
            totalPostsViewed: state.totalPostsViewed + 1,
            sessionViewCount: state.sessionViewCount + 1,
          });
          
          // Check if all current posts are viewed
          const unviewedCount = state.posts.filter(post => !newViewedIds.has(post.id)).length;
          if (unviewedCount === 0) {
            console.log('🎉 All posts viewed in current feed');
            set({ allPostsViewed: true });
          }
        },
        
        // Add view record to queue for batch processing
        addToViewQueue: (viewRecord: ViewRecord) => {
          const state = get();
          const newQueue = [...state.viewQueue, viewRecord];
          
          console.log(`📝 Adding view to queue: ${viewRecord.postId} (queue size: ${newQueue.length})`);
          
          set({ viewQueue: newQueue });
          
          // Auto-sync if queue is full or enough time has passed
          const shouldSync = 
            newQueue.length >= state.maxQueueSize ||
            (Date.now() - state.lastSyncTime) > state.syncInterval;
            
          if (shouldSync) {
            console.log('⚡ Auto-syncing view queue');
            get().syncViewQueue();
          }
        },
        
        // Sync view queue to server
        syncViewQueue: async () => {
          const state = get();
          if (state.viewQueue.length === 0) return;
          
          try {
            const queueToSync = [...state.viewQueue];
            console.log(`🔄 Syncing ${queueToSync.length} view records to server`);
            
            // Clear queue optimistically
            set({ 
              viewQueue: [],
              lastSyncTime: Date.now(),
            });
            
            // Sync to server
            await postService.batchMarkViewed(queueToSync);
            
            console.log(`✅ Successfully synced ${queueToSync.length} view records`);
            
          } catch (error) {
            console.error('❌ Failed to sync view queue:', error);
            
            // Re-add failed views to queue
            const state = get();
            set({
              viewQueue: [...state.viewQueue, ...state.viewQueue],
            });
          }
        },
        
        // Batch mark multiple posts as viewed
        batchMarkViewed: async (viewRecords: ViewRecord[]) => {
          try {
            console.log(`👁️ Batch marking ${viewRecords.length} posts as viewed`);
            
            // Update local state optimistically
            const state = get();
            const newViewedIds = new Set(state.viewedPostIds);
            viewRecords.forEach(record => newViewedIds.add(record.postId));
            
            set({
              viewedPostIds: newViewedIds,
              totalPostsViewed: state.totalPostsViewed + viewRecords.length,
            });
            
            // Sync to server
            await postService.batchMarkViewed(viewRecords);
            
            console.log(`✅ Successfully batch marked ${viewRecords.length} posts`);
            
          } catch (error) {
            console.error('❌ Failed to batch mark viewed:', error);
            throw error;
          }
        },
        
        // Get only unviewed posts from current list
        getUnviewedPosts: () => {
          const state = get();
          const unviewed = state.posts.filter(post => !state.viewedPostIds.has(post.id));
          console.log(`📊 ${unviewed.length} unviewed posts out of ${state.posts.length} total`);
          return unviewed;
        },
        
        // Check if specific post is viewed
        isPostViewed: (postId: string) => {
          return get().viewedPostIds.has(postId);
        },
        
        // Get viewing statistics
        getViewStats: () => {
          const state = get();
          const totalPosts = state.posts.length;
          const viewedCount = state.posts.filter(post => 
            state.viewedPostIds.has(post.id)
          ).length;
          
          return {
            viewed: viewedCount,
            total: totalPosts,
            percentage: totalPosts > 0 ? (viewedCount / totalPosts) * 100 : 0,
          };
        },
        
        // Clear all posts (but keep viewed IDs for session)
        clearPosts: () => {
          console.log('🗑️ Clearing posts');
          set({
            posts: [],
            hasMore: true,
            currentPage: 0,
            allPostsViewed: false,
          });
        },
        
        // Reset entire store to initial state
        resetStore: () => {
          console.log('🔄 Resetting discover store');
          set({
            ...initialState,
            viewedPostIds: new Set(), // Reset viewed posts too
          });
        },
        
        // Error handling
        setError: (error: string) => {
          console.error('❌ Setting error:', error);
          set({
            hasError: true,
            errorMessage: error,
          });
        },
        
        clearError: () => {
          console.log('✅ Clearing error');
          set({
            hasError: false,
            errorMessage: null,
          });
        },
        
        // Feed settings
        toggleAlgorithmicRanking: () => {
          const state = get();
          const newValue = !state.useAlgorithmicRanking;
          console.log(`🎯 Toggling algorithmic ranking: ${newValue ? 'ON' : 'OFF'}`);
          
          set({ 
            useAlgorithmicRanking: newValue,
            posts: [], // Clear posts to force refetch
            rankedPosts: [],
            allPostsViewed: false,
          });
          
          // Automatically refresh with new algorithm
          get().refreshPosts();
        },
        
        setAlgorithmicRanking: (enabled: boolean) => {
          const state = get();
          if (state.useAlgorithmicRanking === enabled) return; // No change needed
          
          console.log(`🎯 Setting algorithmic ranking: ${enabled ? 'ON' : 'OFF'}`);
          
          set({ 
            useAlgorithmicRanking: enabled,
            posts: [], // Clear posts to force refetch
            rankedPosts: [],
            allPostsViewed: false,
          });
          
          // Clear prefetch cache when changing algorithms
          feedPrefetchService.clearCache();
          
          // Automatically refresh with new algorithm
          get().refreshPosts();
        },

        // Smart prefetching
        triggerSmartPrefetch: async (currentIndex: number, scrollVelocity: number) => {
          const state = get();
          
          try {
            const userId = await getCurrentUserId();
            if (!userId) return;

            const prefetchedPosts = await feedPrefetchService.smartPrefetch(
              currentIndex,
              state.posts.length,
              userId,
              state.currentPage,
              scrollVelocity,
              state.useAlgorithmicRanking
            );

            if (prefetchedPosts.length > 0) {
              console.log(`🚀 Smart prefetch completed: ${prefetchedPosts.length} posts`);
              
              // Optionally add prefetched posts to the store
              // (or keep them only in cache for now)
              if (state.useAlgorithmicRanking) {
                const newRankedPosts = [...state.rankedPosts, ...prefetchedPosts];
                set({
                  rankedPosts: newRankedPosts,
                  posts: newRankedPosts,
                  hasMore: prefetchedPosts.length === state.postsPerPage,
                });
              } else {
                const newPosts = [...state.posts, ...prefetchedPosts];
                set({
                  posts: newPosts,
                  hasMore: prefetchedPosts.length === state.postsPerPage,
                });
              }
            }
          } catch (error) {
            console.error('🚀 Smart prefetch failed:', error);
          }
        },

        triggerPredictivePrefetch: async (scrollHistory: number[], currentPosition: number) => {
          const state = get();
          
          try {
            const userId = await getCurrentUserId();
            if (!userId) return;

            const prefetchedPosts = await feedPrefetchService.predictivePrefetch(
              scrollHistory,
              currentPosition,
              userId,
              state.currentPage,
              state.useAlgorithmicRanking
            );

            if (prefetchedPosts.length > 0) {
              console.log(`🔮 Predictive prefetch completed: ${prefetchedPosts.length} posts`);
            }
          } catch (error) {
            console.error('🔮 Predictive prefetch failed:', error);
          }
        },
      }),
      {
        name: 'discover-store',
        storage: createJSONStorage(() => AsyncStorage),
        // Only persist viewed post IDs and user metrics
        partialize: (state) => ({
          viewedPostIds: Array.from(state.viewedPostIds), // Convert Set to Array for JSON
          totalPostsViewed: state.totalPostsViewed,
        }),
        // Merge persisted data back to state
        merge: (persistedState: any, currentState) => ({
          ...currentState,
          ...persistedState,
          viewedPostIds: new Set(persistedState?.viewedPostIds || []), // Convert back to Set
        }),
      }
    ),
    {
      name: 'discover-store',
    }
  )
);

// Helper function to get current user ID
// This should be replaced with your actual auth implementation
const getCurrentUserId = async (): Promise<string | null> => {
  try {
    // This is a placeholder - replace with your actual auth store/service
    // For example: return authStore.getState().user?.id || null;
    
    // For now, let's try to get it from Supabase auth
    const { supabase } = await import('../services/supabase');
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (error) {
    console.error('Failed to get current user ID:', error);
    return null;
  }
};

// Export types for external use
export type { DiscoverState, DiscoverActions };