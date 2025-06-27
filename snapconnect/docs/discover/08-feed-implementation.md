# Feed Implementation Guide

## 🎯 Overview

This document covers the complete implementation of the discover feed screen, integrating all components (PostFeedCard, DiscoverStore, ViewTracker, Security) into a performant, user-friendly experience.

## 🏗️ Screen Architecture

### Component Hierarchy
```
DiscoverScreen
├── SecurityProvider (App-level security context)
├── SafeAreaProvider (Screen boundaries)
├── LinearGradient (Background)
├── StatusBar (Customized)
├── Header (Title, refresh indicator)
├── FeedContainer
│   ├── FlatList (Performance-optimized)
│   │   ├── PostFeedCard (Wrapped in ViewTracker)
│   │   └── LoadingSkeletons
│   ├── EmptyState (No content available)
│   ├── ErrorState (Network/loading errors)
│   └── EndOfFeedState (All content viewed)
└── OfflineIndicator (Network status)
```

## 📱 Main Screen Implementation

### DiscoverScreen.tsx

```typescript
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StatusBar,
  Dimensions,
  ListRenderItem,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useDiscoverFeed } from '../hooks/useDiscoverFeed';
import { useViewTracking } from '../hooks/useViewTracking';
import { useScrollVelocity } from '../hooks/useScrollVelocity';
import { PostFeedCard, PostWithUser } from '../components/discover/PostFeedCard';
import { SecurityProvider } from '../contexts/SecurityContext';
import { FeedHeader } from '../components/discover/FeedHeader';
import { EmptyFeedState } from '../components/discover/EmptyFeedState';
import { ErrorState } from '../components/discover/ErrorState';
import { LoadingSkeleton } from '../components/discover/LoadingSkeleton';
import { EndOfFeedIndicator } from '../components/discover/EndOfFeedIndicator';
import { OfflineIndicator } from '../components/discover/OfflineIndicator';

const { height: screenHeight } = Dimensions.get('window');

export const DiscoverScreen: React.FC = () => {
  const {
    posts,
    isLoading,
    isRefreshing,
    hasError,
    hasMore,
    allPostsViewed,
    onRefresh,
    onLoadMore,
  } = useDiscoverFeed();
  
  const { trackView } = useViewTracking();
  const { scrollVelocity, onScroll } = useScrollVelocity();
  
  // Handle post viewed callback
  const handlePostViewed = useCallback((postId: string) => {
    trackView(postId, 2000); // Mark as viewed after 2 seconds
  }, [trackView]);
  
  // Memoized FlatList configuration
  const flatListConfig = useMemo(() => ({
    // Performance optimizations
    removeClippedSubviews: true,
    maxToRenderPerBatch: 3,
    initialNumToRender: 2,
    windowSize: 8,
    updateCellsBatchingPeriod: 100,
    
    // View tracking configuration
    viewabilityConfig: {
      itemVisiblePercentThreshold: 75,
      minimumViewTime: 1000,
    },
  }), []);
  
  // Render individual post
  const renderPost: ListRenderItem<PostWithUser> = useCallback(({ item, index }) => (
    <PostFeedCard
      key={item.id}
      post={item}
      onViewed={handlePostViewed}
      scrollVelocity={scrollVelocity}
      isViewingEnabled={!isRefreshing && !isLoading}
    />
  ), [handlePostViewed, scrollVelocity, isRefreshing, isLoading]);
  
  // Handle end reached for pagination
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoading && !allPostsViewed) {
      onLoadMore();
    }
  }, [hasMore, isLoading, allPostsViewed, onLoadMore]);
  
  // Memoized refresh control
  const refreshControl = useMemo(() => (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      colors={['#7C3AED', '#EC4899']} // Gradient colors
      tintColor="#7C3AED"
      titleColor="#FFFFFF"
      title="Pull to refresh"
    />
  ), [isRefreshing, onRefresh]);
  
  // List header component
  const ListHeaderComponent = useCallback(() => (
    <FeedHeader 
      isRefreshing={isRefreshing}
      hasError={hasError}
      totalPosts={posts.length}
    />
  ), [isRefreshing, hasError, posts.length]);
  
  // List footer component
  const ListFooterComponent = useCallback(() => {
    if (isLoading && posts.length > 0) {
      return <LoadingSkeleton count={2} />;
    }
    
    if (allPostsViewed && posts.length > 0) {
      return <EndOfFeedIndicator onRefresh={onRefresh} />;
    }
    
    if (!hasMore && posts.length > 0) {
      return <EndOfFeedIndicator onRefresh={onRefresh} />;
    }
    
    return null;
  }, [isLoading, allPostsViewed, hasMore, posts.length, onRefresh]);
  
  // Empty state component
  const ListEmptyComponent = useCallback(() => {
    if (isLoading) {
      return <LoadingSkeleton count={3} />;
    }
    
    if (hasError) {
      return <ErrorState onRetry={onRefresh} />;
    }
    
    if (allPostsViewed) {
      return <EmptyFeedState onRefresh={onRefresh} />;
    }
    
    return <EmptyFeedState onRefresh={onRefresh} />;
  }, [isLoading, hasError, allPostsViewed, onRefresh]);
  
  return (
    <SecurityProvider>
      <SafeAreaProvider>
        <LinearGradient
          colors={['#0F0F0F', '#1F1F1F', '#0F0F0F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          className="flex-1"
        >
          <StatusBar
            barStyle="light-content"
            backgroundColor="transparent"
            translucent
          />
          
          <SafeAreaView className="flex-1">
            <OfflineIndicator />
            
            <FlatList
              data={posts}
              renderItem={renderPost}
              keyExtractor={(item) => item.id}
              
              // Performance props
              {...flatListConfig}
              
              // Scroll handling
              onScroll={onScroll}
              scrollEventThrottle={16}
              
              // Pagination
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              
              // Components
              ListHeaderComponent={ListHeaderComponent}
              ListFooterComponent={ListFooterComponent}
              ListEmptyComponent={ListEmptyComponent}
              
              // Refresh control
              refreshControl={refreshControl}
              
              // Styling
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 100, // Tab bar spacing
              }}
              showsVerticalScrollIndicator={false}
            />
          </SafeAreaView>
        </LinearGradient>
      </SafeAreaProvider>
    </SecurityProvider>
  );
};
```

