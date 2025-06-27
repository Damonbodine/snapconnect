# Performance Optimization Guide

## 🎯 Overview

This document covers comprehensive performance optimization strategies for the ephemeral discover feed, ensuring smooth 60fps scrolling even with large datasets and complex view tracking.

## 📊 FlatList Optimization

### Core Configuration

```typescript
const optimizedFlatListProps = {
  // Memory management
  removeClippedSubviews: true,
  maxToRenderPerBatch: 3,
  initialNumToRender: 2,
  windowSize: 8,
  
  // Update optimization
  updateCellsBatchingPeriod: 100,
  legacyImplementation: false,
  
  // Layout optimization
  getItemLayout: (data: PostWithUser[], index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }),
  
  // Key extraction
  keyExtractor: (item: PostWithUser) => item.id,
  
  // Scroll optimization
  scrollEventThrottle: 16,
  disableIntervalMomentum: true,
};
```

### Dynamic Item Heights

```typescript
interface PostDimensions {
  headerHeight: number;
  mediaHeight: number;
  contentHeight: number;
  footerHeight: number;
  totalHeight: number;
}

const usePostDimensions = (post: PostWithUser): PostDimensions => {
  return useMemo(() => {
    const headerHeight = 72; // Fixed header
    const footerHeight = 48; // Fixed footer
    
    // Calculate media height based on aspect ratio
    const screenWidth = Dimensions.get('window').width - 32;
    const mediaHeight = post.media_type === 'video' 
      ? screenWidth * (9/16) // 16:9 aspect ratio
      : screenWidth; // Square for photos
    
    // Estimate content height based on text length
    const contentHeight = post.content 
      ? Math.ceil(post.content.length / 40) * 20 + 16 // Rough estimate
      : 0;
    
    return {
      headerHeight,
      mediaHeight,
      contentHeight,
      footerHeight,
      totalHeight: headerHeight + mediaHeight + contentHeight + footerHeight + 24, // margins
    };
  }, [post]);
};
```

## 🖼️ Image Optimization

### Progressive Loading

```typescript
interface OptimizedImageProps {
  uri: string;
  width: number;
  height: number;
  quality?: 'low' | 'medium' | 'high';
}

const useOptimizedImage = ({ uri, width, height, quality = 'medium' }: OptimizedImageProps) => {
  const [optimizedUri, setOptimizedUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const optimizeImage = async () => {
      try {
        // Generate optimized URL with parameters
        const url = new URL(uri);
        url.searchParams.set('w', width.toString());
        url.searchParams.set('h', height.toString());
        url.searchParams.set('f', 'webp'); // Modern format
        
        const qualityMap = { low: 60, medium: 80, high: 95 };
        url.searchParams.set('q', qualityMap[quality].toString());
        
        setOptimizedUri(url.toString());
      } catch (error) {
        setOptimizedUri(uri); // Fallback to original
      } finally {
        setIsLoading(false);
      }
    };
    
    optimizeImage();
  }, [uri, width, height, quality]);
  
  return { optimizedUri, isLoading };
};
```

### Image Caching Strategy

```typescript
interface ImageCache {
  [key: string]: {
    uri: string;
    timestamp: number;
    size: number;
  };
}

class ImageCacheManager {
  private cache: ImageCache = {};
  private maxCacheSize = 50 * 1024 * 1024; // 50MB
  private currentCacheSize = 0;
  
  async cacheImage(key: string, uri: string): Promise<string> {
    try {
      // Check if already cached
      if (this.cache[key]) {
        return this.cache[key].uri;
      }
      
      // Download and cache image
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Create local cache entry
      const cacheUri = await this.saveToDisk(blob, key);
      
      this.cache[key] = {
        uri: cacheUri,
        timestamp: Date.now(),
        size: blob.size,
      };
      
      this.currentCacheSize += blob.size;
      
      // Clean cache if needed
      await this.cleanCacheIfNeeded();
      
      return cacheUri;
    } catch (error) {
      console.error('Failed to cache image:', error);
      return uri; // Return original on failure
    }
  }
  
  private async cleanCacheIfNeeded(): Promise<void> {
    if (this.currentCacheSize <= this.maxCacheSize) return;
    
    // Sort by timestamp (oldest first)
    const entries = Object.entries(this.cache)
      .sort(([,a], [,b]) => a.timestamp - b.timestamp);
    
    // Remove oldest entries until under limit
    for (const [key, entry] of entries) {
      await this.removeCacheEntry(key);
      this.currentCacheSize -= entry.size;
      
      if (this.currentCacheSize <= this.maxCacheSize * 0.8) break;
    }
  }
}
```

