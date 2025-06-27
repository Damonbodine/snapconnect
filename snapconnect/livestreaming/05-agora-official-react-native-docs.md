# Agora Official React Native Documentation Analysis

## Document Source
- **URL**: https://docs.agora.io/en/interactive-live-streaming/get-started/get-started-sdk?platform=React+Native
- **Focus**: Official Agora React Native SDK implementation for interactive live streaming
- **Integration Target**: SnapConnect fitness social platform

## Official SDK Architecture Overview

The official documentation provides the authoritative implementation patterns for React Native integration. This analysis focuses on production-ready patterns for SnapConnect.

### 1. SDK Installation and Setup
```bash
# Official installation command
npm install react-native-agora

# iOS setup (SnapConnect already uses development builds)
cd ios && pod install

# Android setup - Add to android/app/build.gradle
dependencies {
    implementation project(':react-native-agora')
}
```

### 2. Engine Initialization (Official Pattern)
```typescript
// src/services/officialAgoraService.ts
// Following official documentation patterns
import RtcEngine, { 
  RtcEngineConfig, 
  ChannelProfile, 
  ClientRole,
  IRtcEngineEventHandler 
} from 'react-native-agora';

export class OfficialAgoraService implements IRtcEngineEventHandler {
  private engine: RtcEngine | null = null;
  private appId: string;
  
  constructor() {
    this.appId = process.env.EXPO_PUBLIC_AGORA_APP_ID!;
  }
  
  // Official initialization pattern
  async initialize(): Promise<void> {
    try {
      // Create engine with configuration
      this.engine = await RtcEngine.createWithConfig({
        appId: this.appId,
        // SnapConnect-specific areas (global fitness community)
        areaCode: ['GLOBAL'],
        logConfig: {
          level: __DEV__ ? 'INFO' : 'ERROR',
        }
      });
      
      // Set channel profile for live broadcasting
      await this.engine.setChannelProfile(ChannelProfile.LiveBroadcasting);
      
      // Register event handler
      this.engine.registerEventHandler(this);
      
      // SnapConnect-specific configuration
      await this.configureForFitnessStreaming();
      
      console.log('✅ Official Agora engine initialized');
      
    } catch (error) {
      console.error('❌ Official Agora initialization failed:', error);
      throw new Error('Failed to initialize Agora engine');
    }
  }
  
  private async configureForFitnessStreaming(): Promise<void> {
    if (!this.engine) return;
    
    // Enable video and audio
    await this.engine.enableVideo();
    await this.engine.enableAudio();
    
    // Configure video for fitness content (portrait orientation)
    await this.engine.setVideoEncoderConfiguration({
      dimensions: { width: 720, height: 1280 }, // Portrait
      frameRate: 30, // Smooth for exercise demonstrations
      bitrate: 1500, // High quality for fitness instruction
      orientationMode: 'FixedPortrait',
      degradationPreference: 'MaintainQuality',
    });
    
    // Configure audio for fitness instruction
    await this.engine.setAudioProfile(
      'MusicHighQuality',  // Clear instruction audio
      'GameStreaming'      // Low latency for real-time feedback
    );
    
    // Enable dual stream for scalability
    await this.engine.enableDualStreamMode(true);
  }
  
  // Event handler implementations (official pattern)
  onJoinChannelSuccess(channel: string, uid: number, elapsed: number): void {
    console.log(`✅ Joined channel ${channel} with UID ${uid}`);
    
    // Update SnapConnect state
    const streamStore = useLiveStreamStore.getState();
    streamStore.setConnectionState('connected');
    streamStore.setMyUID(uid);
  }
  
  onUserJoined(uid: number, elapsed: number): void {
    console.log(`👤 User ${uid} joined`);
    
    // Add to SnapConnect participant list
    const streamStore = useLiveStreamStore.getState();
    streamStore.addParticipant({
      agoraUid: uid,
      role: 'viewer',
      joinedAt: new Date().toISOString(),
    });
  }
  
  onUserOffline(uid: number, reason: number): void {
    console.log(`👤 User ${uid} left (reason: ${reason})`);
    
    // Remove from SnapConnect participant list
    const streamStore = useLiveStreamStore.getState();
    streamStore.removeParticipant(uid);
  }
  
  onError(errorCode: number): void {
    console.error(`❌ Agora error: ${errorCode}`);
    
    // Handle specific errors for SnapConnect
    this.handleOfficialErrors(errorCode);
  }
  
  private handleOfficialErrors(errorCode: number): void {
    const errorMap: Record<number, string> = {
      2: 'Invalid App ID - Check Agora configuration',
      17: 'Network unavailable - Check internet connection',
      109: 'Token expired - Refreshing authentication',
      110: 'Token invalid - Authentication failed',
    };
    
    const message = errorMap[errorCode] || `Streaming error: ${errorCode}`;
    
    // Use SnapConnect error handling
    const errorStore = useErrorStore?.getState();
    errorStore?.setError(message);
  }
}
```