## 🎨 Feed Components

### FeedHeader Component

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDiscoverMetrics } from '../hooks/useDiscoverMetrics';

interface FeedHeaderProps {
  isRefreshing: boolean;
  hasError: boolean;
  totalPosts: number;
}

export const FeedHeader: React.FC<FeedHeaderProps> = ({
  isRefreshing,
  hasError,
  totalPosts,
}) => {
  const metrics = useDiscoverMetrics();
  
  return (
    <View className="mb-6">
      {/* Title */}
      <Text className="text-white text-3xl font-bold mb-2">
        Discover
      </Text>
      
      {/* Subtitle with metrics */}
      <Text className="text-gray-400 text-base mb-4">
        {totalPosts > 0 
          ? `${metrics.unviewedInFeed} new posts from your fitness community`
          : 'Fresh content from your fitness community'
        }
      </Text>
      
      {/* Progress indicator */}
      {totalPosts > 0 && (
        <View className="mb-4">
          <View className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <LinearGradient
              colors={['#7C3AED', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                width: `${metrics.completionPercentage}%`,
                height: '100%',
              }}
            />
          </View>
          <Text className="text-gray-500 text-xs mt-1">
            {metrics.viewedInFeed} of {totalPosts} viewed
          </Text>
        </View>
      )}
      
      {/* Status indicators */}
      {isRefreshing && (
        <Text className="text-purple-400 text-sm">
          🔄 Refreshing feed...
        </Text>
      )}
      
      {hasError && (
        <Text className="text-red-400 text-sm">
          ⚠️ Error loading content
        </Text>
      )}
    </View>
  );
};
```

### EmptyFeedState Component

```typescript
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../ui/GradientCard';

interface EmptyFeedStateProps {
  onRefresh: () => void;
}

