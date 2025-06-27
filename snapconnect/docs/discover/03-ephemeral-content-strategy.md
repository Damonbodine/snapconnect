# Ephemeral Content Strategy

## 🎯 Core Philosophy

**"Content exists until consumed"** - Every piece of content on the discover feed has a single-use lifecycle per user. Once viewed, it disappears forever from that user's feed, creating urgency and authentic engagement.

## 🔄 Content Lifecycle

### 1. Content Creation
```
User creates post → Uploaded to Supabase → Available in global pool → Appears in others' feeds
```

### 2. Content Discovery
```
User opens discover → Query unviewed posts → Display in chronological order → Wait for interaction
```

### 3. Content Consumption
```
User views post → ViewTracker detects → Mark as viewed → Content remains visible during session
```

### 4. Content Disappearance
```
User leaves/refreshes → Previously viewed content filtered out → Never appears again
```

## 📊 View Detection Strategy

### What Counts as "Viewed"?

#### For Photos
- **Minimum Duration**: 2-3 seconds in viewport
- **Minimum Visibility**: 75% of image visible on screen
- **User Intent**: Not just scrolling past, but actually viewing

```typescript
interface PhotoViewCriteria {
  minDuration: 2000; // 2 seconds
  minVisibility: 0.75; // 75% visible
  scrollVelocity: 'low'; // Not rapid scrolling
}
```

#### For Videos
- **Play Requirement**: Video must start playing
- **Duration Requirement**: Watch at least 3 seconds OR 50% of video
- **Audio Consideration**: Muted videos have lower threshold

```typescript
interface VideoViewCriteria {
  mustPlay: true;
  minDuration: 3000; // 3 seconds
  orMinPercentage: 0.5; // 50% of video
  mutedThreshold: 0.3; // Lower bar for muted content
}
```

### View Detection Implementation

```typescript
// ViewTracker component logic
const useViewTracking = (postId: string, mediaType: 'photo' | 'video') => {
  const [isViewed, setIsViewed] = useState(false);
  const [viewStartTime, setViewStartTime] = useState<number | null>(null);
  
  const onViewableChange = useCallback((isViewable: boolean, entry: ViewToken) => {
    if (isViewable && !isViewed) {
      setViewStartTime(Date.now());
    } else if (!isViewable && viewStartTime) {
      const duration = Date.now() - viewStartTime;
      const threshold = mediaType === 'photo' ? 2000 : 3000;
      
      if (duration >= threshold && entry.percent >= 0.75) {
        markAsViewed(postId, duration);
        setIsViewed(true);
      }
      setViewStartTime(null);
    }
  }, [isViewed, viewStartTime, postId, mediaType]);
  
  return { isViewed, onViewableChange };
};
```

## 🚫 Anti-Gaming Measures

### Preventing Abuse

#### Rapid Scrolling Detection
```typescript
// Detect rapid scrolling to prevent gaming
const useScrollVelocityDetection = () => {
  const [isRapidScrolling, setIsRapidScrolling] = useState(false);
  
  const onScroll = useCallback((event) => {
    const velocity = event.nativeEvent.velocity?.y || 0;
    setIsRapidScrolling(Math.abs(velocity) > 1000);
  }, []);
  
  return { isRapidScrolling, onScroll };
};
```

#### Intent Detection
- Track user scroll patterns
- Require deliberate stopping on content
- Ignore accidental views during rapid scrolling
- Validate view depth vs superficial engagement

#### Batch View Tracking
```typescript
// Prevent API spam by batching view tracking
const useBatchedViewTracking = () => {
  const [pendingViews, setPendingViews] = useState<ViewRecord[]>([]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingViews.length > 0) {
        postService.batchMarkViewed(pendingViews);
        setPendingViews([]);
      }
    }, 5000); // Batch every 5 seconds
    
    return () => clearInterval(interval);
  }, [pendingViews]);
  
  const addView = useCallback((view: ViewRecord) => {
    setPendingViews(prev => [...prev, view]);
  }, []);
  
  return { addView };
};
```

## 🎨 User Experience Design

### Visual Feedback

#### Content State Indicators
```typescript
// Visual states for content
enum ContentState {
  Fresh = 'fresh',      // New, unviewed content
  Viewing = 'viewing',  // Currently being viewed
  Consumed = 'consumed' // Viewed, will disappear on refresh
}
```

#### Subtle Animations
- **Fresh Content**: Slight glow or pulsing border
- **Being Viewed**: Progress indicator for view tracking
- **About to Disappear**: Gentle fade or opacity change

### Empty State Handling

#### "All Caught Up" Experience
```typescript
const EmptyFeedState = () => (
  <View className="flex-1 items-center justify-center p-8">
    <Text className="text-4xl mb-4">🎉</Text>
    <Text className="text-2xl font-bold text-white mb-2">
      You're All Caught Up!
    </Text>
    <Text className="text-gray-400 text-center mb-6">
      You've seen all the latest content. Check back later for more posts from your fitness community.
    </Text>
    <GradientCard onPress={refreshFeed}>
      <Text className="text-white font-semibold">Refresh Feed</Text>
    </GradientCard>
  </View>
);
```

