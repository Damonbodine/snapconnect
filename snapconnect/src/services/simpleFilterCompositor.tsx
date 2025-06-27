import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system';
import { FilterAsset } from '../types/media';

interface SimpleFilterCompositorProps {
  imageUri: string;
  filter: FilterAsset;
  imageWidth: number;
  imageHeight: number;
  onComplete: (compositedImageUri: string) => void;
}

export const SimpleFilterCompositor: React.FC<SimpleFilterCompositorProps> = ({
  imageUri,
  filter,
  imageWidth,
  imageHeight,
  onComplete,
}) => {
  const viewRef = React.useRef<View>(null);
  const [imageLoaded, setImageLoaded] = React.useState(false);

  // Calculate filter position
  const getFilterPosition = () => {
    const width = imageWidth;
    const height = imageHeight;
    const baseSize = Math.min(width, height);
    
    let x = width * 0.5;
    let y = height * 0.5;
    let fontSize = baseSize * 0.08;
    
    switch (filter.position) {
      case 'eyes':
        x = width * 0.5;
        y = height * 0.35;
        fontSize = baseSize * 0.06;
        break;
      case 'forehead':
        x = width * 0.5;
        y = height * 0.25;
        fontSize = baseSize * 0.05;
        break;
      case 'mouth':
        x = width * 0.5;
        y = height * 0.65;
        fontSize = baseSize * 0.04;
        break;
      case 'leftCheek':
        x = width * 0.25;
        y = height * 0.5;
        fontSize = baseSize * 0.04;
        break;
      case 'rightCheek':
        x = width * 0.75;
        y = height * 0.5;
        fontSize = baseSize * 0.04;
        break;
      case 'face':
        x = width * 0.5;
        y = height * 0.45;
        fontSize = baseSize * 0.12;
        break;
    }
    
    return {
      x: x - fontSize / 2, // Center the emoji
      y: y - fontSize / 2,
      fontSize: Math.max(fontSize, 30),
    };
  };

  const position = getFilterPosition();

  React.useEffect(() => {
    if (imageLoaded && viewRef.current) {
      // Small delay to ensure everything is rendered
      setTimeout(async () => {
        try {
          console.log('📸 Capturing view for filter composition...');
          
          const result = await captureRef(viewRef.current!, {
            format: 'jpg',
            quality: 0.8,
            result: 'tmpfile',
          });
          
          console.log('✅ View captured successfully:', result);
          onComplete(result);
        } catch (error) {
          console.error('❌ Error capturing view:', error);
          onComplete(imageUri); // Return original on error
        }
      }, 100);
    }
  }, [imageLoaded, imageUri, filter]);

  return (
    <View 
      ref={viewRef}
      style={[
        styles.container,
        {
          width: imageWidth,
          height: imageHeight,
        }
      ]}
    >
      {/* Background image */}
      <View style={styles.imageContainer}>
        <img
          src={imageUri}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            console.error('Failed to load image for composition');
            onComplete(imageUri);
          }}
        />
      </View>
      
      {/* Filter overlay */}
      {imageLoaded && (
        <Text
          style={[
            styles.filterText,
            {
              left: position.x,
              top: position.y,
              fontSize: position.fontSize,
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
    top: -10000, // Hide off-screen
    left: -10000,
    backgroundColor: 'transparent',
  },
  imageContainer: {
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
  },
});