# iOS Live Streaming Implementation Guide

## Document Source
- **URL**: https://www.agora.io/en/blog/how-to-build-a-live-video-streaming-ios-app-with-agora/
- **Focus**: Technical implementation patterns for live streaming (adapted for React Native)

## Core Architecture Understanding

The iOS implementation provides key insights for React Native architecture:

### 1. Role-Based Broadcasting System
```typescript
// Equivalent React Native implementation
enum ClientRole {
  BROADCASTER = 1, // Host role - can send audio/video
  AUDIENCE = 2     // Viewer role - receive only
}

// src/services/agoraStreamingService.ts
export class AgoraStreamingService {
  private agoraEngine: RtcEngine;
  
  async setUserRole(role: ClientRole): Promise<void> {
    await this.agoraEngine.setClientRole(role);
    
    // SnapConnect integration - update user state
    const streamStore = useLiveStreamStore.getState();
    streamStore.setMyRole(role === ClientRole.BROADCASTER ? 'host' : 'viewer');
  }
  
  // Dynamic role switching for co-host feature
  async promoteToCoHost(userId: string): Promise<void> {
    // Switch from audience to broadcaster
    await this.setUserRole(ClientRole.BROADCASTER);
    
    // Enable video for new co-host
    await this.enableLocalVideo();
    
    // Update SnapConnect database
    await this.updateParticipantRole(userId, 'co_host');
  }
}
```

### 2. Channel Management
```typescript
// Channel lifecycle management for SnapConnect
export class ChannelManager {
  
  // Create channel for SnapConnect event
  async createEventChannel(eventId: string, hostId: string): Promise<string> {
    const channelId = `snapconnect-event-${eventId}`;
    
    // Initialize engine with SnapConnect configuration
    await this.agoraEngine.initialize({
      appId: process.env.AGORA_APP_ID,
      // SnapConnect-specific configuration
      channelProfile: ChannelProfile.LiveBroadcasting,
      videoEncoderConfiguration: {
        // Optimized for fitness content
        dimensions: { width: 720, height: 1280 }, // Portrait orientation
        frameRate: 30,
        bitrate: 1000, // Balanced for mobile networks
      }
    });
    
    return channelId;
  }
  
  // Join channel with SnapConnect authentication
  async joinChannel(channelId: string, role: ClientRole): Promise<void> {
    // Get token from SnapConnect auth service
    const token = await agoraTokenService.generateToken(channelId, role);
    
    // Generate unique UID from SnapConnect user ID
    const { user } = useAuthStore.getState();
    const uid = this.generateUID(user.id);
    
    await this.agoraEngine.joinChannel(token, channelId, null, uid);
    
    // Set up SnapConnect-specific event handlers
    this.setupSnapConnectEventHandlers();
  }
}
```

## Key Implementation Patterns

### 1. Event Handler System
```typescript
// React Native adaptation of iOS delegate methods
export class AgoraEventHandler {
  
  setupEventHandlers() {
    const engine = this.agoraEngine;
    
    // User joined - iOS: didJoinedOfUid
    engine.addListener('UserJoined', (uid: number, elapsed: number) => {
      console.log(`User ${uid} joined the channel`);
      
      // SnapConnect integration - update participant list
      const streamStore = useLiveStreamStore.getState();
      streamStore.addParticipant({
        agoraUid: uid,
        joinedAt: new Date().toISOString(),
        role: 'viewer' // Default role
      });
      
      // Update real-time participant count
      this.updateViewerCount();
    });
    
    // User left - iOS: didOfflineOfUid
    engine.addListener('UserOffline', (uid: number, reason: number) => {
      console.log(`User ${uid} left the channel`);
      
      // Remove from SnapConnect participant list
      const streamStore = useLiveStreamStore.getState();
      streamStore.removeParticipant(uid);
      
      // Update viewer count
      this.updateViewerCount();
    });
    
    // Role changed - iOS: didClientRoleChanged
    engine.addListener('ClientRoleChanged', (oldRole: number, newRole: number) => {
      // Handle co-host promotions in SnapConnect
      if (newRole === ClientRole.BROADCASTER) {
        this.handleCoHostPromotion();
      }
    });
    
    // Network quality - important for SnapConnect mobile users
    engine.addListener('NetworkQuality', (uid: number, txQuality: number, rxQuality: number) => {
      // Show network quality indicator in SnapConnect UI
      this.updateNetworkQuality(uid, txQuality, rxQuality);
    });
  }
  
  private updateViewerCount() {
    const participants = useLiveStreamStore.getState().streamParticipants;
    const viewerCount = participants.filter(p => p.role === 'viewer').length;
    
    // Update SnapConnect database in real-time
    this.syncViewerCountToSupabase(viewerCount);
  }
}
```

