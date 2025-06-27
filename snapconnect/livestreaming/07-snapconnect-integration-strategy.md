# SnapConnect Integration Strategy

## Document Purpose
- **Integration Focus**: How to seamlessly integrate Agora live streaming into existing SnapConnect architecture
- **Codebase Analysis**: Leveraging existing patterns, services, and components
- **Implementation Strategy**: Step-by-step integration approach

## Existing SnapConnect Architecture Analysis

### 1. Current Technology Stack
```typescript
// SnapConnect's existing foundation
const snapConnectStack = {
  framework: 'React Native 0.79.4 + Expo SDK 51',
  stateManagement: 'Zustand 5.0.5',
  backend: 'Supabase (Auth, Database, Storage, Realtime)',
  navigation: 'Expo Router v3',
  styling: 'NativeWind + Gradient-based design',
  camera: 'react-native-vision-camera 4.7.0',
  videoPlayback: 'expo-video 2.2.2',
  aiIntegration: 'OpenAI GPT-4 API',
  realTime: 'Supabase Realtime WebSocket',
};
```

### 2. Existing Component Patterns
```typescript
// SnapConnect's established patterns for live streaming integration
interface SnapConnectPatterns {
  // Store management pattern (from messagesStore.ts)
  storePattern: {
    state: 'Comprehensive state with UI flags, error handling, caching';
    actions: 'Async operations with optimistic updates';
    realTime: 'Supabase channel subscriptions';
    persistence: 'Selective persistence with AsyncStorage';
  };
  
  // Service layer pattern (from eventService.ts, messageService.ts)
  servicePattern: {
    structure: 'Class-based services with error handling';
    validation: 'Input validation and sanitization';
    caching: 'Smart caching with TTL';
    errorHandling: 'Comprehensive error mapping';
  };
  
  // Component pattern (from EventsScreen.tsx, CameraInterface.tsx)
  componentPattern: {
    structure: 'Functional components with hooks';
    styling: 'Gradient-based design with NativeWind';
    stateManagement: 'Zustand store integration';
    errorBoundaries: 'Graceful error handling';
  };
}
```

### 3. Database Schema Integration Points
```sql
-- Extend existing SnapConnect tables for live streaming
-- Based on existing schema in supabase.ts

-- Extend events table (already exists)
ALTER TABLE events ADD COLUMN location_type text CHECK (location_type IN ('physical', 'virtual')) DEFAULT 'physical';
ALTER TABLE events ADD COLUMN stream_id uuid REFERENCES live_streams(id);
ALTER TABLE events ADD COLUMN is_live boolean DEFAULT false;

-- New live_streams table (integrates with events)
CREATE TABLE live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Link to existing users table
  host_id uuid REFERENCES users(id) NOT NULL,
  
  -- Stream metadata
  title text NOT NULL,
  description text,
  channel_id text UNIQUE NOT NULL,
  
  -- Status tracking
  is_active boolean DEFAULT false,
  viewer_count integer DEFAULT 0,
  started_at timestamptz,
  ended_at timestamptz,
  
  -- Integration with events
  event_id uuid REFERENCES events(id),
  
  -- Agora-specific fields
  agora_channel_name text NOT NULL,
  agora_app_id text NOT NULL,
  
  -- SnapConnect standard fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Stream participants (following SnapConnect patterns)
CREATE TABLE stream_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) NOT NULL,
  
  -- Role management
  role text CHECK (role IN ('host', 'co_host', 'viewer')) DEFAULT 'viewer',
  agora_uid integer NOT NULL,
  
  -- Timing
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  is_active boolean DEFAULT true,
  
  UNIQUE(stream_id, user_id)
);

-- Row Level Security (following SnapConnect patterns)
ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_participants ENABLE ROW LEVEL SECURITY;

-- Policies for live_streams
CREATE POLICY "Users can view public streams" ON live_streams
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own streams" ON live_streams
  FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their streams" ON live_streams
  FOR UPDATE USING (auth.uid() = host_id);
```

## Integration with Existing Services

### 1. Authentication Integration
```typescript
// src/services/agoraAuthService.ts
// Integrate with existing authStore and Supabase auth
import { useAuthStore } from '../stores/authStore';
import { supabase } from './supabase';

export class AgoraAuthService {
  
  // Generate token using existing Supabase auth
  async generateToken(params: {
    channelId: string;
    role: 'host' | 'audience';
  }): Promise<string> {
    // Use existing SnapConnect auth pattern
    const { user, session } = useAuthStore.getState();
    
    if (!user || !session) {
      throw new Error('User must be authenticated with SnapConnect');
    }
    
    // Call Supabase Edge Function (following existing pattern)
    const { data, error } = await supabase.functions.invoke('generate-agora-token', {
      body: {
        channelName: params.channelId,
        uid: this.generateUID(user.id),
        role: params.role,
        userId: user.id, // Include for validation
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    
    if (error) {
      console.error('❌ Token generation failed:', error);
      throw new Error('Failed to generate streaming token');
    }
    
    return data.token;
  }
  
  // UID generation consistent with SnapConnect user IDs
  private generateUID(userId: string): number {
    // Use same pattern as existing SnapConnect ID handling
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) || 1;
  }
}
```

