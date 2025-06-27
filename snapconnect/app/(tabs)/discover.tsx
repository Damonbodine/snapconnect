import React, { useEffect, useCallback, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  RefreshControl, 
  ActivityIndicator, 
  Alert,
  SafeAreaView,
  StatusBar,
  ViewToken,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { PostFeedCard } from '../../src/components/discover/PostFeedCard';
import { useDiscoverStore } from '../../src/stores/discoverStore';
import { SecurityProvider } from '../../src/contexts/SecurityContext';
import { PostWithUser, ViewRecord } from '../../src/services/postService';
import { AppHeader } from '../../src/components/ui/AppHeader';

const DiscoverScreen: React.FC = () => {
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [scrollHistory, setScrollHistory] = useState<number[]>([]);
  const [currentScrollPosition, setCurrentScrollPosition] = useState(0);
  
  const {
    posts,
    useAlgorithmicRanking,
    isLoading,
    isRefreshing,
    hasError,
    errorMessage,
    hasMore,
    allPostsViewed,
    fetchPosts,
    refreshPosts,
    loadMorePosts,
    markPostAsViewed,
    addToViewQueue,
    clearError,
    getUnviewedPosts,
    toggleAlgorithmicRanking,
    triggerSmartPrefetch,
    triggerPredictivePrefetch,
  } = useDiscoverStore();

  // Initialize posts on mount
  useEffect(() => {
    if (posts.length === 0 && !isLoading && !hasError) {
      fetchPosts();
    }
  }, []);

  // Refresh posts when screen comes into focus (e.g., after posting)
  useFocusEffect(
    useCallback(() => {
      console.log('🎯 DISCOVER: Screen focused, refreshing posts...');
      refreshPosts();
    }, [refreshPosts])
  );

  // Handle view tracking with batching
  const handlePostViewed = useCallback((postId: string) => {
    console.log(`🎯 DISCOVER: Post ${postId} viewed - adding to queue`);
    console.log(`🎯 DISCOVER: Current unviewed posts before marking: ${unviewedPosts.length}`);
    
    // Add to view queue for batched processing
    const viewRecord: ViewRecord = {
      postId,
      viewedAt: Date.now(), // Use timestamp number instead of string
      duration: 10000, // 10 seconds duration
      viewPercentage: 100,
      deviceType: 'mobile',
      appVersion: '1.0.0',
    };
    
    // Mark as viewed locally (optimistic update)
    markPostAsViewed(postId);
    console.log(`🎯 DISCOVER: Marked post ${postId} as viewed locally`);
    
    // Add to batch queue
    addToViewQueue(viewRecord);
    console.log(`🎯 DISCOVER: Added to view queue - should disappear on next render`);
    
    // Log current state after marking
    setTimeout(() => {
      const newUnviewed = getUnviewedPosts();
      console.log(`🎯 DISCOVER: Unviewed posts after marking: ${newUnviewed.length}`);
    }, 100);
  }, [markPostAsViewed, addToViewQueue, getUnviewedPosts]);

  // Handle pull to refresh
  const handleRefresh = useCallback(async () => {
    try {
      await refreshPosts();
    } catch (error) {
      console.error('Failed to refresh:', error);
      Alert.alert('Error', 'Failed to refresh posts. Please try again.');
    }
  }, [refreshPosts]);

  // Handle load more (pagination)
  const handleLoadMore = useCallback(async () => {
    if (!isLoading && hasMore && !allPostsViewed) {
      try {
        await loadMorePosts();
      } catch (error) {
        console.error('Failed to load more:', error);
      }
    }
  }, [isLoading, hasMore, allPostsViewed, loadMorePosts]);

  // Handle post press - navigate to user profile
  const handlePostPress = useCallback((post: PostWithUser) => {
    console.log('🎯 DISCOVER: Post pressed, navigating to user profile:', post.users.username);
    console.log('🎯 DISCOVER: Post object:', post);
    console.log('🎯 DISCOVER: User ID:', post.user_id);
    
    if (!post.user_id) {
      console.error('❌ DISCOVER: No user_id found in post object');
      return;
    }
    
    router.push(`/user/${post.user_id}`);
  }, []);

  // Track scroll velocity and position for prefetching
  const handleScroll = useCallback((event: any) => {
    const velocity = event.nativeEvent?.velocity?.y || 0;
    const position = event.nativeEvent?.contentOffset?.y || 0;
    const absVelocity = Math.abs(velocity);
    
    setScrollVelocity(absVelocity);
    setCurrentScrollPosition(position);
    
    // Update scroll history for predictive prefetching (keep last 10 values)
    setScrollHistory(prev => {
      const newHistory = [...prev, absVelocity].slice(-10);
      return newHistory;
    });
  }, []);

  // Handle viewability change - track which post is currently most visible and trigger prefetching
  const handleViewabilityChange = useCallback((info: { viewableItems: ViewToken[] }) => {
    const { viewableItems } = info;
    
    if (viewableItems.length > 0) {
      // Take the first viewable item as the active post (most visible)
      const mostVisiblePost = viewableItems[0];
      const newActivePostId = mostVisiblePost.item?.id || null;
      const currentIndex = mostVisiblePost.index || 0;
      
      if (newActivePostId !== activePostId) {
        console.log(`👁️ ACTIVE POST: Changed from ${activePostId} to ${newActivePostId} (index: ${currentIndex})`);
        setActivePostId(newActivePostId);
        
        // Trigger smart prefetching when user scrolls to new posts
        triggerSmartPrefetch(currentIndex, scrollVelocity);
        
        // Trigger predictive prefetching if we have enough scroll history
        if (scrollHistory.length >= 5) {
          triggerPredictivePrefetch(scrollHistory, currentScrollPosition);
        }
      }
    } else {
      if (activePostId !== null) {
        console.log(`👁️ ACTIVE POST: No posts visible, clearing active post`);
        setActivePostId(null);
      }
    }
  }, [activePostId, scrollVelocity, scrollHistory, currentScrollPosition, triggerSmartPrefetch, triggerPredictivePrefetch]);

  // Viewability config - only count as viewable if 60% visible
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 500, // Must be visible for 500ms before counting
  };

  // Render individual post
  const renderPost = useCallback(({ item }: { item: PostWithUser }) => {
    const isActivePost = item.id === activePostId;
    const isViewingEnabled = scrollVelocity < 500 && isActivePost; // Only enable for active post
    
    console.log(`🎯 DISCOVER: Rendering post ${item.id} - active: ${isActivePost}, viewEnabled: ${isViewingEnabled}`);
    
    return (
      <PostFeedCard
        post={item}
        onViewed={handlePostViewed}
        onPress={handlePostPress}
        onUserPress={handlePostPress} // Same handler for now - goes to user profile
        isViewingEnabled={isViewingEnabled}
        scrollVelocity={scrollVelocity}
      />
    );
  }, [handlePostViewed, handlePostPress, scrollVelocity, activePostId]);

  // Render footer (loading indicator or end message)
  const renderFooter = useCallback(() => {
    if (isLoading && posts.length > 0) {
      return (
        <View className="py-4">
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      );
    }
    
    if (allPostsViewed && posts.length > 0) {
      return (
        <View className="py-8 items-center">
          <Text className="text-2xl mb-2">🎉</Text>
          <Text className="text-white text-lg font-semibold mb-1">
            All caught up!
          </Text>
          <Text className="text-gray-400 text-center px-8">
            You've viewed all available posts. Pull down to refresh for new content.
          </Text>
        </View>
      );
    }
    
    if (!hasMore && posts.length > 0 && !allPostsViewed) {
      return (
        <View className="py-8 items-center">
          <Text className="text-gray-400 text-center px-8">
            No more posts available right now.
          </Text>
        </View>
      );
    }
    
    return null;
  }, [isLoading, allPostsViewed, hasMore, posts.length]);

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text className="text-white text-lg mt-4">Loading posts...</Text>
        </View>
      );
    }
    
    if (hasError) {
      return (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-4">⚠️</Text>
          <Text className="text-white text-xl font-semibold mb-2">
            Something went wrong
          </Text>
          <Text className="text-gray-400 text-center mb-6">
            {errorMessage || 'Failed to load posts'}
          </Text>
          <LinearGradient
            colors={['#7C3AED', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="rounded-full"
          >
            <Text 
              className="text-white font-semibold py-3 px-6"
              onPress={() => {
                clearError();
                fetchPosts();
              }}
            >
              Try Again
            </Text>
          </LinearGradient>
        </View>
      );
    }
    
    if (allPostsViewed) {
      return (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-4">🎉</Text>
          <Text className="text-white text-2xl font-bold mb-2">
            All caught up!
          </Text>
          <Text className="text-gray-400 text-center mb-6">
            You've viewed all available posts. New content will appear here as it becomes available.
          </Text>
        </View>
      );
    }
    
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-4xl mb-4">🏋️</Text>
        <Text className="text-white text-2xl font-bold mb-2">
          No posts yet
        </Text>
        <Text className="text-gray-400 text-center">
          Be the first to share your fitness journey!
        </Text>
      </View>
    );
  };

  // Get only unviewed posts for rendering
  const unviewedPosts = getUnviewedPosts();

  return (
    <SecurityProvider initialSecurityLevel="high" allowUserOverride={__DEV__}>
      <LinearGradient
        colors={['#0F0F0F', '#1F1F1F']}
        className="flex-1"
      >
        <SafeAreaView className="flex-1">
          <StatusBar barStyle="light-content" backgroundColor="#0F0F0F" />
          
          {/* Header */}
          <AppHeader 
            title="Discover"
            subtitle={`${unviewedPosts.length} new posts ${useAlgorithmicRanking ? '• Personalized for you' : '• Chronological order'}`}
            centerContent={
              <Pressable 
                onPress={toggleAlgorithmicRanking}
                className="flex-row items-center"
              >
                <View className={`w-10 h-5 rounded-full ${useAlgorithmicRanking ? 'bg-purple-600' : 'bg-gray-600'} mr-2`}>
                  <View className={`w-4 h-4 rounded-full bg-white mt-0.5 ml-0.5 transition-transform ${useAlgorithmicRanking ? 'translate-x-5' : 'translate-x-0'}`} />
                </View>
                <Text className="text-gray-400 text-xs">
                  {useAlgorithmicRanking ? '🎯 Smart' : '📅 Latest'}
                </Text>
              </Pressable>
            }
          />

          {/* Posts List */}
          {unviewedPosts.length > 0 ? (
            <FlatList
              data={unviewedPosts}
              renderItem={renderPost}
              keyExtractor={(item: PostWithUser) => item.id}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              onViewableItemsChanged={handleViewabilityChange}
              viewabilityConfig={viewabilityConfig}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  colors={['#7C3AED']}
                  tintColor="#7C3AED"
                  titleColor="#FFFFFF"
                  title="Pull to refresh"
                />
              }
              ListFooterComponent={renderFooter}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 100, // Extra padding for tab bar
              }}
              removeClippedSubviews={true}
              maxToRenderPerBatch={5}
              updateCellsBatchingPeriod={50}
              initialNumToRender={10}
              windowSize={10}
            />
          ) : (
            renderEmptyState()
          )}
        </SafeAreaView>
      </LinearGradient>
    </SecurityProvider>
  );
};

export default DiscoverScreen;