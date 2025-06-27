import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  Pressable, 
  Alert, 
  SafeAreaView, 
  Dimensions, 
  StatusBar,
  ActivityIndicator,
  TextInput 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { 
  RtcSurfaceView, 
  VideoViewSetupMode,
  VideoSourceType,
  RenderModeType 
} from 'react-native-agora';
import { useAuthStore } from '../stores/authStore';
import { useLiveStreamStore } from '../stores/liveStreamStore';
import liveStreamService from '../services/liveStreamService';

const { width, height } = Dimensions.get('window');

interface LiveStreamingScreenProps {
  mode: 'host' | 'viewer';
  streamId?: string;
}

export const LiveStreamingScreen = () => {
  const params = useLocalSearchParams();
  const { user } = useAuthStore();
  const {
    currentStream,
    myRole,
    connectionState,
    localVideoEnabled,
    localAudioEnabled,
    createStream,
    joinStream,
    leaveStream,
  } = useLiveStreamStore();

  const [isLoading, setIsLoading] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<number[]>([]);

  const mode = params.mode as 'host' | 'viewer';
  const streamId = params.streamId as string;

  useEffect(() => {
    if (mode === 'host' && !streamId) {
      // Show create stream modal for new hosts
      setShowCreateModal(true);
    } else if (mode === 'viewer' && streamId) {
      // Join existing stream as viewer
      handleJoinAsViewer();
    }

    // Setup Agora event callbacks
    liveStreamService.setCallbacks({
      onUserJoined: (connection, uid) => {
        console.log('👤 User joined:', uid);
        setRemoteUsers(prev => [...prev, uid]);
      },
      onUserOffline: (connection, uid) => {
        console.log('👤 User left:', uid);
        setRemoteUsers(prev => prev.filter(id => id !== uid));
      },
      onConnectionStateChanged: (connection, state, reason) => {
        console.log('🔗 Connection changed:', state, reason);
      },
      onError: (error) => {
        console.error('❌ Agora error:', error);
        Alert.alert('Streaming Error', error);
      }
    });

    return () => {
      // Cleanup when leaving - don't navigate during unmount
      liveStreamService.leaveStream().catch(console.error);
      leaveStream().catch(console.error);
    };
  }, [mode, streamId]);

  const handleCreateStream = async (title: string, description?: string) => {
    if (!user) {
      Alert.alert('Authentication Error', 'Please sign in to start streaming.');
      return;
    }
    
    setIsLoading(true);
    try {
      // Check authentication before proceeding
      const { agoraAuthService } = await import('../services/agoraAuthService');
      if (!agoraAuthService.isConfigured()) {
        Alert.alert('Configuration Error', 'Live streaming is not configured. Please contact support.');
        return;
      }

      console.log('🎥 Creating stream for user:', user.id);

      // Create stream in database
      const stream = await createStream({
        title,
        description,
        quality: 'medium'
      });

      console.log('📊 Stream created in database:', stream.id);

      // Verify session before starting Agora streaming
      console.log('🔍 Verifying session before Agora call...');
      const { supabase } = await import('../services/supabase');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('📊 Pre-Agora session check:');
      console.log('  - Session exists:', !!session);
      console.log('  - Session user:', session?.user?.id);
      console.log('  - Access token exists:', !!session?.access_token);
      
      if (!session || !session.user) {
        throw new Error('Session lost before starting Agora stream. Please try again.');
      }

      // Start Agora streaming
      await liveStreamService.startStream({
        channelName: stream.agora_channel_name,
        userId: user.id,
        title,
        description,
        quality: 'medium'
      });

      setShowCreateModal(false);
      console.log('✅ Stream created and started successfully');
      
    } catch (error) {
      console.error('❌ Failed to create stream:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (errorMessage.includes('authenticated')) {
        Alert.alert('Authentication Error', 'Please sign out and sign back in to start streaming.');
      } else if (errorMessage.includes('configured')) {
        Alert.alert('Configuration Error', 'Live streaming is not available at this time.');
      } else {
        Alert.alert('Stream Error', 'Failed to start streaming. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinAsViewer = async () => {
    if (!user || !streamId) return;
    
    setIsLoading(true);
    try {
      // Join stream in database
      await joinStream({
        streamId,
        role: 'viewer'
      });

      // Join Agora channel as viewer
      if (currentStream) {
        await liveStreamService.joinStreamAsViewer({
          channelName: currentStream.agora_channel_name,
          userId: user.id,
          role: 'audience'
        });
      }

      console.log('✅ Joined stream as viewer');
      
    } catch (error) {
      console.error('❌ Failed to join stream:', error);
      Alert.alert('Join Error', 'Failed to join stream. Please try again.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveStream = async () => {
    try {
      await liveStreamService.leaveStream();
      await leaveStream();
      
      // Use router.replace instead of router.back to avoid navigation issues
      router.replace('/(tabs)/clique');
    } catch (error) {
      console.error('❌ Failed to leave stream:', error);
      // Even if leaving fails, still navigate back
      router.replace('/(tabs)/clique');
    }
  };

  const handleToggleVideo = async () => {
    try {
      await liveStreamService.toggleLocalVideo();
    } catch (error) {
      console.error('❌ Failed to toggle video:', error);
    }
  };

  const handleToggleAudio = async () => {
    try {
      await liveStreamService.toggleLocalAudio();
    } catch (error) {
      console.error('❌ Failed to toggle audio:', error);
    }
  };

  const handleSwitchCamera = async () => {
    try {
      await liveStreamService.switchCamera();
    } catch (error) {
      console.error('❌ Failed to switch camera:', error);
    }
  };

  const renderLocalVideo = () => {
    // Don't show picture-in-picture if:
    // 1. User is a viewer
    // 2. Host is alone (no remote users) - they see full screen instead
    if (mode === 'viewer' || (mode === 'host' && remoteUsers.length === 0)) {
      return null;
    }

    return (
      <View className="absolute top-20 right-4 w-24 h-32 rounded-lg overflow-hidden bg-black">
        <RtcSurfaceView
          canvas={{
            uid: 0, // 0 for local user
            sourceType: VideoSourceType.VideoSourceCamera,
            setupMode: VideoViewSetupMode.VideoViewSetupReplace,
            renderMode: RenderModeType.RenderModeHidden,
          }}
          style={{ flex: 1 }}
        />
        <View className="absolute top-1 left-1 bg-black/50 px-1 rounded">
          <Text className="text-white text-xs">You</Text>
        </View>
      </View>
    );
  };

  const renderRemoteVideo = (uid: number, index: number) => (
    <View key={uid} className="flex-1 bg-black rounded-lg overflow-hidden">
      <RtcSurfaceView
        canvas={{
          uid,
          sourceType: VideoSourceType.VideoSourceRemote,
          setupMode: VideoViewSetupMode.VideoViewSetupReplace,
          renderMode: RenderModeType.RenderModeHidden,
        }}
        style={{ flex: 1 }}
      />
      <View className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded">
        <Text className="text-white text-xs">User {uid}</Text>
      </View>
    </View>
  );

  const renderStreamingControls = () => (
    <View className="absolute bottom-0 left-0 right-0 pb-8">
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        className="pt-8 pb-4"
      >
        <View className="flex-row justify-center items-center space-x-6">
          {/* Video Toggle */}
          {mode !== 'viewer' && (
            <Pressable
              onPress={handleToggleVideo}
              className={`w-12 h-12 rounded-full items-center justify-center ${
                localVideoEnabled ? 'bg-white/20' : 'bg-red-500'
              }`}
            >
              <Text className="text-white text-lg">
                {localVideoEnabled ? '📹' : '🚫'}
              </Text>
            </Pressable>
          )}

          {/* Audio Toggle */}
          {mode !== 'viewer' && (
            <Pressable
              onPress={handleToggleAudio}
              className={`w-12 h-12 rounded-full items-center justify-center ${
                localAudioEnabled ? 'bg-white/20' : 'bg-red-500'
              }`}
            >
              <Text className="text-white text-lg">
                {localAudioEnabled ? '🎤' : '🔇'}
              </Text>
            </Pressable>
          )}

          {/* Camera Switch */}
          {mode !== 'viewer' && (
            <Pressable
              onPress={handleSwitchCamera}
              className="w-12 h-12 rounded-full items-center justify-center bg-white/20"
            >
              <Text className="text-white text-lg">🔄</Text>
            </Pressable>
          )}

          {/* End Stream */}
          <Pressable
            onPress={handleLeaveStream}
            className="w-12 h-12 rounded-full items-center justify-center bg-red-500"
          >
            <Text className="text-white text-lg">📞</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );

  const renderConnectionStatus = () => (
    <View className="absolute top-16 left-4 bg-black/50 px-3 py-1 rounded-full">
      <View className="flex-row items-center">
        <View className={`w-2 h-2 rounded-full mr-2 ${
          connectionState === 'connected' ? 'bg-green-500' :
          connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
        }`} />
        <Text className="text-white text-xs capitalize">
          {connectionState}
        </Text>
      </View>
    </View>
  );

  const renderCreateStreamModal = () => {
    if (!showCreateModal) return null;

    return (
      <View className="absolute inset-0 bg-black/80 items-center justify-center">
        <View className="bg-white/10 backdrop-blur-lg p-6 rounded-lg mx-4 w-80">
          <Text className="text-white text-xl font-bold mb-4 text-center">
            Start Live Stream
          </Text>
          
          <TextInput
            placeholder="Stream title..."
            placeholderTextColor="#888"
            value={streamTitle}
            onChangeText={setStreamTitle}
            className="bg-white/20 text-white p-3 rounded-lg mb-4"
            maxLength={50}
          />
          
          <View className="flex-row space-x-3">
            <Pressable
              onPress={() => setShowCreateModal(false)}
              className="flex-1 bg-gray-500 p-3 rounded-lg"
            >
              <Text className="text-white text-center font-semibold">Cancel</Text>
            </Pressable>
            
            <Pressable
              onPress={() => handleCreateStream(streamTitle || 'Untitled Stream')}
              disabled={isLoading}
              className="flex-1 bg-red-500 p-3 rounded-lg"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-center font-semibold">Go Live</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading && !showCreateModal) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#EC4899" />
        <Text className="text-white mt-4">
          {mode === 'host' ? 'Starting stream...' : 'Joining stream...'}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" />
      
      {/* Main Video Area */}
      <View className="flex-1">
        {remoteUsers.length === 0 ? (
          // No remote users - show host's local video full screen or waiting state for viewers
          mode === 'host' ? (
            <View className="flex-1">
              {/* Full screen local video for host */}
              <RtcSurfaceView
                canvas={{
                  uid: 0, // 0 for local user
                  sourceType: VideoSourceType.VideoSourceCamera,
                  setupMode: VideoViewSetupMode.VideoViewSetupReplace,
                  renderMode: RenderModeType.RenderModeFit,
                }}
                style={{ flex: 1 }}
              />
              {/* Overlay text for host */}
              <View className="absolute inset-0 items-center justify-center pointer-events-none">
                <View className="bg-black/30 px-4 py-2 rounded-lg">
                  <Text className="text-white text-lg font-semibold mb-1">
                    You're Live! 🔴
                  </Text>
                  <Text className="text-white/80 text-center">
                    Waiting for viewers to join...
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            // Viewer waiting state
            <View className="flex-1 items-center justify-center">
              <Text className="text-white text-6xl mb-4">📺</Text>
              <Text className="text-white text-xl font-bold mb-2">Connecting...</Text>
              <Text className="text-white/70 text-center px-8">
                Connecting to the live stream...
              </Text>
            </View>
          )
        ) : (
          // Show remote users
          <View className="flex-1 p-2">
            {remoteUsers.length === 1 ? (
              // Single user - full screen
              renderRemoteVideo(remoteUsers[0], 0)
            ) : (
              // Multiple users - grid
              <View className="flex-1">
                <View className="flex-1 flex-row mb-2">
                  {renderRemoteVideo(remoteUsers[0], 0)}
                  {remoteUsers[1] && (
                    <View className="ml-2 flex-1">
                      {renderRemoteVideo(remoteUsers[1], 1)}
                    </View>
                  )}
                </View>
                {remoteUsers.length > 2 && (
                  <View className="flex-1 flex-row">
                    {remoteUsers.slice(2, 4).map((uid, index) => (
                      <View key={uid} className={`flex-1 ${index > 0 ? 'ml-2' : ''}`}>
                        {renderRemoteVideo(uid, index + 2)}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Local Video (Picture-in-Picture) */}
      {renderLocalVideo()}

      {/* Connection Status */}
      {renderConnectionStatus()}

      {/* Stream Info */}
      {currentStream && (
        <View className="absolute top-16 right-4 bg-black/50 px-3 py-1 rounded-lg max-w-48">
          <Text className="text-white text-sm font-semibold" numberOfLines={1}>
            {currentStream.title}
          </Text>
          <Text className="text-white/70 text-xs">
            {currentStream.viewer_count} viewers
          </Text>
        </View>
      )}

      {/* Streaming Controls */}
      {renderStreamingControls()}

      {/* Create Stream Modal */}
      {renderCreateStreamModal()}
    </View>
  );
};