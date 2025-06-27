import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { FaceDetectionResult, FilterAsset } from '../../types/media';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FaceOverlayProps {
  faces: FaceDetectionResult[];
  activeFilter: FilterAsset;
  cameraRatio?: number; // Aspect ratio for proper scaling
}

interface InteractiveFilterProps {
  filter: FilterAsset;
}

const InteractiveFilter: React.FC<InteractiveFilterProps> = ({ filter }) => {
  // Start with a simple static version to test
  return (
    <View style={styles.simpleFilter}>
      <Text style={styles.filterEmoji}>{filter.asset}</Text>
      <Text style={styles.filterLabel}>{filter.name}</Text>
      <Text style={styles.gestureHint}>Filter Active</Text>
    </View>
  );
};

export const FaceOverlay: React.FC<FaceOverlayProps> = ({
  faces,
  activeFilter,
  cameraRatio = 16 / 9, // Default camera aspect ratio
}) => {
  // Don't render anything if no filter or it's the "none" filter
  if (!activeFilter || activeFilter.id === 'none') {
    return null;
  }

  // If no faces detected, show filter in center as fallback for testing
  const useFallbackPosition = faces.length === 0;
  
  if (useFallbackPosition) {
    return (
      <View style={styles.overlay} pointerEvents="box-none">
        <InteractiveFilter filter={activeFilter} />
      </View>
    );
  }

  // Calculate the position for a filter based on face landmarks
  const getFilterPosition = (face: FaceDetectionResult, position: string) => {
    const { bounds, landmarks } = face;
    const faceWidth = bounds.size.width;
    const faceHeight = bounds.size.height;
    const faceX = bounds.origin.x;
    const faceY = bounds.origin.y;

    let x = faceX;
    let y = faceY;
    let width = faceWidth;
    let height = faceHeight / 4; // Default height for most filters

    switch (position) {
      case 'eyes':
        if (landmarks?.leftEye && landmarks?.rightEye) {
          const eyeCenterX = (landmarks.leftEye.x + landmarks.rightEye.x) / 2;
          const eyeCenterY = (landmarks.leftEye.y + landmarks.rightEye.y) / 2;
          x = eyeCenterX - faceWidth * 0.4;
          y = eyeCenterY - faceHeight * 0.1;
          width = faceWidth * 0.8;
          height = faceHeight * 0.2;
        } else {
          // Fallback to estimated eye position
          x = faceX + faceWidth * 0.1;
          y = faceY + faceHeight * 0.2;
          width = faceWidth * 0.8;
          height = faceHeight * 0.2;
        }
        break;

      case 'forehead':
        x = faceX + faceWidth * 0.2;
        y = faceY - faceHeight * 0.1;
        width = faceWidth * 0.6;
        height = faceHeight * 0.2;
        break;

      case 'mouth':
        if (landmarks?.mouthLeft && landmarks?.mouthRight) {
          const mouthCenterX = (landmarks.mouthLeft.x + landmarks.mouthRight.x) / 2;
          const mouthY = Math.max(landmarks.mouthLeft.y, landmarks.mouthRight.y);
          x = mouthCenterX - faceWidth * 0.15;
          y = mouthY - faceHeight * 0.05;
          width = faceWidth * 0.3;
          height = faceHeight * 0.15;
        } else {
          // Fallback to estimated mouth position
          x = faceX + faceWidth * 0.35;
          y = faceY + faceHeight * 0.65;
          width = faceWidth * 0.3;
          height = faceHeight * 0.15;
        }
        break;

      case 'leftCheek':
        if (landmarks?.leftCheek) {
          x = landmarks.leftCheek.x - faceWidth * 0.1;
          y = landmarks.leftCheek.y - faceHeight * 0.1;
        } else {
          x = faceX + faceWidth * 0.1;
          y = faceY + faceHeight * 0.4;
        }
        width = faceWidth * 0.2;
        height = faceHeight * 0.2;
        break;

      case 'rightCheek':
        if (landmarks?.rightCheek) {
          x = landmarks.rightCheek.x - faceWidth * 0.1;
          y = landmarks.rightCheek.y - faceHeight * 0.1;
        } else {
          x = faceX + faceWidth * 0.7;
          y = faceY + faceHeight * 0.4;
        }
        width = faceWidth * 0.2;
        height = faceHeight * 0.2;
        break;

      case 'face':
      default:
        // Cover the entire face
        x = faceX;
        y = faceY;
        width = faceWidth;
        height = faceHeight;
        break;
    }

    return { x, y, width, height };
  };

  return (
    <View style={styles.overlay} pointerEvents="none">
      {faces.map((face, index) => {
        const position = getFilterPosition(face, activeFilter.position || 'face');
        
        return (
          <View
            key={face.faceID || index}
            style={[
              styles.filterOverlay,
              {
                left: position.x,
                top: position.y,
                width: position.width,
                height: position.height,
              },
            ]}
          >
            {/* For now, we're using emoji as placeholder filters */}
            {/* In production, this would be an Image component with PNG assets */}
            <Text style={styles.filterEmoji}>{activeFilter.asset}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10, // Above camera, below UI controls
  },
  filterOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterEmoji: {
    fontSize: 80, // Make it even bigger and more visible
    textAlign: 'center',
  },
  fallbackPosition: {
    position: 'absolute',
    top: '40%',
    left: '40%',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 60,
  },
  filterLabel: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  interactiveFilter: {
    position: 'absolute',
    width: 120,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderStyle: 'dashed',
  },
  gestureHint: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    opacity: 0.8,
  },
  simpleFilter: {
    position: 'absolute',
    top: '20%',
    left: '25%',
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#fff',
  },
});