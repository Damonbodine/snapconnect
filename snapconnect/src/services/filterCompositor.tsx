import React from 'react';
import {
  Canvas,
  useCanvasRef,
  useImage,
  Image as SkiaImage,
  Text as SkiaText,
  Group,
  useFont,
} from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system';
import { FilterAsset } from '../types/media';

interface FilterPosition {
  x: number;
  y: number;
  fontSize: number;
}

export class FilterCompositor {
  /**
   * Apply a filter overlay to an image using Skia
   */
  static async applyFilterToImage(
    imageUri: string,
    filter: FilterAsset,
    imageWidth: number,
    imageHeight: number
  ): Promise<string> {
    try {
      console.log('🎨 Applying filter with Skia:', filter.name);
      
      return new Promise<string>((resolve, reject) => {
        // This will be handled by the SkiaFilterCompositor component
        // For now, return the original image
        resolve(imageUri);
      });
      
    } catch (error) {
      console.error('❌ Error applying filter:', error);
      return imageUri;
    }
  }
  
  /**
   * Calculate where to position the filter on the image with better proportions
   */
  static calculateFilterPosition(
    filter: FilterAsset,
    imageWidth: number,
    imageHeight: number
  ): FilterPosition {
    // Ensure all values are numbers and validate input
    const width = Math.max(Number(imageWidth) || 1080, 1);
    const height = Math.max(Number(imageHeight) || 1920, 1);
    
    // Base font size calculation with better scaling
    const baseSize = Math.min(width, height);
    let fontSize = Math.round(baseSize * 0.08); // Smaller base size for better proportions
    let x = Math.round(width * 0.5); // Center by default
    let y = Math.round(height * 0.5);
    
    switch (filter.position) {
      case 'eyes':
        x = Math.round(width * 0.5); // Center horizontally
        y = Math.round(height * 0.35); // Eye level
        fontSize = Math.round(baseSize * 0.06);
        break;
        
      case 'forehead':
        x = Math.round(width * 0.5);
        y = Math.round(height * 0.25); // Higher on forehead
        fontSize = Math.round(baseSize * 0.05);
        break;
        
      case 'mouth':
        x = Math.round(width * 0.5);
        y = Math.round(height * 0.65); // Mouth level
        fontSize = Math.round(baseSize * 0.04);
        break;
        
      case 'leftCheek':
        x = Math.round(width * 0.25); // Left side
        y = Math.round(height * 0.5);
        fontSize = Math.round(baseSize * 0.04);
        break;
        
      case 'rightCheek':
        x = Math.round(width * 0.75); // Right side
        y = Math.round(height * 0.5);
        fontSize = Math.round(baseSize * 0.04);
        break;
        
      case 'face':
        // Cover more of the face area
        x = Math.round(width * 0.5);
        y = Math.round(height * 0.45);
        fontSize = Math.round(baseSize * 0.12);
        break;
        
      default:
        // Center position with good proportions
        x = Math.round(width * 0.5);
        y = Math.round(height * 0.45);
        fontSize = Math.round(baseSize * 0.08);
        break;
    }
    
    // Ensure minimum font size for visibility
    fontSize = Math.max(fontSize, 20);
    
    return { x, y, fontSize };
  }
}

// Skia Filter Compositor Component
interface SkiaFilterCompositorProps {
  imageUri: string;
  filter: FilterAsset;
  imageWidth: number;
  imageHeight: number;
  onComplete: (compositedImageUri: string) => void;
}

