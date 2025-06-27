import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, Image, Pressable, Dimensions, Modal, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { PostWithUser } from '../../services/postService';
import { SimpleViewTracker } from './SimpleViewTracker';
import { useSecurityContext } from '../../contexts/SecurityContext';
import { gradients } from '../../styles/gradients';
import { CommentsList } from '../comments/CommentsList';
import { commentService } from '../../services/commentService';
import { likeService } from '../../services/likeService';

const { width: screenWidth } = Dimensions.get('window');

interface PostFeedCardProps {
  post: PostWithUser;
  onViewed?: (postId: string) => void;
  onPress?: (post: PostWithUser) => void;
  onUserPress?: (post: PostWithUser) => void;
  isViewingEnabled?: boolean;
  scrollVelocity?: number;
}

export const PostFeedCard: React.FC<PostFeedCardProps> = ({
  post,
  onViewed,
  onPress,
  onUserPress,
  isViewingEnabled = true,
  scrollVelocity = 0,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [lastTap, setLastTap] = useState<number>(0);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const { isSecureMode } = useSecurityContext();
  
  // Animation refs
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  
  // Create video player for video posts
  const videoPlayer = useVideoPlayer(
    post.media_type === 'video' && post.media_url ? post.media_url : '', 
    (player) => {
      if (post.media_type === 'video' && post.media_url) {
        console.log('📹 Setting up video player for post:', post.id);
        player.loop = true;
        player.muted = true; // Start muted for better UX
        // Don't auto-play, let user control playback
      }
    }
  );
  
  // Load comment count and like data
  useEffect(() => {
    const loadPostInteractions = async () => {
      try {
        // Load comment count
        const commentCounts = await commentService.getCommentCounts([post.id]);
        setCommentCount(commentCounts[post.id] || 0);

        // Load like count and user's like state
        const [likeCounts, likeStates] = await Promise.all([
          likeService.getLikeCounts([post.id]),
          likeService.getUserLikeStates([post.id])
        ]);
        
        setLikeCount(likeCounts[post.id] || 0);
        setIsLiked(likeStates[post.id] || false);
      } catch (error) {
        console.error('Failed to load post interactions:', error);
      }
    };

    loadPostInteractions();
  }, [post.id]);

  // Determine gradient based on fitness level
  const userGradient = useMemo(() => {
    const gradientMap: Record<string, keyof typeof gradients> = {
      beginner: 'beginner',
      intermediate: 'intermediate', 
      advanced: 'advanced',
    };
    
    return gradientMap[post.users.fitness_level] || 'primary';
  }, [post.users.fitness_level]);
  
  const handleViewed = useCallback((postId: string, duration: number) => {
    console.log(`🔥 POSTCARD: Post ${postId} viewed for ${duration}ms`);
    console.log(`🔥 POSTCARD: Calling onViewed callback for ${postId}`);
    onViewed?.(postId);
    console.log(`🔥 POSTCARD: onViewed callback completed for ${postId}`);
  }, [onViewed]);

  const handleUserPress = useCallback(() => {
    console.log(`🔥 POSTCARD: User ${post.users.username} pressed`);
    onUserPress?.(post);
  }, [post, onUserPress]);

  const handleCommentsPress = useCallback(() => {
    setShowComments(true);
  }, []);

  const handleCloseComments = useCallback(() => {
    setShowComments(false);
  }, []);

  const handleLikePress = useCallback(async () => {
    if (isLiking) return; // Prevent double-tap
    
    setIsLiking(true);
    
    try {
      if (isLiked) {
        // Optimistically update UI
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
        
        // Unlike the post
        await likeService.unlikePost(post.id);
      } else {
        // Optimistically update UI
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
        
        // Like the post
        await likeService.likePost(post.id);
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      
      // Revert optimistic update on error
      if (isLiked) {
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      } else {
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      }
    } finally {
      setIsLiking(false);
    }
  }, [isLiked, isLiking, post.id]);

  // Double-tap to like handler
  const handleDoubleTap = useCallback(async () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // 300ms window for double tap
    
    if (now - lastTap < DOUBLE_TAP_DELAY) {
      // This is a double tap!
      console.log('💗 Double tap detected - triggering like');
      
      if (!isLiked && !isLiking) {
        // Show heart animation
        setShowHeartAnimation(true);
        
        // Animate heart
        heartScale.setValue(0);
        heartOpacity.setValue(1);
        
        Animated.sequence([
          Animated.parallel([
            Animated.spring(heartScale, {
              toValue: 1.2,
              useNativeDriver: true,
              tension: 100,
              friction: 5,
            }),
            Animated.timing(heartOpacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.spring(heartScale, {
              toValue: 1,
              useNativeDriver: true,
              tension: 100,
              friction: 8,
            }),
            Animated.timing(heartOpacity, {
              toValue: 0,
              duration: 800,
              delay: 500,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          setShowHeartAnimation(false);
        });
        
        // Trigger like
        await handleLikePress();
      }
    }
    
    setLastTap(now);
  }, [lastTap, isLiked, isLiking, handleLikePress, heartScale, heartOpacity]);

  // Single tap handler (for other actions)
  const handleSingleTap = useCallback(() => {
    const now = Date.now();
    
    // Use setTimeout to check if this was actually a single tap
    setTimeout(() => {
      if (now === lastTap) {
        // This was a single tap (no double tap occurred)
        onPress?.(post);
      }
    }, 350); // Wait slightly longer than double-tap delay
  }, [lastTap, onPress, post]);
  
  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffMs = now.getTime() - postDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };
  
  const handleVideoPress = useCallback(() => {
    if (post.media_type === 'video' && videoPlayer) {
      if (isPlaying) {
        videoPlayer.pause();
        setIsPlaying(false);
        console.log('📹 Video paused for post:', post.id);
      } else {
        videoPlayer.play();
        setIsPlaying(true);
        console.log('📹 Video playing for post:', post.id);
      }
    }
  }, [post.media_type, post.id, videoPlayer, isPlaying]);

  const handleMuteToggle = useCallback((event) => {
    event.stopPropagation(); // Prevent video play/pause when tapping mute button
    if (post.media_type === 'video' && videoPlayer) {
      const newMutedState = !isMuted;
      videoPlayer.muted = newMutedState;
      setIsMuted(newMutedState);
      console.log('📹 Video', newMutedState ? 'muted' : 'unmuted', 'for post:', post.id);
    }
  }, [post.media_type, post.id, videoPlayer, isMuted]);

  const renderMedia = () => {
    if (!post.media_url) return null;
    
    if (!isSecureMode) {
      return (
        <View className="w-full aspect-square bg-gray-800 items-center justify-center rounded-xl">
          <Text className="text-gray-400">🔒 Content Protected</Text>
        </View>
      );
    }
    
    return (
      <View className="w-full aspect-[4/3] rounded-xl overflow-hidden relative">
        {post.media_type === 'video' ? (
          <Pressable 
            onPress={handleDoubleTap}
            onLongPress={handleVideoPress}
            delayLongPress={500}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Show thumbnail by default, video when playing */}
            {!isPlaying ? (
              /* Video thumbnail for optimized feed display */
              <>
                <Image
                  source={{ uri: post.thumbnail_url || post.media_url }}
                  className="w-full h-full"
                  resizeMode="cover"
                  style={{ backgroundColor: '#000' }}
                />
                {/* Large play button overlay */}
                <View className="absolute inset-0 items-center justify-center">
                  <View className="bg-black/40 rounded-full w-16 h-16 items-center justify-center">
                    <Text className="text-white text-2xl">▶️</Text>
                  </View>
                </View>
              </>
            ) : (
              /* Full video player when actively playing */
              <VideoView
                player={videoPlayer}
                style={{ width: '100%', height: '100%' }}
                allowsFullscreen={false}
                allowsPictureInPicture={false}
                nativeControls={false}
                onVideoLoadStart={() => {
                  console.log('📹 Video load started for post:', post.id);
                }}
                onVideoLoad={() => {
                  console.log('📹 Video loaded for post:', post.id);
                }}
                onVideoError={(error) => {
                  console.error('📹 Video error for post:', post.id, error);
                  // Fallback to thumbnail on error
                  setIsPlaying(false);
                }}
              />
            )}
            
            {/* Video indicator */}
            <View className="absolute bottom-2 right-2">
              <View className="bg-black/60 rounded-full px-2 py-1">
                <Text className="text-white text-xs">📹</Text>
              </View>
            </View>
            
            {/* Quality indicator for thumbnails */}
            {post.thumbnail_url && (
              <View className="absolute top-2 left-2">
                <View className="bg-green-500/20 rounded-full px-2 py-1">
                  <Text className="text-green-400 text-xs font-semibold">HD</Text>
                </View>
              </View>
            )}
          </Pressable>
        ) : (
          /* Photo display with double-tap to like */
          <Pressable 
            onPress={handleDoubleTap}
            style={{ width: '100%', height: '100%' }}
          >
            <Image
              source={{ uri: post.thumbnail_url || post.media_url }}
              className="w-full h-full"
              resizeMode="cover"
              style={{ backgroundColor: '#000' }}
            />
            {/* Quality indicator for thumbnails */}
            {post.thumbnail_url && (
              <View className="absolute top-2 left-2">
                <View className="bg-green-500/20 rounded-full px-2 py-1">
                  <Text className="text-green-400 text-xs font-semibold">HD</Text>
                </View>
              </View>
            )}
          </Pressable>
        )}
        
        {/* Heart Animation Overlay */}
        {showHeartAnimation && (
          <View className="absolute inset-0 items-center justify-center pointer-events-none">
            <Animated.View
              style={{
                transform: [{ scale: heartScale }],
                opacity: heartOpacity,
              }}
            >
              <Text style={{ fontSize: 80, color: '#ff3366' }}>❤️</Text>
            </Animated.View>
          </View>
        )}
      </View>
    );
  };
  
  return (
    <SimpleViewTracker
      postId={post.id}
      mediaType={post.media_type || 'photo'}
      onViewed={handleViewed}
      enabled={isViewingEnabled}
      debug={true}
    >
      <View className="mb-6">
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          className="rounded-2xl overflow-hidden"
        >
          {/* User Header */}
          <Pressable onPress={handleUserPress} className="flex-row items-center p-4">
            {/* Avatar with Gradient Border */}
            <View className="relative">
              <LinearGradient
                colors={gradients[userGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="w-12 h-12 rounded-full items-center justify-center"
              >
                <View className="w-10 h-10 rounded-full overflow-hidden bg-gray-800">
                  <Image
                    source={{ uri: post.users.avatar_url || 'https://via.placeholder.com/40' }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </View>
              </LinearGradient>
              
              {/* Fitness Level Indicator */}
              <View className="absolute -bottom-1 -right-1">
                <LinearGradient
                  colors={gradients[userGradient]}
                  className="w-6 h-6 rounded-full items-center justify-center"
                >
                  <Text className="text-white text-xs font-bold">
                    {post.users.fitness_level.charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
              </View>
            </View>
            
            {/* User Info */}
            <View className="flex-1 ml-3">
              <Text className="text-white font-semibold text-base">
                {post.users.username}
              </Text>
              <View className="flex-row items-center">
                <Text className="text-gray-400 text-sm capitalize">
                  {post.users.fitness_level}
                </Text>
                {post.workout_type && (
                  <>
                    <Text className="text-gray-500 mx-2">•</Text>
                    <Text className="text-gray-400 text-sm capitalize">
                      {post.workout_type}
                    </Text>
                  </>
                )}
              </View>
            </View>
            
            {/* Timestamp */}
            <Text className="text-gray-500 text-sm">
              {formatRelativeTime(post.created_at)}
            </Text>
          </Pressable>
          
          {/* Media Content */}
          <View className="px-4">
            {renderMedia()}
          </View>
          
          {/* Post Caption */}
          {post.content && (
            <View className="px-4 py-3">
              <Text className="text-white text-base leading-5">
                {post.content}
              </Text>
            </View>
          )}
          
          {/* Footer Actions */}
          <View className="px-4 pb-4">
            {/* Tags */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                {post.workout_type && (
                  <View className="bg-gray-800 rounded-full px-3 py-1 mr-2">
                    <Text className="text-gray-300 text-xs capitalize">
                      #{post.workout_type}
                    </Text>
                  </View>
                )}
                <View className="bg-gray-800 rounded-full px-3 py-1">
                  <Text className="text-gray-300 text-xs capitalize">
                    {post.users.fitness_level}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row items-center justify-between">
              {/* Like Button */}
              <Pressable 
                onPress={handleLikePress}
                disabled={isLiking}
                className="flex-row items-center mr-4"
              >
                <View className="bg-gray-800/50 rounded-full px-4 py-2 flex-row items-center">
                  <Text className={`text-sm mr-2 ${isLiked ? 'text-red-500' : 'text-gray-300'}`}>
                    {isLiked ? '❤️' : '🤍'}
                  </Text>
                  <Text className="text-gray-300 text-sm">
                    {likeCount > 0 ? `${likeCount}` : ''}
                  </Text>
                </View>
              </Pressable>

              {/* Comment Button */}
              <Pressable 
                onPress={handleCommentsPress}
                className="flex-row items-center flex-1"
              >
                <View className="bg-gray-800/50 rounded-full px-4 py-2 flex-row items-center">
                  <Text className="text-gray-300 text-sm mr-2">💬</Text>
                  <Text className="text-gray-300 text-sm">
                    {commentCount > 0 ? `${commentCount} comments` : 'Add comment'}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Comments Modal */}
      <Modal
        visible={showComments}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseComments}
      >
        <KeyboardAvoidingView 
          className="flex-1 bg-gray-900"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Modal Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-gray-800">
            <Text className="text-white text-lg font-semibold">Comments</Text>
            <Pressable onPress={handleCloseComments}>
              <Text className="text-gray-400 text-lg">✕</Text>
            </Pressable>
          </View>
          
          <CommentsList 
            postId={post.id} 
            isVisible={showComments}
          />
        </KeyboardAvoidingView>
      </Modal>
    </SimpleViewTracker>
  );
};