## 🎥 Video Optimization

### Adaptive Video Loading

```typescript
interface VideoQualitySettings {
  resolution: 'low' | 'medium' | 'high';
  bitrate: number;
  fps: number;
}

const useAdaptiveVideoQuality = (networkType: string) => {
  return useMemo((): VideoQualitySettings => {
    switch (networkType) {
      case 'wifi':
        return { resolution: 'high', bitrate: 2000, fps: 30 };
      case '4g':
        return { resolution: 'medium', bitrate: 1000, fps: 24 };
      case '3g':
      case '2g':
        return { resolution: 'low', bitrate: 500, fps: 15 };
      default:
        return { resolution: 'medium', bitrate: 1000, fps: 24 };
    }
  }, [networkType]);
};
```

### Video Preloading

```typescript
class VideoPreloader {
  private preloadQueue: string[] = [];
  private preloadedVideos: Set<string> = new Set();
  private maxPreloadCount = 3;
  
  preloadVideos(videoUris: string[]): void {
    // Add to queue if not already preloaded
    const newVideos = videoUris.filter(uri => !this.preloadedVideos.has(uri));
    this.preloadQueue.push(...newVideos.slice(0, this.maxPreloadCount));
    
    this.processPreloadQueue();
  }
  
  private async processPreloadQueue(): Promise<void> {
    while (this.preloadQueue.length > 0 && this.preloadedVideos.size < this.maxPreloadCount) {
      const uri = this.preloadQueue.shift()!;
      
      try {
        // Create video element to trigger preload
        const video = new Video.createVideoAsync({ uri });
        await video.loadAsync({ shouldPlay: false });
        
        this.preloadedVideos.add(uri);
      } catch (error) {
        console.warn('Failed to preload video:', uri, error);
      }
    }
  }
  
  isPreloaded(uri: string): boolean {
    return this.preloadedVideos.has(uri);
  }
}
```

## 💾 Database Query Optimization

### Efficient Post Fetching

```sql
-- Optimized query with proper indexing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_unviewed_user 
ON posts (created_at DESC) 
WHERE expires_at > NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_views_user_post_composite 
ON post_views (user_id, post_id, viewed_at);

-- Main query with optimizations
WITH unviewed_posts AS (
  SELECT DISTINCT p.id
  FROM posts p
  LEFT JOIN post_views pv ON p.id = pv.post_id AND pv.user_id = $1
  WHERE p.expires_at > NOW()
    AND pv.id IS NULL
    AND p.user_id != $1
  ORDER BY p.created_at DESC
  LIMIT $2 OFFSET $3
)
SELECT 
  p.*,
  u.username,
  u.full_name,
  u.avatar_url,
  u.fitness_level
FROM unviewed_posts up
JOIN posts p ON up.id = p.id
JOIN users u ON p.user_id = u.id
ORDER BY p.created_at DESC;
```

### Query Result Caching

```typescript
interface QueryCache {
  key: string;
  data: any;
  timestamp: number;
  expiry: number;
}

class DatabaseQueryCache {
  private cache = new Map<string, QueryCache>();
  private defaultTTL = 60000; // 1 minute
  
  async get<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();
    
    // Return cached data if valid
    if (cached && now < cached.expiry) {
      return cached.data;
    }
    
    // Fetch fresh data
    const data = await fetcher();
    
    // Cache the result
    this.cache.set(key, {
      key,
      data,
      timestamp: now,
      expiry: now + (ttl || this.defaultTTL),
    });
    
    return data;
  }
  
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
```

## 📏 Memory Management

### Component Memoization

```typescript
// Optimized PostFeedCard with proper memoization
export const PostFeedCard = React.memo<PostFeedCardProps>(({ 
  post, 
  onViewed, 
  scrollVelocity 
}) => {
  // Implementation
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  if (prevProps.post.id !== nextProps.post.id) return false;
  if (Math.abs(prevProps.scrollVelocity - nextProps.scrollVelocity) > 100) return false;
  return true;
});

// Memoized hooks
const useMemoizedUserGradient = (fitnessLevel: string) => {
  return useMemo(() => {
    const gradientMap = {
      beginner: 'beginner',
      intermediate: 'intermediate',
      advanced: 'advanced',
    };
    return gradientMap[fitnessLevel] || 'primary';
  }, [fitnessLevel]);
};
```

