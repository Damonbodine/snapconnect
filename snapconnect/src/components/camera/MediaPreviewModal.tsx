import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  TextInput,
  Dimensions,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { MediaFile } from '../../types/media';
import { UploadProgress, mediaUploadService } from '../../services/mediaUploadService';
import { GradientCard } from '../ui/GradientCard';
import { gradients } from '../../styles/gradients';
import { springConfigs } from '../../utils/animations/springs';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface MediaPreviewModalProps {
  visible: boolean;
  media: MediaFile | null;
  userId: string;
  onClose: () => void;
  onRetake: () => void;
  onPost: (media: MediaFile, caption: string, workoutType?: string) => void;
  isLoading?: boolean;
}

const WORKOUT_TYPES = [
  { id: 'cardio', label: 'Cardio', emoji: '❤️' },
  { id: 'strength', label: 'Strength', emoji: '💪' },
  { id: 'flexibility', label: 'Flexibility', emoji: '🧘' },
  { id: 'recovery', label: 'Recovery', emoji: '😌' },
  { id: 'other', label: 'Other', emoji: '🏃' },
];

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  visible,
  media,
  userId,
  onClose,
  onRetake,
  onPost,
  isLoading = false,
}) => {
  const [caption, setCaption] = useState('');
  const [selectedWorkoutType, setSelectedWorkoutType] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    progress: 0,
    isCompleted: false,
  });

  // Animation values
  const uploadProgressWidth = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  // Video player for expo-video
  const videoPlayer = useVideoPlayer(media?.type === 'video' ? media.uri : '', (player) => {
    try {
      console.log('📱 VIDEO DEBUG: ============ VIDEO PLAYER SETUP ============');
      console.log('📱 VIDEO DEBUG: Setting up video player for URI:', media?.uri);
      console.log('📱 VIDEO DEBUG: Media type:', media?.type);
      console.log('📱 VIDEO DEBUG: Media duration:', media?.duration);
      
      player.loop = true;
      player.play();
      
      console.log('📱 VIDEO DEBUG: Video player setup completed');
    } catch (playerError) {
      console.error('📱 VIDEO DEBUG: CRASH in video player setup:', playerError);
      console.error('📱 VIDEO DEBUG: Player error stack:', playerError?.stack);
    }
  });

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (visible) {
      setCaption('');
      setSelectedWorkoutType(undefined);
      setIsUploading(false);
      setUploadProgress({ progress: 0, isCompleted: false });
      uploadProgressWidth.value = 0;
    }
  }, [visible]);

  // Update progress animation
  React.useEffect(() => {
    uploadProgressWidth.value = withTiming(uploadProgress.progress / 100, {
      duration: 300,
    });
  }, [uploadProgress.progress]);

  // Animation styles
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${uploadProgressWidth.value * 100}%`,
  }));

  const postButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePost = async () => {
    if (!media || isUploading || isLoading) return;

    try {
      setIsUploading(true);
      buttonScale.value = withSpring(0.95, springConfigs.gentle);

      // Call parent handler - it will handle upload and database save
      onPost(media, caption, selectedWorkoutType);
      
      // Reset state
      setIsUploading(false);
      buttonScale.value = withSpring(1, springConfigs.gentle);
    } catch (error) {
      console.error('Error in handlePost:', error);
      setIsUploading(false);
      buttonScale.value = withSpring(1, springConfigs.gentle);
    }
  };

  const handleRetake = () => {
    if (isUploading) return;
    onRetake();
  };

  const handleClose = () => {
    if (isUploading) return;
    onClose();
  };

  if (!media) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarHidden
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#0F0F0F', '#1F1F1F']}
          style={styles.background}
        >
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Header */}
            <View style={styles.header}>
              <Pressable style={styles.headerButton} onPress={handleClose}>
                <BlurView intensity={20} style={styles.blurButton}>
                  <Text style={styles.headerIcon}>✕</Text>
                </BlurView>
              </Pressable>
              
              <Text style={styles.headerTitle}>Preview</Text>
              
              <Pressable style={styles.headerButton} onPress={handleRetake}>
                <BlurView intensity={20} style={styles.blurButton}>
                  <Text style={styles.headerIcon}>🔄</Text>
                </BlurView>
              </Pressable>
            </View>

            <ScrollView 
              style={styles.content} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }} // Add padding for bottom actions
            >
              {/* Media preview */}
              <View style={styles.mediaContainer}>
                {media.type === 'photo' ? (
                  <Image 
                    source={{ uri: media.uri }} 
                    style={styles.media}
                    onLoad={() => {
                      console.log('🔍 FILTER DEBUG: Preview image loaded successfully');
                    }}
                    onError={(error) => {
                      console.error('🔍 FILTER DEBUG: Preview image load error:', error);
                      console.error('🔍 FILTER DEBUG: Failed URI:', media.uri);
                    }}
                    onLoadStart={() => {
                      console.log('🔍 FILTER DEBUG: Preview image load started for URI:', media.uri);
                    }}
                  />
                ) : (
                  (() => {
                    try {
                      console.log('📱 VIDEO DEBUG: ============ RENDERING VIDEO VIEW ============');
                      console.log('📱 VIDEO DEBUG: VideoView render for:', media?.uri);
                      console.log('📱 VIDEO DEBUG: Player exists:', !!videoPlayer);
                      
                      return (
                        <VideoView
                          player={videoPlayer}
                          style={styles.media}
                          allowsFullscreen={false}
                          allowsPictureInPicture={false}
                          onVideoLoadStart={() => {
                            console.log('📱 VIDEO DEBUG: Video load started');
                          }}
                          onVideoLoad={(event) => {
                            console.log('📱 VIDEO DEBUG: Video loaded successfully:', event);
                          }}
                          onVideoError={(error) => {
                            console.error('📱 VIDEO DEBUG: Video load error:', error);
                          }}
                        />
                      );
                    } catch (renderError) {
                      console.error('📱 VIDEO DEBUG: CRASH rendering VideoView:', renderError);
                      return (
                        <View style={styles.media}>
                          <Text style={{ color: 'white', textAlign: 'center' }}>
                            Video Error: {renderError.message}
                          </Text>
                        </View>
                      );
                    }
                  })()
                )}
                
                {/* Filter indicator overlay */}
                {media.filter && (
                  <View style={styles.filterIndicator}>
                    <BlurView intensity={20} style={styles.filterIndicatorBlur}>
                      <Text style={styles.filterIndicatorText}>✨ {media.filter.name}</Text>
                    </BlurView>
                  </View>
                )}
              </View>

              {/* Caption input */}
              <View style={styles.captionContainer}>
                <Text style={styles.sectionTitle}>Caption</Text>
                <TextInput
                  style={styles.captionInput}
                  placeholder="What's your workout about?"
                  placeholderTextColor="#666"
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  maxLength={280}
                  returnKeyType="done"
                />
                <Text style={styles.characterCount}>
                  {caption.length}/280
                </Text>
              </View>

              {/* Workout type selector */}
              <View style={styles.workoutTypeContainer}>
                <Text style={styles.sectionTitle}>Workout Type</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.workoutTypeScroll}
                >
                  {WORKOUT_TYPES.map((type) => (
                    <Pressable
                      key={type.id}
                      onPress={() => setSelectedWorkoutType(
                        selectedWorkoutType === type.id ? undefined : type.id
                      )}
                    >
                      <GradientCard
                        gradient={selectedWorkoutType === type.id ? 'primary' : 'dark'}
                        className="mr-3"
                        style={styles.workoutTypeCard}
                      >
                        <Text style={styles.workoutTypeEmoji}>{type.emoji}</Text>
                        <Text style={[
                          styles.workoutTypeLabel,
                          selectedWorkoutType === type.id && styles.workoutTypeLabelSelected
                        ]}>
                          {type.label}
                        </Text>
                      </GradientCard>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Upload progress */}
              {isUploading && (
                <View style={styles.uploadContainer}>
                  <Text style={styles.uploadText}>
                    Uploading... {Math.round(uploadProgress.progress)}%
                  </Text>
                  <View style={styles.progressBar}>
                    <Animated.View style={[styles.progressFill, progressBarStyle]} />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Bottom actions */}
            <View style={styles.bottomActions}>
              <AnimatedPressable
                style={[styles.postButton, postButtonStyle]}
                onPress={handlePost}
                disabled={isUploading}
              >
                <LinearGradient
                  colors={isUploading ? gradients.dark : gradients.primary}
                  style={styles.postButtonGradient}
                >
                  <Text style={styles.postButtonText}>
                    {isUploading ? 'Uploading...' : 'Post'}
                  </Text>
                </LinearGradient>
              </AnimatedPressable>
            </View>
          </KeyboardAvoidingView>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerButton: {
    width: 44,
    height: 44,
  },
  blurButton: {
    flex: 1,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerIcon: {
    fontSize: 18,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  mediaContainer: {
    aspectRatio: 1, // Square aspect ratio for more compact display
    maxHeight: screenHeight * 0.35, // Reduced to 35% of screen height
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16, // Reduced margin
    backgroundColor: '#000',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  captionContainer: {
    marginBottom: 16, // Reduced margin
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  captionInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12, // Reduced padding
    color: '#fff',
    fontSize: 16,
    minHeight: 60, // Reduced min height
    textAlignVertical: 'top',
  },
  characterCount: {
    textAlign: 'right',
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
  workoutTypeContainer: {
    marginBottom: 16, // Reduced margin
  },
  workoutTypeScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  workoutTypeCard: {
    minWidth: 80,
    alignItems: 'center',
  },
  workoutTypeEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  workoutTypeLabel: {
    fontSize: 12,
    color: '#ccc',
    fontWeight: '500',
  },
  workoutTypeLabelSelected: {
    color: '#fff',
  },
  uploadContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  uploadText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  bottomActions: {
    padding: 20,
    paddingBottom: 40,
  },
  postButton: {
    height: 56,
  },
  postButtonGradient: {
    flex: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  filterIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
  },
  filterIndicatorBlur: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  filterIndicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});