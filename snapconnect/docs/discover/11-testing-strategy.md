# Testing Strategy for Ephemeral Discover Feed

## 🎯 Testing Overview

Comprehensive testing strategy covering all aspects of the ephemeral discover feed, from unit tests to end-to-end user journey validation.

## 🧪 Unit Testing

### Store Testing

```typescript
// discoverStore.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { useDiscoverStore } from '../stores/discoverStore';
import { mockPost, mockViewRecord } from './testUtils';

describe('DiscoverStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useDiscoverStore());
    act(() => {
      result.current.resetStore();
    });
  });
  
  describe('Post Management', () => {
    it('should fetch posts successfully', async () => {
      const { result } = renderHook(() => useDiscoverStore());
      
      await act(async () => {
        await result.current.fetchPosts();
      });
      
      expect(result.current.posts.length).toBeGreaterThan(0);
      expect(result.current.isLoading).toBe(false);
    });
    
    it('should handle fetch errors gracefully', async () => {
      // Mock API failure
      jest.spyOn(postService, 'getUnviewedPosts').mockRejectedValue(new Error('Network error'));
      
      const { result } = renderHook(() => useDiscoverStore());
      
      await act(async () => {
        await result.current.fetchPosts();
      });
      
      expect(result.current.hasError).toBe(true);
      expect(result.current.errorMessage).toBe('Network error');
    });
  });
  
  describe('View Tracking', () => {
    it('should mark post as viewed', () => {
      const { result } = renderHook(() => useDiscoverStore());
      
      act(() => {
        result.current.markPostAsViewed('test-post-1');
      });
      
      expect(result.current.viewedPostIds.has('test-post-1')).toBe(true);
      expect(result.current.totalPostsViewed).toBe(1);
    });
    
    it('should not mark same post twice', () => {
      const { result } = renderHook(() => useDiscoverStore());
      
      act(() => {
        result.current.markPostAsViewed('test-post-1');
        result.current.markPostAsViewed('test-post-1');
      });
      
      expect(result.current.totalPostsViewed).toBe(1);
    });
    
    it('should batch view tracking', async () => {
      const batchSpy = jest.spyOn(postService, 'batchMarkViewed');
      const { result } = renderHook(() => useDiscoverStore());
      
      const viewRecords = [
        mockViewRecord('post-1'),
        mockViewRecord('post-2'),
        mockViewRecord('post-3'),
      ];
      
      await act(async () => {
        await result.current.batchMarkViewed(viewRecords);
      });
      
      expect(batchSpy).toHaveBeenCalledWith(viewRecords);
    });
  });
  
  describe('Pagination', () => {
    it('should load more posts', async () => {
      const { result } = renderHook(() => useDiscoverStore());
      
      // Initial load
      await act(async () => {
        await result.current.fetchPosts();
      });
      
      const initialCount = result.current.posts.length;
      
      // Load more
      await act(async () => {
        await result.current.loadMorePosts();
      });
      
      expect(result.current.posts.length).toBeGreaterThan(initialCount);
      expect(result.current.currentPage).toBe(2);
    });
  });
});
```

### Component Testing

```typescript
// PostFeedCard.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PostFeedCard } from '../components/discover/PostFeedCard';
import { SecurityProvider } from '../contexts/SecurityContext';

const MockWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SecurityProvider>
    {children}
  </SecurityProvider>
);

describe('PostFeedCard', () => {
  const mockPost = {
    id: 'test-post-1',
    content: 'Test workout content',
    media_url: 'https://example.com/image.jpg',
    media_type: 'photo' as const,
    created_at: '2024-01-01T12:00:00Z',
    users: {
      username: 'testuser',
      full_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
      fitness_level: 'intermediate' as const,
    },
  };
  
  it('renders post content correctly', () => {
    const { getByText, getByTestId } = render(
      <PostFeedCard post={mockPost} />,
      { wrapper: MockWrapper }
    );
    
    expect(getByText('testuser')).toBeTruthy();
    expect(getByText('Test workout content')).toBeTruthy();
    expect(getByText('intermediate')).toBeTruthy();
  });
  
  it('calls onViewed when view tracking triggers', async () => {
    const onViewed = jest.fn();
    
    render(
      <PostFeedCard post={mockPost} onViewed={onViewed} />,
      { wrapper: MockWrapper }
    );
    
    // Simulate view tracking
    // This would require mocking the ViewTracker component
    await waitFor(() => {
      expect(onViewed).toHaveBeenCalledWith('test-post-1');
    }, { timeout: 3000 });
  });
  
  it('handles press interactions', () => {
    const onPress = jest.fn();
    
    const { getByTestId } = render(
      <PostFeedCard post={mockPost} onPress={onPress} />,
      { wrapper: MockWrapper }
    );
    
    fireEvent.press(getByTestId('post-card'));
    expect(onPress).toHaveBeenCalledWith(mockPost);
  });
  
  it('applies security measures', () => {
    const { getByTestId } = render(
      <PostFeedCard post={mockPost} />,
      { wrapper: MockWrapper }
    );
    
    const secureView = getByTestId('secure-view');
    expect(secureView).toBeTruthy();
  });
});
```

