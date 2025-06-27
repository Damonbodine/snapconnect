import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { FilterAsset } from '../types/media';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FilterTransform {
  scale: number;
  x: number;
  y: number;
  rotation: number;
}

interface NativeFilterCompositorProps {
  imageUri: string;
  filter: FilterAsset;
  imageWidth: number;
  imageHeight: number;
  transform: FilterTransform;
  onComplete: (compositedImageUri: string) => void;
}

export const NativeFilterCompositor: React.FC<NativeFilterCompositorProps> = ({
  imageUri,
  filter,
  imageWidth,
  imageHeight,
  transform,
  onComplete,
}) => {
  const viewRef = React.useRef<View>(null);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [compositionComplete, setCompositionComplete] = React.useState(false);
  const [isCapturing, setIsCapturing] = React.useState(false);

  // Calculate filter position using user's custom transform
  const getFilterPosition = () => {
    const width = imageWidth;
    const height = imageHeight;
    
    // Use actual screen dimensions for coordinate conversion
    
    // Base font size matching the interactive overlay (60px base)
    let baseFontSize = 60;
    
    // Apply user's scale transform (same as interactive overlay)
    const fontSize = Math.max(baseFontSize * transform.scale, 12);
    
    // Convert screen coordinates to image coordinates
    // The interactive overlay uses screen coordinates, so we need to scale them to image coordinates
    const scaleX = width / screenWidth;
    const scaleY = height / screenHeight;
    
    // Center position in image coordinates
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    
    // Apply user's transform (scale screen coordinates to image coordinates)
    const x = centerX + (transform.x * scaleX);
    const y = centerY + (transform.y * scaleY);
    
    console.log('🔍 COMPOSITOR DEBUG: ============ COORDINATE CONVERSION ============');
    console.log('🔍 COMPOSITOR DEBUG: Screen dimensions:', screenWidth, 'x', screenHeight);
    console.log('🔍 COMPOSITOR DEBUG: Image dimensions:', width, 'x', height);
    console.log('🔍 COMPOSITOR DEBUG: Scale factors (img/screen):', scaleX, scaleY);
    console.log('🔍 COMPOSITOR DEBUG: Input transform:', transform);
    console.log('🔍 COMPOSITOR DEBUG: Base font size: 60px');
    console.log('🔍 COMPOSITOR DEBUG: Scaled font size:', fontSize);
    console.log('🔍 COMPOSITOR DEBUG: Center position (image coords):', centerX, centerY);
    console.log('🔍 COMPOSITOR DEBUG: Transform offset (screen coords):', transform.x, transform.y);
    console.log('🔍 COMPOSITOR DEBUG: Transform offset (image coords):', transform.x * scaleX, transform.y * scaleY);
    console.log('🔍 COMPOSITOR DEBUG: Final position (image coords):', x, y);
    console.log('🔍 COMPOSITOR DEBUG: Text positioned at:', x - fontSize / 2, y - fontSize / 2);
    console.log('🔍 COMPOSITOR DEBUG: ========================================');
    
    return {
      x: x - fontSize / 2, // Center the emoji
      y: y - fontSize / 2,
      fontSize,
      rotation: transform.rotation,
    };
  };

  const position = getFilterPosition();

  React.useEffect(() => {
    if (imageLoaded && viewRef.current && !compositionComplete) {
      // Small delay to ensure everything is rendered
      setTimeout(async () => {
        try {
          console.log('🎨 Native: Capturing view for filter composition...');
          console.log('🎨 Native: View ref exists:', !!viewRef.current);
          console.log('🔍 COMPOSITOR DEBUG: ============ COMPOSITION START ============');
          console.log('🔍 COMPOSITOR DEBUG: Input image URI:', imageUri);
          console.log('🔍 COMPOSITOR DEBUG: Filter:', filter);
          console.log('🔍 COMPOSITOR DEBUG: Image dimensions:', imageWidth, 'x', imageHeight);
          console.log('🔍 COMPOSITOR DEBUG: Received transform:', transform);
          
          // Temporarily make view visible for capture
          setIsCapturing(true);
          
          // Wait a bit for the visibility change to take effect
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const result = await captureRef(viewRef.current!, {
            format: 'jpg',
            quality: 0.9,
            result: 'tmpfile',
            snapshotContentContainer: false, // Capture the view itself, not its container
          });
          
          console.log('🎨 Native: View captured successfully:', result);
          console.log('🔍 FILTER DEBUG: Raw capture result:', result);
          console.log('🔍 FILTER DEBUG: Result type:', typeof result);
          
          // Ensure result has file:// prefix for React Native Image component
          const resultWithPrefix = result.startsWith('file://') ? result : `file://${result}`;
          console.log('🔍 FILTER DEBUG: Result with prefix:', resultWithPrefix);
          console.log('🔍 FILTER DEBUG: Prefix added?', !result.startsWith('file://'));
          
          setIsCapturing(false);
          setCompositionComplete(true);
          onComplete(resultWithPrefix);
        } catch (error) {
          console.error('❌ Native: Error capturing view:', error);
          console.error('❌ Native: Error details:', error.message);
          console.error('🔍 FILTER DEBUG: Capture failed, returning original:', imageUri);
          setIsCapturing(false);
          setCompositionComplete(true);
          onComplete(imageUri); // Return original on error
        }
      }, 500); // Increased delay for better rendering
    }
  }, [imageLoaded, imageUri, filter, compositionComplete]);

  // Timeout fallback
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (!compositionComplete) {
        console.log('🎨 Native: Composition timeout, returning original');
        setCompositionComplete(true);
        onComplete(imageUri);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View 
      ref={viewRef}
      style={[
        styles.container,
        {
          width: imageWidth,
          height: imageHeight,
          opacity: isCapturing ? 1 : 0, // Make visible only during capture
        }
      ]}
    >
      {/* Background image */}
      <Image
        source={{ uri: imageUri }}
        style={styles.backgroundImage}
        onLoad={() => {
          console.log('🎨 Native: Image loaded');
          console.log('🔍 FILTER DEBUG: Background image loaded successfully');
          setImageLoaded(true);
        }}
        onError={(error) => {
          console.error('🎨 Native: Image load error:', error);
          console.error('🔍 FILTER DEBUG: Background image failed to load:', imageUri);
          console.error('🔍 FILTER DEBUG: Image error details:', error);
          setCompositionComplete(true);
          onComplete(imageUri);
        }}
        onLoadStart={() => {
          console.log('🔍 FILTER DEBUG: Background image load started for:', imageUri);
        }}
        resizeMode="cover"
      />
      
      {/* Filter overlay */}
      {imageLoaded && (
        <Text
          style={[
            styles.filterText,
            {
              left: position.x,
              top: position.y,
              fontSize: position.fontSize,
              transform: [
                { rotate: `${position.rotation}rad` }
              ],
            }
          ]}
        >
          {filter.asset}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, // Keep on-screen but make invisible
    left: 0,
    backgroundColor: 'transparent',
    zIndex: -1, // Ensure it's behind everything
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  filterText: {
    position: 'absolute',
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    fontWeight: 'bold',
  },
});