import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, PhotoFile, VideoFile } from 'react-native-vision-camera';
// Face detection is optional - only available in development builds
let FaceDetector: any = null;
try {
  FaceDetector = require('expo-face-detector');
} catch (error) {
  console.log('Face detector not available in this build');
}
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { MediaFile, FaceDetectionResult, FilterAsset } from '../../types/media';
import { gradients } from '../../styles/gradients';
import { springConfigs } from '../../utils/animations/springs';
import { FaceOverlay } from './FaceOverlay';
import { FilterSelector } from './FilterSelector';
import { LiveFilterOverlay } from './LiveFilterOverlay';
import { InteractiveFilterOverlay } from './InteractiveFilterOverlay';
import { TextInputModal } from './TextInputModal';
import { FILTER_LIBRARY, getDefaultFilter } from '../../constants/filters';
import { NativeFilterCompositor } from '../../services/nativeFilterCompositor';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CameraInterfaceProps {
  onMediaCaptured: (media: MediaFile) => void;
  onClose?: () => void;
}

export const CameraInterface: React.FC<CameraInterfaceProps> = ({
  onMediaCaptured,
  onClose,
}) => {
  // Camera state
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
  
  // AR Filter state
  const [faces, setFaces] = useState<FaceDetectionResult[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterAsset>(getDefaultFilter());
  const [showFilterSelector, setShowFilterSelector] = useState(false);
  const [isComposingFilter, setIsComposingFilter] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{uri: string; width: number; height: number} | null>(null);
  
  // Text input modal state
  const [showTextInput, setShowTextInput] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  
  // User filter customization state
  const [filterTransform, setFilterTransform] = useState({
    scale: 1,
    x: 0,
    y: 0,
    rotation: 0,
  });
  
  // Camera permissions and device
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice(facing);
  
  // Refs
  const cameraRef = useRef<Camera>(null);
  const cameraContainerRef = useRef<View>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingPromiseRef = useRef<Promise<any> | null>(null);
  const faceDetectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animations
  const recordButtonScale = useSharedValue(1);
  const recordingProgress = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  
  // Optimized face detection with throttling and error recovery
  const detectFaces = async () => {
    if (!cameraRef.current || !isCameraReady || !device || !FaceDetector) return;
    
    // Throttle face detection to prevent performance issues
    if (isComposingFilter || isRecording) return;
    
    try {
      // Use takeSnapshot for faster, lower quality face detection
      const snapshot = await cameraRef.current.takeSnapshot({
        quality: 85, // Lower quality for performance
        skipMetadata: true,
      });
      
      if (snapshot?.path) {
        // VisionCamera already returns path with file:// prefix
        const snapshotUri = snapshot.path;
        const detectedFaces = await FaceDetector.detectFacesAsync(snapshotUri, {
          mode: FaceDetector.FaceDetectorMode.fast,
          detectLandmarks: activeFilter.position ? FaceDetector.FaceDetectorLandmarks.all : FaceDetector.FaceDetectorLandmarks.none,
          runClassifications: FaceDetector.FaceDetectorClassifications.none, // Skip expressions for performance
        });
        
        const processedFaces: FaceDetectionResult[] = detectedFaces.map((face, index) => ({
          faceID: face.faceID || index,
          bounds: face.bounds,
          landmarks: face.landmarks,
          expressions: {
            smilingProbability: face.smilingProbability,
            leftEyeOpenProbability: face.leftEyeOpenProbability,
            rightEyeOpenProbability: face.rightEyeOpenProbability,
          },
        }));
        setFaces(processedFaces);
      }
    } catch (error) {
      console.log('Face detection error:', error);
      // Clear faces on error to prevent stale data
      setFaces([]);
    }
  };
  
  // Filter selection handler
  const handleFilterSelect = (filter: FilterAsset) => {
    if (filter.type === 'text' && filter.id === 'custom_text') {
      // Open text input modal for custom text
      setShowTextInput(true);
      setShowFilterSelector(false);
    } else {
      setActiveFilter(filter);
      setShowFilterSelector(false);
      // Reset transform when changing filters
      setFilterTransform({
        scale: 1,
        x: 0,
        y: 0,
        rotation: 0,
      });
    }
  };
  
  // Filter transform handler
  const handleFilterTransformChange = (newTransform: typeof filterTransform) => {
    setFilterTransform(newTransform);
  };

  // Text input submission handler
  const handleTextSubmit = (text: string, options: any) => {
    const customTextFilter: FilterAsset = {
      id: 'custom_text_active',
      name: 'Custom Text',
      type: 'text',
      category: 'text',
      thumbnail: '📝',
      asset: text,
      customText: text,
      textColor: options.color,
      fontSize: options.fontSize,
      fontWeight: options.fontWeight,
      fontStyle: options.fontStyle,
    };
    
    setActiveFilter(customTextFilter);
    setShowTextInput(false);
    
    // Only reset transform for new text, not edited text
    if (!isEditingText) {
      setFilterTransform({
        scale: 1,
        x: 0,
        y: 0,
        rotation: 0,
      });
    }
    // For edited text, keep the current transform (position, scale, rotation)
    // The filterTransform state already contains the user's adjustments
    
    setIsEditingText(false);
  };

  // Edit text handler
  const handleEditText = () => {
    if (activeFilter.type === 'text') {
      setIsEditingText(true);
      setShowTextInput(true);
    }
  };
  
  // Toggle filter selector
  const toggleFilterSelector = () => {
    setShowFilterSelector(prev => !prev);
  };
  
  // Handle Skia composition completion
  const handleFilterCompositionComplete = (compositedImageUri: string) => {
    console.log('🎨 Filter composition complete:', compositedImageUri);
    console.log('🔍 FILTER DEBUG: Composited image URI:', compositedImageUri);
    console.log('🔍 FILTER DEBUG: URI starts with file://?', compositedImageUri.startsWith('file://'));
    console.log('🔍 FILTER DEBUG: URI length:', compositedImageUri.length);
    
    setIsComposingFilter(false);
    
    if (pendingPhoto) {
      const mediaFile: MediaFile = {
        uri: compositedImageUri,
        type: 'photo',
        width: pendingPhoto.width,
        height: pendingPhoto.height,
        filter: {
          id: activeFilter.id,
          name: activeFilter.name,
          type: activeFilter.type,
        },
      };
      console.log('📸 Calling onMediaCaptured with filtered photo:', mediaFile);
      console.log('🔍 FILTER DEBUG: Final media file URI:', mediaFile.uri);
      onMediaCaptured(mediaFile);
      setPendingPhoto(null);
    }
  };
  
  // Optimized face detection timer with adaptive intervals
  useEffect(() => {
    // Only run face detection when:
    // 1. Camera is ready
    // 2. A filter is active (not 'none')
    // 3. Not currently recording or composing (to avoid interference)
    if (isCameraReady && activeFilter.id !== 'none' && !isRecording && !isComposingFilter) {
      // Use adaptive interval based on performance
      const detectionInterval = faces.length > 0 ? 1000 : 800; // Slower when faces detected, faster when searching
      
      // Start face detection timer
      faceDetectionTimerRef.current = setInterval(() => {
        detectFaces();
      }, detectionInterval);
    } else {
      // Clear face detection timer
      if (faceDetectionTimerRef.current) {
        clearInterval(faceDetectionTimerRef.current);
        faceDetectionTimerRef.current = null;
      }
      // Clear faces when no filter is active
      if (activeFilter.id === 'none') {
        setFaces([]);
      }
    }
    
    return () => {
      if (faceDetectionTimerRef.current) {
        clearInterval(faceDetectionTimerRef.current);
        faceDetectionTimerRef.current = null;
      }
    };
  }, [isCameraReady, activeFilter.id, isRecording, isComposingFilter, faces.length]);

  // Handle permissions
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Reset recording state on mount to prevent stuck state
  useEffect(() => {
    console.log('🔄 Component mounted, resetting recording state');
    setIsRecording(false);
    setRecordingDuration(0);
    recordingProgress.value = 0;
  }, []);

  // Recording timer effect - NO shared value updates here
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const newDuration = prev + 0.1;
          
          // Auto-stop at 10 seconds
          if (newDuration >= 10) {
            handleStopRecording();
            return 10;
          }
          return newDuration;
        });
      }, 100);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingDuration(0);
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
      }
      if (faceDetectionTimerRef.current) {
        clearInterval(faceDetectionTimerRef.current);
      }
    };
  }, [isRecording]);

  // Separate effect for recording progress animation - safer pattern
  useEffect(() => {
    if (isRecording) {
      recordingProgress.value = withTiming(recordingDuration / 10, { duration: 100 });
    } else {
      recordingProgress.value = withTiming(0, { duration: 200 });
    }
  }, [recordingDuration, isRecording]);

  // Separate effect for record button animation - safer pattern
  useEffect(() => {
    if (isRecording) {
      recordButtonScale.value = withSpring(0.8, springConfigs.gentle);
    } else {
      recordButtonScale.value = withSpring(1, springConfigs.gentle);
    }
  }, [isRecording]);

  // Animation styles
  const recordButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordButtonScale.value }],
  }));

  const recordingProgressStyle = useAnimatedStyle(() => ({
    width: `${interpolate(recordingProgress.value, [0, 10], [0, 100])}%`,
  }));

  const flashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  // Reset recording state
  const resetRecordingState = () => {
    console.log('🎥 VIDEO DEBUG: ============ RESET RECORDING STATE ============');
    console.log('🎥 VIDEO DEBUG: Resetting recording state');
    console.log('🎥 VIDEO DEBUG: Previous state - isRecording:', isRecording);
    console.log('🎥 VIDEO DEBUG: Previous state - recordingDuration:', recordingDuration);
    
    try {
      // Clear any timers first
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
        console.log('🎥 VIDEO DEBUG: Cleared recording timer');
      }
      
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
        console.log('🎥 VIDEO DEBUG: Cleared press timer');
      }
      
      // Reset state variables immediately
      setIsRecording(false);
      setRecordingDuration(0);
      
      // Shared value updates now handled by separate effects
      console.log('🎥 VIDEO DEBUG: State reset completed, animations handled by effects');
      
      console.log('🎥 VIDEO DEBUG: Recording state reset completed');
    } catch (error) {
      console.error('🎥 VIDEO DEBUG: Error resetting recording state:', error);
    }
  };

  // Camera ready callback
  const handleCameraReady = () => {
    console.log('📷 Camera is ready');
    setIsCameraReady(true);
  };

  // Take photo
  const handleTakePhoto = async () => {
    console.log('🔍 handleTakePhoto called');
    console.log('🔍 Camera ready:', isCameraReady);
    console.log('🔍 Camera ref exists:', !!cameraRef.current);
    console.log('🔍 Is recording:', isRecording);
    
    if (!cameraRef.current || !isCameraReady) {
      console.log('❌ Camera not ready or no camera ref');
      Alert.alert('Camera Not Ready', 'Please wait for camera to initialize.');
      return;
    }

    // Don't take photo if we're recording
    if (isRecording) {
      console.log('⚠️ Currently recording, ignoring photo request');
      return;
    }

    try {
      console.log('📸 Taking photo...');
      
      // Switch to picture mode
      setCameraMode('picture');
      
      // Flash animation
      flashOpacity.value = withTiming(1, { duration: 100 }, () => {
        flashOpacity.value = withTiming(0, { duration: 200 });
      });

      // Take regular camera photo first
      console.log('📸 Calling takePhoto...');
      const photo = await cameraRef.current.takePhoto({
        flash: flash,
        enableShutterSound: false,
      });

      console.log('📸 Photo result:', photo);
      console.log('📸 Photo path:', photo?.path);

      if (photo && photo.path) {
        // VisionCamera already returns path with file:// prefix
        const photoUri = photo.path;
        console.log('✅ Photo captured:', photoUri);
        
        // VisionCamera doesn't provide dimensions directly, so we'll estimate or get them later
        const estimatedWidth = 1080; // Common mobile photo width
        const estimatedHeight = 1920; // Common mobile photo height
        
        // If we have an active filter, compose it with Skia
        if (activeFilter.id !== 'none') {
          console.log('🎨 CAMERA DEBUG: ============ FILTER COMPOSITION ============');
          console.log('🎨 CAMERA DEBUG: Filter active, starting composition...');
          console.log('🎨 CAMERA DEBUG: Active filter:', activeFilter);
          console.log('🎨 CAMERA DEBUG: Current filter transform:', filterTransform);
          console.log('🎨 CAMERA DEBUG: Photo URI:', photoUri);
          console.log('🎨 CAMERA DEBUG: Estimated dimensions:', estimatedWidth, 'x', estimatedHeight);
          console.log('🎨 CAMERA DEBUG: ========================================');
          setIsComposingFilter(true);
          setPendingPhoto({
            uri: photoUri,
            width: estimatedWidth,
            height: estimatedHeight,
          });
          // The Skia compositor will handle the rest
        } else {
          // No filter, use photo as-is
          const mediaFile: MediaFile = {
            uri: photoUri,
            type: 'photo',
            width: estimatedWidth,
            height: estimatedHeight,
          };
          console.log('📸 Calling onMediaCaptured with original photo:', mediaFile);
          onMediaCaptured(mediaFile);
        }
      } else {
        console.log('❌ No photo returned');
        Alert.alert('Error', 'Failed to capture photo. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Start recording
  const handleStartRecording = async () => {
    console.log('🎥 VIDEO DEBUG: ============ START RECORDING ============');
    console.log('🎥 VIDEO DEBUG: handleStartRecording called');
    console.log('🎥 VIDEO DEBUG: Camera ready:', isCameraReady);
    console.log('🎥 VIDEO DEBUG: Already recording:', isRecording);
    console.log('🎥 VIDEO DEBUG: Camera ref exists:', !!cameraRef.current);
    console.log('🎥 VIDEO DEBUG: Device:', device);
    console.log('🎥 VIDEO DEBUG: Flash setting:', flash);
    
    if (!cameraRef.current || !isCameraReady || isRecording) {
      console.log('❌ VIDEO DEBUG: Start recording early return - not ready or already recording');
      return;
    }

    try {
      console.log('🎥 VIDEO DEBUG: Starting video recording...');
      setIsRecording(true);
      setCameraMode('video');
      
      // Clear any existing recording promise
      recordingPromiseRef.current = null;
      
      console.log('🎥 VIDEO DEBUG: About to call startRecording...');
      
      // Start recording with VisionCamera API
      cameraRef.current.startRecording({
        onRecordingFinished: (video) => {
          console.log('🎥 VIDEO DEBUG: ============ RECORDING FINISHED ============');
          console.log('🎥 VIDEO DEBUG: Video object:', video);
          console.log('🎥 VIDEO DEBUG: Video path:', video?.path);
          console.log('🎥 VIDEO DEBUG: Video duration from VisionCamera:', video?.duration);
          console.log('🎥 VIDEO DEBUG: Video dimensions from VisionCamera:', video?.width, 'x', video?.height);
          console.log('🎥 VIDEO DEBUG: Our recorded duration:', recordingDuration);
          
          // Reset recording state FIRST to prevent race conditions
          console.log('🎥 VIDEO DEBUG: Resetting recording state FIRST...');
          
          // Clear timers and basic state immediately
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
          if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
          }
          setIsRecording(false);
          setRecordingDuration(0);
          
          // Shared value updates now handled by separate effects
          
          try {
            if (video && video.path) {
              // VisionCamera already returns path with file:// prefix
              const videoUri = video.path;
              console.log('🎥 VIDEO DEBUG: Processing video URI:', videoUri);
              
              // Use VisionCamera's duration if available, fallback to our timer
              const actualDuration = video.duration || recordingDuration;
              
              // Handle missing or invalid dimensions
              const videoWidth = video.width > 0 ? video.width : 1080; // Fallback width
              const videoHeight = video.height > 0 ? video.height : 1920; // Fallback height
              
              console.log('🎥 VIDEO DEBUG: Using duration:', actualDuration);
              console.log('🎥 VIDEO DEBUG: Using dimensions:', videoWidth, 'x', videoHeight);
              
              const mediaFile: MediaFile = {
                uri: videoUri,
                type: 'video',
                duration: actualDuration,
                width: videoWidth,
                height: videoHeight,
                filter: activeFilter.id !== 'none' ? {
                  id: activeFilter.id,
                  name: activeFilter.name,
                  type: activeFilter.type,
                } : undefined,
              };
              
              console.log('🎥 VIDEO DEBUG: Created media file:', mediaFile);
              console.log('🎥 VIDEO DEBUG: Calling onMediaCaptured...');
              
              // Use longer setTimeout to ensure we're completely outside the render cycle
              setTimeout(() => {
                try {
                  console.log('🎥 VIDEO DEBUG: About to call onMediaCaptured...');
                  console.log('🎥 VIDEO DEBUG: Media file being passed:', JSON.stringify(mediaFile, null, 2));
                  onMediaCaptured(mediaFile);
                  console.log('🎥 VIDEO DEBUG: onMediaCaptured call completed successfully');
                } catch (captureError) {
                  console.error('🎥 VIDEO DEBUG: CRASH in onMediaCaptured:', captureError);
                  console.error('🎥 VIDEO DEBUG: Error stack:', captureError?.stack);
                  Alert.alert('Error', `Failed to process recorded video: ${captureError?.message}`);
                }
              }, 300); // Increased delay to ensure render cycle is complete
              
            } else {
              console.error('🎥 VIDEO DEBUG: No video or video path received');
              Alert.alert('Error', 'Video recording failed - no file created.');
            }
          } catch (callbackError) {
            console.error('🎥 VIDEO DEBUG: Error in onRecordingFinished callback:', callbackError);
            Alert.alert('Error', 'Failed to process recorded video.');
          }
        },
        onRecordingError: (error) => {
          console.error('🎥 VIDEO DEBUG: ============ RECORDING ERROR ============');
          console.error('🎥 VIDEO DEBUG: Recording error:', error);
          console.error('🎥 VIDEO DEBUG: Error type:', typeof error);
          console.error('🎥 VIDEO DEBUG: Error message:', error?.message);
          console.error('🎥 VIDEO DEBUG: Error code:', error?.code);
          console.error('🎥 VIDEO DEBUG: Error cause:', error?.cause);
          Alert.alert('Recording Error', `Failed to record video: ${error?.message || 'Unknown error'}`);
          resetRecordingState();
        },
        flash: flash,
        videoCodec: 'h264',
      });
      
      console.log('🎥 VIDEO DEBUG: startRecording call completed successfully');
      
    } catch (error) {
      console.error('🎥 VIDEO DEBUG: ============ START RECORDING ERROR ============');
      console.error('🎥 VIDEO DEBUG: Error starting recording:', error);
      console.error('🎥 VIDEO DEBUG: Error type:', typeof error);
      console.error('🎥 VIDEO DEBUG: Error message:', error?.message);
      console.error('🎥 VIDEO DEBUG: Error stack:', error?.stack);
      Alert.alert('Recording Error', `Failed to start recording: ${error?.message || 'Unknown error'}`);
      resetRecordingState();
    }
  };

  // Stop recording
  const handleStopRecording = async () => {
    console.log('🎥 VIDEO DEBUG: ============ STOP RECORDING ============');
    console.log('🎥 VIDEO DEBUG: handleStopRecording called');
    console.log('🎥 VIDEO DEBUG: Current recording state:', isRecording);
    console.log('🎥 VIDEO DEBUG: Recording promise exists:', !!recordingPromiseRef.current);
    console.log('🎥 VIDEO DEBUG: Camera ref exists:', !!cameraRef.current);
    console.log('🎥 VIDEO DEBUG: Recording duration so far:', recordingDuration);
    
    if (!isRecording || !cameraRef.current) {
      console.log('❌ VIDEO DEBUG: Stop recording early return - not recording or no camera ref');
      console.log('❌ VIDEO DEBUG: isRecording:', isRecording);
      console.log('❌ VIDEO DEBUG: cameraRef.current:', !!cameraRef.current);
      return;
    }

    try {
      console.log('🎥 VIDEO DEBUG: About to call stopRecording on camera...');
      
      // Call stopRecording which will trigger the onRecordingFinished callback
      cameraRef.current.stopRecording();
      console.log('🎥 VIDEO DEBUG: stopRecording call completed successfully');
      
    } catch (error) {
      console.error('🎥 VIDEO DEBUG: ============ STOP RECORDING ERROR ============');
      console.error('🎥 VIDEO DEBUG: Error in stopRecording call:', error);
      console.error('🎥 VIDEO DEBUG: Error type:', typeof error);
      console.error('🎥 VIDEO DEBUG: Error message:', error?.message);
      console.error('🎥 VIDEO DEBUG: Error stack:', error?.stack);
      console.error('🎥 VIDEO DEBUG: Forcing state reset due to stopRecording error');
      resetRecordingState();
    }
  };

  // Toggle camera facing
  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  // Toggle flash
  const toggleFlash = () => {
    setFlash(current => {
      switch (current) {
        case 'off':
          return 'on';
        case 'on':
          return 'auto';
        case 'auto':
          return 'off';
        default:
          return 'off';
      }
    });
  };

  // Handle press in (start long press detection)
  const handlePressIn = () => {
    console.log('🔽 Press in detected');
    
    // Start timer for long press detection (500ms for video)
    pressTimerRef.current = setTimeout(() => {
      console.log('⏱️ Long press detected - starting video recording');
      handleStartRecording();
    }, 500);
  };

  // Handle press out (detect if it was a tap or end of long press)
  const handlePressOut = () => {
    console.log('🔼 Press out detected');
    
    if (pressTimerRef.current) {
      // Clear the long press timer - this was a quick tap
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
      
      if (isRecording) {
        // If we're recording, stop the recording
        console.log('⏹️ Stopping recording due to press out');
        handleStopRecording();
      }
      // Note: handleTakePhoto will be called by onPress if it's just a tap
    } else if (isRecording) {
      // Long press was triggered, now finger lifted - stop recording
      console.log('⏹️ Stopping recording due to long press end');
      handleStopRecording();
    }
  };

  // Open gallery picker
  const handleGalleryPick = async () => {
    try {
      console.log('🖼️ Opening gallery...');
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: false,
        quality: 0.8,
        videoMaxDuration: 10, // 10 seconds max
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log('✅ Media selected from gallery:', asset.uri);
        
        const mediaFile: MediaFile = {
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'photo',
          duration: asset.duration ? asset.duration / 1000 : undefined,
          width: asset.width,
          height: asset.height,
          // Gallery images don't get filters applied
        };

        // Validate video duration
        if (mediaFile.type === 'video' && mediaFile.duration && mediaFile.duration > 10) {
          Alert.alert('Video Too Long', 'Please select a video that is 10 seconds or shorter.');
          return;
        }

        onMediaCaptured(mediaFile);
      }
    } catch (error) {
      console.error('❌ Error picking from gallery:', error);
      Alert.alert('Error', 'Failed to access gallery. Please try again.');
    }
  };

  // Get flash icon
  const getFlashIcon = () => {
    switch (flash) {
      case 'on':
        return '⚡';
      case 'auto':
        return '⚡️';
      default:
        return '⚡️';
    }
  };

  // Permission handling
  if (!hasPermission) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Camera Access Required</Text>
        <Text style={styles.errorText}>
          SnapConnect needs access to your camera to capture photos and videos for your fitness journey.
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <LinearGradient
            colors={gradients.primary}
            style={styles.permissionButtonGradient}
          >
            <Text style={styles.permissionButtonText}>Enable Camera</Text>
          </LinearGradient>
        </Pressable>
        {onClose && (
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Device handling
  if (!device) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading camera device...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Flash overlay */}
      <Animated.View style={[styles.flashOverlay, flashAnimatedStyle]} />
      
      {/* Camera view */}
      <Camera
        style={styles.camera}
        device={device}
        isActive={true}
        photo={true}
        video={true}
        audio={true}
        onInitialized={handleCameraReady}
        ref={cameraRef}
      />
      
      {/* Interactive filter overlay for real-time preview with user controls */}
      <InteractiveFilterOverlay 
        faces={faces} 
        activeFilter={activeFilter} 
        isVisible={!isComposingFilter && !isRecording && !showFilterSelector}
        transform={filterTransform}
        onTransformChange={handleFilterTransformChange}
        onEditText={handleEditText}
        cameraAspectRatio={9/16} // Portrait mode
      />
      
      {/* Face detection overlays (fallback) - disabled since we have InteractiveFilterOverlay */}
      
      {/* Camera overlay controls */}
      <View style={styles.overlay}>
        {/* Top controls */}
        <View style={styles.topControls}>
          {onClose && (
            <Pressable style={styles.controlButton} onPress={onClose}>
              <BlurView intensity={20} style={styles.blurButton}>
                <Text style={styles.controlIcon}>✕</Text>
              </BlurView>
            </Pressable>
          )}
          
          <View style={styles.spacer} />
          
          <Pressable style={styles.controlButton} onPress={toggleFlash}>
            <BlurView intensity={20} style={styles.blurButton}>
              <Text style={styles.controlIcon}>{getFlashIcon()}</Text>
            </BlurView>
          </Pressable>
          
          <Pressable style={styles.controlButton} onPress={toggleCameraFacing}>
            <BlurView intensity={20} style={styles.blurButton}>
              <Text style={styles.controlIcon}>🔄</Text>
            </BlurView>
          </Pressable>
          
          <Pressable style={styles.controlButton} onPress={toggleFilterSelector}>
            <BlurView intensity={20} style={styles.blurButton}>
              <Text style={styles.controlIcon}>✨</Text>
            </BlurView>
          </Pressable>
          
          <Pressable style={styles.controlButton} onPress={() => setShowTextInput(true)}>
            <BlurView intensity={20} style={styles.blurButton}>
              <Text style={styles.controlIcon}>📝</Text>
            </BlurView>
          </Pressable>
        </View>

        {/* Recording progress bar */}
        {isRecording && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFill, recordingProgressStyle]} />
            </View>
            <Text style={styles.recordingTime}>
              {Math.floor(recordingDuration)}.{Math.floor((recordingDuration % 1) * 10)}s
            </Text>
          </View>
        )}

        {/* Bottom controls */}
        <View style={styles.bottomControls}>
          {/* Gallery button */}
          <Pressable style={styles.galleryButton} onPress={handleGalleryPick}>
            <BlurView intensity={20} style={styles.blurButton}>
              <Text style={styles.controlIcon}>🖼️</Text>
            </BlurView>
          </Pressable>

          {/* Capture button */}
          <AnimatedPressable
            style={[styles.captureButton, recordButtonAnimatedStyle]}
            onPress={handleTakePhoto}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <LinearGradient
              colors={isRecording ? gradients.danger : gradients.light}
              style={styles.captureButtonGradient}
            >
              <View style={[
                styles.captureButtonInner,
                isRecording && styles.captureButtonRecording
              ]} />
            </LinearGradient>
          </AnimatedPressable>

          {/* Filter info or empty space */}
          <View style={styles.galleryButton}>
            {activeFilter.id !== 'none' && (
              <BlurView intensity={20} style={styles.blurButton}>
                <Text style={styles.controlIcon}>{activeFilter.thumbnail}</Text>
              </BlurView>
            )}
          </View>
        </View>
      </View>
      
      {/* Filter selector */}
      <FilterSelector
        activeFilter={activeFilter}
        onFilterSelect={handleFilterSelect}
        visible={showFilterSelector}
      />
      
      {/* Native Filter Compositor (hidden) */}
      {isComposingFilter && pendingPhoto && (
        <NativeFilterCompositor
          imageUri={pendingPhoto.uri}
          filter={activeFilter}
          imageWidth={pendingPhoto.width}
          imageHeight={pendingPhoto.height}
          transform={filterTransform}
          onComplete={handleFilterCompositionComplete}
        />
      )}
      
      {/* Text Input Modal */}
      <TextInputModal
        isVisible={showTextInput}
        onClose={() => {
          setShowTextInput(false);
          setIsEditingText(false);
        }}
        onSubmit={handleTextSubmit}
        initialText={isEditingText ? activeFilter.customText || '' : ''}
        initialOptions={isEditingText ? {
          color: activeFilter.textColor || '#FFFFFF',
          fontSize: activeFilter.fontSize || 24,
          fontWeight: activeFilter.fontWeight || 'normal',
          fontStyle: activeFilter.fontStyle || 'normal',
          fontFamily: 'System'
        } : undefined}
        isEditing={isEditingText}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  permissionButton: {
    marginBottom: 16,
  },
  permissionButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  permissionHelpText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 100,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  spacer: {
    flex: 1,
  },
  controlButton: {
    width: 44,
    height: 44,
    marginHorizontal: 5,
  },
  blurButton: {
    flex: 1,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  controlIcon: {
    fontSize: 20,
    color: '#fff',
  },
  progressContainer: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  recordingTime: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  galleryButton: {
    width: 44,
    height: 44,
  },
  captureButton: {
    width: 80,
    height: 80,
  },
  captureButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  captureButtonRecording: {
    borderRadius: 8,
    width: 30,
    height: 30,
  },
});