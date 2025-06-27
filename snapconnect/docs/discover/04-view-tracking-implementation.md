# View Tracking Implementation

## 🎯 Overview

This document provides the technical implementation details for accurately tracking when users view ephemeral content. The challenge is detecting genuine content consumption vs incidental exposure during scrolling.

## 🔍 Core View Detection Strategy

### FlatList Integration

React Native's `FlatList` provides the foundation for view tracking through the `onViewableItemsChanged` callback.

```typescript
// Core FlatList configuration for view tracking
const viewabilityConfig = {
  itemVisiblePercentThreshold: 75, // 75% of item must be visible
  minimumViewTime: 2000,           // Must be visible for 2 seconds
};

const viewabilityConfigCallbackPairs = [
  {
    viewabilityConfig,
    onViewableItemsChanged: handleViewableItemsChanged,
  },
];
```

### ViewTracker Component

A dedicated component that wraps each post to handle view detection logic:

```typescript
import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { useViewTracking } from '../hooks/useViewTracking';

interface ViewTrackerProps {
  postId: string;
  mediaType: 'photo' | 'video';
  children: React.ReactNode;
  onViewed?: (postId: string, duration: number) => void;
}

export const ViewTracker: React.FC<ViewTrackerProps> = ({
  postId,
  mediaType,
  children,
  onViewed,
}) => {
  const [isInViewport, setIsInViewport] = useState(false);
  const viewStartTime = useRef<number | null>(null);
  const hasBeenViewed = useRef(false);
  
  const { markAsViewed } = useViewTracking();
  
  const handleViewabilityChange = useCallback((isVisible: boolean, viewToken: ViewToken) => {
    if (hasBeenViewed.current) return;
    
    if (isVisible) {
      // Started viewing
      setIsInViewport(true);
      viewStartTime.current = Date.now();
    } else if (viewStartTime.current) {
      // Stopped viewing
      setIsInViewport(false);
      const viewDuration = Date.now() - viewStartTime.current;
      
      // Check if view meets criteria
      const meetsThreshold = checkViewCriteria(
        viewDuration,
        viewToken.percent || 0,
        mediaType
      );
      
      if (meetsThreshold) {
        hasBeenViewed.current = true;
        markAsViewed(postId, viewDuration);
        onViewed?.(postId, viewDuration);
      }
      
      viewStartTime.current = null;
    }
  }, [postId, mediaType, markAsViewed, onViewed]);
  
  return (
    <View onLayout={() => {/* Layout tracking if needed */}}>
      {children}
    </View>
  );
};
```

## 🧠 View Criteria Logic

### Smart View Detection

```typescript
interface ViewCriteria {
  minDuration: number;      // Minimum time in ms
  minVisibility: number;    // Minimum % visible (0-1)
  mediaType: 'photo' | 'video';
  scrollVelocity?: number;  // Pixels per second
}

const checkViewCriteria = (
  duration: number,
  visibilityPercent: number,
  mediaType: 'photo' | 'video',
  scrollVelocity: number = 0
): boolean => {
  // Base criteria by media type
  const baseCriteria: Record<string, ViewCriteria> = {
    photo: {
      minDuration: 2000,    // 2 seconds
      minVisibility: 0.75,  // 75% visible
      mediaType: 'photo',
    },
    video: {
      minDuration: 3000,    // 3 seconds
      minVisibility: 0.6,   // 60% visible (videos can be taller)
      mediaType: 'video',
    },
  };
  
  const criteria = baseCriteria[mediaType];
  
  // Check basic criteria
  if (duration < criteria.minDuration) return false;
  if (visibilityPercent < criteria.minVisibility) return false;
  
  // Check scroll velocity (rapid scrolling = not viewing)
  if (scrollVelocity > 1000) return false; // Too fast
  
  return true;
};
```

### Advanced Intent Detection

```typescript
const useScrollVelocityTracking = () => {
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const lastScrollTime = useRef(Date.now());
  const lastScrollY = useRef(0);
  
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const currentTime = Date.now();
    
    const deltaY = Math.abs(currentY - lastScrollY.current);
    const deltaTime = currentTime - lastScrollTime.current;
    
    if (deltaTime > 0) {
      const velocity = deltaY / deltaTime * 1000; // pixels per second
      setScrollVelocity(velocity);
    }
    
    lastScrollY.current = currentY;
    lastScrollTime.current = currentTime;
  }, []);
  
  return { scrollVelocity, onScroll };
};
```

