import { 
  createAgoraRtcEngine, 
  IRtcEngine, 
  ChannelProfileType,
  ClientRoleType,
  RtcConnection,
  UserOfflineReasonType,
  ConnectionStateType,
  ConnectionChangedReasonType,
  LocalVideoStreamState,
  LocalVideoStreamReason,
  VideoSourceType,
} from 'react-native-agora';
import { agoraAuthService, AgoraCredentials } from './agoraAuthService';
import { useLiveStreamStore } from '../stores/liveStreamStore';
import { supabase } from './supabase';

export interface StreamingCallbacks {
  onUserJoined?: (connection: RtcConnection, uid: number) => void;
  onUserOffline?: (connection: RtcConnection, uid: number, reason: UserOfflineReasonType) => void;
  onConnectionStateChanged?: (connection: RtcConnection, state: ConnectionStateType, reason: ConnectionChangedReasonType) => void;
  onLocalVideoStateChanged?: (source: VideoSourceType, state: LocalVideoStreamState, reason: LocalVideoStreamReason) => void;
  onError?: (error: string) => void;
}

export interface StartStreamParams {
  channelName: string;
  userId: string;
  title: string;
  description?: string;
  quality?: 'low' | 'medium' | 'high';
}

export interface JoinStreamParams {
  channelName: string;
  userId: string;
  role: 'host' | 'audience';
}

export class LiveStreamService {
  private engine: IRtcEngine | null = null;
  private isInitialized = false;
  private currentChannel: string | null = null;
  private currentRole: ClientRoleType | null = null;
  private callbacks: StreamingCallbacks = {};

  constructor() {
    // Don't initialize immediately - only when actually needed
    console.log('🎥 LiveStreamService created (lazy initialization)');
  }

  /**
   * Initialize Agora RTC Engine
   * Following SnapConnect's error handling patterns
   */
  async initializeEngine(): Promise<void> {
    try {
      if (this.isInitialized) return;

      // Check if Agora is configured before initializing
      if (!agoraAuthService.isConfigured()) {
        throw new Error('Live streaming is not configured');
      }

      console.log('🎥 Initializing Agora RTC Engine...');
      
      const appId = agoraAuthService.getAppId();
      this.engine = createAgoraRtcEngine();
      
      await this.engine.initialize({
        appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });

      // Set up event handlers
      this.setupEventHandlers();
      
      // Enable video by default (following camera interface patterns)
      await this.engine.enableVideo();
      await this.engine.enableAudio();
      
      this.isInitialized = true;
      console.log('✅ Agora RTC Engine initialized successfully');
      
      // Update store state
      useLiveStreamStore.getState().agoraEngine = this.engine;
      
    } catch (error) {
      console.error('❌ Failed to initialize Agora engine:', error);
      useLiveStreamStore.getState().setError(`Failed to initialize streaming: ${error.message}`);
      throw error;
    }
  }

  /**
   * Set up Agora event handlers
   * Following SnapConnect's real-time patterns
   */
  private setupEventHandlers(): void {
    if (!this.engine) return;

    // User joined channel
    this.engine.addListener('onUserJoined', (connection: RtcConnection, uid: number) => {
      console.log('👤 User joined:', uid);
      this.callbacks.onUserJoined?.(connection, uid);
      
      // Update participant count optimistically
      const { currentStream } = useLiveStreamStore.getState();
      if (currentStream) {
        useLiveStreamStore.getState().optimisticallyUpdateViewerCount(currentStream.id, 1);
      }
    });

    // User left channel
    this.engine.addListener('onUserOffline', (connection: RtcConnection, uid: number, reason: UserOfflineReasonType) => {
      console.log('👤 User left:', uid, 'reason:', reason);
      this.callbacks.onUserOffline?.(connection, uid, reason);
      
      // Update participant count optimistically
      const { currentStream } = useLiveStreamStore.getState();
      if (currentStream) {
        useLiveStreamStore.getState().optimisticallyUpdateViewerCount(currentStream.id, -1);
      }
    });

    // Connection state changed
    this.engine.addListener('onConnectionStateChanged', (connection: RtcConnection, state: ConnectionStateType, reason: ConnectionChangedReasonType) => {
      console.log('🔗 Connection state changed:', state, 'reason:', reason);
      
      // Update store connection state
      const stateMap: Record<ConnectionStateType, any> = {
        [ConnectionStateType.ConnectionStateDisconnected]: 'disconnected',
        [ConnectionStateType.ConnectionStateConnecting]: 'connecting',
        [ConnectionStateType.ConnectionStateConnected]: 'connected',
        [ConnectionStateType.ConnectionStateReconnecting]: 'reconnecting',
        [ConnectionStateType.ConnectionStateFailed]: 'failed',
      };
      
      useLiveStreamStore.setState({ connectionState: stateMap[state] || 'disconnected' });
      this.callbacks.onConnectionStateChanged?.(connection, state, reason);
    });

    // Local video state changed
    this.engine.addListener('onLocalVideoStateChanged', (source: VideoSourceType, state: LocalVideoStreamState, reason: LocalVideoStreamReason) => {
      console.log('📹 Local video state changed:', state, 'reason:', reason);
      this.callbacks.onLocalVideoStateChanged?.(source, state, reason);
    });

    // Error handling
    this.engine.addListener('onError', (error: number, message: string) => {
      console.error('❌ Agora error:', error, message);
      this.callbacks.onError?.(`Agora error ${error}: ${message}`);
      useLiveStreamStore.getState().setError(`Streaming error: ${message}`);
    });

    // Token privilege will expire
    this.engine.addListener('onTokenPrivilegeWillExpire', (connection: RtcConnection, token: string) => {
      console.warn('⚠️ Token will expire, refreshing...');
      this.refreshToken(connection.channelId);
    });
  }

