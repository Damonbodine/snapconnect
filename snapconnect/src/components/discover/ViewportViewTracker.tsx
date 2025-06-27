import React, { useEffect, useRef, useState } from 'react';
import { View, Dimensions } from 'react-native';

interface ViewportViewTrackerProps {
  postId: string;
  mediaType: 'photo' | 'video';
  children: React.ReactNode;
  onViewed?: (postId: string, duration: number) => void;
  enabled?: boolean;
  debug?: boolean;
}

const { height: screenHeight } = Dimensions.get('window');

export const ViewportViewTracker: React.FC<ViewportViewTrackerProps> = ({
  postId,
  mediaType,
  children,
  onViewed,
  enabled = true,
  debug = false,
}) => {
  const viewRef = useRef<View>(null);
  const viewTimer = useRef<NodeJS.Timeout | null>(null);
  const hasBeenViewed = useRef(false);
  const [isInViewport, setIsInViewport] = useState(false);
  
  const minDuration = mediaType === 'video' ? 10000 : 10000; // 10s for both (testing)
  
  // Measure if post is in active viewport (center 60% of screen)
  const measureViewport = () => {
    if (!viewRef.current || !enabled) return;
    
    viewRef.current.measure((x, y, width, height, pageX, pageY) => {
      const postTop = pageY;
      const postBottom = pageY + height;
      const viewportTop = screenHeight * 0.2; // Top 20% margin
      const viewportBottom = screenHeight * 0.8; // Bottom 20% margin
      
      // Check if post is prominently visible in the center viewport
      const isVisible = postTop < viewportBottom && postBottom > viewportTop;
      const overlapTop = Math.max(postTop, viewportTop);
      const overlapBottom = Math.min(postBottom, viewportBottom);
      const overlapHeight = Math.max(0, overlapBottom - overlapTop);
      const visibilityRatio = overlapHeight / height;
      
      const shouldStartTimer = isVisible && visibilityRatio > 0.6; // 60% visible
      
      if (debug) {
        console.log(`📐 VIEWPORT: ${postId} - visible: ${isVisible}, ratio: ${visibilityRatio.toFixed(2)}, shouldStart: ${shouldStartTimer}`);
      }
      
      setIsInViewport(shouldStartTimer);
    });
  };
  
  // Start timer when post enters viewport
  useEffect(() => {
    if (!enabled || hasBeenViewed.current || !isInViewport) {
      return;
    }
    
    if (debug) {
      console.log(`⏰ VIEWPORT: Starting ${minDuration}ms timer for ${postId} (in viewport)`);
    }
    
    viewTimer.current = setTimeout(() => {
      if (!hasBeenViewed.current && enabled && isInViewport) {
        hasBeenViewed.current = true;
        
        if (debug) {
          console.log(`✅ VIEWPORT: ${postId} viewed for ${minDuration}ms - triggering callback`);
        }
        
        onViewed?.(postId, minDuration);
      }
    }, minDuration);
    
    return () => {
      if (viewTimer.current) {
        if (debug) {
          console.log(`🧹 VIEWPORT: Cleaning up timer for ${postId}`);
        }
        clearTimeout(viewTimer.current);
      }
    };
  }, [isInViewport, enabled, debug, postId, minDuration, onViewed]);
  
  // Measure viewport on mount and when layout changes
  useEffect(() => {
    const measureTimeout = setTimeout(measureViewport, 100);
    return () => clearTimeout(measureTimeout);
  }, []);
  
  return (
    <View 
      ref={viewRef}
      onLayout={measureViewport}
    >
      {children}
    </View>
  );
};