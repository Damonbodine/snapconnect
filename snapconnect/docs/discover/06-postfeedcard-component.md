# PostFeedCard Component Implementation

## 🎯 Component Overview

The PostFeedCard is the core UI component that displays individual posts in the discover feed. It must handle both photos and videos while integrating view tracking, security features, and the existing design system.

## 🏗️ Component Architecture

### Core Structure
```
PostFeedCard
├── ViewTracker (Ephemeral logic)
├── SecurityWrapper (Screenshot prevention)
├── UserHeader (Avatar, username, fitness level)
├── MediaContent (Photo/Video with security)
├── PostCaption (Text content)
├── PostMetadata (Timestamp, workout type)
└── InteractionZone (Tap handling)
```

## 📱 Main Component Implementation

### PostFeedCard.tsx

```typescript
import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, Image, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../ui/GradientCard';
import { SecureView } from '../security/SecureView';
import { ViewTracker } from '../tracking/ViewTracker';
import { MediaContent } from './MediaContent';
import { UserHeader } from './UserHeader';
import { gradients } from '../../styles/gradients';
import { formatRelativeTime } from '../../utils/dateUtils';

const { width: screenWidth } = Dimensions.get('window');

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

interface PostFeedCardProps {
  post: PostWithUser;
  onViewed?: (postId: string) => void;
  onPress?: (post: PostWithUser) => void;
  isViewingEnabled?: boolean;
  scrollVelocity?: number;
}

export const PostFeedCard: React.FC<PostFeedCardProps> = ({
  post,
  onViewed,
  onPress,
  isViewingEnabled = true,
  scrollVelocity = 0,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  
  // Determine gradient based on fitness level
  const userGradient = useMemo(() => {
    const gradientMap = {
      beginner: 'beginner',
      intermediate: 'intermediate', 
      advanced: 'advanced',
    } as const;
    
    return gradientMap[post.users.fitness_level] || 'primary';
  }, [post.users.fitness_level]);
  
  // Handle view tracking callback
  const handleViewed = useCallback((postId: string, duration: number) => {
    console.log(`Post ${postId} viewed for ${duration}ms`);
    onViewed?.(postId);
  }, [onViewed]);
  
  // Handle post interaction
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(post);
    }
  }, [post, onPress]);
  
  const handlePressIn = useCallback(() => {
    setIsPressed(true);
  }, []);
  
  const handlePressOut = useCallback(() => {
    setIsPressed(false);
  }, []);
  
  return (
    <ViewTracker
      postId={post.id}
      mediaType={post.media_type}
      onViewed={handleViewed}
      enabled={isViewingEnabled}
    >
      <SecureView securityLevel="high" className="mb-6">
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          className={`overflow-hidden rounded-2xl ${isPressed ? 'opacity-95 scale-[0.98]' : ''}`}
          style={{
            transform: [
              { scale: isPressed ? 0.98 : 1 }
            ]
          }}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            className="absolute inset-0 z-10"
          />
          
          {/* User Header */}
          <UserHeader 
            user={post.users}
            gradient={userGradient}
            timestamp={post.created_at}
            workoutType={post.workout_type}
          />
          
          {/* Media Content */}
          <MediaContent
            mediaUrl={post.media_url}
            mediaType={post.media_type}
            scrollVelocity={scrollVelocity}
            postId={post.id}
          />
          
          {/* Post Caption */}
          {post.content && (
            <PostCaption
              content={post.content}
              gradient={userGradient}
            />
          )}
          
          {/* Metadata Footer */}
          <PostFooter
            timestamp={post.created_at}
            workoutType={post.workout_type}
            fitnessLevel={post.users.fitness_level}
          />
        </Pressable>
      </SecureView>
    </ViewTracker>
  );
};
```

## 👤 UserHeader Component

```typescript
import React from 'react';
import { View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../../styles/gradients';
import { formatRelativeTime } from '../../utils/dateUtils';

interface UserHeaderProps {
  user: {
    username: string;
    full_name: string;
    avatar_url: string;
    fitness_level: 'beginner' | 'intermediate' | 'advanced';
  };
  gradient: keyof typeof gradients;
  timestamp: string;
  workoutType?: string;
}

export const UserHeader: React.FC<UserHeaderProps> = ({
  user,
  gradient,
  timestamp,
  workoutType,
}) => {
  return (
    <View className="flex-row items-center p-4 z-20">
      {/* Avatar with Gradient Border */}
      <View className="relative">
        <LinearGradient
          colors={gradients[gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="w-12 h-12 rounded-full items-center justify-center"
        >
          <View className="w-10 h-10 rounded-full overflow-hidden bg-gray-800">
            <Image
              source={{ uri: user.avatar_url }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
        </LinearGradient>
        
        {/* Fitness Level Indicator */}
        <View className="absolute -bottom-1 -right-1">
          <LinearGradient
            colors={gradients[gradient]}
            className="w-6 h-6 rounded-full items-center justify-center"
          >
            <Text className="text-white text-xs font-bold">
              {user.fitness_level.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
        </View>
      </View>
      
      {/* User Info */}
      <View className="flex-1 ml-3">
        <Text className="text-white font-semibold text-base">
          {user.username}
        </Text>
        <View className="flex-row items-center">
          <Text className="text-gray-400 text-sm capitalize">
            {user.fitness_level}
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
      
      {/* Timestamp */}
      <Text className="text-gray-500 text-sm">
        {formatRelativeTime(timestamp)}
      </Text>
    </View>
  );
};
```