### 2. Real-time Integration
```typescript
// src/stores/liveStreamStore.ts
// Follow messagesStore.ts pattern exactly
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

interface LiveStreamState {
  // Stream data (following messagesStore pattern)
  liveStreams: LiveStream[];
  currentStream: LiveStream | null;
  streamParticipants: StreamParticipant[];
  
  // UI state (same pattern as messagesStore)
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  hasError: boolean;
  
  // Real-time subscriptions (identical to messagesStore pattern)
  streamSubscription: RealtimeChannel | null;
  participantSubscription: RealtimeChannel | null;
  
  // Agora-specific state
  agoraEngine: RtcEngine | null;
  myRole: 'host' | 'co_host' | 'viewer' | null;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
}

interface LiveStreamActions {
  // Core streaming operations (following messagesStore naming)
  startStream: (params: StartStreamParams) => Promise<void>;
  joinStream: (streamId: string) => Promise<void>;
  leaveStream: () => Promise<void>;
  
  // Real-time operations (identical to messagesStore pattern)
  setupRealTimeSubscriptions: (userId: string) => void;
  teardownRealTimeSubscriptions: () => void;
  
  // State management (same as messagesStore)
  setError: (error: string) => void;
  clearError: () => void;
  resetStore: () => void;
}

export const useLiveStreamStore = create<LiveStreamState & LiveStreamActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state (following messagesStore structure)
        liveStreams: [],
        currentStream: null,
        streamParticipants: [],
        isLoading: false,
        isStreaming: false,
        error: null,
        hasError: false,
        streamSubscription: null,
        participantSubscription: null,
        agoraEngine: null,
        myRole: null,
        connectionState: 'disconnected',
        
        // Real-time subscriptions (adapted from messagesStore:290-346)
        setupRealTimeSubscriptions: (userId: string) => {
          console.log('🔔 Setting up live stream subscriptions for user:', userId);
          
          // Cleanup existing subscriptions
          get().teardownRealTimeSubscriptions();
          
          // Subscribe to stream updates
          const streamSubscription = supabase
            .channel('live_streams')
            .on('postgres_changes', 
              { event: '*', schema: 'public', table: 'live_streams' },
              (payload) => {
                console.log('📺 Stream update received:', payload);
                get().handleStreamUpdate(payload);
              }
            )
            .subscribe();
            
          // Subscribe to participant updates
          const participantSubscription = supabase
            .channel('stream_participants')
            .on('postgres_changes',
              { event: '*', schema: 'public', table: 'stream_participants' },
              (payload) => {
                console.log('👥 Participant update received:', payload);
                get().handleParticipantUpdate(payload);
              }
            )
            .subscribe();
            
          set({ streamSubscription, participantSubscription });
        },
        
        // Teardown subscriptions (identical to messagesStore pattern)
        teardownRealTimeSubscriptions: () => {
          const { streamSubscription, participantSubscription } = get();
          
          if (streamSubscription) {
            streamSubscription.unsubscribe();
          }
          
          if (participantSubscription) {
            participantSubscription.unsubscribe();
          }
          
          set({
            streamSubscription: null,
            participantSubscription: null,
          });
        },
        
        // Error handling (same as messagesStore)
        setError: (error: string) => {
          set({ error, hasError: true });
        },
        
        clearError: () => {
          set({ error: null, hasError: false });
        },
        
        resetStore: () => {
          get().teardownRealTimeSubscriptions();
          set({
            liveStreams: [],
            currentStream: null,
            streamParticipants: [],
            isLoading: false,
            isStreaming: false,
            error: null,
            hasError: false,
            myRole: null,
            connectionState: 'disconnected',
          });
        },
      }),
      {
        // Persistence pattern (following messagesStore)
        name: 'live-stream-storage',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          // Only persist essential data
          liveStreams: state.liveStreams,
          connectionState: state.connectionState,
        }),
      }
    ),
    {
      name: 'live-stream-store',
    }
  )
);
```

