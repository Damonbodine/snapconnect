# Bulletproof Agora Live Streaming Integration Plan for SnapConnect

## Architecture Overview

**App Structure Integration:**
- **Stories Tab**: Existing ephemeral content (no changes)
- **Clique Tab**: NEW - Live streaming hub powered by Agora
- **Events Tab**: Extended to support scheduled live streams
- **Existing Infrastructure**: Leverages Supabase auth, Zustand stores, camera system

## Phase 1: Technical Foundation & Dependencies

### 1.1 Agora SDK Integration
```bash
npm install react-native-agora
cd ios && pod install  # Required for iOS
```

**Key Challenge**: Your app uses Expo SDK 51. Agora requires native modules that aren't supported in Expo managed workflow.
**Solution**: You're already using `expo run:ios` and `expo run:android`, so you have the required development build setup.

### 1.2 Authentication Token Server
**Create Supabase Edge Function for Agora Token Generation:**
- Generate Agora tokens server-side using your APP_ID and APP_CERTIFICATE
- Integrate with existing Supabase auth to ensure only authenticated users get tokens
- Implement token refresh logic for long streams

```typescript
// New service: src/services/agoraTokenService.ts
interface AgoraTokenRequest {
  channelId: string;
  uid: number;
  role: 'host' | 'audience';
}
```

## Phase 2: Database Schema Extensions

### 2.1 Live Streams Table
```sql
CREATE TABLE live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid REFERENCES users(id) NOT NULL,
  channel_id text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  is_active boolean DEFAULT false,
  viewer_count integer DEFAULT 0,
  max_viewers integer DEFAULT 1000,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Link to events if scheduled
  event_id uuid REFERENCES events(id),
  
  -- Agora-specific
  agora_channel_name text NOT NULL,
  agora_app_id text NOT NULL
);
```

### 2.2 Stream Participants Table
```sql
CREATE TABLE stream_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) NOT NULL,
  role text CHECK (role IN ('host', 'co_host', 'viewer')) DEFAULT 'viewer',
  agora_uid integer NOT NULL,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  is_active boolean DEFAULT true,
  
  UNIQUE(stream_id, user_id)
);
```

### 2.3 Events Table Extension
```sql
-- Add to existing events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_type text CHECK (location_type IN ('physical', 'virtual')) DEFAULT 'physical';
ALTER TABLE events ADD COLUMN IF NOT EXISTS stream_id uuid REFERENCES live_streams(id);
```

## Phase 3: Agora Service Layer

### 3.1 Core Live Streaming Service
```typescript
// src/services/liveStreamService.ts
export class LiveStreamService {
  private agoraEngine: RtcEngine | null = null;
  
  async initializeEngine(appId: string): Promise<void>
  async joinAsHost(channelId: string, token: string, uid: number): Promise<void>
  async joinAsViewer(channelId: string, token: string, uid: number): Promise<void>
  async switchToCoHost(uid: number): Promise<void>
  async leaveChannel(): Promise<void>
  async enableVideo(): Promise<void>
  async enableAudio(): Promise<void>
}
```

### 3.2 Integration with Existing Camera System
**Leverage your existing `react-native-vision-camera` as video source:**
- Use your current camera interface for stream preview
- Integrate AR filters with live streaming
- Maintain existing camera permissions and error handling

## Phase 4: State Management (Zustand Integration)

### 4.1 Live Stream Store
```typescript
// src/stores/liveStreamStore.ts - Following your messagesStore pattern
interface LiveStreamState {
  // Active streams
  liveStreams: LiveStream[];
  currentStream: LiveStream | null;
  isStreaming: boolean;
  isViewingStream: boolean;
  
  // Participants
  streamParticipants: StreamParticipant[];
  myRole: 'host' | 'co_host' | 'viewer' | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Agora state
  agoraEngine: RtcEngine | null;
  localVideoEnabled: boolean;
  localAudioEnabled: boolean;
  
  // Real-time subscriptions (following your pattern)
  streamSubscription: RealtimeChannel | null;
}
```

### 4.2 Real-time Subscriptions (Following Your Message Pattern)
```typescript
// Following src/stores/messagesStore.ts:290-346 pattern
setupStreamSubscriptions: (userId: string) => {
  const streamSubscription = supabase
    .channel('live_streams')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'live_streams' },
      (payload) => handleStreamUpdate(payload)
    )
    .subscribe();
    
  set({ streamSubscription });
}
```

## Phase 5: UI Integration

### 5.1 New Clique Tab
```typescript
// app/(tabs)/clique.tsx - Following your events.tsx pattern
export default function CliqueTab() {
  return <CliqueScreen />;
}

// src/screens/CliqueScreen.tsx - Following EventsScreen pattern
interface CliqueScreenProps {
  // Similar to EventsScreen with live streams instead of events
}
```

### 5.2 Live Stream Components
```typescript
// Following your component patterns:
// src/components/streaming/
├── LiveStreamCard.tsx        // Like your event cards with "LIVE" indicator
├── StreamInterface.tsx       // Full-screen streaming view
├── ViewerInterface.tsx       // Viewer experience
├── StreamControls.tsx        // Host controls
├── CoHostRequestModal.tsx    // Permission modals
└── StreamParticipants.tsx    // Participant management
```