## 📱 MediaContent Component

```typescript
import React, { useState, useCallback, useMemo } from 'react';
import { View, Image, Dimensions, ActivityIndicator } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { SecureImage } from '../security/SecureImage';
import { SecureVideo } from '../security/SecureVideo';
import { useVideoViewTracking } from '../../hooks/useVideoViewTracking';

const { width: screenWidth } = Dimensions.get('window');

interface MediaContentProps {
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  scrollVelocity: number;
  postId: string;
}

export const MediaContent: React.FC<MediaContentProps> = ({
  mediaUrl,
  mediaType,
  scrollVelocity,
  postId,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const { onPlaybackStatusUpdate } = useVideoViewTracking(postId);
  
  // Determine if video should autoplay based on scroll velocity
  const shouldAutoplay = useMemo(() => {
    return scrollVelocity < 500; // Only autoplay if not scrolling fast
  }, [scrollVelocity]);
  
  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
  }, []);
  
  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);
  
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);
  
  const renderLoadingState = () => (
    <View className="absolute inset-0 items-center justify-center bg-gray-800">
      <ActivityIndicator size="large" color="#7C3AED" />
    </View>
  );
  
  const renderErrorState = () => (
    <View className="absolute inset-0 items-center justify-center bg-gray-900">
      <Text className="text-gray-400 text-center">
        Failed to load {mediaType}
      </Text>
    </View>
  );
  
  if (mediaType === 'video') {
    return (
      <View 
        style={{ 
          width: screenWidth - 32, 
          aspectRatio: 16/9,
          alignSelf: 'center',
        }}
        className="relative bg-black rounded-xl overflow-hidden"
      >
        <SecureVideo
          source={{ uri: mediaUrl }}
          style={{ width: '100%', height: '100%' }}
          shouldPlay={shouldAutoplay}
          isLooping
          isMuted={true}
          resizeMode={ResizeMode.COVER}
          onLoadStart={handleLoadStart}
          onLoad={handleLoadEnd}
          onError={handleError}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />
        
        {isLoading && renderLoadingState()}
        {hasError && renderErrorState()}
        
        {/* Video Overlay Indicators */}
        <View className="absolute bottom-2 right-2">
          <View className="bg-black/60 rounded-full px-2 py-1">
            <Text className="text-white text-xs">📹</Text>
          </View>
        </View>
      </View>
    );
  }
  
  return (
    <View 
      style={{ 
        width: screenWidth - 32,
        aspectRatio: 1,
        alignSelf: 'center',
      }}
      className="relative bg-gray-800 rounded-xl overflow-hidden"
    >
      <SecureImage
        source={{ uri: mediaUrl }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
      />
      
      {isLoading && renderLoadingState()}
      {hasError && renderErrorState()}
    </View>
  );
};
```

## 💬 PostCaption Component

```typescript
import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../../styles/gradients';

interface PostCaptionProps {
  content: string;
  gradient: keyof typeof gradients;
  maxLines?: number;
}

export const PostCaption: React.FC<PostCaptionProps> = ({
  content,
  gradient,
  maxLines = 3,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReadMore, setShowReadMore] = useState(false);
  
  const handleTextLayout = useCallback((event) => {
    const { lines } = event.nativeEvent;
    setShowReadMore(lines.length > maxLines);
  }, [maxLines]);
  
  const toggleExpanded = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);
  
  return (
    <View className="px-4 pb-2">
      <Text
        className="text-white text-base leading-5"
        numberOfLines={isExpanded ? undefined : maxLines}
        onTextLayout={handleTextLayout}
      >
        {content}
      </Text>
      
      {showReadMore && (
        <Pressable onPress={toggleExpanded} className="mt-1">
          <LinearGradient
            colors={gradients[gradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="self-start px-2 py-1 rounded-full"
          >
            <Text className="text-white text-xs font-medium">
              {isExpanded ? 'Show less' : 'Read more'}
            </Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
};
```

## 📊 PostFooter Component

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import { formatRelativeTime } from '../../utils/dateUtils';