#### Onboarding for New Users
- Explain ephemeral concept on first use
- Show view tracking indicators initially
- Provide tips for engaging with content

## ⚙️ Configuration & Customization

### Content Lifecycle Settings

```typescript
interface EphemeralConfig {
  // View detection thresholds
  photoMinDuration: number;     // Default: 2000ms
  videoMinDuration: number;     // Default: 3000ms
  minVisibilityPercent: number; // Default: 0.75
  
  // Behavioral settings
  allowReview: boolean;         // Default: false (no second chances)
  gracePeriodMs: number;        // Default: 0 (immediate disappearance)
  debugMode: boolean;           // Default: false (show view tracking)
  
  // Performance settings
  batchInterval: number;        // Default: 5000ms
  maxBatchSize: number;         // Default: 10 views
  preloadBuffer: number;        // Default: 3 posts ahead
}
```

### A/B Testing Capabilities

```typescript
// Different strategies for different user groups
const getViewStrategy = (userId: string): ViewStrategy => {
  const userSegment = getUserSegment(userId);
  
  switch (userSegment) {
    case 'power_users':
      return { minDuration: 1500, allowQuickViews: true };
    case 'casual_users': 
      return { minDuration: 3000, requireDeepEngagement: true };
    default:
      return { minDuration: 2000, balanced: true };
  }
};
```

## 📊 Analytics & Insights

### Tracking Metrics

#### Content Performance
```typescript
interface ContentMetrics {
  // Basic engagement
  totalViews: number;
  uniqueViewers: number;
  averageViewDuration: number;
  
  // Engagement quality
  viewCompletionRate: number; // % who viewed full duration
  rapidScrollSkips: number;   // Views that were too quick
  
  // Time-based patterns
  viewsByHour: Record<string, number>;
  peakEngagementTime: Date;
}
```

#### User Behavior
```typescript
interface UserEngagementMetrics {
  // Content consumption
  dailyPostsViewed: number;
  averageSessionDuration: number;
  contentCompletionRate: number;
  
  // Behavior patterns
  preferredContentTypes: string[];
  optimalPostingTimes: Date[];
  engagementTrends: EngagementTrend[];
}
```

### Privacy-First Analytics
- Aggregate data only, no individual tracking
- User consent for detailed analytics
- Regular data cleanup and anonymization
- Focus on content performance, not user surveillance

## 🔄 Content Refresh Strategies

### New Content Discovery

#### Pull-to-Refresh Behavior
```typescript
const useDiscoverRefresh = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Only fetch truly new content, not reset viewed content
      await discoverStore.fetchNewPosts();
    } finally {
      setIsRefreshing(false);
    }
  }, []);
  
  return { isRefreshing, onRefresh };
};
```

#### Real-time Content Injection
- Supabase realtime for new posts
- Subtle notifications for fresh content
- Maintain feed position when new content arrives

### Content Prioritization

#### Algorithmic Considerations
```typescript
interface ContentRanking {
  // Time-based
  recency: number;           // How recently posted
  
  // Social signals
  creatorPopularity: number; // Creator's engagement history
  contentQuality: number;    // Historical performance of similar content
  
  // Personal relevance
  fitnessLevelMatch: number; // Matches user's fitness level
  goalAlignment: number;     // Aligns with user's fitness goals
  
  // Diversity
  contentTypeBalance: number; // Ensure mix of photos/videos
  creatorDiversity: number;   // Don't show too much from same creator
}
```

## 🚨 Edge Cases & Error Handling

### Network Issues
- **Offline Viewing**: Allow viewing cached content
- **Sync on Reconnect**: Batch upload view tracking when online
- **Partial Views**: Handle interrupted view sessions gracefully

### App State Changes
- **Backgrounding**: Pause view tracking when app goes to background
- **Interruptions**: Handle calls, notifications during viewing
- **Crash Recovery**: Resume view tracking state appropriately

### Data Integrity
- **Duplicate Views**: Prevent double-counting same view session
- **Clock Skew**: Handle device time inconsistencies
- **Concurrent Access**: Handle multiple devices accessing same account

## 🎯 Success Metrics

### User Engagement
- **Daily Active Viewers**: Users who view discover content daily
- **Session Depth**: Average posts viewed per session
- **Return Rate**: Users who come back after viewing all content

### Content Quality
- **View Completion Rate**: % of content viewed to completion
- **Creator Engagement**: Response to having content viewed
- **Content Diversity**: Variety in content types and creators

### Technical Performance
- **View Tracking Accuracy**: Reliability of view detection
- **Query Performance**: Speed of filtering viewed content
- **Error Rates**: Failed view tracking attempts

## 🔗 Integration Points

### With Camera Feature
- Seamless flow from creation to discovery
- Creator notifications when content is viewed
- Quality feedback loop for content creation

### With Social Features
- Friend prioritization in discover feed
- Social proof for popular content
- Community engagement around ephemeral content

### With AI/RAG Features
- Personalized content recommendations
- Smart content categorization
- Automated content quality assessment

---

**Status**: Strategy defined, ready for implementation  
**Key Dependencies**: View tracking system, database schema  
**Critical Success Factor**: Accurate view detection without false positives  
**User Impact**: Creates urgency and authentic engagement patterns