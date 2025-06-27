import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
type AppStateStatus = string;
import { useDiscoverStore } from '../stores/discoverStore';
import { PostWithUser } from '../services/postService';

export interface DiscoverFeedConfig {
  // Refresh behavior
  autoRefreshInterval: number; // milliseconds
  enableBackgroundSync: boolean;
  enablePullToRefresh: boolean;
  
  // Pagination
  postsPerPage: number;
  prefetchThreshold: number; // Load more when this many posts from end
  
  // Performance
  enableVirtualization: boolean;
  maxConcurrentRequests: number;
  
  // View tracking
  enableViewTracking: boolean;
  batchViewUpdates: boolean;
  
  // Error handling
  maxRetries: number;
  retryDelay: number; // milliseconds
}

export interface UseDiscoverFeedOptions {
  config?: Partial<DiscoverFeedConfig>;
  onPostViewed?: (postId: string) => void;
  onError?: (error: Error) => void;
  onEmpty?: () => void;
  onAllViewed?: () => void;
  enabled?: boolean;
}

const DEFAULT_CONFIG: DiscoverFeedConfig = {
  autoRefreshInterval: 5 * 60 * 1000, // 5 minutes
  enableBackgroundSync: true,
  enablePullToRefresh: true,
  postsPerPage: 20,
  prefetchThreshold: 5,
  enableVirtualization: true,
  maxConcurrentRequests: 3,
  enableViewTracking: true,
  batchViewUpdates: true,
  maxRetries: 3,
  retryDelay: 1000,
};