## 🎣 Custom Hooks for View Tracking

### useViewTracking Hook

```typescript
import { useCallback } from 'react';
import { useDiscoverStore } from '../stores/discoverStore';
import { postService } from '../services/postService';

interface ViewData {
  postId: string;
  duration: number;
  timestamp: number;
  deviceType: string;
  appVersion: string;
}

export const useViewTracking = () => {
  const { addViewedPost, batchViewQueue } = useDiscoverStore();
  
  const markAsViewed = useCallback(async (
    postId: string, 
    duration: number,
    metadata?: Partial<ViewData>
  ) => {
    try {
      // Optimistically update local state
      addViewedPost(postId);
      
      // Add to batch queue for server sync
      const viewData: ViewData = {
        postId,
        duration,
        timestamp: Date.now(),
        deviceType: Platform.OS,
        appVersion: '1.0.0', // Get from app config
        ...metadata,
      };
      
      batchViewQueue(viewData);
      
    } catch (error) {
      console.error('Failed to mark post as viewed:', error);
      // Could implement retry logic here
    }
  }, [addViewedPost, batchViewQueue]);
  
  const markMultipleAsViewed = useCallback(async (
    views: Array<{ postId: string; duration: number }>
  ) => {
    try {
      const viewData = views.map(({ postId, duration }) => ({
        postId,
        duration,
        timestamp: Date.now(),
        deviceType: Platform.OS,
        appVersion: '1.0.0',
      }));
      
      // Update local state
      views.forEach(({ postId }) => addViewedPost(postId));
      
      // Batch sync to server
      await postService.batchMarkViewed(viewData);
      
    } catch (error) {
      console.error('Failed to batch mark posts as viewed:', error);
    }
  }, [addViewedPost]);
  
  return {
    markAsViewed,
    markMultipleAsViewed,
  };
};
```

### useVideoViewTracking Hook

Specialized hook for tracking video views with play state awareness:

```typescript
import { useCallback, useRef } from 'react';
import { AVPlaybackStatus } from 'expo-av';

export const useVideoViewTracking = (postId: string) => {
  const playStartTime = useRef<number | null>(null);
  const totalWatchTime = useRef(0);
  const hasBeenViewed = useRef(false);
  
  const { markAsViewed } = useViewTracking();
  
  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    
    if (status.isPlaying && !playStartTime.current) {
      // Started playing
      playStartTime.current = Date.now();
    } else if (!status.isPlaying && playStartTime.current) {
      // Stopped playing
      const sessionTime = Date.now() - playStartTime.current;
      totalWatchTime.current += sessionTime;
      playStartTime.current = null;
      
      // Check if viewed enough to count
      const videoDuration = status.durationMillis || 0;
      const watchPercentage = totalWatchTime.current / videoDuration;
      
      if (!hasBeenViewed.current && (
        totalWatchTime.current >= 3000 || // 3 seconds minimum
        watchPercentage >= 0.5 // 50% of video
      )) {
        hasBeenViewed.current = true;
        markAsViewed(postId, totalWatchTime.current);
      }
    }
  }, [postId, markAsViewed]);
  
  return {
    onPlaybackStatusUpdate,
    totalWatchTime: totalWatchTime.current,
    hasBeenViewed: hasBeenViewed.current,
  };
};
```

## 📱 Implementation in Feed Components

### FlatList Setup

