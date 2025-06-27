import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

interface SimpleViewTrackerProps {
  postId: string;
  mediaType: 'photo' | 'video';
  children: React.ReactNode;
  onViewed?: (postId: string, duration: number) => void;
  enabled?: boolean;
  debug?: boolean;
}

export const SimpleViewTracker: React.FC<SimpleViewTrackerProps> = ({
  postId,
  mediaType,
  children,
  onViewed,
  enabled = true,
  debug = false,
}) => {
  const viewTimer = useRef<NodeJS.Timeout | null>(null);
  const hasBeenViewed = useRef(false);
  
  const minDuration = mediaType === 'video' ? 3600000 : 3600000; // 1 hour for both photos and videos
  
  useEffect(() => {
    if (!enabled || hasBeenViewed.current) {
      if (debug) {
        console.log(`🚫 SIMPLE: ${postId} - tracking disabled or already viewed`);
      }
      return;
    }
    
    if (debug) {
      console.log(`⏰ SIMPLE: Starting ${minDuration}ms timer for ${postId}`);
    }
    
    // Start timer when component mounts (post becomes visible)
    viewTimer.current = setTimeout(() => {
      if (!hasBeenViewed.current && enabled) {
        hasBeenViewed.current = true;
        
        if (debug) {
          console.log(`✅ SIMPLE: ${postId} viewed for ${minDuration}ms - triggering callback`);
        }
        
        onViewed?.(postId, minDuration);
      }
    }, minDuration);
    
    // Cleanup on unmount
    return () => {
      if (viewTimer.current) {
        if (debug) {
          console.log(`🧹 SIMPLE: Cleaning up timer for ${postId}`);
        }
        clearTimeout(viewTimer.current);
      }
    };
  }, [postId, mediaType, enabled, onViewed, debug, minDuration]);
  
  return <View>{children}</View>;
};