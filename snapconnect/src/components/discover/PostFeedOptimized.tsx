import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PostWithUser } from '../../services/postService';
import { ViewTracker } from '../tracking/ViewTracker';
import { SecureImage } from '../security/SecureImage';
import { SecureVideo } from '../security/SecureVideo';
import { useSecurityContext } from '../../contexts/SecurityContext';
import { gradients } from '../../styles/gradients';

const { width: screenWidth } = Dimensions.get('window');

interface PostFeedOptimizedProps {
  post: PostWithUser;
  onViewed?: (postId: string) => void;
  onPress?: (post: PostWithUser) => void;
  isViewingEnabled?: boolean;
  scrollVelocity?: number;
  index?: number;
}

// Memoized components for better performance
const MemoizedUserAvatar = memo(({ 
  avatarUrl, 
  username, 
  fitnessLevel,
  userGradient 
}: {
  avatarUrl: string;
  username: string;
  fitnessLevel: string;
  userGradient: string;
}) => (
  <View className="relative">
    <LinearGradient
      colors={gradients[userGradient] || gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="w-12 h-12 rounded-full items-center justify-center"
    >
      <View className="w-10 h-10 rounded-full overflow-hidden bg-gray-800">
        <SecureImage
          source={{ uri: avatarUrl || 'https://via.placeholder.com/40' }}
          className="w-full h-full"
          resizeMode="cover"
          fallbackText="👤"
        />
      </View>
    </LinearGradient>
    
    {/* Fitness Level Indicator */}
    <View className="absolute -bottom-1 -right-1">
      <LinearGradient
        colors={gradients[userGradient] || gradients.primary}
        className="w-6 h-6 rounded-full items-center justify-center"
      >
        <Text className="text-white text-xs font-bold">
          {fitnessLevel.charAt(0).toUpperCase()}
        </Text>
      </LinearGradient>
    </View>
  </View>
));

const MemoizedUserInfo = memo(({ 
  username, 
  fitnessLevel, 
  workoutType, 
  createdAt 
}: {
  username: string;
  fitnessLevel: string;
  workoutType?: string;
  createdAt: string;
}) => {
  const formatRelativeTime = useMemo(() => {
    const now = new Date();
    const postDate = new Date(createdAt);
    const diffMs = now.getTime() - postDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  }, [createdAt]);

  return (
    <>
      <View className="flex-1 ml-3">
        <Text className="text-white font-semibold text-base">
          {username}
        </Text>
        <View className="flex-row items-center">
          <Text className="text-gray-400 text-sm capitalize">
            {fitnessLevel}
          </Text>
          {workoutType && (
            <>
              <Text className="text-gray-500 mx-2">•</Text>
              <Text className="text-gray-400 text-sm capitalize">
                {workoutType}
              </Text>
            </>
          )}
        </View>
      </View>
      
      <Text className="text-gray-500 text-sm">
        {formatRelativeTime}
      </Text>
    </>
  );
});

const MemoizedMediaContent = memo(({ 
  mediaUrl, 
  mediaType,
  isSecureMode 
}: {
  mediaUrl?: string;
  mediaType?: string;
  isSecureMode: boolean;
}) => {
  if (!mediaUrl) return null;
  
  if (!isSecureMode) {
    return (
      <View className="w-full aspect-square bg-gray-800 items-center justify-center rounded-xl">
        <Text className="text-gray-400">🔒 Content Protected</Text>
      </View>
    );
  }
  
  return (
    <View className="w-full aspect-square rounded-xl overflow-hidden">
      {mediaType === 'video' ? (
        <SecureVideo
          source={{ uri: mediaUrl }}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <SecureImage
          source={{ uri: mediaUrl }}
          className="w-full h-full"
          resizeMode="cover"
        />
      )}
      {mediaType === 'video' && (
        <View className="absolute bottom-2 right-2">
          <View className="bg-black/60 rounded-full px-2 py-1">
            <Text className="text-white text-xs">📹</Text>
          </View>
        </View>
      )}
    </View>
  );
});

const MemoizedPostTags = memo(({ 
  workoutType, 
  fitnessLevel 
}: {
  workoutType?: string;
  fitnessLevel: string;
}) => (
  <View className="flex-row items-center justify-between px-4 pb-4">
    <View className="flex-row items-center">
      {workoutType && (
        <View className="bg-gray-800 rounded-full px-3 py-1 mr-2">
          <Text className="text-gray-300 text-xs capitalize">
            #{workoutType}
          </Text>
        </View>
      )}
      <View className="bg-gray-800 rounded-full px-3 py-1">
        <Text className="text-gray-300 text-xs capitalize">
          {fitnessLevel}
        </Text>
      </View>
    </View>
  </View>
));

export const PostFeedOptimized = memo<PostFeedOptimizedProps>(({
  post,
  onViewed,
  onPress,
  isViewingEnabled = true,
  scrollVelocity = 0,
  index = 0,
}) => {
  const { isSecureMode } = useSecurityContext();
  
  // Determine gradient based on fitness level
  const userGradient = useMemo(() => {
    const gradientMap = {
      beginner: 'beginner',
      intermediate: 'intermediate', 
      advanced: 'advanced',
    } as const;
    
    return gradientMap[post.users.fitness_level] || 'primary';
  }, [post.users.fitness_level]);
  
  const handleViewed = useCallback((postId: string, duration: number) => {
    console.log(`Post ${postId} viewed for ${duration}ms`);
    onViewed?.(postId);
  }, [onViewed]);
  
  const handlePress = useCallback(() => {
    onPress?.(post);
  }, [post, onPress]);
  
  // Performance optimization: Reduce re-renders for fast scrolling
  const shouldOptimizeForScroll = scrollVelocity > 1000;
  
  return (
    <ViewTracker
      postId={post.id}
      mediaType={post.media_type || 'photo'}
      onViewed={handleViewed}
      enabled={isViewingEnabled && !shouldOptimizeForScroll}
      debug={__DEV__}
    >
      <Pressable
        onPress={handlePress}
        className="mb-6"
        style={({ pressed }) => ({
          opacity: pressed ? 0.95 : 1,
          // Reduce shadow/effects during fast scroll
          ...(shouldOptimizeForScroll ? {} : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }),
        })}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          className="rounded-2xl overflow-hidden"
        >
          {/* User Header */}
          <View className="flex-row items-center p-4">
            <MemoizedUserAvatar
              avatarUrl={post.users.avatar_url}
              username={post.users.username}
              fitnessLevel={post.users.fitness_level}
              userGradient={userGradient}
            />
            
            <MemoizedUserInfo
              username={post.users.username}
              fitnessLevel={post.users.fitness_level}
              workoutType={post.workout_type}
              createdAt={post.created_at}
            />
          </View>
          
          {/* Media Content */}
          <View className="px-4">
            <MemoizedMediaContent
              mediaUrl={post.media_url}
              mediaType={post.media_type}
              isSecureMode={isSecureMode}
            />
          </View>
          
          {/* Post Caption */}
          {post.content && (
            <View className="px-4 py-3">
              <Text 
                className="text-white text-base leading-5"
                numberOfLines={shouldOptimizeForScroll ? 2 : undefined}
              >
                {post.content}
              </Text>
            </View>
          )}
          
          {/* Footer Tags */}
          <MemoizedPostTags
            workoutType={post.workout_type}
            fitnessLevel={post.users.fitness_level}
          />
        </LinearGradient>
      </Pressable>
    </ViewTracker>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo optimization
  const prevPost = prevProps.post;
  const nextPost = nextProps.post;
  
  // Deep comparison for post data
  if (prevPost.id !== nextPost.id) return false;
  if (prevPost.content !== nextPost.content) return false;
  if (prevPost.media_url !== nextPost.media_url) return false;
  if (prevPost.users.username !== nextPost.users.username) return false;
  if (prevPost.users.fitness_level !== nextPost.users.fitness_level) return false;
  
  // Compare other props
  if (prevProps.isViewingEnabled !== nextProps.isViewingEnabled) return false;
  if (Math.abs((prevProps.scrollVelocity || 0) - (nextProps.scrollVelocity || 0)) > 100) return false;
  
  return true;
});

PostFeedOptimized.displayName = 'PostFeedOptimized';