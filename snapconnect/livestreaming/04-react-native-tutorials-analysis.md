# React Native Live Streaming Tutorials Analysis

## Document Sources
- **Primary**: https://dev.to/kyle_buntin/how-to-build-a-simple-live-video-streaming-app-with-react-native-and-agora-o40
- **Supporting**: Multiple React Native + Agora tutorials from web search
- **Focus**: Direct React Native implementation patterns for SnapConnect

## Core Implementation Architecture

### 1. Basic Setup and Installation
```bash
# Required dependencies for SnapConnect integration
npm install react-native-agora@3.7.0  # Version validated in tutorials
npm install react-native-get-random-values # For UUID generation
npm install react-native-permissions  # Camera/microphone permissions

# iOS specific setup (SnapConnect already uses development builds)
cd ios && pod install

# Android specific setup
# Add to android/app/build.gradle:
# implementation "com.facebook.react:react-native:+"
```

### 2. Permission Management Integration
```typescript
// src/services/streamingPermissions.ts
// Integrate with existing SnapConnect permission patterns
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

export class StreamingPermissions {
  
  // Integrate with existing camera permission flow
  async requestStreamingPermissions(): Promise<boolean> {
    try {
      // SnapConnect already handles camera permissions
      // Extend for microphone
      const micPermission = await request(
        Platform.OS === 'ios' 
          ? PERMISSIONS.IOS.MICROPHONE 
          : PERMISSIONS.ANDROID.RECORD_AUDIO
      );
      
      if (micPermission !== RESULTS.GRANTED) {
        throw new Error('Microphone permission required for live streaming');
      }
      
      // Camera permission should already be granted from SnapConnect camera flow
      const cameraPermission = await this.checkCameraPermission();
      
      return cameraPermission && micPermission === RESULTS.GRANTED;
      
    } catch (error) {
      console.error('❌ Streaming permissions error:', error);
      
      // Use SnapConnect error handling patterns
      const errorStore = useErrorStore.getState();
      errorStore.setError('Permissions required for live streaming');
      
      return false;
    }
  }
  
  private async checkCameraPermission(): Promise<boolean> {
    // Leverage existing SnapConnect camera permission check
    return await cameraService.hasPermissions();
  }
}
```

### 3. Agora Engine Service
```typescript
// src/services/agoraEngineService.ts
// Following tutorial patterns but integrated with SnapConnect architecture
import RtcEngine, { 
  RtcEngineConfig, 
  ChannelProfile, 
  ClientRole,
  VideoEncoderConfiguration 
} from 'react-native-agora';

export class AgoraEngineService {
  private engine: RtcEngine | null = null;
  private isInitialized: boolean = false;
  
  async initialize(): Promise<void> {
    try {
      // Initialize with SnapConnect configuration
      const config: RtcEngineConfig = {
        appId: process.env.EXPO_PUBLIC_AGORA_APP_ID!,
        // SnapConnect-specific logging
        logConfig: {
          level: __DEV__ ? 'INFO' : 'WARN',
          filePath: '', // Use default
        },
        // Optimize for SnapConnect use case
        areaCode: 'GLOBAL', // Support international users
      };
      
      this.engine = await RtcEngine.createWithConfig(config);
      
      // Configure for live broadcasting (SnapConnect streaming)
      await this.engine.setChannelProfile(ChannelProfile.LiveBroadcasting);
      
      // SnapConnect-specific video configuration
      await this.configureVideo();
      await this.configureAudio();
      
      this.isInitialized = true;
      console.log('✅ Agora engine initialized for SnapConnect');
      
    } catch (error) {
      console.error('❌ Agora initialization error:', error);
      throw new Error('Failed to initialize streaming engine');
    }
  }
  
  private async configureVideo(): Promise<void> {
    // Enable video module
    await this.engine!.enableVideo();
    
    // SnapConnect-optimized video configuration
    const videoConfig: VideoEncoderConfiguration = {
      // Portrait orientation for fitness content
      dimensions: { width: 720, height: 1280 },
      frameRate: 24, // Balanced for mobile battery
      bitrate: 1000, // Good quality for fitness demos
      orientationMode: 'FixedPortrait',
      degradationPreference: 'MaintainQuality', // Prioritize clarity for workout demos
      mirrorMode: 'Auto',
    };
    
    await this.engine!.setVideoEncoderConfiguration(videoConfig);
  }
  
  private async configureAudio(): Promise<void> {
    // Enable audio module
    await this.engine!.enableAudio();
    
    // SnapConnect audio profile - optimized for fitness instruction
    await this.engine!.setAudioProfile(
      'MusicHighQuality', // Clear voice for workout instruction
      'GameStreaming'     // Low latency for real-time interaction
    );
  }
  
  // SnapConnect-specific engine access
  getEngine(): RtcEngine {
    if (!this.isInitialized || !this.engine) {
      throw new Error('Agora engine not initialized');
    }
    return this.engine;
  }
  
  async destroy(): Promise<void> {
    if (this.engine) {
      await this.engine.destroy();
      this.engine = null;
      this.isInitialized = false;
    }
  }
}
```

