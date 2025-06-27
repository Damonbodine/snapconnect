import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Canvas, Group, Text as SkiaText, useFont } from '@shopify/react-native-skia';
import { FaceDetectionResult, FilterAsset } from '../../types/media';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LiveFilterOverlayProps {
  faces: FaceDetectionResult[];
  activeFilter: FilterAsset;
  isVisible: boolean;
  cameraAspectRatio?: number;
}

interface FilterPosition {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export const LiveFilterOverlay: React.FC<LiveFilterOverlayProps> = ({
  faces,
  activeFilter,
  isVisible,
  cameraAspectRatio = 16 / 9,
}) => {
  const overlayOpacity = useSharedValue(0);
  const filterScale = useSharedValue(1);

  // Animation for overlay visibility
  React.useEffect(() => {
    overlayOpacity.value = withTiming(isVisible && activeFilter.id !== 'none' ? 1 : 0, {
      duration: 300,
    });
  }, [isVisible, activeFilter.id]);

  // Calculate camera display dimensions
  const getCameraDisplayDimensions = () => {
    const screenRatio = screenWidth / screenHeight;
    
    if (cameraAspectRatio > screenRatio) {
      // Camera is wider than screen
      const displayHeight = screenHeight;
      const displayWidth = displayHeight * cameraAspectRatio;
      return {
        width: displayWidth,
        height: displayHeight,
        offsetX: (displayWidth - screenWidth) / 2,
        offsetY: 0,
      };
    } else {
      // Camera is taller than screen
      const displayWidth = screenWidth;
      const displayHeight = displayWidth / cameraAspectRatio;
      return {
        width: displayWidth,
        height: displayHeight,
        offsetX: 0,
        offsetY: (screenHeight - displayHeight) / 2,
      };
    }
  };

  // Calculate filter position based on face bounds
  const calculateFilterPosition = (face: FaceDetectionResult): FilterPosition => {
    const { bounds } = face;
    const cameraDisplay = getCameraDisplayDimensions();
    
    // Scale face coordinates to screen coordinates
    const scaleX = cameraDisplay.width / 1080; // Assuming camera resolution
    const scaleY = cameraDisplay.height / 1920;
    
    const faceX = bounds.origin.x * scaleX - cameraDisplay.offsetX;
    const faceY = bounds.origin.y * scaleY - cameraDisplay.offsetY;
    const faceWidth = bounds.size.width * scaleX;
    const faceHeight = bounds.size.height * scaleY;
    
    let x = faceX + faceWidth / 2;
    let y = faceY + faceHeight / 2;
    let scale = Math.min(faceWidth, faceHeight) / 100; // Base scale
    let rotation = 0;
    
    // Adjust position based on filter type
    switch (activeFilter.position) {
      case 'eyes':
        if (face.landmarks?.leftEye && face.landmarks?.rightEye) {
          const leftEye = face.landmarks.leftEye;
          const rightEye = face.landmarks.rightEye;
          x = ((leftEye.x + rightEye.x) / 2) * scaleX - cameraDisplay.offsetX;
          y = ((leftEye.y + rightEye.y) / 2) * scaleY - cameraDisplay.offsetY;
          
          // Calculate rotation based on eye alignment
          const eyeAngle = Math.atan2(
            rightEye.y - leftEye.y,
            rightEye.x - leftEye.x
          );
          rotation = (eyeAngle * 180) / Math.PI;
        } else {
          y = faceY + faceHeight * 0.35;
        }
        scale *= 0.8;
        break;
        
      case 'forehead':
        y = faceY + faceHeight * 0.15;
        scale *= 0.6;
        break;
        
      case 'mouth':
        if (face.landmarks?.mouthLeft && face.landmarks?.mouthRight) {
          const mouthLeft = face.landmarks.mouthLeft;
          const mouthRight = face.landmarks.mouthRight;
          x = ((mouthLeft.x + mouthRight.x) / 2) * scaleX - cameraDisplay.offsetX;
          y = Math.max(mouthLeft.y, mouthRight.y) * scaleY - cameraDisplay.offsetY;
        } else {
          y = faceY + faceHeight * 0.75;
        }
        scale *= 0.5;
        break;
        
      case 'leftCheek':
        if (face.landmarks?.leftCheek) {
          x = face.landmarks.leftCheek.x * scaleX - cameraDisplay.offsetX;
          y = face.landmarks.leftCheek.y * scaleY - cameraDisplay.offsetY;
        } else {
          x = faceX + faceWidth * 0.25;
          y = faceY + faceHeight * 0.5;
        }
        scale *= 0.4;
        break;
        
      case 'rightCheek':
        if (face.landmarks?.rightCheek) {
          x = face.landmarks.rightCheek.x * scaleX - cameraDisplay.offsetX;
          y = face.landmarks.rightCheek.y * scaleY - cameraDisplay.offsetY;
        } else {
          x = faceX + faceWidth * 0.75;
          y = faceY + faceHeight * 0.5;
        }
        scale *= 0.4;
        break;
        
      case 'face':
      default:
        // Full face coverage
        scale *= 1.2;
        break;
    }
    
    return { x, y, scale: Math.max(scale, 0.3), rotation };
  };

  // Animated style for the overlay
  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    transform: [{ scale: filterScale.value }],
  }));

  // Don't render if filter is 'none' or not visible
  if (activeFilter.id === 'none' || !isVisible) {
    return null;
  }

  return (
    <Animated.View style={[styles.overlay, overlayAnimatedStyle]} pointerEvents="none">
      {faces.map((face, index) => {
        const position = calculateFilterPosition(face);
        
        return (
          <FilterElement
            key={face.faceID || index}
            filter={activeFilter}
            position={position}
          />
        );
      })}
    </Animated.View>
  );
};

interface FilterElementProps {
  filter: FilterAsset;
  position: FilterPosition;
}

const FilterElement: React.FC<FilterElementProps> = ({ filter, position }) => {
  const elementScale = useSharedValue(1);
  
  // Add subtle breathing animation for liveliness
  React.useEffect(() => {
    const breathingAnimation = () => {
      elementScale.value = withSpring(1.05, { duration: 1000 }, () => {
        elementScale.value = withSpring(1, { duration: 1000 });
      });
    };
    
    const interval = setInterval(breathingAnimation, 2000);
    return () => clearInterval(interval);
  }, []);

  const elementAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.x },
      { translateY: position.y },
      { scale: position.scale * elementScale.value },
      { rotate: `${position.rotation}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.filterElement, elementAnimatedStyle]}>
      <Animated.Text style={[styles.filterEmoji, { fontSize: 60 * position.scale }]}>
        {filter.asset}
      </Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5, // Above camera, below UI controls
  },
  filterElement: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterEmoji: {
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});