### 3. Events System Integration
```typescript
// src/services/eventStreamService.ts
// Integrate with existing eventService.ts
import { eventService } from './eventService';
import { Event } from '../types/events';

export class EventStreamService {
  
  // Create live stream event (extends existing event creation)
  async createLiveStreamEvent(params: {
    title: string;
    description?: string;
    startTime: Date;
    maxParticipants?: number;
    fitnessLevel: string[];
    category: string;
  }): Promise<{ event: Event; stream: LiveStream }> {
    
    try {
      // Create event using existing eventService pattern
      const event = await eventService.createEvent({
        ...params,
        locationType: 'virtual', // New field
        locationName: 'Live Stream',
        locationCoordinates: null, // Virtual events don't need coordinates
      });
      
      // Create associated live stream
      const stream = await this.createStreamRecord({
        eventId: event.id,
        hostId: event.creator_id,
        title: params.title,
        description: params.description,
      });
      
      // Link stream to event
      await eventService.updateEvent(event.id, {
        streamId: stream.id,
      });
      
      return { event, stream };
      
    } catch (error) {
      console.error('❌ Failed to create live stream event:', error);
      throw error;
    }
  }
  
  // Start scheduled stream (integrates with existing event flow)
  async startScheduledStream(eventId: string): Promise<void> {
    const event = await eventService.getEvent(eventId);
    
    if (!event.streamId) {
      throw new Error('Event is not configured for live streaming');
    }
    
    // Update stream status
    await this.activateStream(event.streamId);
    
    // Update event status
    await eventService.updateEvent(eventId, {
      isLive: true,
    });
    
    // Notify RSVP'd users (using existing notification patterns)
    await this.notifyEventParticipants(eventId, 'stream_started');
  }
}
```

### 4. Camera System Integration
```typescript
// src/services/cameraStreamingService.ts
// Integrate with existing camera system
import { Camera } from 'react-native-vision-camera';
import { agoraEngine } from './agoraEngineService';

export class CameraStreamingService {
  
  // Use existing SnapConnect camera for streaming
  async initializeStreamingCamera(camera: React.RefObject<Camera>): Promise<void> {
    try {
      // Use existing camera configuration from CameraInterface.tsx
      const device = camera.current?.getCameraDevice();
      
      if (!device) {
        throw new Error('Camera not available');
      }
      
      // Configure for streaming (maintain existing quality)
      await camera.current?.configure({
        device,
        isActive: true,
        video: {
          pixelFormat: 'yuv',
          hdr: false,
          fps: 24, // Match Agora configuration
        },
        audio: {
          enabled: true,
          sampleRate: 48000,
        },
      });
      
      // Set Agora custom video source
      await agoraEngine.setVideoSource('custom');
      
      console.log('✅ Camera configured for streaming');
      
    } catch (error) {
      console.error('❌ Camera streaming setup failed:', error);
      throw error;
    }
  }
  
  // Integrate AR filters with streaming
  async applyFilterToStream(filter: FilterAsset): Promise<void> {
    // Use existing filter system from InteractiveFilterOverlay.tsx
    const { activeFilter } = useARFilterStore.getState();
    
    if (activeFilter && activeFilter.id !== 'none') {
      // Apply filter using existing nativeFilterCompositor
      // This requires extending the existing filter system to support real-time processing
      console.log('🎨 Applying filter to live stream:', filter);
    }
  }
}
```

## UI Integration Strategy

### 1. Clique Tab Integration
```typescript
// app/(tabs)/clique.tsx
// Follow existing tab pattern from events.tsx
import { CliqueScreen } from '../src/screens/CliqueScreen';

export default function CliqueTab() {
  return <CliqueScreen />;
}

// src/screens/CliqueScreen.tsx
// Follow EventsScreen.tsx pattern exactly
export const CliqueScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { 
    liveStreams, 
    isLoading, 
    error,
    setupRealTimeSubscriptions,
  } = useLiveStreamStore();
  
  // Follow EventsScreen.tsx initialization pattern
  useEffect(() => {
    if (user) {
      setupRealTimeSubscriptions(user.id);
    }
  }, [user]);
  
  // Use existing gradient background pattern
  return (
    <LinearGradient 
      colors={['#000000', '#1a1a1a']} 
      style={styles.container}
    >
      {/* Follow EventsScreen header pattern */}
      <SafeAreaView style={styles.safeArea}>
        <SnapConnectHeader title="Clique" />
        
        {/* Live streams list (follow EventsScreen card pattern) */}
        <FlatList
          data={liveStreams}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LiveStreamCard stream={item} />
          )}
          style={styles.streamsList}
        />
        
        {/* Floating action button (follow EventsScreen pattern) */}
        <TouchableOpacity 
          style={styles.goLiveButton}
          onPress={handleGoLive}
        >
          <Text style={styles.goLiveText}>Go Live</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
};
```