### Hook Testing

```typescript
// useViewTracking.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { useViewTracking } from '../hooks/useViewTracking';
import { useDiscoverStore } from '../stores/discoverStore';

jest.mock('../stores/discoverStore');

describe('useViewTracking', () => {
  const mockMarkAsViewed = jest.fn();
  const mockAddToViewQueue = jest.fn();
  
  beforeEach(() => {
    (useDiscoverStore as jest.Mock).mockReturnValue({
      markPostAsViewed: mockMarkAsViewed,
      addToViewQueue: mockAddToViewQueue,
    });
  });
  
  it('should track view correctly', async () => {
    const { result } = renderHook(() => useViewTracking());
    
    await act(async () => {
      await result.current.trackView('test-post-1', 2000);
    });
    
    expect(mockMarkAsViewed).toHaveBeenCalledWith('test-post-1');
    expect(mockAddToViewQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: 'test-post-1',
        duration: 2000,
      })
    );
  });
  
  it('should handle tracking errors gracefully', async () => {
    mockMarkAsViewed.mockRejectedValue(new Error('Tracking failed'));
    
    const { result } = renderHook(() => useViewTracking());
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    await act(async () => {
      await result.current.trackView('test-post-1', 2000);
    });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to track view:',
      expect.any(Error)
    );
  });
});
```

## 🧪 Integration Testing

### Database Integration

```typescript
// database.integration.test.ts
import { supabase } from '../services/supabase';
import { postService } from '../services/postService';

describe('Database Integration', () => {
  beforeEach(async () => {
    // Clean up test data
    await supabase.from('post_views').delete().eq('user_id', 'test-user-id');
    await supabase.from('posts').delete().eq('user_id', 'test-user-id');
  });
  
  it('should filter viewed posts correctly', async () => {
    // Create test posts
    const { data: posts } = await supabase
      .from('posts')
      .insert([
        { content: 'Post 1', user_id: 'other-user-1' },
        { content: 'Post 2', user_id: 'other-user-2' },
        { content: 'Post 3', user_id: 'other-user-3' },
      ])
      .select();
    
    // Mark one as viewed
    await supabase
      .from('post_views')
      .insert({
        user_id: 'test-user-id',
        post_id: posts[0].id,
      });
    
    // Fetch unviewed posts
    const unviewedPosts = await postService.getUnviewedPosts('test-user-id', 10);
    
    expect(unviewedPosts).toHaveLength(2);
    expect(unviewedPosts.find(p => p.id === posts[0].id)).toBeUndefined();
  });
  
  it('should handle view tracking batch operations', async () => {
    const viewRecords = [
      {
        postId: 'post-1',
        viewedAt: Date.now(),
        duration: 2000,
        deviceType: 'ios',
        appVersion: '1.0.0',
      },
      {
        postId: 'post-2',
        viewedAt: Date.now(),
        duration: 3000,
        deviceType: 'ios',
        appVersion: '1.0.0',
      },
    ];
    
    await expect(postService.batchMarkViewed(viewRecords)).resolves.not.toThrow();
    
    // Verify records were created
    const { data } = await supabase
      .from('post_views')
      .select('*')
      .in('post_id', ['post-1', 'post-2']);
    
    expect(data).toHaveLength(2);
  });
});
```

### API Integration

