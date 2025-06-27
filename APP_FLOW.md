# SnapConnect App Flow Documentation

## Table of Contents
1. [User Journey Maps](#user-journey-maps)
2. [Screen Hierarchy](#screen-hierarchy)
3. [Navigation Patterns](#navigation-patterns)
4. [State Flow Diagrams](#state-flow-diagrams)
5. [RAG Integration Points](#rag-integration-points)
6. [Gesture Reference](#gesture-reference)
7. [Error States](#error-states)

## User Journey Maps

### 1. New User Onboarding Flow
```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│   Splash    │────▶│   Welcome    │────▶│   Sign Up     │────▶│   Verify     │
│   Screen    │     │   Screen     │     │  Email/Phone  │     │   Account    │
└─────────────┘     └──────────────┘     └───────────────┘     └──────────────┘
                                                                         │
                                                                         ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  Tutorial   │◀────│ Permissions  │◀────│Fitness Profile│◀────│   Username   │
│   Complete  │     │   Request    │     │     Setup     │     │   Selection  │
└─────────────┘     └──────────────┘     └───────────────┘     └──────────────┘
        │
        ▼
┌─────────────┐
│  Home Feed  │
│  (Camera)   │
└─────────────┘
```

#### Fitness Profile Setup Details:
1. **Fitness Level Selection**
   - Beginner: New to fitness
   - Intermediate: 6+ months experience
   - Advanced: 2+ years experience

2. **Goals Selection (Multi-select)**
   - Weight Loss
   - Muscle Gain
   - Endurance
   - Flexibility
   - General Wellness

3. **Preferences**
   - Dietary: Vegetarian, Vegan, Keto, Paleo, No restrictions
   - Workout Style: Home, Gym, Outdoor, Mixed
   - Frequency: 1-7 days per week

### 2. Content Creation Flow
```
Camera Button → Capture Options → Media Capture → AI Enhancement → Privacy Settings → Post
     │              │                  │               │                │
     │              │                  │               │                │
     ▼              ▼                  ▼               ▼                ▼
Always       • Photo (3s)        • Preview      • Caption AI     • Public
Accessible   • Video (60s)       • Retake       • Hashtag AI     • Friends Only
from tabs    • Progress Mode     • Effects      • Time suggest   • Private
```

### 3. Daily Active User Flow
```
App Open → Camera (if last used) → Swipe to Discover → Check Stories → 
Browse Events → Post Content → Check Messages → Update Progress
```

### 4. RAG-Enhanced Interaction Flow
```
User Input → Context Analysis → Vector Search → Knowledge Retrieval → 
GPT-4 Generation → Personalization → Output → User Feedback → Learning Update
```

## Screen Hierarchy

```
Root Navigator
├── Auth Stack (Not Logged In)
│   ├── SplashScreen
│   ├── WelcomeScreen
│   ├── LoginScreen
│   ├── SignUpScreen
│   ├── VerificationScreen
│   ├── ForgotPasswordScreen
│   └── OnboardingStack
│       ├── UsernameScreen
│       ├── FitnessLevelScreen
│       ├── GoalsScreen
│       ├── PreferencesScreen
│       └── PermissionsScreen
│
└── Main Tab Navigator (Logged In)
    ├── DiscoverTab
    │   ├── DiscoverFeed
    │   ├── ContentDetailModal
    │   ├── CreatorProfileModal
    │   └── SearchScreen
    │
    ├── CliqueTab
    │   ├── GroupsList
    │   ├── GroupChat
    │   ├── CreateGroup
    │   ├── GroupSettings
    │   └── MemberList
    │
    ├── CameraTab (FAB - Floating Action Button)
    │   ├── CameraScreen
    │   ├── MediaPreview
    │   ├── EffectsPanel
    │   ├── TimerSettings
    │   └── AIEnhancementModal
    │
    ├── EventsTab
    │   ├── EventsList
    │   ├── EventMapView
    │   ├── EventDetails
    │   ├── CreateEvent
    │   ├── MyEvents
    │   └── EventChat
    │
    └── ProfileTab
        ├── MyProfile
        ├── EditProfile
        ├── ProgressTimeline
        ├── Achievements
        ├── Settings
        │   ├── AccountSettings
        │   ├── PrivacySettings
        │   ├── NotificationSettings
        │   └── AIPreferences
        └── StatsScreen
```

## Navigation Patterns

### Bottom Tab Navigation
```typescript
// Tab configuration
const tabs = [
  { name: 'discover', icon: 'home', label: 'Discover' },
  { name: 'clique', icon: 'users', label: 'Clique' },
  { name: 'camera', icon: 'camera', label: null, isFAB: true },
  { name: 'events', icon: 'calendar', label: 'Events' },
  { name: 'profile', icon: 'user', label: 'Profile' },
];
```

### Stack Navigation Within Tabs
- Each tab maintains its own navigation stack
- Camera opens as modal overlay
- Deep linking supported for all screens

### Modal Presentations
- Story viewer (full screen)
- Camera capture (full screen)
- AI suggestions (bottom sheet)
- Image preview (full screen with gestures)

## State Flow Diagrams

### Authentication State Flow
```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Initial   │────▶│   Checking   │────▶│ Authenticated │
│   State     │     │    Auth      │     │     State     │
└─────────────┘     └──────────────┘     └───────────────┘
                            │                      │
                            ▼                      ▼
                    ┌──────────────┐     ┌───────────────┐
                    │     Not      │     │   Main App    │
                    │Authenticated │     │   Navigation  │
                    └──────────────┘     └───────────────┘
```

### Content Generation State Flow
```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│   Capture   │────▶│  Processing  │────▶│ AI Generation │────▶│   Preview    │
│   Media     │     │    Media     │     │   Running     │     │  & Editing   │
└─────────────┘     └──────────────┘     └───────────────┘     └──────────────┘
                                                                         │
                                                                         ▼
                                                                 ┌──────────────┐
                                                                 │   Posted     │
                                                                 │Successfully  │
                                                                 └──────────────┘
```

## RAG Integration Points

### 1. Caption Generation
```
Trigger: After photo/video capture
Input: Image + User Profile + Recent Posts
Process: 
  1. Analyze image content
  2. Extract user context
  3. Generate 3 caption options
  4. Rank by relevance
Output: Personalized captions with hashtags
```

### 2. Content Suggestions
```
Trigger: Opening camera or during idle time
Input: Time of day + User habits + Trending content
Process:
  1. Analyze optimal posting times
  2. Check trending topics in fitness
  3. Consider user's content gaps
  4. Generate creative ideas
Output: 5 content ideas with reasoning
```

### 3. Event Recommendations
```
Trigger: Opening events tab or based on location
Input: User location + Fitness level + Schedule + Friends
Process:
  1. Find nearby events
  2. Match to user fitness level
  3. Check friend attendance
  4. Score relevance
Output: Ranked event list with explanations
```

### 4. Challenge Creation
```
Trigger: Creating group challenge
Input: Group members + Fitness levels + Past challenges
Process:
  1. Analyze group capabilities
  2. Balance difficulty
  3. Create progressive goals
  4. Add motivational elements
Output: Custom challenge with milestones
```

### 5. Progress Analysis
```
Trigger: Viewing progress photos
Input: Photo timeline + Measurements + Goals
Process:
  1. Visual analysis of changes
  2. Trend identification
  3. Goal alignment check
  4. Generate insights
Output: Personalized progress report
```

## Gesture Reference

### Global Gestures
- **Swipe Down**: Refresh current screen
- **Swipe Up**: Load more content
- **Swipe Left/Right**: Navigate between tabs (except in camera)
- **Pinch**: Zoom in photos
- **Long Press**: Context menu

### Camera Gestures
- **Tap**: Take photo
- **Hold**: Record video
- **Swipe Up**: Open effects
- **Swipe Down**: Close camera
- **Double Tap**: Switch camera

### Story Gestures
- **Tap Right**: Next story
- **Tap Left**: Previous story
- **Swipe Up**: Reply to story
- **Swipe Down**: Exit stories
- **Hold**: Pause story

### Feed Gestures
- **Double Tap**: Like content
- **Swipe Left on Card**: Save for later
- **Swipe Right on Card**: Share
- **3D Touch/Long Press**: Preview

## Error States

### Network Errors
```
Offline Mode:
- Cache recent content
- Queue posts for later
- Show offline indicator
- Disable real-time features
```

### AI Generation Errors
```
Fallback Strategy:
1. Try regeneration (1 retry)
2. Use cached suggestions
3. Provide generic templates
4. Allow manual input
```

### Media Upload Errors
```
Recovery Options:
- Retry upload
- Save to drafts
- Reduce quality
- Try alternative storage
```

## Screen-Specific Flows

### Discover Feed
```
Load → Show Skeleton → Fetch Content → Render Cards → 
Listen for Updates → Infinite Scroll → Pull to Refresh
```

### Camera Capture
```
Open Camera → Check Permissions → Show Viewfinder → 
Capture → Process → AI Enhance → Preview → Edit → Post
```

### Events Page
```
Load Events → Apply Filters → Show Map/List → 
Select Event → View Details → RSVP → Add to Calendar
```

### Profile Screen
```
Load Profile → Fetch Stats → Show Timeline → 
Calculate Progress → Display Achievements → Settings Access
```

## Deep Linking Structure

```
snapconnect://
├── profile/{username}
├── event/{eventId}
├── group/{groupId}
├── challenge/{challengeId}
├── post/{postId}
└── camera?mode={photo|video|progress}
```

## Push Notification Flows

### Notification Types
1. **Message Received**: Opens chat
2. **Event Reminder**: Opens event details
3. **Challenge Update**: Opens challenge screen
4. **Friend Request**: Opens profile
5. **AI Suggestion**: Opens relevant screen

### Permission Request Flow
```
Day 1: Skip
Day 3: First request after value shown
Day 7: Second request with benefits
Day 14: Final request with incentive
```

## Analytics Events

### Key Events to Track
```typescript
// User engagement
track('screen_view', { screen_name: string })
track('content_created', { type: 'photo' | 'video', ai_used: boolean })
track('ai_suggestion_used', { type: string, accepted: boolean })

// Social interactions
track('friend_added', { source: string })
track('group_joined', { group_id: string })
track('event_rsvp', { event_id: string })

// Feature usage
track('camera_effect_used', { effect: string })
track('progress_photo_taken', { comparison: boolean })
track('challenge_completed', { challenge_id: string })
```

---

This document serves as the comprehensive guide for understanding user flows, navigation patterns, and interaction points within SnapConnect. All development should reference these flows to ensure consistency and optimal user experience.