export const EmptyFeedState: React.FC<EmptyFeedStateProps> = ({
  onRefresh,
}) => {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      {/* Emoji */}
      <Text className="text-6xl mb-6">🎉</Text>
      
      {/* Title */}
      <Text className="text-white text-2xl font-bold text-center mb-3">
        You're All Caught Up!
      </Text>
      
      {/* Description */}
      <Text className="text-gray-400 text-center text-base mb-8 leading-6">
        You've seen all the latest content from your fitness community. 
        Check back later for fresh posts, or create your own to inspire others!
      </Text>
      
      {/* Action buttons */}
      <View className="w-full space-y-4">
        <GradientCard 
          gradient="primary" 
          onPress={onRefresh}
          className="w-full"
        >
          <View className="py-4 items-center">
            <Text className="text-white font-semibold text-base">
              🔄 Check for New Posts
            </Text>
          </View>
        </GradientCard>
        
        <GradientCard 
          gradient="secondary" 
          onPress={() => {/* Navigate to camera */}}
          className="w-full"
        >
          <View className="py-4 items-center">
            <Text className="text-white font-semibold text-base">
              📸 Create Your Own Post
            </Text>
          </View>
        </GradientCard>
      </View>
      
      {/* Tips */}
      <View className="mt-8 p-4 bg-gray-900/50 rounded-xl">
        <Text className="text-gray-300 text-sm text-center">
          💡 <Text className="font-medium">Tip:</Text> Content disappears after you view it, 
          creating authentic, in-the-moment experiences!
        </Text>
      </View>
    </View>
  );
};
```

### ErrorState Component

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { GradientCard } from '../ui/GradientCard';

interface ErrorStateProps {
  onRetry: () => void;
  error?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  onRetry,
  error = "Couldn't load posts",
}) => {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      {/* Error icon */}
      <Text className="text-5xl mb-6">😕</Text>
      
      {/* Title */}
      <Text className="text-white text-xl font-bold text-center mb-3">
        Something went wrong
      </Text>
      
      {/* Error message */}
      <Text className="text-gray-400 text-center text-base mb-8">
        {error}. Please check your connection and try again.
      </Text>
      
      {/* Retry button */}
      <GradientCard 
        gradient="primary" 
        onPress={onRetry}
        className="w-full max-w-xs"
      >
        <View className="py-4 items-center">
          <Text className="text-white font-semibold text-base">
            Try Again
          </Text>
        </View>
      </GradientCard>
    </View>
  );
};
```

### LoadingSkeleton Component

```typescript
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface LoadingSkeletonProps {
  count?: number;
}

const SkeletonItem: React.FC = () => {
  const opacity = useSharedValue(0.3);
  
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  
  return (
    <Animated.View 
      style={animatedStyle}
      className="mb-6 bg-gray-800 rounded-2xl overflow-hidden"
    >
      {/* Header skeleton */}
      <View className="flex-row items-center p-4">
        <View className="w-12 h-12 bg-gray-700 rounded-full" />
        <View className="ml-3 flex-1">
          <View className="h-4 bg-gray-700 rounded w-24 mb-2" />
          <View className="h-3 bg-gray-700 rounded w-16" />
        </View>
        <View className="h-3 bg-gray-700 rounded w-12" />
      </View>
      
      {/* Media skeleton */}
      <View className="mx-4 mb-4 bg-gray-700 rounded-xl aspect-square" />
      
      {/* Content skeleton */}
      <View className="px-4 pb-4">
        <View className="h-4 bg-gray-700 rounded w-full mb-2" />
        <View className="h-4 bg-gray-700 rounded w-3/4" />
      </View>
    </Animated.View>
  );
};

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  count = 3,
}) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonItem key={index} />
      ))}
    </View>
  );
};
```

### EndOfFeedIndicator Component

```typescript
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface EndOfFeedIndicatorProps {
  onRefresh: () => void;
}

export const EndOfFeedIndicator: React.FC<EndOfFeedIndicatorProps> = ({
  onRefresh,
}) => {
  return (
    <View className="items-center py-8">
      <View className="items-center mb-6">
        <Text className="text-3xl mb-2">✨</Text>
        <Text className="text-white text-lg font-semibold mb-1">
          You've seen it all!
        </Text>
        <Text className="text-gray-400 text-center text-sm">
          All current posts have been viewed
        </Text>
      </View>
      
      <Pressable onPress={onRefresh}>
        <LinearGradient
          colors={['#7C3AED', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-6 py-3 rounded-full"
        >
          <Text className="text-white font-medium">
            Check for New Content
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
};
```

## 🔄 Custom Hooks

### useScrollVelocity Hook

```typescript
import { useState, useCallback, useRef } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

export const useScrollVelocity = () => {
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const lastScrollTime = useRef(Date.now());
  const lastScrollY = useRef(0);
  
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const currentTime = Date.now();
    
    const deltaY = Math.abs(currentY - lastScrollY.current);
    const deltaTime = currentTime - lastScrollTime.current;
    
    if (deltaTime > 0) {
      const velocity = (deltaY / deltaTime) * 1000; // pixels per second
      setScrollVelocity(velocity);
    }
    
    lastScrollY.current = currentY;
    lastScrollTime.current = currentTime;
  }, []);
  
  return { scrollVelocity, onScroll };
};
```