export const useDiscoverFeed = (options: UseDiscoverFeedOptions = {}) => {
  const {
    config: userConfig = {},
    onPostViewed,
    onError,
    onEmpty,
    onAllViewed,
    enabled = true,
  } = options;

  const config = { ...DEFAULT_CONFIG, ...userConfig };
  
  const {
    // State
    posts,
    isLoading,
    isRefreshing,
    hasError,
    errorMessage,
    hasMore,
    allPostsViewed,
    sessionViewCount,
    
    // Actions
    fetchPosts,
    refreshPosts,
    loadMorePosts,
    markPostAsViewed,
    addToViewQueue,
    syncViewQueue,
    clearError,
    getUnviewedPosts,
    getViewStats,
    resetStore,
  } = useDiscoverStore();

  // Refs for managing intervals and state
  const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');
  const retryCount = useRef(0);
  const lastSyncTime = useRef(0);

  // Computed values
  const unviewedPosts = useMemo(() => getUnviewedPosts(), [getUnviewedPosts]);
  const viewStats = useMemo(() => getViewStats(), [getViewStats]);
  const isEmpty = posts.length === 0 && !isLoading && !hasError;
  const shouldShowEmpty = isEmpty && enabled;
  const shouldShowAllViewed = allPostsViewed && posts.length > 0;

  // Initialize feed
  const initializeFeed = useCallback(async () => {
    if (!enabled || isLoading) return;
    
    try {
      retryCount.current = 0;
      await fetchPosts();
    } catch (error) {
      console.error('Failed to initialize discover feed:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to initialize feed'));
    }
  }, [enabled, isLoading, fetchPosts, onError]);

  // Handle refresh with error handling and retries
  const handleRefresh = useCallback(async () => {
    if (!enabled) return;
    
    try {
      clearError();
      retryCount.current = 0;
      await refreshPosts();
    } catch (error) {
      console.error('Failed to refresh posts:', error);
      
      // Retry logic
      if (retryCount.current < config.maxRetries) {
        retryCount.current++;
        setTimeout(() => {
          handleRefresh();
        }, config.retryDelay * retryCount.current);
      } else {
        onError?.(error instanceof Error ? error : new Error('Failed to refresh posts'));
      }
    }
  }, [enabled, refreshPosts, clearError, config.maxRetries, config.retryDelay, onError]);

  // Handle load more with smart prefetching
  const handleLoadMore = useCallback(async () => {
    if (!enabled || isLoading || !hasMore || allPostsViewed) return;
    
    try {
      await loadMorePosts();
    } catch (error) {
      console.error('Failed to load more posts:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to load more posts'));
    }
  }, [enabled, isLoading, hasMore, allPostsViewed, loadMorePosts, onError]);

  // Smart prefetch based on scroll position
  const shouldPrefetch = useCallback((currentIndex: number, totalItems: number) => {
    const remainingItems = totalItems - currentIndex;
    return remainingItems <= config.prefetchThreshold && hasMore && !isLoading;
  }, [config.prefetchThreshold, hasMore, isLoading]);

  // Handle post viewed with batching
  const handlePostViewed = useCallback((postId: string) => {
    if (!config.enableViewTracking) return;
    
    markPostAsViewed(postId);
    onPostViewed?.(postId);
    
    // Check if all posts are now viewed
    const updatedUnviewed = unviewedPosts.filter(post => post.id !== postId);
    if (updatedUnviewed.length === 0 && posts.length > 0) {
      onAllViewed?.();
    }
  }, [
    config.enableViewTracking,
    markPostAsViewed,
    onPostViewed,
    unviewedPosts,
    posts.length,
    onAllViewed,
  ]);

  // Auto-sync view queue
  const handleAutoSync = useCallback(async () => {
    if (!config.batchViewUpdates) return;
    
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTime.current;
    
    // Sync every 30 seconds or when app becomes active
    if (timeSinceLastSync > 30000 || appStateRef.current === 'active') {
      try {
        await syncViewQueue();
        lastSyncTime.current = now;
      } catch (error) {
        console.error('Failed to sync view queue:', error);
      }
    }
  }, [config.batchViewUpdates, syncViewQueue]);

  // Handle app state changes
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    const previousState = appStateRef.current;
    appStateRef.current = nextAppState;
    
    if (previousState.match(/inactive|background/) && nextAppState === 'active') {
      // App became active - sync and potentially refresh
      handleAutoSync();
      
      if (config.enableBackgroundSync) {
        const timeSinceLastRefresh = Date.now() - lastSyncTime.current;
        if (timeSinceLastRefresh > config.autoRefreshInterval) {
          handleRefresh();
        }
      }
    } else if (nextAppState.match(/inactive|background/)) {
      // App going to background - sync pending views
      handleAutoSync();
    }
  }, [handleAutoSync, handleRefresh, config.enableBackgroundSync, config.autoRefreshInterval]);

  // Setup auto-refresh interval
  useEffect(() => {
    if (!enabled || !config.autoRefreshInterval) return;
    
    autoRefreshInterval.current = setInterval(() => {
      if (appStateRef.current === 'active') {
        handleRefresh();
      }
    }, config.autoRefreshInterval);
    
    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
      }
    };
  }, [enabled, config.autoRefreshInterval, handleRefresh]);

  // Setup app state listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [handleAppStateChange]);

  // Initialize on mount
  useEffect(() => {
    if (enabled && posts.length === 0 && !isLoading && !hasError) {
      initializeFeed();
    }
  }, [enabled, posts.length, isLoading, hasError, initializeFeed]);

  // Handle empty state callback
  useEffect(() => {
    if (shouldShowEmpty) {
      onEmpty?.();
    }
  }, [shouldShowEmpty, onEmpty]);

  // Handle all viewed callback
  useEffect(() => {
    if (shouldShowAllViewed) {
      onAllViewed?.();
    }
  }, [shouldShowAllViewed, onAllViewed]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (autoRefreshInterval.current) {
      clearInterval(autoRefreshInterval.current);
    }
    
    // Sync any pending views before cleanup
    syncViewQueue().catch(console.error);
  }, [syncViewQueue]);

  // Reset feed (useful for logout or major state changes)
  const resetFeed = useCallback(() => {
    resetStore();
    retryCount.current = 0;
    lastSyncTime.current = 0;
  }, [resetStore]);

  return {
    // Posts data
    posts: enabled ? unviewedPosts : [],
    allPosts: posts,
    
    // Loading states
    isLoading,
    isRefreshing,
    isEmpty: shouldShowEmpty,
    allViewed: shouldShowAllViewed,
    
    // Error handling
    hasError,
    errorMessage,
    
    // Pagination
    hasMore,
    canLoadMore: hasMore && !isLoading && !allPostsViewed,
    
    // Stats
    viewStats,
    sessionViewCount,
    
    // Actions
    refresh: handleRefresh,
    loadMore: handleLoadMore,
    onPostViewed: handlePostViewed,
    resetFeed,
    
    // Utilities
    shouldPrefetch,
    cleanup,
    
    // Config
    config,
    
    // Debug info
    debug: {
      retryCount: retryCount.current,
      lastSyncTime: lastSyncTime.current,
      appState: appStateRef.current,
      enabled,
    },
  };
};