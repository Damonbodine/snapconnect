import React, { useCallback, useMemo, useState } from 'react';
import {
  VirtualizedList,
  RefreshControl,
  View,
  Text,
  ActivityIndicator,
  Dimensions,
  ListRenderItemInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PostWithUser } from '../../services/postService';
import { PostFeedOptimized } from './PostFeedOptimized';

const { height: screenHeight } = Dimensions.get('window');

// Estimated item height for virtualization
const ESTIMATED_ITEM_HEIGHT = 600;
const BUFFER_SIZE = 3;
const MAX_TO_RENDER_PER_BATCH = 5;

interface VirtualizedFeedProps {
  posts: PostWithUser[];
  onPostViewed: (postId: string) => void;
  onPostPress?: (post: PostWithUser) => void;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  isRefreshing?: boolean;
  hasMore?: boolean;
  allViewed?: boolean;
  isEmpty?: boolean;
  emptyComponent?: React.ReactNode;
  headerComponent?: React.ReactNode;
  footerComponent?: React.ReactNode;
  onScroll?: (scrollVelocity: number) => void;
}

export const VirtualizedFeed: React.FC<VirtualizedFeedProps> = ({
  posts,
  onPostViewed,
  onPostPress,
  onLoadMore,
  onRefresh,
  isLoading = false,
  isRefreshing = false,
  hasMore = true,
  allViewed = false,
  isEmpty = false,
  emptyComponent,
  headerComponent,
  footerComponent,
  onScroll,
}) => {
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [itemHeights, setItemHeights] = useState<Map<string, number>>(new Map());

  // Memoized posts with stable keys
  const stablePosts = useMemo(() => 
    posts.map((post, index) => ({ ...post, _index: index })), 
    [posts]
  );

  // Get item by index for VirtualizedList
  const getItem = useCallback((data: typeof stablePosts, index: number) => {
    return data[index];
  }, []);

  // Get item count
  const getItemCount = useCallback((data: typeof stablePosts) => {
    return data.length;
  }, []);

  // Get item layout for better performance
  const getItemLayout = useCallback((data: any, index: number) => {
    const postId = data[index]?.id;
    const height = itemHeights.get(postId) || ESTIMATED_ITEM_HEIGHT;
    
    return {
      length: height,
      offset: height * index,
      index,
    };
  }, [itemHeights]);

  // Handle item layout measurement
  const handleItemLayout = useCallback((postId: string, height: number) => {
    setItemHeights(prev => {
      const newMap = new Map(prev);
      newMap.set(postId, height);
      return newMap;
    });
  }, []);

  // Handle scroll events
  const handleScroll = useCallback((event: any) => {
    const velocity = Math.abs(event.nativeEvent?.velocity?.y || 0);
    setScrollVelocity(velocity);
    onScroll?.(velocity);
  }, [onScroll]);

  // Render individual post item
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<PostWithUser & { _index: number }>) => (
    <View
      onLayout={(event) => {
        const { height } = event.nativeEvent.layout;
        handleItemLayout(item.id, height);
      }}
    >
      <PostFeedOptimized
        post={item}
        onViewed={onPostViewed}
        onPress={onPostPress}
        isViewingEnabled={scrollVelocity < 500}
        scrollVelocity={scrollVelocity}
        index={index}
      />
    </View>
  ), [onPostViewed, onPostPress, scrollVelocity, handleItemLayout]);

  // Render loading footer
  const renderFooter = useCallback(() => {
    if (isLoading && posts.length > 0) {
      return (
        <View className="py-4 items-center">
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text className="text-gray-400 mt-2">Loading more posts...</Text>
        </View>
      );
    }
    
    if (allViewed && posts.length > 0) {
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
    
    if (!hasMore && posts.length > 0 && !allViewed) {
      return (
        <View className="py-6 items-center">
          <Text className="text-gray-400 text-center px-8">
            No more posts available right now.
          </Text>
        </View>
      );
    }

    return footerComponent || null;
  }, [isLoading, allViewed, hasMore, posts.length, footerComponent]);

  // Render empty state
  const renderEmptyState = useCallback(() => {
    if (emptyComponent) {
      return emptyComponent;
    }
    
    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text className="text-white text-lg mt-4">Loading posts...</Text>
        </View>
      );
    }
    
    if (allViewed) {
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
  }, [emptyComponent, isLoading, allViewed]);

  // Handle end reached (load more)
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoading && posts.length > 0) {
      onLoadMore?.();
    }
  }, [hasMore, isLoading, posts.length, onLoadMore]);

  // Key extractor
  const keyExtractor = useCallback((item: PostWithUser & { _index: number }) => item.id, []);

  if (isEmpty || posts.length === 0) {
    return (
      <View className="flex-1">
        {headerComponent}
        {renderEmptyState()}
      </View>
    );
  }

  return (
    <VirtualizedList
      data={stablePosts}
      getItem={getItem}
      getItemCount={getItemCount}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#7C3AED']}
            tintColor="#7C3AED"
            titleColor="#FFFFFF"
            title="Pull to refresh"
          />
        ) : undefined
      }
      ListHeaderComponent={headerComponent}
      ListFooterComponent={renderFooter}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 100, // Extra padding for tab bar
      }}
      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={MAX_TO_RENDER_PER_BATCH}
      updateCellsBatchingPeriod={50}
      initialNumToRender={Math.ceil(screenHeight / ESTIMATED_ITEM_HEIGHT)}
      windowSize={10}
      // Virtualization settings
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
      }}
      // Debug props (development only)
      {...(__DEV__ && {
        debug: false, // Set to true for debugging virtualization
      })}
    />
  );
};