### 2. Video Rendering System
```typescript
// React Native video rendering adapted from iOS implementation
import { RtcSurfaceView, RtcTextureView } from 'react-native-agora';

export const SnapConnectVideoRenderer = ({ participants, localUser }) => {
  const [videoViewMode, setVideoViewMode] = useState('fit'); // SnapConnect default
  
  return (
    <View style={styles.videoContainer}>
      {/* Host/Local video with SnapConnect styling */}
      <View style={styles.hostVideoWrapper}>
        <RtcSurfaceView
          style={styles.hostVideo}
          uid={localUser.uid}
          channelId={channelId}
          renderMode={VideoRenderMode.Fit} // Maintain aspect ratio
        />
        
        {/* SnapConnect AR filter overlay */}
        <ARFilterOverlay 
          isVisible={localUser.role === 'host'}
          activeFilter={activeFilter}
        />
        
        {/* SnapConnect host info overlay */}
        <View style={styles.hostInfoOverlay}>
          <Text style={styles.hostName}>{localUser.username}</Text>
          <FitnessLevelBadge level={localUser.fitnessLevel} />
          <LiveIndicator isLive={true} />
        </View>
      </View>
      
      {/* Remote participants grid */}
      <View style={styles.participantGrid}>
        {participants.map((participant, index) => (
          <View key={participant.uid} style={styles.participantVideo}>
            <RtcSurfaceView
              style={styles.remoteVideo}
              uid={participant.uid}
              channelId={channelId}
              renderMode={VideoRenderMode.Fit}
            />
            
            {/* SnapConnect participant info */}
            <View style={styles.participantInfo}>
              <Text style={styles.participantName}>{participant.username}</Text>
              {participant.role === 'co_host' && (
                <CoHostBadge />
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};
```

### 3. Camera Integration with SnapConnect
```typescript
// Integrate with existing SnapConnect camera system
export class SnapConnectCameraIntegration {
  
  async initializeCameraForStreaming(): Promise<void> {
    // Use existing react-native-vision-camera setup
    const camera = useRef<Camera>(null);
    
    // Configure for streaming
    const streamingConfig = {
      video: true,
      audio: true,
      // Use existing SnapConnect camera permissions
      preset: 'high', // Match existing quality settings
    };
    
    // Enable custom video source for Agora
    await this.agoraEngine.setVideoSource(VideoSourceType.VideoSourceCustom);
    
    // Forward camera frames to Agora
    camera.current?.startRecording({
      onRecordingFinished: (video) => {
        // This is for regular recording, not streaming
      },
      // For streaming, we need frame callback
      onFrameProcessing: (frame) => {
        // Send frame to Agora engine
        this.agoraEngine.pushExternalVideoFrame(frame);
      }
    });
  }
  
  // Integrate AR filters with live streaming
  async applyARFilterToStream(filter: FilterAsset): Promise<void> {
    // Use existing SnapConnect filter system
    const filteredFrame = await nativeFilterCompositor.applyFilter(
      currentCameraFrame,
      filter,
      filterTransform
    );
    
    // Send filtered frame to Agora
    await this.agoraEngine.pushExternalVideoFrame(filteredFrame);
  }
}
```

## React Native Specific Adaptations

### 1. Platform Differences from iOS
```typescript
// Handle React Native cross-platform considerations
export class ReactNativePlatformHandler {
  
  setupPlatformSpecificFeatures() {
    if (Platform.OS === 'ios') {
      // iOS specific optimizations from the blog post
      this.setupiOSBackgroundMode();
      this.configureiOSAudioSession();
    } else {
      // Android specific setup
      this.setupAndroidPermissions();
      this.configureAndroidAudio();
    }
  }
  
  private setupiOSBackgroundMode() {
    // Configure background mode for streaming
    // This matches the iOS implementation patterns
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        // Pause video, continue audio
        this.agoraEngine.muteLocalVideoStream(true);
      } else if (nextAppState === 'active') {
        // Resume video
        this.agoraEngine.muteLocalVideoStream(false);
      }
    });
  }
}
```