### 4. Channel Management with SnapConnect Integration
```typescript
// src/services/agoraChannelService.ts
// Adapted from tutorial patterns for SnapConnect events system
export class AgoraChannelService {
  private engine: RtcEngine;
  private currentChannel: string | null = null;
  private currentRole: ClientRole | null = null;
  
  constructor(private agoraEngine: AgoraEngineService) {
    this.engine = agoraEngine.getEngine();
  }
  
  // Join channel for SnapConnect event
  async joinEventStream(eventId: string, role: 'host' | 'viewer'): Promise<void> {
    try {
      // Generate channel name from SnapConnect event
      const channelId = `snapconnect-event-${eventId}`;
      
      // Get SnapConnect user context
      const { user } = useAuthStore.getState();
      if (!user) throw new Error('User must be authenticated');
      
      // Set client role
      const clientRole = role === 'host' ? ClientRole.Broadcaster : ClientRole.Audience;
      await this.engine.setClientRole(clientRole);
      
      // Generate UID from SnapConnect user ID
      const uid = this.generateUID(user.id);
      
      // Get token from SnapConnect auth service
      const token = await this.getChannelToken(channelId, clientRole);
      
      // Join channel
      await this.engine.joinChannel(token, channelId, null, uid);
      
      this.currentChannel = channelId;
      this.currentRole = clientRole;
      
      // Update SnapConnect streaming state
      const streamStore = useLiveStreamStore.getState();
      streamStore.setCurrentStream({
        channelId,
        eventId,
        role,
        joinedAt: new Date().toISOString(),
      });
      
      console.log(`✅ Joined channel ${channelId} as ${role}`);
      
    } catch (error) {
      console.error('❌ Failed to join channel:', error);
      throw error;
    }
  }
  
  // Create instant stream (Clique feature)
  async createInstantStream(): Promise<string> {
    try {
      const { user } = useAuthStore.getState();
      const streamId = `snapconnect-instant-${Date.now()}`;
      
      // Create stream record in SnapConnect database
      const stream = await this.createStreamRecord({
        channelId: streamId,
        hostId: user.id,
        title: `${user.username}'s Live Workout`,
        isInstant: true,
      });
      
      // Join as host
      await this.joinChannel(streamId, 'host');
      
      return streamId;
      
    } catch (error) {
      console.error('❌ Failed to create instant stream:', error);
      throw error;
    }
  }
  
  // Switch to co-host (tutorial pattern adapted)
  async switchToCoHost(): Promise<void> {
    if (this.currentRole !== ClientRole.Audience) {
      throw new Error('Can only switch to co-host from audience role');
    }
    
    await this.engine.setClientRole(ClientRole.Broadcaster);
    this.currentRole = ClientRole.Broadcaster;
    
    // Update SnapConnect state
    const streamStore = useLiveStreamStore.getState();
    streamStore.setMyRole('co_host');
    
    console.log('✅ Switched to co-host role');
  }
  
  private generateUID(userId: string): number {
    // Convert SnapConnect user ID to numeric UID for Agora
    // Use consistent hash function
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  private async getChannelToken(channelId: string, role: ClientRole): Promise<string> {
    // Call SnapConnect token service
    return await agoraTokenService.generateToken({
      channelId,
      role: role === ClientRole.Broadcaster ? 'host' : 'audience',
    });
  }
}
```

### 5. Event Handling System
```typescript
// src/services/agoraEventHandler.ts
// Following tutorial patterns with SnapConnect integration
export class AgoraEventHandler {
  private engine: RtcEngine;
  