### 3. Token Authentication (Production Pattern)
```typescript
// src/services/agoraTokenService.ts
// Official token management for SnapConnect
export class AgoraTokenService {
  
  // Official token generation via SnapConnect backend
  async generateToken(params: {
    channelId: string;
    userId: string;
    role: 'host' | 'audience';
  }): Promise<string> {
    try {
      // Call SnapConnect Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('generate-agora-token', {
        body: {
          channelName: params.channelId,
          uid: this.generateUID(params.userId),
          role: params.role === 'host' ? 'publisher' : 'subscriber',
          // Official token expiration (1 hour)
          privilegeExpiredTs: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      
      if (error) throw error;
      
      return data.token;
      
    } catch (error) {
      console.error('❌ Token generation failed:', error);
      throw new Error('Failed to generate streaming token');
    }
  }
  
  // Official UID generation pattern
  private generateUID(userId: string): number {
    // Convert SnapConnect user ID to numeric UID
    // Use CRC32 or similar hash for consistency
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Ensure positive number between 1 and 2^32-1
    return Math.abs(hash) || 1;
  }
  
  // Official token refresh pattern
  async refreshToken(channelId: string): Promise<string> {
    const { user } = useAuthStore.getState();
    const { myRole } = useLiveStreamStore.getState();
    
    const newToken = await this.generateToken({
      channelId,
      userId: user.id,
      role: myRole === 'host' ? 'host' : 'audience',
    });
    
    // Renew token in engine
    const agoraService = OfficialAgoraService.getInstance();
    await agoraService.getEngine().renewToken(newToken);
    
    return newToken;
  }
}
```

### 4. Channel Operations (Official API)
```typescript
// src/services/officialChannelService.ts
// Official channel management patterns
export class OfficialChannelService {
  private agoraService: OfficialAgoraService;
  private tokenService: AgoraTokenService;
  
  constructor() {
    this.agoraService = OfficialAgoraService.getInstance();
    this.tokenService = new AgoraTokenService();
  }
  
  // Official join channel pattern
  async joinChannel(params: {
    channelId: string;
    role: 'host' | 'viewer';
    eventId?: string;
  }): Promise<void> {
    try {
      const engine = this.agoraService.getEngine();
      const { user } = useAuthStore.getState();
      
      // Set client role (official pattern)
      const clientRole = params.role === 'host' ? ClientRole.Broadcaster : ClientRole.Audience;
      await engine.setClientRole(clientRole);
      
      // Generate token
      const token = await this.tokenService.generateToken({
        channelId: params.channelId,
        userId: user.id,
        role: params.role,
      });
      
      // Generate UID
      const uid = this.tokenService.generateUID(user.id);
      
      // Official join channel call
      await engine.joinChannel(token, params.channelId, null, uid);
      
      // Update SnapConnect state
      const streamStore = useLiveStreamStore.getState();
      streamStore.setCurrentStream({
        channelId: params.channelId,
        role: params.role,
        eventId: params.eventId,
        joinedAt: new Date().toISOString(),
      });
      
      console.log(`✅ Joined channel ${params.channelId} as ${params.role}`);
      
    } catch (error) {
      console.error('❌ Failed to join channel:', error);
      throw error;
    }
  }
  
  // Official leave channel pattern
  async leaveChannel(): Promise<void> {
    try {
      const engine = this.agoraService.getEngine();
      await engine.leaveChannel();
      
      // Clean up SnapConnect state
      const streamStore = useLiveStreamStore.getState();
      streamStore.clearCurrentStream();
      
      console.log('✅ Left channel');
      
    } catch (error) {
      console.error('❌ Failed to leave channel:', error);
      throw error;
    }
  }
  
  // Official role switching (for co-host feature)
  async switchClientRole(newRole: 'host' | 'viewer'): Promise<void> {
    try {
      const engine = this.agoraService.getEngine();
      const clientRole = newRole === 'host' ? ClientRole.Broadcaster : ClientRole.Audience;
      
      await engine.setClientRole(clientRole);
      
      // Update SnapConnect state
      const streamStore = useLiveStreamStore.getState();
      streamStore.setMyRole(newRole === 'host' ? 'host' : 'viewer');
      
      console.log(`✅ Switched to ${newRole} role`);
      
    } catch (error) {
      console.error('❌ Failed to switch role:', error);
      throw error;
    }
  }
}
```