  /**
   * Start a live stream as host
   * Integrates with SnapConnect's auth and database
   */
  async startStream(params: StartStreamParams): Promise<void> {
    try {
      if (!this.isInitialized) await this.initializeEngine();
      if (!this.engine) throw new Error('Agora engine not initialized');

      console.log('🎥 Starting live stream:', params.channelName);
      
      // Set client role to broadcaster (host)
      await this.engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      this.currentRole = ClientRoleType.ClientRoleBroadcaster;
      
      // Get Agora credentials
      const credentials: AgoraCredentials = await agoraAuthService.generateHostToken(
        params.channelName,
        params.userId
      );
      
      // Apply quality settings
      await this.applyQualitySettings(params.quality || 'medium');
      
      // Join channel
      await this.engine.joinChannel(
        credentials.token,
        params.channelName,
        credentials.uid,
        {
          autoSubscribeAudio: true,
          autoSubscribeVideo: true,
          publishMicrophoneTrack: true,
          publishCameraTrack: true,
        }
      );
      
      this.currentChannel = params.channelName;
      
      // Update store state
      useLiveStreamStore.setState({
        isStreaming: true,
        connectionState: 'connecting',
        currentChannelName: params.channelName,
        currentAgoraUID: credentials.uid,
        currentAgoraToken: credentials.token,
      });
      
      console.log('✅ Live stream started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start stream:', error);
      useLiveStreamStore.getState().setError(`Failed to start stream: ${error.message}`);
      throw error;
    }
  }

  /**
   * Join an existing stream as viewer
   */
  async joinStreamAsViewer(params: JoinStreamParams): Promise<void> {
    try {
      if (!this.isInitialized) await this.initializeEngine();
      if (!this.engine) throw new Error('Agora engine not initialized');

      console.log('👀 Joining stream as viewer:', params.channelName);
      
      // Set client role to audience (viewer)
      await this.engine.setClientRole(ClientRoleType.ClientRoleAudience);
      this.currentRole = ClientRoleType.ClientRoleAudience;
      
      // Get viewer token
      const credentials: AgoraCredentials = await agoraAuthService.generateViewerToken(
        params.channelName,
        params.userId
      );
      
      // Join channel
      await this.engine.joinChannel(
        credentials.token,
        params.channelName,
        credentials.uid,
        {
          autoSubscribeAudio: true,
          autoSubscribeVideo: true,
          publishMicrophoneTrack: false,
          publishCameraTrack: false,
        }
      );
      
      this.currentChannel = params.channelName;
      
      // Update store state
      useLiveStreamStore.setState({
        connectionState: 'connecting',
        currentChannelName: params.channelName,
        currentAgoraUID: credentials.uid,
        currentAgoraToken: credentials.token,
      });
      
      console.log('✅ Joined stream as viewer successfully');
      
    } catch (error) {
      console.error('❌ Failed to join stream:', error);
      useLiveStreamStore.getState().setError(`Failed to join stream: ${error.message}`);
      throw error;
    }
  }

  /**
   * Promote viewer to co-host
   */
  async promoteToCoHost(uid: number): Promise<void> {
    try {
      if (!this.engine) throw new Error('Agora engine not initialized');
      
      // Change role to broadcaster
      await this.engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      this.currentRole = ClientRoleType.ClientRoleBroadcaster;
      
      // Enable publishing
      await this.engine.muteLocalVideoStream(false);
      await this.engine.muteLocalAudioStream(false);
      
      console.log('✅ Promoted to co-host successfully');
      
    } catch (error) {
      console.error('❌ Failed to promote to co-host:', error);
      throw error;
    }
  }

  /**
   * Leave current stream
   */
  async leaveStream(): Promise<void> {
    try {
      if (!this.engine || !this.currentChannel) return;
      
      console.log('🚪 Leaving stream:', this.currentChannel);
      
      await this.engine.leaveChannel();
      
      this.currentChannel = null;
      this.currentRole = null;
      
      // Update store state
      useLiveStreamStore.setState({
        isStreaming: false,
        connectionState: 'disconnected',
        currentChannelName: null,
        currentAgoraUID: null,
        currentAgoraToken: null,
      });
      
      console.log('✅ Left stream successfully');
      
    } catch (error) {
      console.error('❌ Failed to leave stream:', error);
      throw error;
    }
  }

