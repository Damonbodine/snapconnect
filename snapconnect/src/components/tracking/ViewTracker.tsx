import React, { useCallback, useRef, useState, useEffect } from 'react';
import { View, ViewProps, AppState, Text } from 'react-native';
import { ViewToken } from 'react-native';

interface ViewTrackerProps extends ViewProps {
  postId: string;
  mediaType: 'photo' | 'video';
  children: React.ReactNode;
  onViewed?: (postId: string, duration: number) => void;
  enabled?: boolean;
  minViewDuration?: number;
  minVisibilityPercentage?: number;
  debug?: boolean;
}

interface ViewCriteria {
  minDuration: number;
  minVisibility: number;
  mediaType: 'photo' | 'video';
}

export const ViewTracker: React.FC<ViewTrackerProps> = ({
  postId,
  mediaType,
  children,
  onViewed,
  enabled = true,
  minViewDuration,
  minVisibilityPercentage,
  debug = false,
  style,
  ...props
}) => {
  const [isInViewport, setIsInViewport] = useState(false);
  const [hasBeenViewed, setHasBeenViewed] = useState(false);
  
  const viewStartTime = useRef<number | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const isVisibleRef = useRef(false);
  
  // Dynamic criteria based on media type
  const viewCriteria: ViewCriteria = {
    minDuration: minViewDuration || (mediaType === 'photo' ? 2000 : 3000),
    minVisibility: minVisibilityPercentage || 0.75,
    mediaType,
  };
  
  // Track app state changes to pause view tracking
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (appStateRef.current.match(/active|foreground/) && nextAppState === 'background') {
        // App going to background - pause view tracking
        if (viewStartTime.current && !hasBeenViewed) {
          const duration = Date.now() - viewStartTime.current;
          if (debug) {
            console.log(`📱 App backgrounded - pausing view tracking for ${postId}, duration: ${duration}ms`);
          }
        }
      } else if (appStateRef.current === 'background' && nextAppState === 'active') {
        // App coming to foreground - resume if still visible
        if (isVisibleRef.current && !hasBeenViewed) {
          viewStartTime.current = Date.now();
          if (debug) {
            console.log(`📱 App foregrounded - resuming view tracking for ${postId}`);
          }
        }
      }
      appStateRef.current = nextAppState;
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [postId, hasBeenViewed, debug]);
  
  const checkViewCriteria = useCallback((
    duration: number,
    visibilityPercent: number
  ): boolean => {
    if (!enabled) return false;
    if (hasBeenViewed) return false;
    
    // Basic criteria
    if (duration < viewCriteria.minDuration) {
      if (debug) {
        console.log(`⏱️ View too short: ${duration}ms < ${viewCriteria.minDuration}ms for ${postId}`);
      }
      return false;
    }
    
    if (visibilityPercent < viewCriteria.minVisibility) {
      if (debug) {
        console.log(`👁️ Not visible enough: ${visibilityPercent} < ${viewCriteria.minVisibility} for ${postId}`);
      }
      return false;
    }
    
    // App must be in foreground
    if (appStateRef.current !== 'active') {
      if (debug) {
        console.log(`📱 App not active: ${appStateRef.current} for ${postId}`);
      }
      return false;
    }
    
    return true;
  }, [enabled, hasBeenViewed, viewCriteria, postId, debug]);
  
  const handleViewabilityChange = useCallback((isVisible: boolean, viewToken?: ViewToken) => {
    if (!enabled || hasBeenViewed) return;
    
    isVisibleRef.current = isVisible;
    const visibilityPercent = viewToken?.percent || 1;
    
    if (isVisible) {
      // Started viewing
      setIsInViewport(true);
      viewStartTime.current = Date.now();
      
      if (debug) {
        console.log(`👀 Started viewing ${postId} (${Math.round(visibilityPercent * 100)}% visible)`);
      }
    } else if (viewStartTime.current) {
      // Stopped viewing
      setIsInViewport(false);
      const viewDuration = Date.now() - viewStartTime.current;
      
      if (debug) {
        console.log(`👀 Stopped viewing ${postId} after ${viewDuration}ms`);
      }
      
      // Check if view meets criteria
      const meetsThreshold = checkViewCriteria(viewDuration, visibilityPercent);
      
      if (meetsThreshold) {
        setHasBeenViewed(true);
        
        if (debug) {
          console.log(`✅ Post ${postId} marked as viewed (${viewDuration}ms, ${Math.round(visibilityPercent * 100)}%)`);
        }
        
        onViewed?.(postId, viewDuration);
      }
      
      viewStartTime.current = null;
    }
  }, [enabled, hasBeenViewed, checkViewCriteria, postId, onViewed, debug]);
  
  // Create a ref for intersection observer or scroll tracking
  const viewRef = useRef<View>(null);
  
  // For React Native, we'll need to handle this differently
  // This will be called by the parent FlatList's onViewableItemsChanged
  React.useImperativeHandle(viewRef, () => ({
    handleViewabilityChange,
  }));
  
  return (
    <View
      ref={viewRef}
      style={style}
      {...props}
    >
      {children}
      
      {/* Debug overlay */}
      {debug && __DEV__ && (
        <View 
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 8,
            borderRadius: 4,
            zIndex: 1000,
          }}
        >
          <Text style={{ color: 'white', fontSize: 10 }}>
            ID: {postId.slice(-6)}
          </Text>
          <Text style={{ color: 'white', fontSize: 10 }}>
            Viewing: {isInViewport ? '✅' : '❌'}
          </Text>
          <Text style={{ color: 'white', fontSize: 10 }}>
            Viewed: {hasBeenViewed ? '✅' : '❌'}
          </Text>
          <Text style={{ color: 'white', fontSize: 10 }}>
            Type: {mediaType}
          </Text>
        </View>
      )}
    </View>
  );
};