interface PostFooterProps {
  timestamp: string;
  workoutType?: string;
  fitnessLevel: string;
}

export const PostFooter: React.FC<PostFooterProps> = ({
  timestamp,
  workoutType,
  fitnessLevel,
}) => {
  return (
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
      
      <Text className="text-gray-500 text-xs">
        {formatRelativeTime(timestamp)}
      </Text>
    </View>
  );
};
```

## 🎨 Styling and Animations

### Gesture Animations

```typescript
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

export const usePostCardAnimations = () => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  
  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.98, { damping: 15 });
    opacity.value = withSpring(0.9);
  }, []);
  
  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15 });
    opacity.value = withSpring(1);
  }, []);
  
  return {
    animatedStyle,
    onPressIn,
    onPressOut,
  };
};
```

### Dynamic Gradients

```typescript
export const getWorkoutGradient = (workoutType?: string) => {
  const workoutGradients = {
    cardio: 'cardio',
    strength: 'strength', 
    flexibility: 'flexibility',
    recovery: 'recovery',
  } as const;
  
  return workoutType && workoutType in workoutGradients
    ? workoutGradients[workoutType as keyof typeof workoutGradients]
    : 'primary';
};
```

## 🔧 Performance Optimizations

### Memoization Strategy

```typescript
export const PostFeedCard = React.memo<PostFeedCardProps>(({
  post,
  onViewed,
  onPress,
  isViewingEnabled,
  scrollVelocity,
}) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison for memo optimization
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.isViewingEnabled === nextProps.isViewingEnabled &&
    Math.abs(prevProps.scrollVelocity - nextProps.scrollVelocity) < 100
  );
});
```

### Image Optimization

```typescript
const useOptimizedImage = (uri: string) => {
  const optimizedUri = useMemo(() => {
    // Add image optimization parameters
    const url = new URL(uri);
    url.searchParams.set('w', '400'); // Max width
    url.searchParams.set('h', '400'); // Max height
    url.searchParams.set('f', 'webp'); // Format
    url.searchParams.set('q', '80'); // Quality
    return url.toString();
  }, [uri]);
  
  return optimizedUri;
};
```

## 🧪 Testing Utilities

### Component Testing

```typescript
// PostFeedCard.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PostFeedCard } from './PostFeedCard';

const mockPost = {
  id: 'test-post-1',
  content: 'Test workout post',
  media_url: 'https://example.com/image.jpg',
  media_type: 'photo' as const,
  created_at: '2024-01-01T12:00:00Z',
  users: {
    username: 'testuser',
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    fitness_level: 'intermediate' as const,
  },
};

describe('PostFeedCard', () => {
  it('renders post content correctly', () => {
    const { getByText } = render(
      <PostFeedCard post={mockPost} />
    );
    
    expect(getByText('testuser')).toBeTruthy();
    expect(getByText('Test workout post')).toBeTruthy();
    expect(getByText('intermediate')).toBeTruthy();
  });
  
  it('calls onViewed when view tracking triggers', () => {
    const onViewed = jest.fn();
    render(
      <PostFeedCard post={mockPost} onViewed={onViewed} />
    );
    
    // Mock view tracking trigger
    // This would require mocking the ViewTracker component
  });
  
  it('handles press interactions', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <PostFeedCard post={mockPost} onPress={onPress} />
    );
    
    fireEvent.press(getByTestId('post-card'));
    expect(onPress).toHaveBeenCalledWith(mockPost);
  });
});
```

## 📋 Usage Examples

### Basic Usage

```typescript
// In DiscoverFeed component
const renderPost = useCallback(({ item }: { item: PostWithUser }) => (
  <PostFeedCard
    key={item.id}
    post={item}
    onViewed={handlePostViewed}
    onPress={handlePostPress}
    scrollVelocity={scrollVelocity}
  />
), [handlePostViewed, handlePostPress, scrollVelocity]);
```

### With Custom Styling

```typescript
<PostFeedCard
  post={post}
  onViewed={trackView}
  className="mx-4 shadow-lg"
  isViewingEnabled={!isOffline}
/>
```

### Debug Mode

```typescript
<PostFeedCard
  post={post}
  onViewed={trackView}
  debugMode={__DEV__}
  showViewTrackingInfo={true}
/>
```

## 🔗 Integration Points

### With ViewTracker
- Wraps entire card for view detection
- Passes through view events to parent

### With Security System
- Uses SecureView for screenshot prevention
- Implements SecureImage/SecureVideo for media

### With Store
- Receives post data from DiscoverStore
- Updates viewed state optimistically

### With Design System
- Uses GradientCard patterns
- Follows existing spacing and typography

---

**Status**: Component architecture defined  
**Dependencies**: ViewTracker, Security components, Design system  
**Performance**: Optimized for large lists with memoization  
**Accessibility**: Follows React Native accessibility guidelines