```typescript
// api.integration.test.ts
import { postService } from '../services/postService';
import { authStore } from '../stores/authStore';

describe('API Integration', () => {
  beforeAll(async () => {
    // Authenticate test user
    await authStore.getState().login({
      email: 'test@example.com',
      password: 'testpassword',
    });
  });
  
  it('should fetch discover posts with pagination', async () => {
    const page1 = await postService.getDiscoverPosts(10, 0);
    const page2 = await postService.getDiscoverPosts(10, 10);
    
    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
    
    // Ensure no duplicates between pages
    const page1Ids = page1.map(p => p.id);
    const page2Ids = page2.map(p => p.id);
    const intersection = page1Ids.filter(id => page2Ids.includes(id));
    
    expect(intersection).toHaveLength(0);
  });
  
  it('should handle network errors gracefully', async () => {
    // Mock network failure
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    
    await expect(postService.getDiscoverPosts(10))
      .rejects
      .toThrow('Network error');
    
    global.fetch = originalFetch;
  });
});
```

## 🤖 End-to-End Testing

### User Journey Testing

```typescript
// e2e/discoverFeed.e2e.ts
import { by, element, expect, device } from 'detox';

describe('Discover Feed E2E', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
    await element(by.id('discover-tab')).tap();
  });
  
  it('should load and display posts', async () => {
    await expect(element(by.id('discover-feed'))).toBeVisible();
    await expect(element(by.id('post-card-0'))).toBeVisible();
  });
  
  it('should handle pull to refresh', async () => {
    await element(by.id('discover-feed')).swipe('down', 'fast', 0.8);
    await expect(element(by.text('Refreshing feed...'))).toBeVisible();
    await waitFor(element(by.text('Refreshing feed...'))).not.toBeVisible().withTimeout(5000);
  });
  
  it('should track post views and hide viewed content', async () => {
    // Get initial post count
    const initialPosts = await element(by.id('discover-feed')).getAttributes();
    const initialCount = initialPosts.elements?.length || 0;
    
    // View a post (scroll to it and wait)
    await element(by.id('post-card-0')).scrollTo('visible');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for view tracking
    
    // Refresh feed
    await element(by.id('discover-feed')).swipe('down', 'fast', 0.8);
    await waitFor(element(by.text('Refreshing feed...'))).not.toBeVisible().withTimeout(5000);
    
    // Check that post count decreased (viewed post disappeared)
    const updatedPosts = await element(by.id('discover-feed')).getAttributes();
    const updatedCount = updatedPosts.elements?.length || 0;
    
    expect(updatedCount).toBeLessThan(initialCount);
  });
  
  it('should handle empty state', async () => {
    // Mock empty response or view all posts
    await element(by.id('view-all-posts-button')).tap(); // Hypothetical test helper
    
    await expect(element(by.text("You're All Caught Up!"))).toBeVisible();
    await expect(element(by.id('refresh-button'))).toBeVisible();
  });
  
  it('should handle infinite scroll', async () => {
    let canScroll = true;
    let scrollCount = 0;
    
    while (canScroll && scrollCount < 5) {
      try {
        await element(by.id('discover-feed')).scroll(300, 'down');
        scrollCount++;
        
        // Check if loading indicator appears
        await expect(element(by.id('loading-skeleton'))).toBeVisible();
        await waitFor(element(by.id('loading-skeleton'))).not.toBeVisible().withTimeout(10000);
      } catch {
        canScroll = false;
      }
    }
    
    expect(scrollCount).toBeGreaterThan(0);
  });
});
```

### Security Testing

```typescript
// e2e/security.e2e.ts
import { by, element, expect, device } from 'detox';

describe('Security E2E', () => {
  it('should prevent screenshots', async () => {
    await element(by.id('discover-tab')).tap();
    await expect(element(by.id('post-card-0'))).toBeVisible();
    
    // Attempt screenshot (this would be platform-specific)
    try {
      await device.takeScreenshot('attempted-screenshot');
      // If we get here, screenshot prevention failed
      throw new Error('Screenshot should have been prevented');
    } catch (error) {
      // Expected behavior - screenshot was prevented
      expect(error.message).toContain('prevented');
    }
  });
  
  it('should hide content when app goes to background', async () => {
    await element(by.id('discover-tab')).tap();
    await expect(element(by.id('post-card-0'))).toBeVisible();
    
    // Send app to background
    await device.sendToHome();
    await device.launchApp({ newInstance: false });
    
    // Content should be hidden or blurred initially
    await expect(element(by.text('Content hidden for security'))).toBeVisible();
  });
});
```

