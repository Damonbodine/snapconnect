# Ephemeral Discover Feed - Implementation Overview

## 🎯 Project Goal

Build an Instagram/TikTok-style discover feed that shows photos and videos from all users on the platform, with Snapchat-like ephemeral functionality where content disappears after being viewed.

## 🏗️ Architecture Overview

### Core Concept
```
User sees post → Content is marked as "viewed" → Content disappears from their feed forever
```

### Key Features
- **Ephemeral Content**: Once viewed, content never appears again for that user
- **Screenshot Prevention**: Users cannot screenshot or record others' content
- **Real-time Feed**: Most recent content appears first
- **Performance**: Smooth scrolling with large datasets
- **Security**: Content protection at multiple levels

## 📊 Current Infrastructure Status

### ✅ What's Already Built
- **Database**: Posts table with user relationships
- **Storage**: Supabase storage with proper policies  
- **Upload**: MediaUploadService for photos/videos
- **UI**: GradientCard system and animations
- **Auth**: User authentication and permissions

### 🔨 What We Need to Build
- **View Tracking**: Database table and queries for tracking viewed content
- **Security**: Screenshot prevention and content protection
- **Feed Logic**: Filtering out already-viewed posts
- **Components**: PostFeedCard for displaying individual posts
- **State Management**: Ephemeral-aware store

## 🗄️ Database Architecture

### New Table: `post_views`
```sql
CREATE TABLE post_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  view_duration INTEGER, -- seconds spent viewing
  UNIQUE(user_id, post_id)
);
```

### Query Strategy
```sql
-- Get posts user hasn't seen
SELECT p.*, u.username, u.avatar_url
FROM posts p
JOIN users u ON p.user_id = u.id
LEFT JOIN post_views pv ON p.id = pv.post_id AND pv.user_id = $1
WHERE pv.id IS NULL
ORDER BY p.created_at DESC
LIMIT 20;
```

## 🔒 Security Implementation

### Multi-Layer Protection
1. **React Native Level**: Screenshot prevention flags
2. **Component Level**: Secure rendering for media
3. **App State Level**: Blur content when app goes to background
4. **Platform Level**: iOS/Android specific security measures

### Technologies
- `react-native-prevent-screenshot`
- Native security flags (`FLAG_SECURE` on Android)
- App state detection for background security
- Secure video rendering techniques

## 🎨 Component Architecture

```
DiscoverScreen
├── DiscoverStore (Zustand)
├── FlatList (Performance-optimized)
│   ├── PostFeedCard (Individual posts)
│   │   ├── UserHeader (Avatar, username, fitness level)
│   │   ├── MediaContent (Photo/Video with security)
│   │   ├── PostCaption (Content text)
│   │   └── ViewTracker (Invisible component tracking view)
│   └── LoadingSkeletons
└── SecurityProvider (Screenshot prevention)
```

## 📱 User Experience Flow

### 1. Initial Load
```
User opens Discover → Load unviewed posts → Display in feed
```

### 2. Content Consumption
```
User scrolls to post → ViewTracker detects view → Mark as viewed → Content remains visible
```

### 3. Subsequent Loads
```
User refreshes feed → Previously viewed posts filtered out → Only new content shows
```

### 4. End of Content
```
No more unviewed posts → Show "You're all caught up" message
```

## ⚡ Performance Considerations

### Database Optimization
- Efficient indexes on `post_views` table
- Optimized JOIN queries for large datasets
- Pagination to limit memory usage

### React Native Optimization
- `FlatList` with `getItemLayout` for smooth scrolling
- `removeClippedSubviews` for memory management
- Lazy loading of media content
- Image/video caching strategies

### View Tracking Optimization
- Batch view tracking to reduce API calls
- Optimistic UI updates
- Background sync for reliability

## 🔄 Implementation Phases

### Phase 1: Foundation (High Priority)
1. Database schema updates
2. Core PostFeedCard component
3. Basic view tracking
4. Security implementation

### Phase 2: Feed Implementation (Medium Priority)
5. DiscoverStore with ephemeral logic
6. FlatList integration
7. Loading states and UX polish
8. Pull-to-refresh functionality

### Phase 3: Optimization (Lower Priority)
9. Performance tuning
10. Advanced security features
11. Analytics and monitoring
12. Edge case handling

## 🎛️ Configuration Options

### Ephemeral Settings
```typescript
interface EphemeralConfig {
  minViewDuration: number; // Minimum seconds to count as "viewed"
  requireFullView: boolean; // Must see entire post vs partial
  gracePeriod: number; // Minutes before post disappears after viewing
  debugMode: boolean; // Show view tracking for testing
}
```

### Performance Settings
```typescript
interface PerformanceConfig {
  batchSize: number; // Posts loaded per request
  preloadImages: number; // Images to preload ahead
  maxCacheSize: number; // Maximum cached media items
  viewTrackingThrottle: number; // MS between view tracking calls
}
```

## 🚨 Critical Success Factors

### Must-Have Features
- ✅ Reliable view tracking (no false positives/negatives)
- ✅ Smooth performance with large feeds
- ✅ Effective screenshot prevention
- ✅ Intuitive user experience
- ✅ Data privacy and security

### Nice-to-Have Features
- 📊 Analytics on content consumption patterns
- 🔄 Real-time notifications for new content
- 🎨 Custom animations for content disappearing
- 📱 Offline support for already-loaded content
- 🔍 Search functionality for unviewed content

## 📋 Next Steps

1. **Review this overview** - Ensure alignment with project goals
2. **Database implementation** - Create `post_views` table and queries
3. **Security research** - Investigate platform-specific screenshot prevention
4. **Component development** - Start with PostFeedCard component
5. **Testing strategy** - Plan comprehensive testing approach

## 🔗 Related Documentation

- `02-database-schema-updates.md` - Detailed database changes
- `03-ephemeral-content-strategy.md` - Content lifecycle management
- `04-view-tracking-implementation.md` - Technical view detection
- `05-security-implementation.md` - Content protection strategies

---

**Status**: Ready for implementation  
**Estimated Timeline**: 2-3 weeks for complete feature  
**Risk Level**: Medium (security implementation complexity)  
**Dependencies**: Current Supabase setup, React Native permissions