### 2. Memory and Performance Management
```typescript
// Adapted from iOS memory management patterns
export class StreamingPerformanceManager {
  
  optimizeForMobile() {
    // Configure video encoding for mobile
    const videoConfig = {
      // Lower resolution for mobile networks
      dimensions: { width: 720, height: 1280 },
      frameRate: 24, // Reduced from 30 for battery
      bitrate: 800,  // Adaptive based on network
      
      // iOS-inspired optimizations
      degradationPreference: 'MAINTAIN_FRAMERATE',
      mirrorMode: 'AUTO',
    };
    
    this.agoraEngine.setVideoEncoderConfiguration(videoConfig);
  }
  
  handleLowMemoryWarning() {
    // iOS pattern adapted for React Native
    // Reduce video quality temporarily
    this.agoraEngine.setVideoEncoderConfiguration({
      dimensions: { width: 480, height: 640 },
      frameRate: 15,
      bitrate: 400,
    });
  }
}
```

## SnapConnect Integration Points

### 1. User Authentication Flow
```typescript
// Integrate with SnapConnect's Supabase auth
export class StreamingAuthFlow {
  
  async authenticateForStreaming(channelId: string, role: 'host' | 'viewer'): Promise<void> {
    // Get current SnapConnect user
    const { user } = useAuthStore.getState();
    
    if (!user) {
      throw new Error('User must be logged in to SnapConnect');
    }
    
    // Generate Agora token via SnapConnect backend
    const token = await agoraTokenService.generateToken({
      userId: user.id,
      channelId,
      role: role === 'host' ? ClientRole.BROADCASTER : ClientRole.AUDIENCE,
    });
    
    // Join channel with SnapConnect user context
    const uid = this.generateUIDFromUser(user.id);
    await this.agoraEngine.joinChannel(token, channelId, null, uid);
    
    // Update SnapConnect streaming state
    const streamStore = useLiveStreamStore.getState();
    streamStore.setCurrentStream({
      channelId,
      role,
      joinedAt: new Date().toISOString(),
    });
  }
}
```

### 2. Fitness-Specific Features
```typescript
// Add fitness-specific streaming features
export class FitnessStreamingFeatures {
  
  // Workout timer integration
  setupWorkoutTimer() {
    const { currentWorkout } = useWorkoutStore.getState();
    
    if (currentWorkout) {
      // Display workout timer overlay during stream
      this.showWorkoutTimerOverlay(currentWorkout);
    }
  }
  
  // Fitness level-based features
  configureFitnessFeatures(user: SnapConnectUser) {
    // Adjust stream quality based on workout type
    if (user.currentWorkoutType === 'high_intensity') {
      // Higher frame rate for fast movements
      this.agoraEngine.setVideoEncoderConfiguration({
        frameRate: 30,
        bitrate: 1200,
      });
    }
  }
}
```

## Testing Strategy

### 1. iOS Implementation Testing
```typescript
// Test scenarios adapted from iOS implementation
export class StreamingTestSuite {
  
  async testRoleSwitching() {
    // Test host -> viewer -> co-host flow
    await this.joinAsViewer();
    await this.requestCoHostPermission();
    await this.acceptCoHostPromotion();
    
    // Verify video/audio state changes
    expect(this.agoraEngine.isLocalVideoEnabled()).toBe(true);
  }
  
  async testNetworkResilience() {
    // Simulate network conditions
    await this.simulateNetworkDrop();
    await this.verifyAutoReconnection();
    await this.verifyVideoQualityAdaptation();
  }
}
```

## Production Considerations

### 1. Error Handling
```typescript
// Robust error handling based on iOS patterns
export class StreamingErrorHandler {
  
  handleStreamingErrors() {
    this.agoraEngine.addListener('Error', (errorCode: number) => {
      switch (errorCode) {
        case 17: // Network unavailable
          this.showNetworkErrorDialog();
          break;
        case 109: // Token expired
          this.refreshTokenAndReconnect();
          break;
        default:
          this.showGenericErrorDialog(errorCode);
      }
    });
  }
  
  private async refreshTokenAndReconnect() {
    // Use SnapConnect token refresh flow
    const newToken = await agoraTokenService.refreshToken();
    await this.agoraEngine.renewToken(newToken);
  }
}
```

## Key Implementation Files

```
src/
├── services/
│   ├── agoraStreamingService.ts     # Core streaming service
│   ├── channelManager.ts            # Channel lifecycle
│   ├── agoraEventHandler.ts         # Event handling
│   └── streamingPerformanceManager.ts # Performance optimization
├── components/streaming/
│   ├── SnapConnectVideoRenderer.tsx # Video display
│   ├── StreamingControls.tsx        # Stream controls
│   └── ParticipantGrid.tsx          # Participant management
└── hooks/
    ├── useStreamingAuth.ts          # Authentication hook
    └── useStreamingState.ts         # State management hook
```

This implementation guide provides the foundation for translating iOS live streaming patterns into SnapConnect's React Native architecture while maintaining the app's existing design patterns and user experience.