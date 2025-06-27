# DiscoverStore Implementation

## 🎯 Store Overview

The DiscoverStore manages all state for the ephemeral discover feed using Zustand. It handles post fetching, view tracking, pagination, and the complex logic of filtering out already-viewed content.

## 🏗️ Store Architecture

### Core State Structure
```typescript
interface DiscoverState {
  // Posts data
  posts: PostWithUser[];
  viewedPostIds: Set<string>;
  
  // UI state
  isLoading: boolean;
  isRefreshing: boolean;
  hasError: boolean;
  errorMessage: string | null;
  
  // Pagination
  hasMore: boolean;
  currentPage: number;
  lastFetchTime: number;
  
  // View tracking
  viewQueue: ViewRecord[];
  lastSyncTime: number;
  
  // User state
  allPostsViewed: boolean;
  totalPostsViewed: number;
}

interface DiscoverActions {
  // Core data fetching
  fetchPosts: () => Promise<void>;
  refreshPosts: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  
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
}
```

## 📊 Main Store Implementation

### discoverStore.ts

```typescript
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { postService } from '../services/postService';
import { authStore } from './authStore';

export interface PostWithUser {
  id: string;
  content: string;
  media_url: string;
  media_type: 'photo' | 'video';
  workout_type?: string;
  created_at: string;
  users: {
    username: string;
    full_name: string;
    avatar_url: string;
    fitness_level: 'beginner' | 'intermediate' | 'advanced';
  };
}

export interface ViewRecord {
  postId: string;
  viewedAt: number;
  duration: number;
  deviceType: string;
  appVersion: string;
}

interface DiscoverState {
  // Posts and viewing state
  posts: PostWithUser[];
  viewedPostIds: Set<string>;
  
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

interface DiscoverActions {
  // Core fetching
  fetchPosts: () => Promise<void>;
  refreshPosts: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  
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
  viewedPostIds: new Set(),
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
            const userId = authStore.getState().user?.id;
            if (!userId) {
              throw new Error('User not authenticated');
            }
            
            // Fetch posts from server (already filtered by viewed status)
            const posts = await postService.getUnviewedPosts(userId, state.postsPerPage);
            
            set({
              posts,
              isLoading: false,
              currentPage: 1,
              lastFetchTime: Date.now(),
              hasMore: posts.length === state.postsPerPage,
              allPostsViewed: posts.length === 0,
            });
            
          } catch (error) {
            console.error('Failed to fetch posts:', error);
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
            const userId = authStore.getState().user?.id;
            if (!userId) throw new Error('User not authenticated');
            
            // Sync view queue before refreshing
            await get().syncViewQueue();
            
            // Fetch fresh posts
            const posts = await postService.getUnviewedPosts(userId, state.postsPerPage);
            
            set({
              posts,
              isRefreshing: false,
              currentPage: 1,
              lastFetchTime: Date.now(),
              hasMore: posts.length === state.postsPerPage,
              allPostsViewed: posts.length === 0,
            });
            
          } catch (error) {
            console.error('Failed to refresh posts:', error);
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
            const userId = authStore.getState().user?.id;
            if (!userId) throw new Error('User not authenticated');
            
            const offset = state.currentPage * state.postsPerPage;
            const newPosts = await postService.getUnviewedPosts(
              userId, 
              state.postsPerPage, 
              offset
            );
            
            set({
              posts: [...state.posts, ...newPosts],
              isLoading: false,
              currentPage: state.currentPage + 1,
              hasMore: newPosts.length === state.postsPerPage,
            });
            
          } catch (error) {
            console.error('Failed to load more posts:', error);
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
          if (state.viewedPostIds.has(postId)) return;
          
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
            set({ allPostsViewed: true });
          }
        },
        
        // Add view record to queue for batch processing
        addToViewQueue: (viewRecord: ViewRecord) => {
          const state = get();
          const newQueue = [...state.viewQueue, viewRecord];
          
          set({ viewQueue: newQueue });
          
          // Auto-sync if queue is full or enough time has passed
          const shouldSync = 
            newQueue.length >= state.maxQueueSize ||
            (Date.now() - state.lastSyncTime) > state.syncInterval;
            
          if (shouldSync) {
            get().syncViewQueue();
          }
        },
        
        // Sync view queue to server
        syncViewQueue: async () => {
          const state = get();
          if (state.viewQueue.length === 0) return;
          
          try {
            const queueToSync = [...state.viewQueue];
            
            // Clear queue optimistically
            set({ 
              viewQueue: [],
              lastSyncTime: Date.now(),
            });
            
            // Sync to server
            await postService.batchMarkViewed(queueToSync);
            
            console.log(`Synced ${queueToSync.length} view records`);
            
          } catch (error) {
            console.error('Failed to sync view queue:', error);
            
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
            
          } catch (error) {
            console.error('Failed to batch mark viewed:', error);
            throw error;
          }
        },
        
        // Get only unviewed posts from current list
        getUnviewedPosts: () => {
          const state = get();
          return state.posts.filter(post => !state.viewedPostIds.has(post.id));
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
          set({
            posts: [],
            hasMore: true,
            currentPage: 0,
            allPostsViewed: false,
          });
        },
        
        // Reset entire store to initial state
        resetStore: () => {
          set({
            ...initialState,
            viewedPostIds: new Set(), // Reset viewed posts too
          });
        },
        
        // Error handling
        setError: (error: string) => {
          set({
            hasError: true,
            errorMessage: error,
          });
        },
        
        clearError: () => {
          set({
            hasError: false,
            errorMessage: null,
          });
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
        merge: (persistedState, currentState) => ({
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
```