  /**
   * Toggle local video on/off
   * Following camera interface patterns
   */
  async toggleLocalVideo(): Promise<void> {
    try {
      if (!this.engine) return;
      
      const { localVideoEnabled } = useLiveStreamStore.getState();
      await this.engine.muteLocalVideoStream(localVideoEnabled);
      
      useLiveStreamStore.setState({ localVideoEnabled: !localVideoEnabled });
      
      console.log(`📹 Local video ${localVideoEnabled ? 'disabled' : 'enabled'}`);
      
    } catch (error) {
      console.error('❌ Failed to toggle video:', error);
      throw error;
    }
  }

  /**
   * Toggle local audio on/off
   */
  async toggleLocalAudio(): Promise<void> {
    try {
      if (!this.engine) return;
      
      const { localAudioEnabled } = useLiveStreamStore.getState();
      await this.engine.muteLocalAudioStream(localAudioEnabled);
      
      useLiveStreamStore.setState({ localAudioEnabled: !localAudioEnabled });
      
      console.log(`🎤 Local audio ${localAudioEnabled ? 'disabled' : 'enabled'}`);
      
    } catch (error) {
      console.error('❌ Failed to toggle audio:', error);
      throw error;
    }
  }

  /**
   * Switch camera (front/back)
   */
  async switchCamera(): Promise<void> {
    try {
      if (!this.engine) return;
      
      await this.engine.switchCamera();
      console.log('📱 Camera switched');
      
    } catch (error) {
      console.error('❌ Failed to switch camera:', error);
      throw error;
    }
  }

  /**
   * Apply quality settings based on selection
   */
  private async applyQualitySettings(quality: 'low' | 'medium' | 'high'): Promise<void> {
    if (!this.engine) return;

    const qualitySettings = {
      low: {
        width: 480,
        height: 640,
        frameRate: 15,
        bitrate: 400,
      },
      medium: {
        width: 720,
        height: 1280,
        frameRate: 24,
        bitrate: 1000,
      },
      high: {
        width: 1080,
        height: 1920,
        frameRate: 30,
        bitrate: 2000,
      },
    };

    const settings = qualitySettings[quality];
    
    await this.engine.setVideoEncoderConfiguration({
      dimensions: { width: settings.width, height: settings.height },
      frameRate: settings.frameRate,
      bitrate: settings.bitrate,
      minBitrate: Math.floor(settings.bitrate * 0.5),
      orientationMode: 0, // Adaptive
      degradationPreference: 1, // Maintain framerate
      mirrorMode: 0, // Auto
    });
  }

  /**
   * Refresh Agora token when about to expire
   */
  private async refreshToken(channelName: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { myRole } = useLiveStreamStore.getState();
      const role = myRole === 'host' ? 'host' : 'audience';
      
      const credentials = await agoraAuthService.generateToken({
        channelName,
        role,
        userId: user.id,
      });
      
      await this.engine?.renewToken(credentials.token);
      
      useLiveStreamStore.setState({
        currentAgoraToken: credentials.token,
        tokenExpiresAt: credentials.expiresAt,
      });
      
      console.log('✅ Token refreshed successfully');
      
    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
    }
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: StreamingCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Destroy engine and cleanup
   */
  async destroy(): Promise<void> {
    try {
      if (this.currentChannel) {
        await this.leaveStream();
      }
      
      if (this.engine) {
        await this.engine.release();
        this.engine = null;
      }
      
      this.isInitialized = false;
      this.callbacks = {};
      
      console.log('✅ Agora engine destroyed');
      
    } catch (error) {
      console.error('❌ Failed to destroy engine:', error);
    }
  }

  /**
   * Get current engine instance
   */
  getEngine(): IRtcEngine | null {
    return this.engine;
  }

  /**
   * Check if currently streaming
   */
  isCurrentlyStreaming(): boolean {
    return this.currentChannel !== null && this.currentRole === ClientRoleType.ClientRoleBroadcaster;
  }

  /**
   * Check if currently viewing a stream
   */
  isCurrentlyViewing(): boolean {
    return this.currentChannel !== null && this.currentRole === ClientRoleType.ClientRoleAudience;
  }

}

// Create singleton instance
export const liveStreamService = new LiveStreamService();

// Export for use in components
export default liveStreamService;

/*
Example usage:

import liveStreamService from '../services/liveStreamService';
import { useLiveStreamStore } from '../stores/liveStreamStore';

// In a component:
const { user } = useAuthStore();
const { currentStream } = useLiveStreamStore();

// Start streaming
await liveStreamService.startStream({
  channelName: 'my_stream_123',
  userId: user.id,
  title: 'Morning Workout',
  quality: 'medium'
});

// Join as viewer
await liveStreamService.joinStreamAsViewer({
  channelName: 'existing_stream_456',
  userId: user.id,
  role: 'audience'
});

// Toggle controls
await liveStreamService.toggleLocalVideo();
await liveStreamService.toggleLocalAudio();
await liveStreamService.switchCamera();
*/