### 5. Video Rendering (Official Components)
```typescript
// src/components/streaming/OfficialVideoRenderer.tsx
// Using official React Native components
import { RtcLocalView, RtcRemoteView, VideoRenderMode } from 'react-native-agora';

interface OfficialVideoRendererProps {
  channelId: string;
  localUID: number;
  remoteUsers: Array<{ uid: number; username: string; role: string }>;
  isHost: boolean;
}

export const OfficialVideoRenderer: React.FC<OfficialVideoRendererProps> = ({
  channelId,
  localUID,
  remoteUsers,
  isHost,
}) => {
  const [renderMode] = useState(VideoRenderMode.Fit);
  
  return (
    <View style={styles.videoContainer}>
      {/* Local video (host view) */}
      {isHost && (
        <View style={styles.localVideoContainer}>
          <RtcLocalView.SurfaceView
            style={styles.localVideo}
            channelId={channelId}
            renderMode={renderMode}
          />
          
          {/* SnapConnect overlays */}
          <View style={styles.localOverlay}>
            <Text style={styles.localLabel}>You (Host)</Text>
            <LiveIndicator />
            
            {/* AR Filter integration point */}
            <ARFilterOverlay isLocal={true} />
          </View>
        </View>
      )}
      
      {/* Remote videos (participants) */}
      <ScrollView 
        horizontal 
        style={styles.remoteVideoStrip}
        showsHorizontalScrollIndicator={false}
      >
        {remoteUsers.map((user) => (
          <View key={user.uid} style={styles.remoteVideoContainer}>
            <RtcRemoteView.SurfaceView
              style={styles.remoteVideo}
              uid={user.uid}
              channelId={channelId}
              renderMode={renderMode}
            />
            
            {/* SnapConnect participant info */}
            <View style={styles.remoteOverlay}>
              <Text style={styles.participantName}>{user.username}</Text>
              {user.role === 'co_host' && (
                <CoHostBadge />
              )}
              <NetworkQualityIndicator uid={user.uid} />
            </View>
          </View>
        ))}
      </ScrollView>
      
      {/* Empty state for no participants */}
      {remoteUsers.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Waiting for viewers to join...
          </Text>
        </View>
      )}
    </View>
  );
};

// SnapConnect-specific video controls
export const OfficialStreamControls: React.FC<{
  isHost: boolean;
  onEndStream: () => void;
  onToggleCamera: () => void;
  onToggleMicrophone: () => void;
  onSwitchCamera: () => void;
}> = ({
  isHost,
  onEndStream,
  onToggleCamera,
  onToggleMicrophone,
  onSwitchCamera,
}) => {
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  
  const handleToggleCamera = async () => {
    const engine = OfficialAgoraService.getInstance().getEngine();
    await engine.muteLocalVideoStream(!isCameraEnabled);
    setIsCameraEnabled(!isCameraEnabled);
    onToggleCamera();
  };
  
  const handleToggleMicrophone = async () => {
    const engine = OfficialAgoraService.getInstance().getEngine();
    await engine.muteLocalAudioStream(!isMicEnabled);
    setIsMicEnabled(!isMicEnabled);
    onToggleMicrophone();
  };
  
  const handleSwitchCamera = async () => {
    const engine = OfficialAgoraService.getInstance().getEngine();
    await engine.switchCamera();
    onSwitchCamera();
  };
  
  return (
    <View style={styles.controlsContainer}>
      {/* Camera toggle */}
      <TouchableOpacity 
        style={[styles.controlButton, !isCameraEnabled && styles.disabledButton]}
        onPress={handleToggleCamera}
      >
        <Icon name={isCameraEnabled ? 'videocam' : 'videocam-off'} size={24} color="white" />
      </TouchableOpacity>
      
      {/* Microphone toggle */}
      <TouchableOpacity 
        style={[styles.controlButton, !isMicEnabled && styles.disabledButton]}
        onPress={handleToggleMicrophone}
      >
        <Icon name={isMicEnabled ? 'mic' : 'mic-off'} size={24} color="white" />
      </TouchableOpacity>
      
      {/* Camera switch */}
      <TouchableOpacity 
        style={styles.controlButton}
        onPress={handleSwitchCamera}
      >
        <Icon name="camera-reverse" size={24} color="white" />
      </TouchableOpacity>
      
      {/* End stream (host only) */}
      {isHost && (
        <TouchableOpacity 
          style={[styles.controlButton, styles.endButton]}
          onPress={onEndStream}
        >
          <Icon name="call-end" size={24} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
};
```