### 5.3 Integration with Camera Interface
**Extend your existing `CameraInterface.tsx`:**
- Add "Go Live" button when user is in camera mode
- Integrate with existing AR filter system during live streams
- Maintain existing photo/video capture alongside streaming

## Phase 6: Events Integration

### 6.1 Extend Event Creation Modal
```typescript
// Modify src/components/events/CreateEventModal.tsx
// Add location type selection:
const [locationType, setLocationType] = useState<'physical' | 'virtual'>('physical');

// When virtual selected, create scheduled live stream
if (locationType === 'virtual') {
  // Create both event and live_stream record
  // Link them via event.stream_id
}
```

### 6.2 Event Card Updates
**Modify existing event cards to show live status:**
- Red "LIVE" indicator when stream is active
- Viewer count display
- "Join Stream" button instead of RSVP for active streams

## Phase 7: Authentication & Security

### 7.1 Agora Token Management
```typescript
// src/services/agoraTokenService.ts
export const generateAgoraToken = async (
  channelId: string,
  role: 'host' | 'audience'
): Promise<string> => {
  // Call Supabase Edge Function
  // Function validates user auth and generates Agora token
  // Returns token for channel joining
};
```

### 7.2 Supabase Edge Function
```javascript
// supabase/functions/generate-agora-token/index.ts
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

export default async (req: Request) => {
  // Validate user session
  // Generate Agora token with APP_ID and APP_CERTIFICATE
  // Return token with expiration
};
```

## Phase 8: Integration Workflow

### 8.1 Instant Streaming (Clique)
1. User opens Clique tab
2. Sees live streams from other users
3. Taps "Go Live" → creates new stream + joins as host
4. Other users see stream appear in real-time
5. Viewers can request co-host permission

### 8.2 Scheduled Streaming (Events)
1. User creates event → selects "Virtual/Live Stream"
2. Creates both event record and linked stream record
3. When host starts stream → appears in both Events and Clique
4. RSVP'd users get real-time notification

### 8.3 Viewing Experience
1. User sees live stream in either tab
2. Taps to join → requests Agora token
3. Joins as viewer → sees host video
4. Can request co-host permission
5. Real-time chat integration (optional)

## Phase 9: Cost Management & Optimization

### 9.1 Pricing Structure (Based on Research)
- **Free tier**: 10,000 minutes/month across all users
- **Host cost**: ~$3.99/1,000 minutes
- **Viewer cost**: ~$1.99/1,000 minutes
- **Auto volume discounts**: 5-7% for high usage

### 9.2 Cost Optimization Strategies
- Stream quality limits (720p default)
- Auto-disconnect inactive viewers
- Stream duration limits for free users
- Premium features for paid tiers

## Phase 10: Testing & Deployment Strategy

### 10.1 Development Testing
1. **Token server testing** with Supabase local development
2. **Agora integration testing** with development certificates
3. **Real-time subscription testing** following your message patterns
4. **Multi-device testing** for host/viewer scenarios

### 10.2 Production Deployment
1. **Agora production credentials** setup
2. **Supabase Edge Function** deployment
3. **Database migrations** for new tables
4. **Real-time policy** configuration for stream updates
5. **App store review** considerations for live streaming

## Implementation Timeline

### Week 1-2: Foundation
- Agora SDK integration and basic setup
- Database schema creation and migrations
- Token server (Supabase Edge Function) development

### Week 3-4: Core Services
- Live streaming service implementation
- State management store creation
- Real-time subscription setup

### Week 5-6: UI Development
- Clique screen and live stream components
- Integration with existing camera system
- Events system extensions

### Week 7-8: Testing & Polish
- Multi-device testing
- Performance optimization
- Error handling and edge cases
- Production deployment preparation

**Total: 8 weeks for production-ready implementation**

## Success Metrics
- Stream start success rate > 95%
- Average stream duration
- Viewer engagement rates
- Co-host feature adoption
- Integration with existing events system

## Key Technical Considerations

### Existing Codebase Integration Points
1. **Authentication**: Leverage existing `useAuthStore` and Supabase session management
2. **Real-time**: Follow patterns from `messagesStore.ts` for live updates
3. **Camera System**: Integrate with existing `CameraInterface.tsx` and filter system
4. **Navigation**: Use existing Expo Router structure for new Clique tab
5. **UI Components**: Follow established gradient card patterns and design system

### Performance Optimizations
1. **Video Quality**: Default to 720p, allow quality selection
2. **Battery Management**: Implement background/foreground handling
3. **Network Resilience**: Auto-reconnection and quality adaptation
4. **Memory Management**: Proper cleanup of Agora resources

### Security Considerations
1. **Token Expiration**: Implement token refresh before expiry
2. **User Permissions**: Validate stream creation and participation rights
3. **Content Moderation**: Consider reporting and blocking features
4. **Privacy Controls**: Stream visibility settings

This plan leverages your existing architecture patterns while adding robust live streaming capabilities that scale with your user base.