```typescript
import React, { useCallback, useMemo } from 'react';
import { FlatList, ViewToken } from 'react-native';
import { PostFeedCard } from './PostFeedCard';
import { ViewTracker } from './ViewTracker';

export const DiscoverFeed: React.FC = () => {
  const { posts, markPostAsViewed } = useDiscoverStore();
  const { scrollVelocity, onScroll } = useScrollVelocityTracking();
  
  // Memoized viewability config
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 75,
    minimumViewTime: 1000, // Initial detection at 1 second
    waitForInteraction: false,
  }), []);
  
  const handleViewableItemsChanged = useCallback(({ viewableItems }: {
    viewableItems: ViewToken[]
  }) => {
    // This gets called by FlatList, but detailed tracking
    // is handled by individual ViewTracker components
    viewableItems.forEach((item) => {
      console.log(`Post ${item.item.id} is viewable:`, item.isViewable);
    });
  }, []);
  
  const renderPost = useCallback(({ item }: { item: Post }) => (
    <ViewTracker
      key={item.id}
      postId={item.id}
      mediaType={item.media_type}
      onViewed={markPostAsViewed}
    >
      <PostFeedCard 
        post={item} 
        scrollVelocity={scrollVelocity}
      />
    </ViewTracker>
  ), [markPostAsViewed, scrollVelocity]);
  
  return (
    <FlatList
      data={posts}
      renderItem={renderPost}
      keyExtractor={(item) => item.id}
      onScroll={onScroll}
      onViewableItemsChanged={handleViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      removeClippedSubviews={true}
      maxToRenderPerBatch={5}
      initialNumToRender={3}
      windowSize={10}
    />
  );
};
```

### PostFeedCard Integration

```typescript
import React from 'react';
import { View, Image, Text } from 'react-native';
import { Video } from 'expo-av';
import { useVideoViewTracking } from '../hooks/useVideoViewTracking';

interface PostFeedCardProps {
  post: PostWithUser;
  scrollVelocity: number;
}

export const PostFeedCard: React.FC<PostFeedCardProps> = ({ 
  post, 
  scrollVelocity 
}) => {
  const { onPlaybackStatusUpdate } = useVideoViewTracking(post.id);
  
  const renderMedia = () => {
    if (post.media_type === 'video') {
      return (
        <Video
          source={{ uri: post.media_url }}
          style={{ width: '100%', aspectRatio: 16/9 }}
          shouldPlay={scrollVelocity < 500} // Only autoplay if not scrolling fast
          isLooping
          isMuted={true}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />
      );
    } else {
      return (
        <Image
          source={{ uri: post.media_url }}
          style={{ width: '100%', aspectRatio: 1 }}
          resizeMode="cover"
        />
      );
    }
  };
  
  return (
    <View className="mb-4 bg-black/20 rounded-2xl overflow-hidden">
      {/* User header */}
      <View className="flex-row items-center p-4">
        <Image 
          source={{ uri: post.users.avatar_url }} 
          className="w-10 h-10 rounded-full"
        />
        <View className="ml-3">
          <Text className="text-white font-semibold">{post.users.username}</Text>
          <Text className="text-gray-400 text-sm">{post.users.fitness_level}</Text>
        </View>
      </View>
      
      {/* Media content */}
      {renderMedia()}
      
      {/* Post content */}
      {post.content && (
        <View className="p-4">
          <Text className="text-white">{post.content}</Text>
        </View>
      )}
    </View>
  );
};
```

## 🔄 Batch Processing & Sync

### Batched View Tracking

```typescript
interface ViewQueue {
  views: ViewData[];
  lastSync: number;
  maxBatchSize: number;
  syncInterval: number;
}

export const useBatchedViewSync = () => {
  const [viewQueue, setViewQueue] = useState<ViewQueue>({
    views: [],
    lastSync: Date.now(),
    maxBatchSize: 10,
    syncInterval: 5000, // 5 seconds
  });
  
  const addToQueue = useCallback((viewData: ViewData) => {
    setViewQueue(prev => ({
      ...prev,
      views: [...prev.views, viewData],
    }));
  }, []);
  
  const syncQueue = useCallback(async () => {
    if (viewQueue.views.length === 0) return;
    
    try {
      const viewsToSync = [...viewQueue.views];
      
      // Clear queue optimistically
      setViewQueue(prev => ({
        ...prev,
        views: [],
        lastSync: Date.now(),
      }));
      
      // Sync to server
      await postService.batchMarkViewed(viewsToSync);
      console.log(`Synced ${viewsToSync.length} view records`);
      
    } catch (error) {
      console.error('Failed to sync view queue:', error);
      
      // Re-add failed views to queue
      setViewQueue(prev => ({
        ...prev,
        views: [...prev.views, ...viewQueue.views],
      }));
    }
  }, [viewQueue.views]);
  
  // Auto-sync based on time or batch size
  useEffect(() => {
    const shouldSync = 
      viewQueue.views.length >= viewQueue.maxBatchSize ||
      (viewQueue.views.length > 0 && 
       Date.now() - viewQueue.lastSync > viewQueue.syncInterval);
    
    if (shouldSync) {
      syncQueue();
    }
  }, [viewQueue, syncQueue]);
  
  // Sync on app background/foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' && viewQueue.views.length > 0) {
        syncQueue(); // Ensure we sync before backgrounding
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [syncQueue, viewQueue.views.length]);
  
  return {
    addToQueue,
    syncQueue,
    queueSize: viewQueue.views.length,
  };
};
```