export const SkiaFilterCompositor: React.FC<SkiaFilterCompositorProps> = ({
  imageUri,
  filter,
  imageWidth,
  imageHeight,
  onComplete,
}) => {
  const canvasRef = useCanvasRef();
  const skImage = useImage(imageUri);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const compositionCompleteRef = React.useRef<boolean>(false);
  const currentImageUriRef = React.useRef<string>('');
  
  // Calculate filter position
  const filterPos = FilterCompositor.calculateFilterPosition(filter, imageWidth, imageHeight);
  
  // Reset composition state when imageUri changes (new photo)
  React.useEffect(() => {
    if (currentImageUriRef.current !== imageUri) {
      console.log('🎨 New image detected, resetting composition state');
      compositionCompleteRef.current = false;
      currentImageUriRef.current = imageUri;
      
      // Clear any existing timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [imageUri]);

  React.useEffect(() => {
    console.log('🎨 useEffect triggered - skImage:', !!skImage, 'canvasRef:', !!canvasRef.current, 'completed:', compositionCompleteRef.current);
    
    // Don't run if already completed for this image
    if (compositionCompleteRef.current) {
      console.log('🎨 Composition already completed, skipping');
      return;
    }
    
    if (skImage && canvasRef.current) {
      // Much longer delay to ensure canvas is fully rendered
      const compositeImage = async () => {
        if (compositionCompleteRef.current) {
          console.log('🎨 Composition completed during delay, aborting');
          return;
        }
        
        try {
          console.log('🎨 Creating Skia snapshot for filter:', filter.name);
          
          // Give more time for canvas to render
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Final check before proceeding
          if (compositionCompleteRef.current) {
            console.log('🎨 Composition completed during render delay, aborting');
            return;
          }
          
          // Retry mechanism for snapshot creation
          let snapshot = null;
          let retryCount = 0;
          const maxRetries = 5;
          
          while (!snapshot && retryCount < maxRetries && !compositionCompleteRef.current) {
            try {
              // Force a flush of the canvas before snapshot
              if (canvasRef.current) {
                snapshot = canvasRef.current.makeImageSnapshot();
                if (snapshot) {
                  console.log('🎨 Filter composition successful');
                  break;
                }
              }
            } catch (snapshotError) {
              console.warn(`🎨 Snapshot attempt ${retryCount + 1} failed:`, snapshotError);
            }
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
          
          // Mark as completed to prevent race conditions
          if (compositionCompleteRef.current) {
            console.log('🎨 Composition completed by another process, aborting');
            return;
          }
          
          compositionCompleteRef.current = true;
          
          // Clear timeout since we're handling completion
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          
          if (snapshot) {
            // Encode with better quality settings
            const base64Data = snapshot.encodeToBase64();
            
            // Generate unique filename
            const filename = `filtered_image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
            const fileUri = `${FileSystem.cacheDirectory}${filename}`;
            
            await FileSystem.writeAsStringAsync(fileUri, base64Data, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            console.log('🎨 Filter applied successfully:', fileUri);
            onComplete(fileUri);
          } else {
            console.warn('🎨 Failed to create snapshot after all retries, returning original');
            onComplete(imageUri);
          }
        } catch (error) {
          console.error('❌ Error creating Skia snapshot:', error);
          
          // Mark as completed and clear timeout
          compositionCompleteRef.current = true;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          
          onComplete(imageUri); // Return original on error
        }
      };
      
      // Start composition with initial delay
      const timeoutId = setTimeout(compositeImage, 300);
      
      // Set fallback timeout - only fires if composition doesn't complete
      timeoutRef.current = setTimeout(() => {
        if (!compositionCompleteRef.current) {
          console.log('🎨 Composition timeout reached, returning original');
          compositionCompleteRef.current = true;
          onComplete(imageUri);
        }
      }, 10000) as any; // 10 second total timeout
      
      return () => {
        clearTimeout(timeoutId);
      };
    } else if (!compositionCompleteRef.current) {
      console.log('🎨 Skia image not ready yet, setting fallback timeout');
      // Fallback timeout for image loading only if not already completed
      timeoutRef.current = setTimeout(() => {
        if (!compositionCompleteRef.current) {
          console.log('🎨 Image failed to load, returning original');
          compositionCompleteRef.current = true;
          onComplete(imageUri);
        }
      }, 5000) as any; // 5 second timeout for image loading
    }
  }, [skImage, canvasRef, filter]);
  
  if (!skImage) {
    return null;
  }
  
  return (
    <Canvas 
      ref={canvasRef} 
      style={{ 
        width: Math.min(imageWidth, 200), // Debug size
        height: Math.min(imageHeight, 300), 
        position: 'absolute', 
        top: 100, // Visible for debugging
        left: 50,
        opacity: 0.8, // Semi-transparent for debugging
        backgroundColor: 'blue', // Debug background
        zIndex: 1000,
      }}
    >
      {/* Draw the original image */}
      <SkiaImage
        image={skImage}
        x={0}
        y={0}
        width={Math.min(imageWidth, 200)}
        height={Math.min(imageHeight, 300)}
        fit="cover"
      />
      
      {/* Draw the filter emoji - test with simple text first */}
      <SkiaText
        text="TEST" // Simple text instead of emoji
        x={50}
        y={100}
        font={undefined}
        fontSize={30}
        color="red"
      />
      
      {/* Draw the actual filter emoji */}
      <SkiaText
        text={filter.asset || "🎯"} // Fallback emoji
        x={Math.min(filterPos.x / 10, 100)} // Scale position for debug canvas
        y={Math.min(filterPos.y / 10, 150)} // Scale position for debug canvas
        font={undefined}
        fontSize={Math.min(filterPos.fontSize / 3, 40)} // Scale font size for debug canvas
        color="yellow"
      />
    </Canvas>
  );
};