  constructor(agoraEngine: AgoraEngineService) {
    this.engine = agoraEngine.getEngine();
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    // User joined event
    this.engine.addListener('UserJoined', (uid: number, elapsed: number) => {
      console.log(`👤 User ${uid} joined`);
      
      // Update SnapConnect participant list
      const streamStore = useLiveStreamStore.getState();
      streamStore.addParticipant({
        agoraUid: uid,
        role: 'viewer',
        joinedAt: new Date().toISOString(),
      });
      
      // Update viewer count in real-time
      this.updateViewerCount();
    });
    
    // User left event
    this.engine.addListener('UserOffline', (uid: number, reason: number) => {
      console.log(`👤 User ${uid} left (reason: ${reason})`);
      
      // Remove from SnapConnect participant list
      const streamStore = useLiveStreamStore.getState();
      streamStore.removeParticipant(uid);
      
      this.updateViewerCount();
    });
    
    // Role changed event (for co-host functionality)
    this.engine.addListener('ClientRoleChanged', (oldRole: number, newRole: number) => {
      console.log(`🔄 Role changed from ${oldRole} to ${newRole}`);
      
      const streamStore = useLiveStreamStore.getState();
      streamStore.setMyRole(newRole === ClientRole.Broadcaster ? 'host' : 'viewer');
    });
    
    // Network quality monitoring (important for mobile)
    this.engine.addListener('NetworkQuality', (uid: number, txQuality: number, rxQuality: number) => {
      // Show network quality in SnapConnect UI
      const streamStore = useLiveStreamStore.getState();
      streamStore.updateNetworkQuality(uid, { tx: txQuality, rx: rxQuality });
    });
    
    // Audio/Video state changes
    this.engine.addListener('RemoteVideoStateChanged', (uid: number, state: number, reason: number, elapsed: number) => {
      console.log(`📹 Remote video state changed for ${uid}: ${state}`);
      
      // Update SnapConnect UI
      const streamStore = useLiveStreamStore.getState();
      streamStore.updateParticipantVideoState(uid, state === 2); // 2 = Decoding
    });
    
    // Error handling
    this.engine.addListener('Error', (errorCode: number) => {
      console.error(`❌ Agora error: ${errorCode}`);
      this.handleAgoraError(errorCode);
    });
    
    // Connection state changes
    this.engine.addListener('ConnectionStateChanged', (state: number, reason: number) => {
      console.log(`🔗 Connection state: ${state}, reason: ${reason}`);
      this.handleConnectionStateChange(state, reason);
    });
  }
  
  private updateViewerCount(): void {
    const streamStore = useLiveStreamStore.getState();
    const viewerCount = streamStore.streamParticipants.filter(p => p.role === 'viewer').length;
    
    // Update SnapConnect database
    if (streamStore.currentStream) {
      supabase
        .from('live_streams')
        .update({ viewer_count: viewerCount })
        .eq('channel_id', streamStore.currentStream.channelId);
    }
  }
  
  private handleAgoraError(errorCode: number): void {
    // Map Agora errors to SnapConnect error handling
    const errorMessages: Record<number, string> = {
      17: 'Network connection lost. Please check your internet.',
      109: 'Authentication failed. Please try again.',
      110: 'Channel join failed. Stream may have ended.',
    };
    
    const message = errorMessages[errorCode] || `Streaming error: ${errorCode}`;
    
    // Use SnapConnect error handling
    const errorStore = useErrorStore.getState();
    errorStore.setError(message);
  }
  
  private handleConnectionStateChange(state: number, reason: number): void {
    const streamStore = useLiveStreamStore.getState();
    
    switch (state) {
      case 1: // Connecting
        streamStore.setConnectionState('connecting');
        break;
      case 3: // Connected
        streamStore.setConnectionState('connected');
        break;
      case 4: // Reconnecting
        streamStore.setConnectionState('reconnecting');
        break;
      case 5: // Failed
        streamStore.setConnectionState('failed');
        this.handleConnectionFailure(reason);
        break;
    }
  }
}
```

### 6. Video Rendering Components
```typescript
// src/components/streaming/AgoraVideoView.tsx
// Tutorial video rendering adapted for SnapConnect
import { RtcLocalView, RtcRemoteView } from 'react-native-agora';

