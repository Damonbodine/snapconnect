import React, { useState } from 'react';
import { View, Alert, Text } from 'react-native';
import { router } from 'expo-router';
import { CameraInterface } from '../../src/components/camera/CameraInterface';
import { MediaPreviewModal } from '../../src/components/camera/MediaPreviewModal';
import { MediaFile } from '../../src/types/media';
import { useAuthStore } from '../../src/stores/authStore';
import { postService } from '../../src/services/postService';

export default function CameraScreen() {
  const [capturedMedia, setCapturedMedia] = useState<MediaFile | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const { user } = useAuthStore();

  const handleMediaCaptured = (media: MediaFile) => {
    console.log('📱 VIDEO DEBUG: ============ CAMERA SCREEN RECEIVED MEDIA ============');
    console.log('📱 VIDEO DEBUG: Media captured:', media);
    console.log('📱 VIDEO DEBUG: Media URI:', media.uri);
    console.log('📱 VIDEO DEBUG: Media type:', media.type);
    console.log('📱 VIDEO DEBUG: Media duration:', media.duration);
    console.log('📱 VIDEO DEBUG: Media dimensions:', media.width, 'x', media.height);
    
    try {
      console.log('📱 VIDEO DEBUG: Setting captured media...');
      setCapturedMedia(media);
      
      console.log('📱 VIDEO DEBUG: Setting show preview to true...');
      setShowPreview(true);
      
      console.log('📱 VIDEO DEBUG: Camera screen processing completed successfully');
    } catch (error) {
      console.error('📱 VIDEO DEBUG: CRASH in handleMediaCaptured:', error);
      console.error('📱 VIDEO DEBUG: Error stack:', error?.stack);
    }
  };

  const handleRetake = () => {
    setShowPreview(false);
    setCapturedMedia(null);
  };

  const handlePost = async (media: MediaFile, caption: string, workoutType?: string) => {
    if (isCreatingPost) return;
    
    try {
      setIsCreatingPost(true);
      console.log('📱 Creating post with:', { caption, workoutType, mediaType: media.type });
      
      // Create post with media upload
      const post = await postService.createPost(
        user!.id,
        {
          content: caption,
          workoutType,
          media,
        },
        (progress) => {
          console.log('📱 Post creation progress:', progress);
        }
      );
      
      console.log('📱 Post created successfully:', post.id);
      
      Alert.alert(
        'Post Created!',
        'Your photo/video has been shared to your fitness feed.',
        [
          {
            text: 'View in Discover',
            onPress: () => {
              setShowPreview(false);
              setCapturedMedia(null);
              setIsCreatingPost(false);
              router.push('/(tabs)/discover');
            },
          },
          {
            text: 'Take Another',
            onPress: () => {
              setShowPreview(false);
              setCapturedMedia(null);
              setIsCreatingPost(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('📱 Error creating post:', error);
      setIsCreatingPost(false);
      Alert.alert(
        'Upload Failed', 
        error instanceof Error ? error.message : 'Failed to create post. Please try again.'
      );
    }
  };

  const handleClose = () => {
    // Navigate back to a default tab or stay in camera
    router.back();
  };

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white text-lg">Please log in to use the camera</Text>
      </View>
    );
  }

  // Debug logging
  console.log('🔍 Camera screen - User logged in:', !!user);
  console.log('🔍 User ID:', user?.id);

  return (
    <View className="flex-1">
      <CameraInterface
        onMediaCaptured={handleMediaCaptured}
        onClose={handleClose}
      />
      
      <MediaPreviewModal
        visible={showPreview}
        media={capturedMedia}
        userId={user.id}
        onClose={() => {
          if (!isCreatingPost) {
            setShowPreview(false);
          }
        }}
        onRetake={handleRetake}
        onPost={handlePost}
        isLoading={isCreatingPost}
      />
    </View>
  );
}