// Hook for managing view tracking in FlatList
export const useViewTracking = () => {
  const viewTrackersRef = useRef<Map<string, any>>(new Map());
  
  const registerTracker = useCallback((postId: string, tracker: any) => {
    viewTrackersRef.current.set(postId, tracker);
  }, []);
  
  const unregisterTracker = useCallback((postId: string) => {
    viewTrackersRef.current.delete(postId);
  }, []);
  
  const handleViewableItemsChanged = useCallback(({ viewableItems, changed }: {
    viewableItems: ViewToken[];
    changed: ViewToken[];
  }) => {
    changed.forEach((item) => {
      const postId = item.item?.id;
      if (postId && viewTrackersRef.current.has(postId)) {
        const tracker = viewTrackersRef.current.get(postId);
        tracker?.handleViewabilityChange?.(item.isViewable, item);
      }
    });
  }, []);
  
  return {
    registerTracker,
    unregisterTracker,
    handleViewableItemsChanged,
  };
};

// Hook for individual post view tracking
export const usePostViewTracking = (
  postId: string,
  mediaType: 'photo' | 'video',
  onViewed?: (postId: string, duration: number) => void
) => {
  const [isViewing, setIsViewing] = useState(false);
  const [hasBeenViewed, setHasBeenViewed] = useState(false);
  const viewStartTime = useRef<number | null>(null);
  
  const startViewing = useCallback(() => {
    if (hasBeenViewed) return;
    
    setIsViewing(true);
    viewStartTime.current = Date.now();
  }, [hasBeenViewed]);
  
  const stopViewing = useCallback(() => {
    if (!viewStartTime.current || hasBeenViewed) return;
    
    setIsViewing(false);
    const duration = Date.now() - viewStartTime.current;
    viewStartTime.current = null;
    
    // Check criteria
    const minDuration = mediaType === 'photo' ? 2000 : 3000;
    if (duration >= minDuration) {
      setHasBeenViewed(true);
      onViewed?.(postId, duration);
    }
  }, [hasBeenViewed, mediaType, onViewed, postId]);
  
  return {
    isViewing,
    hasBeenViewed,
    startViewing,
    stopViewing,
  };
};