interface AgoraVideoViewProps {
  uid?: number;
  channelId: string;
  isLocal?: boolean;
  style?: ViewStyle;
  renderMode?: VideoRenderMode;
  showStats?: boolean;
}

export const AgoraVideoView: React.FC<AgoraVideoViewProps> = ({
  uid,
  channelId,
  isLocal = false,
  style,
  renderMode = VideoRenderMode.Fit,
  showStats = false,
}) => {
  const [videoStats, setVideoStats] = useState<VideoStats | null>(null);
  
  // Monitor video statistics for SnapConnect performance UI
  useEffect(() => {
    if (showStats && uid) {
      const interval = setInterval(async () => {
        try {
          const stats = await agoraEngine.getEngine().getRemoteVideoStats();
          const userStats = stats.find(s => s.uid === uid);
          setVideoStats(userStats || null);
        } catch (error) {
          console.warn('Failed to get video stats:', error);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [showStats, uid]);
  
  if (isLocal) {
    return (
      <View style={[styles.videoContainer, style]}>
        <RtcLocalView.SurfaceView
          style={styles.video}
          channelId={channelId}
          renderMode={renderMode}
        />
        
        {/* SnapConnect-specific overlays */}
        <StreamingOverlays isLocal={true} />
        
        {showStats && videoStats && (
          <VideoStatsOverlay stats={videoStats} />
        )}
      </View>
    );
  }
  
  return (
    <View style={[styles.videoContainer, style]}>
      <RtcRemoteView.SurfaceView
        style={styles.video}
        uid={uid!}
        channelId={channelId}
        renderMode={renderMode}
      />
      
      {/* SnapConnect participant info */}
      <ParticipantInfoOverlay uid={uid!} />
      
      {showStats && videoStats && (
        <VideoStatsOverlay stats={videoStats} />
      )}
    </View>
  );
};

// SnapConnect-specific overlays
const StreamingOverlays: React.FC<{ isLocal: boolean }> = ({ isLocal }) => {
  const { activeFilter } = useARFilterStore();
  const { currentStream } = useLiveStreamStore();
  
  return (
    <>
      {/* AR Filter overlay for local stream */}
      {isLocal && activeFilter && (
        <ARFilterOverlay 
          filter={activeFilter}
          isStreaming={true}
        />
      )}
      
      {/* Live indicator */}
      {currentStream?.isActive && (
        <View style={styles.liveIndicator}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}
      
      {/* Network quality indicator */}
      <NetworkQualityIndicator />
    </>
  );
};
```

### 7. Integration with SnapConnect Camera System
```typescript
// src/services/cameraStreamingIntegration.ts
// Integrate Agora with existing SnapConnect camera
export class CameraStreamingIntegration {
  private camera: Camera;
  private agoraEngine: AgoraEngineService;
  
  constructor(camera: Camera, agoraEngine: AgoraEngineService) {
    this.camera = camera;
    this.agoraEngine = agoraEngine;
  }
  
  async startCameraStreaming(): Promise<void> {
    try {
      // Use existing SnapConnect camera configuration
      const device = await this.camera.getCameraDevice();
      
      // Configure for streaming
      await this.camera.configure({
        device,
        isActive: true,
        // Use existing SnapConnect video settings
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
      
      // Enable custom video source in Agora
      await this.agoraEngine.getEngine().setVideoSource(VideoSourceType.VideoSourceCustom);
      
      // Start camera preview (existing SnapConnect flow)
      await this.camera.startPreview();
      
      console.log('✅ Camera streaming started');
      
    } catch (error) {
      console.error('❌ Camera streaming error:', error);
      throw error;
    }
  }
  
  // Apply AR filters during streaming
  async applyFilterToStream(filter: FilterAsset): Promise<void> {
    // Use existing SnapConnect filter system
    const filterProcessor = new ARFilterProcessor();
    
    // Process each camera frame
    this.camera.addFrameProcessor('streaming-filter', (frame) => {
      'worklet';
      
      // Apply filter using existing SnapConnect logic
      const filteredFrame = filterProcessor.processFrame(frame, filter);
      
      // Send to Agora engine
      // Note: This requires custom native module integration
      this.sendFrameToAgora(filteredFrame);
    });
  }
  
  private sendFrameToAgora(frame: Frame): void {
    // This would require custom native module
    // Alternative: Use react-native-agora's custom video source
    // Implementation depends on tutorial's video source approach
  }
}
```

## Tutorial-Specific Implementation Patterns

### 1. Authentication Flow (From Tutorials)
```typescript
// Simplified authentication for development
// Production should use SnapConnect's Supabase auth
export class SimplifiedAuth {
  
  // Development/testing flow from tutorials
  async joinChannelSimple(channelId: string): Promise<void> {
    const engine = agoraEngine.getEngine();
    
    // For development: null token (tutorials use this)
    await engine.joinChannel(null, channelId, null, 0);
  }
  
  // Production flow with SnapConnect integration
  async joinChannelProduction(channelId: string, role: 'host' | 'viewer'): Promise<void> {
    // Get authenticated SnapConnect user
    const { user } = useAuthStore.getState();
    
    // Generate secure token via SnapConnect backend
    const token = await agoraTokenService.generateToken({
      channelId,
      userId: user.id,
      role,
    });
    
    const uid = this.generateUID(user.id);
    await engine.joinChannel(token, channelId, null, uid);
  }
}
```

### 2. Error Handling Patterns (Tutorial Best Practices)
```typescript
// Error handling adapted from tutorials
export class TutorialErrorHandling {
  
  setupErrorHandling(): void {
    const engine = agoraEngine.getEngine();
    
    engine.addListener('Error', (errorCode: number) => {
      // Tutorial error handling pattern
      switch (errorCode) {
        case 2: // Invalid app ID
          this.handleInvalidAppId();
          break;
        case 17: // Network unavailable
          this.handleNetworkError();
          break;
        case 109: // Token expired
          this.handleTokenExpired();
          break;
        default:
          console.error(`Agora error: ${errorCode}`);
      }
    });
    
    // Tutorial warning handling
    engine.addListener('Warning', (warningCode: number) => {
      console.warn(`Agora warning: ${warningCode}`);
    });
  }
  
  private handleTokenExpired(): void {
    // Tutorial pattern: refresh and rejoin
    this.refreshTokenAndRejoin();
  }
}
```

## Key Implementation Files (Tutorial Structure)

```
src/
├── services/
│   ├── agoraEngineService.ts        # Core engine management
│   ├── agoraChannelService.ts       # Channel operations
│   ├── agoraEventHandler.ts         # Event handling
│   ├── streamingPermissions.ts      # Permission management
│   └── cameraStreamingIntegration.ts # Camera integration
├── components/streaming/
│   ├── AgoraVideoView.tsx           # Video rendering
│   ├── StreamingControls.tsx        # Control buttons
│   ├── ParticipantList.tsx          # Participant management
│   └── StreamingOverlays.tsx        # UI overlays
├── screens/
│   ├── LiveStreamScreen.tsx         # Main streaming screen
│   └── StreamViewerScreen.tsx       # Viewer interface
└── hooks/
    ├── useAgoraEngine.ts            # Engine hook
    ├── useStreamingState.ts         # State management
    └── useStreamingPermissions.ts   # Permission hook
```

## Testing and Development

### 1. Tutorial Testing Approach
```typescript
// Testing patterns from tutorials
export class StreamingTesting {
  
  async testBasicStreaming(): Promise<void> {
    // 1. Initialize engine
    await agoraEngine.initialize();
    
    // 2. Request permissions
    const hasPermissions = await streamingPermissions.requestPermissions();
    
    // 3. Join channel
    await channelService.joinChannel('test-channel', 'host');
    
    // 4. Verify video/audio
    expect(agoraEngine.getEngine().isLocalVideoEnabled()).toBe(true);
  }
  
  async testRoleSwitching(): Promise<void> {
    // Test viewer -> co-host promotion
    await channelService.joinChannel('test', 'viewer');
    await channelService.switchToCoHost();
    
    // Verify role change
    const { myRole } = useLiveStreamStore.getState();
    expect(myRole).toBe('co_host');
  }
}
```

This comprehensive analysis provides the foundation for implementing Agora live streaming in SnapConnect following proven React Native tutorial patterns while maintaining integration with the existing app architecture.