## 🐛 Error Handling & Edge Cases

### Network Resilience

```typescript
const useOfflineViewTracking = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [offlineViews, setOfflineViews] = useState<ViewData[]>([]);
  
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !isOnline;
      const isNowOnline = state.isConnected;
      
      setIsOnline(isNowOnline);
      
      // If coming back online, sync offline views
      if (wasOffline && isNowOnline && offlineViews.length > 0) {
        syncOfflineViews();
      }
    });
    
    return unsubscribe;
  }, [isOnline, offlineViews]);
  
  const syncOfflineViews = useCallback(async () => {
    if (offlineViews.length === 0) return;
    
    try {
      await postService.batchMarkViewed(offlineViews);
      setOfflineViews([]);
      console.log(`Synced ${offlineViews.length} offline views`);
    } catch (error) {
      console.error('Failed to sync offline views:', error);
    }
  }, [offlineViews]);
  
  const trackView = useCallback((viewData: ViewData) => {
    if (isOnline) {
      // Normal online tracking
      postService.markPostAsViewed(viewData);
    } else {
      // Store for later sync
      setOfflineViews(prev => [...prev, viewData]);
    }
  }, [isOnline]);
  
  return { trackView, isOnline, offlineViewCount: offlineViews.length };
};
```

### App State Handling

```typescript
const useAppStateViewTracking = () => {
  const pauseViewTracking = useRef(false);
  
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        pauseViewTracking.current = true;
      } else if (nextAppState === 'active') {
        pauseViewTracking.current = false;
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);
  
  return { shouldPauseTracking: pauseViewTracking.current };
};
```

## 🧪 Testing & Debugging

### Debug Mode Component

```typescript
const ViewTrackingDebug: React.FC<{ postId: string }> = ({ postId }) => {
  const [debugInfo, setDebugInfo] = useState({
    isInViewport: false,
    viewDuration: 0,
    hasBeenViewed: false,
    scrollVelocity: 0,
  });
  
  if (!__DEV__) return null;
  
  return (
    <View className="absolute top-2 right-2 bg-black/80 p-2 rounded">
      <Text className="text-white text-xs">ID: {postId.slice(-6)}</Text>
      <Text className="text-white text-xs">Viewing: {debugInfo.isInViewport ? '✅' : '❌'}</Text>
      <Text className="text-white text-xs">Duration: {debugInfo.viewDuration}ms</Text>
      <Text className="text-white text-xs">Viewed: {debugInfo.hasBeenViewed ? '✅' : '❌'}</Text>
      <Text className="text-white text-xs">Velocity: {debugInfo.scrollVelocity.toFixed(0)}</Text>
    </View>
  );
};
```

## 📊 Performance Monitoring

### View Tracking Metrics

```typescript
const useViewTrackingMetrics = () => {
  const [metrics, setMetrics] = useState({
    totalViews: 0,
    averageViewDuration: 0,
    falsePositives: 0,
    networkErrors: 0,
  });
  
  const recordView = useCallback((duration: number, isValid: boolean) => {
    setMetrics(prev => ({
      ...prev,
      totalViews: prev.totalViews + 1,
      averageViewDuration: (prev.averageViewDuration * prev.totalViews + duration) / (prev.totalViews + 1),
      falsePositives: prev.falsePositives + (isValid ? 0 : 1),
    }));
  }, []);
  
  const recordError = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      networkErrors: prev.networkErrors + 1,
    }));
  }, []);
  
  return { metrics, recordView, recordError };
};
```

---

**Status**: Technical implementation defined  
**Key Dependencies**: FlatList, view detection, batch processing  
**Critical Path**: Accurate view detection without performance impact  
**Testing Priority**: View accuracy under various scroll patterns