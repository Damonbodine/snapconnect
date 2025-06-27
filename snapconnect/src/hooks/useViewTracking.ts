import { useCallback, useRef, useState } from 'react';
import { useDiscoverStore } from '../stores/discoverStore';
import { ViewRecord } from '../services/postService';

export interface ViewTrackingConfig {
  minViewDuration: number; // milliseconds
  minVisibilityPercentage: number; // 0-100
  debounceMs: number;
  enableBatching: boolean;
  maxBatchSize: number;
}

export interface UseViewTrackingOptions {
  postId: string;
  mediaType: 'photo' | 'video';
  config?: Partial<ViewTrackingConfig>;
  onViewed?: (postId: string, duration: number) => void;
  enabled?: boolean;
  debug?: boolean;
}

const DEFAULT_CONFIG: ViewTrackingConfig = {
  minViewDuration: 2000, // 2 seconds for photos
  minVisibilityPercentage: 75,
  debounceMs: 500,
  enableBatching: true,
  maxBatchSize: 5,
};

export const useViewTracking = (options: UseViewTrackingOptions) => {
  const {
    postId,
    mediaType,
    config: userConfig = {},
    onViewed,
    enabled = true,
    debug = false,
  } = options;

  const config = { ...DEFAULT_CONFIG, ...userConfig };
  
  // Adjust min duration based on media type
  if (mediaType === 'video' && !userConfig.minViewDuration) {
    config.minViewDuration = 3000; // 3 seconds for videos
  }

  const { markPostAsViewed, addToViewQueue, isPostViewed } = useDiscoverStore();
  
  const [isViewing, setIsViewing] = useState(false);
  const [viewDuration, setViewDuration] = useState(0);
  
  const viewStartTime = useRef<number | null>(null);
  const viewTimer = useRef<NodeJS.Timeout | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const hasBeenViewed = useRef(false);

  // Check if post was already viewed
  const alreadyViewed = isPostViewed(postId);

  const clearTimers = useCallback(() => {
    if (viewTimer.current) {
      clearInterval(viewTimer.current);
      viewTimer.current = null;
    }
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }, []);

  const startViewing = useCallback(() => {
    if (!enabled || alreadyViewed || hasBeenViewed.current) {
      if (debug) {
        console.log(`👁️ [${postId}] View blocked:`, {
          enabled,
          alreadyViewed,
          hasBeenViewed: hasBeenViewed.current,
        });
      }
      return;
    }

    if (debug) {
      console.log(`👁️ [${postId}] Starting view tracking`);
    }

    clearTimers();
    
    viewStartTime.current = Date.now();
    setIsViewing(true);
    setViewDuration(0);

    // Start duration timer
    viewTimer.current = setInterval(() => {
      if (viewStartTime.current) {
        const currentDuration = Date.now() - viewStartTime.current;
        setViewDuration(currentDuration);

        if (debug && currentDuration % 1000 === 0) {
          console.log(`👁️ [${postId}] View duration: ${currentDuration}ms`);
        }
      }
    }, 100);
  }, [enabled, alreadyViewed, postId, debug, clearTimers]);

  const stopViewing = useCallback(() => {
    if (!isViewing || !viewStartTime.current || hasBeenViewed.current) {
      return;
    }

    const finalDuration = Date.now() - viewStartTime.current;
    
    if (debug) {
      console.log(`👁️ [${postId}] Stopped viewing after ${finalDuration}ms`);
    }

    clearTimers();
    setIsViewing(false);
    viewStartTime.current = null;

    // Check if view qualifies as "viewed"
    if (finalDuration >= config.minViewDuration) {
      if (debug) {
        console.log(`✅ [${postId}] Qualified as viewed (${finalDuration}ms >= ${config.minViewDuration}ms)`);
      }

      hasBeenViewed.current = true;

      // Create view record
      const viewRecord: ViewRecord = {
        postId,
        viewedAt: new Date().toISOString(),
        sessionId: `session_${Date.now()}`,
        duration: finalDuration.toString(),
        mediaType,
      };

      // Debounce the view recording to prevent rapid fire
      debounceTimer.current = setTimeout(() => {
        // Mark as viewed locally (optimistic update)
        markPostAsViewed(postId);

        // Add to batch queue if batching is enabled
        if (config.enableBatching) {
          addToViewQueue(viewRecord);
        }

        // Call user callback
        onViewed?.(postId, finalDuration);

        if (debug) {
          console.log(`📝 [${postId}] View recorded and queued`);
        }
      }, config.debounceMs);
    } else {
      if (debug) {
        console.log(`❌ [${postId}] View too short (${finalDuration}ms < ${config.minViewDuration}ms)`);
      }
    }
  }, [
    isViewing,
    postId,
    config.minViewDuration,
    config.debounceMs,
    config.enableBatching,
    mediaType,
    debug,
    markPostAsViewed,
    addToViewQueue,
    onViewed,
    clearTimers,
  ]);

  // Handle visibility changes
  const handleVisibilityChange = useCallback((isVisible: boolean, visibilityPercentage: number) => {
    if (!enabled || alreadyViewed) return;

    const meetsVisibilityThreshold = visibilityPercentage >= config.minVisibilityPercentage;

    if (debug) {
      console.log(`👁️ [${postId}] Visibility change:`, {
        isVisible,
        visibilityPercentage,
        meetsThreshold: meetsVisibilityThreshold,
        currentlyViewing: isViewing,
      });
    }

    if (isVisible && meetsVisibilityThreshold && !isViewing) {
      startViewing();
    } else if ((!isVisible || !meetsVisibilityThreshold) && isViewing) {
      stopViewing();
    }
  }, [
    enabled,
    alreadyViewed,
    config.minVisibilityPercentage,
    postId,
    debug,
    isViewing,
    startViewing,
    stopViewing,
  ]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (debug) {
      console.log(`🧹 [${postId}] Cleaning up view tracking`);
    }
    
    if (isViewing) {
      stopViewing();
    }
    clearTimers();
  }, [postId, debug, isViewing, stopViewing, clearTimers]);

  return {
    // State
    isViewing,
    viewDuration,
    isViewed: alreadyViewed || hasBeenViewed.current,
    
    // Controls
    startViewing,
    stopViewing,
    handleVisibilityChange,
    cleanup,
    
    // Config
    config,
    
    // Debug info
    debug: debug ? {
      postId,
      mediaType,
      enabled,
      alreadyViewed,
      hasBeenViewed: hasBeenViewed.current,
      viewStartTime: viewStartTime.current,
    } : undefined,
  };
};