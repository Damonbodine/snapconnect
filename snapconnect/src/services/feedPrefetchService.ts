import { postService } from './postService';
import { ScoredPost } from './feedRankingService';

interface PrefetchConfig {
  prefetchDistance: number;  // How many posts ahead to prefetch
  batchSize: number;        // How many posts to fetch at once
  maxCacheSize: number;     // Maximum cached posts
  scrollThreshold: number;  // Scroll velocity threshold for prefetch
}

interface CachedPost extends ScoredPost {
  cached: boolean;
  cacheTime: number;
}

class FeedPrefetchService {
  private static instance: FeedPrefetchService;
  
  private prefetchQueue: Set<number> = new Set(); // Track prefetch operations
  private postCache: Map<string, CachedPost> = new Map(); // Cache posts by ID
  private imageCache: Map<string, string> = new Map(); // Cache image URIs
  private prefetchedPages: Set<number> = new Set(); // Track prefetched page numbers
  
  private config: PrefetchConfig = {
    prefetchDistance: 8,      // Prefetch when 8 posts from end
    batchSize: 20,           // Fetch 20 posts at once
    maxCacheSize: 100,       // Keep max 100 posts in cache
    scrollThreshold: 200,    // Only prefetch if scroll < 200 velocity
  };

  public static getInstance(): FeedPrefetchService {
    if (!FeedPrefetchService.instance) {
      FeedPrefetchService.instance = new FeedPrefetchService();
    }
    return FeedPrefetchService.instance;
  }

  /**
   * Smart prefetch based on user scroll position
   */
  async smartPrefetch(
    currentIndex: number,
    totalPosts: number,
    userId: string,
    currentPage: number,
    scrollVelocity: number,
    useRanking: boolean = true
  ): Promise<ScoredPost[]> {
    try {
      // Don't prefetch if scrolling too fast
      if (scrollVelocity > this.config.scrollThreshold) {
        console.log('🚀 Skipping prefetch - scrolling too fast:', scrollVelocity);
        return [];
      }

      // Check if we're close enough to the end to trigger prefetch
      const distanceFromEnd = totalPosts - currentIndex;
      if (distanceFromEnd > this.config.prefetchDistance) {
        return [];
      }

      const nextPage = currentPage + 1;
      
      // Don't prefetch if already in progress or already prefetched
      if (this.prefetchQueue.has(nextPage) || this.prefetchedPages.has(nextPage)) {
        return [];
      }

      console.log(`🚀 Smart prefetching page ${nextPage} for user ${userId}`);
      
      // Mark as in progress
      this.prefetchQueue.add(nextPage);

      // Calculate offset
      const offset = currentPage * this.config.batchSize;
      
      // Fetch next batch
      const newPosts = useRanking
        ? await postService.getRankedUnviewedPosts(userId, this.config.batchSize, offset)
        : await postService.getUnviewedPosts(userId, this.config.batchSize, offset);

      // Cache the posts
      const cachedPosts = newPosts.map(post => ({
        ...post,
        cached: true,
        cacheTime: Date.now(),
      }));

      // Add to cache
      cachedPosts.forEach(post => {
        this.postCache.set(post.id, post);
      });

      // Mark page as prefetched
      this.prefetchedPages.add(nextPage);

      // Cleanup cache if too large
      this.cleanupCache();

      // Prefetch images in background
      this.prefetchImages(cachedPosts);

      console.log(`🚀 Prefetched ${newPosts.length} posts for page ${nextPage}`);
      
      return newPosts;
    } catch (error) {
      console.error('🚀 Prefetch error:', error);
      return [];
    } finally {
      // Remove from queue
      this.prefetchQueue.delete(currentPage + 1);
    }
  }

  /**
   * Get cached posts if available
   */
  getCachedPosts(pageNumber: number, pageSize: number): ScoredPost[] {
    if (!this.prefetchedPages.has(pageNumber)) {
      return [];
    }

    const cachedPosts: ScoredPost[] = [];
    
    // Calculate which post IDs should be on this page
    // Note: This is a simplified approach - in practice you'd need better page tracking
    for (const [postId, post] of this.postCache.entries()) {
      if (cachedPosts.length < pageSize) {
        cachedPosts.push(post);
      }
    }

    console.log(`🚀 Retrieved ${cachedPosts.length} cached posts for page ${pageNumber}`);
    return cachedPosts;
  }