## 🎣 Custom Hooks

### useDiscoverFeed Hook

```typescript
import { useEffect, useCallback } from 'react';
import { useDiscoverStore } from '../stores/discoverStore';
import { useNetInfo } from '@react-native-community/netinfo';

export const useDiscoverFeed = () => {
  const {
    posts,
    isLoading,
    isRefreshing,
    hasError,
    hasMore,
    allPostsViewed,
    fetchPosts,
    refreshPosts,
    loadMorePosts,
    syncViewQueue,
    clearError,
    getUnviewedPosts,
  } = useDiscoverStore();
  
  const netInfo = useNetInfo();
  
  // Initial load
  useEffect(() => {
    if (posts.length === 0 && !isLoading) {
      fetchPosts();
    }
  }, []);
  
  // Sync view queue when coming online
  useEffect(() => {
    if (netInfo.isConnected && !isLoading) {
      syncViewQueue();
    }
  }, [netInfo.isConnected]);
  
  // Auto-refresh every 5 minutes if no new content
  useEffect(() => {
    if (allPostsViewed) {
      const interval = setInterval(() => {
        refreshPosts();
      }, 300000); // 5 minutes
      
      return () => clearInterval(interval);
    }
  }, [allPostsViewed, refreshPosts]);
  
  const handleRefresh = useCallback(async () => {
    clearError();
    await refreshPosts();
  }, [refreshPosts, clearError]);
  
  const handleLoadMore = useCallback(async () => {
    if (hasMore && !isLoading) {
      await loadMorePosts();
    }
  }, [hasMore, isLoading, loadMorePosts]);
  
  return {
    posts: getUnviewedPosts(),
    isLoading,
    isRefreshing,
    hasError,
    hasMore,
    allPostsViewed,
    onRefresh: handleRefresh,
    onLoadMore: handleLoadMore,
  };
};
```

### useViewTracking Hook

```typescript
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useDiscoverStore } from '../stores/discoverStore';
import { getVersion } from 'react-native-device-info';

export const useViewTracking = () => {
  const { markPostAsViewed, addToViewQueue } = useDiscoverStore();
  
  const trackView = useCallback(async (
    postId: string,
    duration: number,
    metadata?: Partial<ViewRecord>
  ) => {
    try {
      // Optimistically update local state
      markPostAsViewed(postId);
      
      // Add to sync queue
      const viewRecord: ViewRecord = {
        postId,
        viewedAt: Date.now(),
        duration,
        deviceType: Platform.OS,
        appVersion: await getVersion(),
        ...metadata,
      };
      
      addToViewQueue(viewRecord);
      
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  }, [markPostAsViewed, addToViewQueue]);
  
  return { trackView };
};
```

### useDiscoverMetrics Hook

```typescript
export const useDiscoverMetrics = () => {
  const {
    getViewStats,
    totalPostsViewed,
    sessionViewCount,
    allPostsViewed,
    posts,
  } = useDiscoverStore();
  
  const stats = getViewStats();
  
  const metrics = {
    // Session metrics
    sessionViews: sessionViewCount,
    totalViews: totalPostsViewed,
    
    // Current feed metrics
    postsInFeed: posts.length,
    viewedInFeed: stats.viewed,
    unviewedInFeed: stats.total - stats.viewed,
    completionPercentage: stats.percentage,
    
    // Status
    isComplete: allPostsViewed,
    hasContent: posts.length > 0,
  };
  
  return metrics;
};
```