### 2. Events Integration
```typescript
// src/components/events/CreateEventModal.tsx
// Extend existing modal to support live streaming
export const CreateEventModal: React.FC<CreateEventModalProps> = ({ 
  isVisible, 
  onClose 
}) => {
  // Add location type selection to existing form
  const [locationType, setLocationType] = useState<'physical' | 'virtual'>('physical');
  
  // Follow existing form structure
  return (
    <Modal visible={isVisible} animationType="slide">
      <LinearGradient colors={gradients.primary} style={styles.container}>
        
        {/* Existing form fields... */}
        
        {/* New location type selection */}
        <View style={styles.locationTypeSection}>
          <Text style={styles.sectionTitle}>Event Type</Text>
          
          <View style={styles.locationTypeButtons}>
            <TouchableOpacity 
              style={[
                styles.locationTypeButton,
                locationType === 'physical' && styles.selectedButton
              ]}
              onPress={() => setLocationType('physical')}
            >
              <Text style={styles.locationTypeText}>📍 Physical Location</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.locationTypeButton,
                locationType === 'virtual' && styles.selectedButton
              ]}
              onPress={() => setLocationType('virtual')}
            >
              <Text style={styles.locationTypeText}>📺 Live Stream</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Conditional location picker (existing component) */}
        {locationType === 'physical' && (
          <LocationPicker
            selectedLocation={selectedLocation}
            onLocationSelect={setSelectedLocation}
          />
        )}
        
        {/* Virtual event note */}
        {locationType === 'virtual' && (
          <View style={styles.virtualEventNote}>
            <Text style={styles.noteText}>
              This will create a scheduled live stream that participants can join online.
            </Text>
          </View>
        )}
        
        {/* Rest of existing form... */}
        
      </LinearGradient>
    </Modal>
  );
};
```

### 3. Component Reuse Strategy
```typescript
// Reuse existing SnapConnect components for streaming
interface StreamingComponentReuse {
  // From existing components
  gradientCards: 'EventCard.tsx → LiveStreamCard.tsx';
  modals: 'CreateEventModal.tsx → CreateStreamModal.tsx';
  userProfiles: 'UserProfile.tsx → StreamParticipant.tsx';
  buttons: 'RSVPButton.tsx → JoinStreamButton.tsx';
  
  // From camera system
  cameraInterface: 'CameraInterface.tsx → StreamingInterface.tsx';
  arFilters: 'ARFilterOverlay.tsx → StreamingFilterOverlay.tsx';
  controls: 'CameraControls.tsx → StreamingControls.tsx';
  
  // From messaging system
  realTimeUpdates: 'MessagesStore.tsx → LiveStreamStore.tsx';
  notifications: 'MessageNotifications.tsx → StreamNotifications.tsx';
}
```

## Integration Timeline

### Week 1: Foundation
```typescript
const week1Tasks = [
  // Database integration
  'Extend Supabase schema for live streaming',
  'Create RLS policies following SnapConnect patterns',
  'Set up Edge Function for token generation',
  
  // Service layer
  'Create AgoraAuthService integrating with authStore',
  'Create LiveStreamStore following messagesStore pattern',
  'Set up real-time subscriptions',
  
  // Basic testing
  'Test authentication flow',
  'Test real-time updates',
  'Validate database operations',
];
```

### Week 2: Core Services
```typescript
const week2Tasks = [
  // Agora integration
  'Initialize Agora engine service',
  'Implement channel management',
  'Set up event handling',
  
  // Camera integration
  'Integrate with existing camera system',
  'Test video streaming',
  'Validate audio/video quality',
  
  // Error handling
  'Implement comprehensive error handling',
  'Add logging and debugging',
  'Test edge cases',
];
```

### Week 3-4: UI Integration
```typescript
const week3_4Tasks = [
  // Clique tab
  'Create CliqueScreen following EventsScreen pattern',
  'Implement LiveStreamCard following EventCard pattern',
  'Add real-time stream updates',
  
  // Events integration
  'Extend CreateEventModal for live streaming',
  'Update EventCard to show live status',
  'Implement stream scheduling',
  
  // Streaming interface
  'Create StreamingInterface using camera patterns',
  'Integrate AR filters with streaming',
  'Add streaming controls',
];
```

## Testing Strategy

### 1. Unit Testing
```typescript
// Follow existing testing patterns
describe('LiveStreamStore', () => {
  it('should follow messagesStore patterns', () => {
    // Test real-time subscriptions
    // Test state management
    // Test error handling
  });
});

describe('AgoraAuthService', () => {
  it('should integrate with existing auth', () => {
    // Test token generation
    // Test authentication flow
    // Test error scenarios
  });
});
```

### 2. Integration Testing
```typescript
// Test with existing SnapConnect systems
describe('Events-Streaming Integration', () => {
  it('should create live stream events', () => {
    // Test event creation with streaming
    // Test RSVP flow
    // Test notifications
  });
});

describe('Camera-Streaming Integration', () => {
  it('should use existing camera for streaming', () => {
    // Test camera initialization
    // Test video quality
    // Test AR filter integration
  });
});
```

This integration strategy ensures that live streaming capabilities are seamlessly added to SnapConnect while maintaining the existing architecture patterns, user experience, and code quality standards.