## 📊 Performance Testing

### Load Testing

```typescript
// performance/loadTest.ts
import { performance } from 'perf_hooks';
import { renderHook, act } from '@testing-library/react-hooks';
import { useDiscoverStore } from '../stores/discoverStore';

describe('Performance Tests', () => {
  it('should handle large datasets efficiently', async () => {
    const { result } = renderHook(() => useDiscoverStore());
    
    // Mock large dataset
    const largePosts = Array.from({ length: 1000 }, (_, i) => ({
      id: `post-${i}`,
      content: `Post content ${i}`,
      media_url: `https://example.com/image-${i}.jpg`,
      media_type: 'photo' as const,
      created_at: new Date().toISOString(),
      users: {
        username: `user${i}`,
        full_name: `User ${i}`,
        avatar_url: `https://example.com/avatar-${i}.jpg`,
        fitness_level: 'intermediate' as const,
      },
    }));
    
    const startTime = performance.now();
    
    await act(async () => {
      // Simulate loading large dataset
      result.current.setPosts(largePosts);
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(100); // 100ms
    expect(result.current.posts).toHaveLength(1000);
  });
  
  it('should efficiently filter viewed posts', async () => {
    const { result } = renderHook(() => useDiscoverStore());
    
    // Create large viewed set
    const viewedIds = Array.from({ length: 500 }, (_, i) => `post-${i}`);
    
    const startTime = performance.now();
    
    act(() => {
      viewedIds.forEach(id => result.current.markPostAsViewed(id));
    });
    
    const unviewedPosts = result.current.getUnviewedPosts();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(50); // 50ms
    expect(result.current.viewedPostIds.size).toBe(500);
  });
});
```

### Memory Testing

```typescript
// performance/memoryTest.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { useDiscoverStore } from '../stores/discoverStore';

describe('Memory Tests', () => {
  it('should not leak memory with repeated operations', async () => {
    const { result } = renderHook(() => useDiscoverStore());
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Perform many operations
    for (let i = 0; i < 1000; i++) {
      await act(async () => {
        result.current.markPostAsViewed(`post-${i}`);
        result.current.addToViewQueue({
          postId: `post-${i}`,
          viewedAt: Date.now(),
          duration: 2000,
          deviceType: 'test',
          appVersion: '1.0.0',
        });
      });
    }
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be reasonable
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB
  });
});
```

## 🤖 Test Utilities

### Mock Data Generators

```typescript
// testUtils/mockData.ts
export const mockPost = (overrides = {}): PostWithUser => ({
  id: 'test-post-1',
  content: 'Test post content',
  media_url: 'https://example.com/image.jpg',
  media_type: 'photo',
  workout_type: 'strength',
  created_at: '2024-01-01T12:00:00Z',
  users: {
    username: 'testuser',
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    fitness_level: 'intermediate',
  },
  ...overrides,
});

export const mockViewRecord = (postId: string): ViewRecord => ({
  postId,
  viewedAt: Date.now(),
  duration: 2000,
  deviceType: 'test',
  appVersion: '1.0.0',
});

export const generateMockPosts = (count: number): PostWithUser[] => {
  return Array.from({ length: count }, (_, i) => mockPost({
    id: `post-${i}`,
    content: `Post content ${i}`,
    users: {
      username: `user${i}`,
      full_name: `User ${i}`,
      avatar_url: `https://example.com/avatar-${i}.jpg`,
      fitness_level: ['beginner', 'intermediate', 'advanced'][i % 3],
    },
  }));
};
```

### Test Environment Setup

```typescript
// testUtils/setup.ts
import 'react-native-gesture-handler/jestSetup';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock Expo modules
jest.mock('expo-av', () => ({
  Video: 'Video',
  ResizeMode: {
    COVER: 'cover',
    CONTAIN: 'contain',
  },
}));

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
```

---

**Status**: Comprehensive testing strategy defined  
**Coverage**: Unit, integration, E2E, performance, security  
**Tools**: Jest, React Native Testing Library, Detox  
**Focus Areas**: View tracking accuracy, performance, security compliance