## 🔄 Background Processing

### View Queue Auto-Sync

```typescript
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDiscoverStore } from '../stores/discoverStore';

export const useBackgroundSync = () => {
  const { syncViewQueue, viewQueue } = useDiscoverStore();
  const appState = useRef(AppState.currentState);
  
  // Sync when app goes to background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (
        appState.current.match(/active|foreground/) &&
        nextAppState === 'background' &&
        viewQueue.length > 0
      ) {
        // Sync immediately before backgrounding
        syncViewQueue().catch(console.error);
      }
      
      appState.current = nextAppState;
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [syncViewQueue, viewQueue.length]);
  
  // Periodic sync while app is active
  useEffect(() => {
    const interval = setInterval(() => {
      if (viewQueue.length > 0) {
        syncViewQueue().catch(console.error);
      }
    }, 30000); // Sync every 30 seconds
    
    return () => clearInterval(interval);
  }, [syncViewQueue, viewQueue.length]);
};
```

## 🧪 Testing Utilities

### Store Testing Helpers

```typescript
import { act, renderHook } from '@testing-library/react-hooks';
import { useDiscoverStore } from './discoverStore';

export const createMockPost = (overrides = {}): PostWithUser => ({
  id: 'test-post-1',
  content: 'Test post content',
  media_url: 'https://example.com/image.jpg',
  media_type: 'photo',
  created_at: '2024-01-01T12:00:00Z',
  users: {
    username: 'testuser',
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    fitness_level: 'intermediate',
  },
  ...overrides,
});

export const setupStoreTest = () => {
  const { result } = renderHook(() => useDiscoverStore());
  
  // Reset store before each test
  act(() => {
    result.current.resetStore();
  });
  
  return result;
};

// Test store state changes
export const testStoreAction = async (
  store: ReturnType<typeof setupStoreTest>,
  action: () => Promise<void> | void,
  expectedChanges: Partial<DiscoverState>
) => {
  await act(async () => {
    await action();
  });
  
  Object.entries(expectedChanges).forEach(([key, value]) => {
    expect(store.current[key]).toEqual(value);
  });
};
```

## 📊 Performance Monitoring

### Store Performance Metrics

```typescript
export const useStorePerformance = () => {
  const store = useDiscoverStore();
  const [metrics, setMetrics] = useState({
    fetchTime: 0,
    syncTime: 0,
    queueSize: 0,
    memoryUsage: 0,
  });
  
  useEffect(() => {
    const updateMetrics = () => {
      setMetrics({
        fetchTime: Date.now() - store.lastFetchTime,
        syncTime: Date.now() - store.lastSyncTime,
        queueSize: store.viewQueue.length,
        memoryUsage: store.posts.length * 1024, // Rough estimate
      });
    };
    
    const interval = setInterval(updateMetrics, 5000);
    return () => clearInterval(interval);
  }, [store]);
  
  return metrics;
};
```

## 🔗 Integration Examples

### With React Components

```typescript
// In DiscoverScreen component
export const DiscoverScreen = () => {
  const { posts, isLoading, onRefresh, onLoadMore } = useDiscoverFeed();
  const { trackView } = useViewTracking();
  
  useBackgroundSync(); // Enable background syncing
  
  const handlePostViewed = useCallback((postId: string) => {
    trackView(postId, 2000); // 2 second view
  }, [trackView]);
  
  return (
    <FlatList
      data={posts}
      renderItem={({ item }) => (
        <PostFeedCard 
          post={item} 
          onViewed={handlePostViewed}
        />
      )}
      onRefresh={onRefresh}
      refreshing={isLoading}
      onEndReached={onLoadMore}
    />
  );
};
```

### With Analytics

```typescript
// Track store metrics for analytics
export const useStoreAnalytics = () => {
  const metrics = useDiscoverMetrics();
  
  useEffect(() => {
    analytics.track('discover_session_metrics', {
      sessionViews: metrics.sessionViews,
      completionPercentage: metrics.completionPercentage,
      postsInFeed: metrics.postsInFeed,
    });
  }, [metrics.sessionViews]); // Track when session views change
};
```

---

**Status**: Store implementation defined  
**State Management**: Zustand with persistence and devtools  
**Key Features**: View tracking, pagination, offline support  
**Performance**: Optimized for large datasets with batching