  /**
   * Prefetch images in background
   */
  private async prefetchImages(posts: CachedPost[]): Promise<void> {
    const imagePromises = posts
      .filter(post => post.media_url && !this.imageCache.has(post.media_url))
      .map(async (post) => {
        try {
          if (post.media_url) {
            // For React Native, we can use Image.prefetch
            const { Image } = await import('react-native');
            await Image.prefetch(post.media_url);
            
            // Also prefetch thumbnail if available
            if (post.thumbnail_url) {
              await Image.prefetch(post.thumbnail_url);
            }
            
            this.imageCache.set(post.media_url, post.media_url);
            console.log(`🖼️ Prefetched image: ${post.id}`);
          }
        } catch (error) {
          console.warn(`🖼️ Failed to prefetch image for post ${post.id}:`, error);
        }
      });

    await Promise.allSettled(imagePromises);
  }

  /**
   * Predictive prefetch based on scroll patterns
   */
  async predictivePrefetch(
    scrollHistory: number[], // Array of recent scroll velocities
    currentPosition: number,
    userId: string,
    currentPage: number,
    useRanking: boolean = true
  ): Promise<ScoredPost[]> {
    try {
      // Analyze scroll pattern
      const avgVelocity = scrollHistory.reduce((a, b) => a + b, 0) / scrollHistory.length;
      const isConsistentScrolling = scrollHistory.every(v => Math.abs(v - avgVelocity) < 100);
      
      // Only predictive prefetch if user is scrolling consistently and not too fast
      if (!isConsistentScrolling || avgVelocity > this.config.scrollThreshold) {
        return [];
      }

      // Predict how many pages ahead to prefetch based on scroll speed
      const pagesToPrefetch = Math.min(2, Math.ceil(avgVelocity / 50));
      
      console.log(`🔮 Predictive prefetching ${pagesToPrefetch} pages ahead`);
      
      const prefetchPromises: Promise<ScoredPost[]>[] = [];
      
      for (let i = 1; i <= pagesToPrefetch; i++) {
        const targetPage = currentPage + i;
        if (!this.prefetchedPages.has(targetPage)) {
          const offset = targetPage * this.config.batchSize;
          
          const promise = useRanking
            ? postService.getRankedUnviewedPosts(userId, this.config.batchSize, offset)
            : postService.getUnviewedPosts(userId, this.config.batchSize, offset);
            
          prefetchPromises.push(promise);
        }
      }

      const results = await Promise.allSettled(prefetchPromises);
      const allPrefetchedPosts: ScoredPost[] = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const posts = result.value;
          allPrefetchedPosts.push(...posts);
          
          // Cache posts
          posts.forEach(post => {
            this.postCache.set(post.id, {
              ...post,
              cached: true,
              cacheTime: Date.now(),
            });
          });
          
          // Mark page as prefetched
          this.prefetchedPages.add(currentPage + index + 1);
        }
      });

      if (allPrefetchedPosts.length > 0) {
        this.prefetchImages(allPrefetchedPosts.map(post => ({
          ...post,
          cached: true,
          cacheTime: Date.now(),
        })));
      }

      return allPrefetchedPosts;
    } catch (error) {
      console.error('🔮 Predictive prefetch error:', error);
      return [];
    }
  }

  /**
   * Check if a post is cached
   */
  isPostCached(postId: string): boolean {
    return this.postCache.has(postId);
  }

  /**
   * Get a specific cached post
   */
  getCachedPost(postId: string): CachedPost | null {
    return this.postCache.get(postId) || null;
  }

  /**
   * Cleanup old cached posts
   */
  private cleanupCache(): void {
    if (this.postCache.size <= this.config.maxCacheSize) {
      return;
    }

    // Sort by cache time and remove oldest
    const sortedPosts = Array.from(this.postCache.entries())
      .sort(([,a], [,b]) => a.cacheTime - b.cacheTime);

    const postsToRemove = sortedPosts.slice(0, this.postCache.size - this.config.maxCacheSize);
    
    postsToRemove.forEach(([postId]) => {
      this.postCache.delete(postId);
    });

    console.log(`🗑️ Cleaned up ${postsToRemove.length} cached posts`);
  }

  /**
   * Clear all caches (useful for logout/refresh)
   */
  clearCache(): void {
    this.postCache.clear();
    this.imageCache.clear();
    this.prefetchedPages.clear();
    this.prefetchQueue.clear();
    console.log('🗑️ All caches cleared');
  }

  /**
   * Update prefetch configuration
   */
  updateConfig(newConfig: Partial<PrefetchConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Prefetch config updated:', this.config);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    cachedPosts: number;
    cachedImages: number;
    prefetchedPages: number;
    queueSize: number;
  } {
    return {
      cachedPosts: this.postCache.size,
      cachedImages: this.imageCache.size,
      prefetchedPages: this.prefetchedPages.size,
      queueSize: this.prefetchQueue.size,
    };
  }
}

export const feedPrefetchService = FeedPrefetchService.getInstance();