### useDiscoverNavigation Hook

```typescript
import { useCallback } from 'react';
import { useRouter } from 'expo-router';

export const useDiscoverNavigation = () => {
  const router = useRouter();
  
  const navigateToCamera = useCallback(() => {
    router.push('/(tabs)/camera');
  }, [router]);
  
  const navigateToProfile = useCallback((username: string) => {
    router.push(`/profile/${username}`);
  }, [router]);
  
  const navigateToPost = useCallback((postId: string) => {
    router.push(`/post/${postId}`);
  }, [router]);
  
  return {
    navigateToCamera,
    navigateToProfile,
    navigateToPost,
  };
};
```

## 🎛️ Configuration and Settings

### Feed Configuration

```typescript
interface FeedConfig {
  // Performance settings
  initialRenderCount: number;
  maxRenderBatch: number;
  windowSize: number;
  
  // View tracking settings
  viewThreshold: number;
  minViewTime: number;
  
  // Refresh settings
  refreshCooldown: number;
  autoRefreshInterval: number;
  
  // Security settings
  enableScreenshotPrevention: boolean;
  securityLevel: 'high' | 'medium' | 'low';
}

export const feedConfig: FeedConfig = {
  initialRenderCount: 2,
  maxRenderBatch: 3,
  windowSize: 8,
  viewThreshold: 0.75,
  minViewTime: 2000,
  refreshCooldown: 5000,
  autoRefreshInterval: 300000, // 5 minutes
  enableScreenshotPrevention: true,
  securityLevel: 'high',
};
```

## 🧪 Testing Implementation

### Screen Testing

```typescript
// DiscoverScreen.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DiscoverScreen } from './DiscoverScreen';
import { useDiscoverStore } from '../stores/discoverStore';

// Mock the store
jest.mock('../stores/discoverStore');
const mockUseDiscoverStore = useDiscoverStore as jest.MockedFunction<typeof useDiscoverStore>;

describe('DiscoverScreen', () => {
  beforeEach(() => {
    mockUseDiscoverStore.mockReturnValue({
      posts: [],
      isLoading: false,
      hasError: false,
      fetchPosts: jest.fn(),
      refreshPosts: jest.fn(),
    });
  });
  
  it('renders empty state when no posts', () => {
    const { getByText } = render(<DiscoverScreen />);
    expect(getByText("You're All Caught Up!")).toBeTruthy();
  });
  
  it('renders posts when available', () => {
    mockUseDiscoverStore.mockReturnValue({
      posts: [mockPost],
      isLoading: false,
      hasError: false,
      fetchPosts: jest.fn(),
      refreshPosts: jest.fn(),
    });
    
    const { getByText } = render(<DiscoverScreen />);
    expect(getByText('testuser')).toBeTruthy();
  });
  
  it('handles pull to refresh', async () => {
    const refreshPosts = jest.fn();
    mockUseDiscoverStore.mockReturnValue({
      posts: [],
      isRefreshing: false,
      refreshPosts,
    });
    
    const { getByTestId } = render(<DiscoverScreen />);
    const flatList = getByTestId('discover-feed');
    
    fireEvent(flatList, 'refresh');
    expect(refreshPosts).toHaveBeenCalled();
  });
});
```

## 📊 Performance Monitoring

### Feed Performance Metrics

```typescript
export const useFeedPerformance = () => {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    scrollFPS: 0,
    memoryUsage: 0,
    viewTrackingLatency: 0,
  });
  
  const startRenderTimer = useCallback(() => {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      setMetrics(prev => ({
        ...prev,
        renderTime: endTime - startTime,
      }));
    };
  }, []);
  
  return { metrics, startRenderTimer };
};
```

## 🔗 Integration with Tab Navigation

### Tab Integration

```typescript
// In app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F0F0F',
          borderTopColor: '#1F1F1F',
        },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

**Status**: Complete feed implementation defined  
**Key Features**: Performance optimization, error handling, security integration  
**Dependencies**: All previous components and stores  
**User Experience**: Instagram/TikTok-like with ephemeral behavior