### 6. SnapConnect Integration Hooks
```typescript
// src/hooks/useOfficialAgoraStreaming.ts
// Custom hook for SnapConnect integration
export const useOfficialAgoraStreaming = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  const agoraService = useRef<OfficialAgoraService>();
  const channelService = useRef<OfficialChannelService>();
  
  const { user } = useAuthStore();
  const { currentStream, setCurrentStream, clearCurrentStream } = useLiveStreamStore();
  
  // Initialize Agora services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        agoraService.current = new OfficialAgoraService();
        await agoraService.current.initialize();
        
        channelService.current = new OfficialChannelService();
        
        setIsInitialized(true);
        console.log('✅ Agora services initialized');
        
      } catch (error) {
        console.error('❌ Failed to initialize Agora services:', error);
      }
    };
    
    initializeServices();
    
    // Cleanup on unmount
    return () => {
      agoraService.current?.destroy();
    };
  }, []);
  
  // Start streaming (host)
  const startStream = useCallback(async (params: {
    title: string;
    eventId?: string;
    isInstant?: boolean;
  }) => {
    if (!isInitialized || !channelService.current) {
      throw new Error('Agora not initialized');
    }
    
    try {
      // Create stream record in SnapConnect database
      const streamRecord = await createStreamRecord({
        hostId: user.id,
        title: params.title,
        eventId: params.eventId,
        isInstant: params.isInstant || false,
      });
      
      // Join as host
      await channelService.current.joinChannel({
        channelId: streamRecord.channelId,
        role: 'host',
        eventId: params.eventId,
      });
      
      setIsStreaming(true);
      setConnectionState('connected');
      
      return streamRecord;
      
    } catch (error) {
      console.error('❌ Failed to start stream:', error);
      throw error;
    }
  }, [isInitialized, user]);
  
  // Join stream (viewer)
  const joinStream = useCallback(async (channelId: string, eventId?: string) => {
    if (!isInitialized || !channelService.current) {
      throw new Error('Agora not initialized');
    }
    
    try {
      await channelService.current.joinChannel({
        channelId,
        role: 'viewer',
        eventId,
      });
      
      setConnectionState('connected');
      
    } catch (error) {
      console.error('❌ Failed to join stream:', error);
      throw error;
    }
  }, [isInitialized]);
  
  // Leave stream
  const leaveStream = useCallback(async () => {
    if (!channelService.current) return;
    
    try {
      await channelService.current.leaveChannel();
      
      setIsStreaming(false);
      setConnectionState('disconnected');
      clearCurrentStream();
      
    } catch (error) {
      console.error('❌ Failed to leave stream:', error);
      throw error;
    }
  }, [clearCurrentStream]);
  
  // Switch to co-host
  const requestCoHost = useCallback(async () => {
    if (!channelService.current) return;
    
    try {
      await channelService.current.switchClientRole('host');
      
      // Update SnapConnect participant role
      await updateParticipantRole(user.id, 'co_host');
      
    } catch (error) {
      console.error('❌ Failed to switch to co-host:', error);
      throw error;
    }
  }, [user]);
  
  return {
    // State
    isInitialized,
    isStreaming,
    connectionState,
    currentStream,
    
    // Actions
    startStream,
    joinStream,
    leaveStream,
    requestCoHost,
    
    // Services (for advanced usage)
    agoraService: agoraService.current,
    channelService: channelService.current,
  };
};
```

