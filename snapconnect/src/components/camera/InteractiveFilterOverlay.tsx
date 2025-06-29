import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import {
  PanGestureHandler,
  PinchGestureHandler,
  RotationGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { FaceDetectionResult, FilterAsset } from '../../types/media';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FilterTransform {
  scale: number;
  x: number;
  y: number;
  rotation: number;
}

interface InteractiveFilterOverlayProps {
  faces: FaceDetectionResult[];
  activeFilter: FilterAsset;
  isVisible: boolean;
  transform: FilterTransform;
  onTransformChange: (transform: FilterTransform) => void;
  onEditText?: () => void;
  cameraAspectRatio?: number;
}

export const InteractiveFilterOverlay: React.FC<InteractiveFilterOverlayProps> = ({
  faces,
  activeFilter,
  isVisible,
  transform,
  onTransformChange,
  onEditText,
  cameraAspectRatio = 16 / 9,
}) => {
  // Animated values for gestures
  const scale = useSharedValue(transform.scale);
  const translateX = useSharedValue(transform.x);
  const translateY = useSharedValue(transform.y);
  const rotation = useSharedValue(transform.rotation);
  
  // Gesture state
  const savedScale = useSharedValue(transform.scale);
  const savedTranslateX = useSharedValue(transform.x);
  const savedTranslateY = useSharedValue(transform.y);
  const savedRotation = useSharedValue(transform.rotation);

  // Calculate initial position based on face detection or center screen
  const getInitialPosition = () => {
    // Always default to center of camera area (accounting for safe areas)
    return { x: 0, y: 0 }; // Center relative position
  };

  // Update transform callback
  const updateTransform = (newTransform: Partial<FilterTransform>) => {
    const updatedTransform = { ...transform, ...newTransform };
    console.log('🔍 INTERACTIVE DEBUG: ============ TRANSFORM UPDATE ============');
    console.log('🔍 INTERACTIVE DEBUG: Previous transform:', transform);
    console.log('🔍 INTERACTIVE DEBUG: New partial transform:', newTransform);
    console.log('🔍 INTERACTIVE DEBUG: Final transform:', updatedTransform);
    console.log('🔍 INTERACTIVE DEBUG: Screen dimensions:', screenWidth, 'x', screenHeight);
    console.log('🔍 INTERACTIVE DEBUG: Emoji font size will be:', 60 * updatedTransform.scale);
    console.log('🔍 INTERACTIVE DEBUG: ========================================');
    onTransformChange(updatedTransform);
  };

  // Pan gesture handler
  const panGestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      context.startX = savedTranslateX.value;
      context.startY = savedTranslateY.value;
    },
    onActive: (event, context) => {
      translateX.value = context.startX + event.translationX;
      translateY.value = context.startY + event.translationY;
    },
    onEnd: () => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      
      runOnJS(updateTransform)({
        x: translateX.value,
        y: translateY.value,
      });
    },
  });

  // Pinch gesture handler
  const pinchGestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      context.startScale = savedScale.value;
    },
    onActive: (event, context) => {
      const newScale = Math.max(0.1, context.startScale * event.scale); // Minimum 0.1x, no maximum
      scale.value = newScale;
    },
    onEnd: () => {
      savedScale.value = scale.value;
      
      runOnJS(updateTransform)({
        scale: scale.value,
      });
    },
  });

  // Rotation gesture handler
  const rotationGestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      context.startRotation = savedRotation.value;
    },
    onActive: (event, context) => {
      rotation.value = context.startRotation + event.rotation;
    },
    onEnd: () => {
      savedRotation.value = rotation.value;
      
      runOnJS(updateTransform)({
        rotation: rotation.value,
      });
    },
  });

  // Double-tap to edit text
  const doubleTapGestureHandler = useAnimatedGestureHandler({
    onEnd: () => {
      if (activeFilter.type === 'text' && onEditText) {
        runOnJS(onEditText)();
      }
    },
  });

  // Animated style
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        // Scale is applied to fontSize instead to match compositor exactly
        { rotate: `${rotation.value}rad` },
      ],
    };
  });

  // Initialize position when filter changes
  React.useEffect(() => {
    if (activeFilter.id !== 'none' && transform.x === 0 && transform.y === 0) {
      const initialPos = getInitialPosition();
      translateX.value = initialPos.x;
      translateY.value = initialPos.y;
      savedTranslateX.value = initialPos.x;
      savedTranslateY.value = initialPos.y;
      
      updateTransform({
        x: initialPos.x,
        y: initialPos.y,
      });
    }
  }, [activeFilter.id]);

  // Update animated values when transform prop changes
  React.useEffect(() => {
    scale.value = transform.scale;
    translateX.value = transform.x;
    translateY.value = transform.y;
    rotation.value = transform.rotation;
    
    savedScale.value = transform.scale;
    savedTranslateX.value = transform.x;
    savedTranslateY.value = transform.y;
    savedRotation.value = transform.rotation;
  }, [transform]);

  // Don't render if filter is 'none' or not visible
  if (activeFilter.id === 'none' || !isVisible) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsText}>
          Drag to move • Pinch to resize • Two fingers to rotate{activeFilter.type === 'text' ? ' • Double-tap to edit' : ''}
        </Text>
      </View>

      {/* Interactive filter element */}
      <View style={styles.filterContainer}>
        <TapGestureHandler 
          onGestureEvent={doubleTapGestureHandler}
          numberOfTaps={2}
          shouldCancelWhenOutside={false}
        >
          <Animated.View>
            <PanGestureHandler onGestureEvent={panGestureHandler}>
              <Animated.View>
                <PinchGestureHandler onGestureEvent={pinchGestureHandler}>
                  <Animated.View>
                    <RotationGestureHandler onGestureEvent={rotationGestureHandler}>
                      <Animated.View style={[styles.filterElement, animatedStyle]}>
                        {activeFilter.type === 'emoji' ? (
                          <Text style={[styles.filterEmoji, { fontSize: 60 * transform.scale }]}>
                            {activeFilter.asset}
                          </Text>
                        ) : activeFilter.type === 'text' ? (
                          <View style={styles.textContainer}>
                            <Text style={[
                              styles.filterText, 
                              { 
                                fontSize: (activeFilter.fontSize || 24) * transform.scale,
                                color: activeFilter.textColor || '#FFFFFF',
                                fontWeight: activeFilter.fontWeight || 'normal',
                                fontStyle: activeFilter.fontStyle || 'normal',
                              }
                            ]}>
                              {activeFilter.customText || 'Add Text'}
                            </Text>
                          </View>
                        ) : null}
                      </Animated.View>
                    </RotationGestureHandler>
                  </Animated.View>
                </PinchGestureHandler>
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </TapGestureHandler>
      </View>
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
    zIndex: 5, // Above camera, below UI controls
  },
  instructionsContainer: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  instructionsText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  filterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterElement: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
    minHeight: 80,
  },
  filterEmoji: {
    fontSize: 60, // Base size - matches NativeFilterCompositor
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  textContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  filterText: {
    fontSize: 24, // Base size for text
    textAlign: 'center',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
});