### Memory Leak Prevention

```typescript
const useMemoryOptimizedEffect = (effect: () => void | (() => void), deps: any[]) => {
  useEffect(() => {
    const cleanup = effect();
    
    return () => {
      // Ensure cleanup is called
      if (typeof cleanup === 'function') {
        cleanup();
      }
      
      // Clear any remaining references
      deps.forEach(dep => {
        if (dep && typeof dep === 'object' && 'current' in dep) {
          dep.current = null;
        }
      });
    };
  }, deps);
};
```

## 🚀 Network Optimization

### Request Batching

```typescript
interface BatchedRequest {
  id: string;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

class RequestBatcher {
  private viewTrackingBatch: BatchedRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private maxBatchSize = 10;
  private batchDelay = 1000;
  
  addViewTracking(postId: string, duration: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.viewTrackingBatch.push({ 
        id: postId, 
        resolve, 
        reject 
      });
      
      if (this.viewTrackingBatch.length >= this.maxBatchSize) {
        this.flushBatch();
      } else if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => this.flushBatch(), this.batchDelay);
      }
    });
  }
  
  private async flushBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    const batch = [...this.viewTrackingBatch];
    this.viewTrackingBatch = [];
    
    if (batch.length === 0) return;
    
    try {
      await postService.batchMarkViewed(batch.map(item => ({
        postId: item.id,
        viewedAt: Date.now(),
        duration: 2000,
        deviceType: Platform.OS,
        appVersion: '1.0.0',
      })));
      
      batch.forEach(item => item.resolve(undefined));
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }
  }
}
```

### Connection Quality Adaptation

```typescript
const useConnectionOptimization = () => {
  const netInfo = useNetInfo();
  
  const optimizationSettings = useMemo(() => {
    const { type, isConnected, details } = netInfo;
    
    if (!isConnected) {
      return {
        imageQuality: 'low',
        videoQuality: 'low',
        preloadCount: 0,
        batchSize: 1,
      };
    }
    
    if (type === 'wifi') {
      return {
        imageQuality: 'high',
        videoQuality: 'high',
        preloadCount: 5,
        batchSize: 10,
      };
    }
    
    if (type === 'cellular') {
      const effectiveType = (details as any)?.effectiveType;
      
      switch (effectiveType) {
        case '4g':
          return {
            imageQuality: 'medium',
            videoQuality: 'medium',
            preloadCount: 3,
            batchSize: 5,
          };
        case '3g':
          return {
            imageQuality: 'low',
            videoQuality: 'low',
            preloadCount: 1,
            batchSize: 3,
          };
        default:
          return {
            imageQuality: 'low',
            videoQuality: 'low',
            preloadCount: 0,
            batchSize: 1,
          };
      }
    }
    
    return {
      imageQuality: 'medium',
      videoQuality: 'medium',
      preloadCount: 2,
      batchSize: 5,
    };
  }, [netInfo]);
  
  return optimizationSettings;
};
```

## 📊 Performance Monitoring

### Real-time Metrics

```typescript
interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  scrollVelocity: number;
  networkLatency: number;
}

const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    memoryUsage: 0,
    renderTime: 0,
    scrollVelocity: 0,
    networkLatency: 0,
  });
  
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        setMetrics(prev => ({
          ...prev,
          fps: Math.round((frameCount * 1000) / (currentTime - lastTime)),
        }));
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    };
    
    requestAnimationFrame(measureFPS);
  }, []);
  
  return metrics;
};
```

### Performance Alerts

```typescript
const usePerformanceAlerts = (metrics: PerformanceMetrics) => {
  useEffect(() => {
    // Alert on low FPS
    if (metrics.fps < 45) {
      console.warn('Low FPS detected:', metrics.fps);
      // Could trigger performance optimization mode
    }
    
    // Alert on high memory usage
    if (metrics.memoryUsage > 100 * 1024 * 1024) { // 100MB
      console.warn('High memory usage:', metrics.memoryUsage);
      // Could trigger memory cleanup
    }
    
    // Alert on slow renders
    if (metrics.renderTime > 16) { // > 16ms for 60fps
      console.warn('Slow render detected:', metrics.renderTime);
      // Could reduce render complexity
    }
  }, [metrics]);
};
```

---

**Status**: Comprehensive performance optimization guide  
**Key Areas**: FlatList, images, videos, database, memory, network  
**Target Performance**: 60fps scrolling with large datasets  
**Monitoring**: Real-time metrics and automated alerts