### 7. Production Configuration
```typescript
// src/config/agoraConfig.ts
// Production configuration following official guidelines
export const AgoraConfig = {
  // Environment-specific settings
  development: {
    appId: process.env.EXPO_PUBLIC_AGORA_APP_ID_DEV!,
    logLevel: 'INFO',
    enableDebug: true,
  },
  production: {
    appId: process.env.EXPO_PUBLIC_AGORA_APP_ID_PROD!,
    logLevel: 'ERROR',
    enableDebug: false,
  },
  
  // SnapConnect-specific settings
  video: {
    // Portrait orientation for fitness content
    dimensions: { width: 720, height: 1280 },
    frameRate: 30,
    bitrate: 1500,
    orientationMode: 'FixedPortrait' as const,
    degradationPreference: 'MaintainQuality' as const,
  },
  
  audio: {
    profile: 'MusicHighQuality' as const,
    scenario: 'GameStreaming' as const,
  },
  
  // Streaming limits for SnapConnect
  limits: {
    maxStreamDuration: 3600, // 1 hour max
    maxViewers: 1000,
    tokenExpirationTime: 3600, // 1 hour
  },
};

// Get environment-specific config
export const getAgoraConfig = () => {
  return __DEV__ ? AgoraConfig.development : AgoraConfig.production;
};
```

## Key Implementation Files (Official Structure)

```
src/
├── services/
│   ├── officialAgoraService.ts      # Core engine service
│   ├── agoraTokenService.ts         # Token management
│   ├── officialChannelService.ts    # Channel operations
│   └── agoraEventHandler.ts         # Event handling
├── components/streaming/
│   ├── OfficialVideoRenderer.tsx    # Video components
│   ├── OfficialStreamControls.tsx   # Control interface
│   └── StreamingOverlays.tsx        # UI overlays
├── hooks/
│   ├── useOfficialAgoraStreaming.ts # Main streaming hook
│   └── useStreamingPermissions.ts   # Permissions hook
├── config/
│   └── agoraConfig.ts               # Configuration
└── types/
    └── agoraTypes.ts                # TypeScript types
```

## Production Deployment Checklist

### 1. Environment Setup
- [ ] Production Agora App ID configured
- [ ] Supabase Edge Function for token generation deployed
- [ ] SSL certificates for token server
- [ ] Production logging configuration

### 2. Testing Requirements
- [ ] Multi-device streaming tests
- [ ] Network resilience testing
- [ ] Token expiration handling
- [ ] Role switching functionality
- [ ] Error handling validation

### 3. Performance Optimization
- [ ] Video quality profiles configured
- [ ] Battery usage optimized
- [ ] Memory leak testing
- [ ] Network bandwidth optimization

This official documentation analysis provides the authoritative implementation path for integrating Agora live streaming into SnapConnect following production-ready patterns and best practices.