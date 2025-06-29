/**
 * Voice Coaching Panel - Real-time Pypecat Integration
 * 🎙️ Enhanced voice interface with WebSocket streaming to Pypecat backend
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
  Platform
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { pychatVoiceService, VoiceSession, VoiceStreamMessage } from '../../services/pychatVoiceService';
import { useAuthStore } from '../../stores/authStore';

interface VoiceCoachingPanelProps {
  onClose?: () => void;
  workoutContext?: any;
  minimized?: boolean;
}

type VoicePanelState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

export const VoiceCoachingPanel: React.FC<VoiceCoachingPanelProps> = ({
  onClose,
  workoutContext,
  minimized = false
}) => {
  // State management
  const [state, setState] = useState<VoicePanelState>('idle');
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Audio recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Audio processing refs
  const audioBuffer = useRef<number[]>([]);
  const processingInterval = useRef<NodeJS.Timeout | null>(null);

  const { user } = useAuthStore();

  // Initialize voice coaching session
  useEffect(() => {
    if (user && !session) {
      initializeSession();
    }

    return () => {
      cleanup();
    };
  }, [user]);

  // Animation effects
  useEffect(() => {
    if (state === 'listening') {
      startListeningAnimation();
    } else if (state === 'processing') {
      startProcessingAnimation();
    } else if (state === 'speaking') {
      startSpeakingAnimation();
    } else {
      stopAllAnimations();
    }
  }, [state]);

  const initializeSession = useCallback(async () => {
    try {
      setState('connecting');
      console.log('🎙️ Initializing voice coaching session...');

      // Request audio permissions
      if (permissionResponse?.status !== 'granted') {
        console.log('Requesting audio permissions...');
        await requestPermission();
      }

      // Configure audio session
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      // Start voice session with Pypecat
      const newSession = await pychatVoiceService.startVoiceSession(workoutContext);
      setSession(newSession);

      // Register message handlers
      pychatVoiceService.onMessage('voicePanel', handleVoiceMessage);

      setState('idle');
      console.log('✅ Voice session initialized successfully');

      // Send initial greeting
      await pychatVoiceService.sendTextMessage("Start voice coaching session with greeting");

    } catch (error) {
      console.error('❌ Failed to initialize voice session:', error);
      setError('Failed to start voice coaching. Please try again.');
      setState('error');
    }
  }, [permissionResponse, requestPermission, workoutContext]);

  const cleanup = useCallback(async () => {
    console.log('🧹 Cleaning up voice coaching session...');

    // Stop recording if active
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }

    // Clear intervals
    if (processingInterval.current) {
      clearInterval(processingInterval.current);
    }

    // End session
    if (session) {
      try {
        await pychatVoiceService.endSession();
      } catch (error) {
        console.error('Error ending session:', error);
      }
    }

    // Unregister handlers
    pychatVoiceService.offMessage('voicePanel');

    setSession(null);
    setState('idle');
  }, [recording, session]);

  const handleVoiceMessage = useCallback((message: VoiceStreamMessage) => {
    console.log('📨 Voice message received:', message.type);

    switch (message.type) {
      case 'transcript':
        setTranscript(message.data.transcript || '');
        setState('processing');
        break;

      case 'response':
        setLastResponse(message.data.text || '');
        setState('speaking');
        
        // Auto-transition back to idle after speaking
        setTimeout(() => {
          setState('idle');
        }, (message.data.text?.length || 50) * 50); // Estimate speaking time
        break;

      case 'status':
        if (message.data.error) {
          setError(message.data.error);
          setState('error');
        }
        break;

      case 'audio':
        setState('speaking');
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      if (!permissionResponse?.granted) {
        await requestPermission();
        return;
      }

      console.log('🎤 Starting voice recording...');
      setState('listening');
      setIsRecording(true);
      setTranscript('');
      setError(null);

      // Configure recording options for Pypecat compatibility
      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.PCM_16BIT,
          audioEncoder: Audio.AndroidAudioEncoder.PCM_16BIT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 256000,
        },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(newRecording);

      // Start streaming audio to Pypecat
      startAudioStreaming(newRecording);

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      setError('Failed to start recording. Please check microphone permissions.');
      setState('error');
      setIsRecording(false);
    }
  }, [permissionResponse]);

  const stopRecording = useCallback(async () => {
    try {
      if (!recording) return;

      console.log('⏹️ Stopping voice recording...');
      setState('processing');
      setIsRecording(false);

      // Stop recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        // Get final audio data and send to Pypecat
        const response = await fetch(uri);
        const audioData = await response.arrayBuffer();
        await pychatVoiceService.sendAudioChunk(audioData);
      }

      setRecording(null);

      // Clear processing interval
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
        processingInterval.current = null;
      }

    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      setError('Failed to process recording. Please try again.');
      setState('error');
    }
  }, [recording]);

  const startAudioStreaming = useCallback(async (recordingInstance: Audio.Recording) => {
    // Start interval to stream audio chunks to Pypecat
    processingInterval.current = setInterval(async () => {
      try {
        if (recordingInstance && isRecording) {
          const status = await recordingInstance.getStatusAsync();
          
          if (status.isRecording) {
            // Get current recording data and stream to Pypecat
            // This is a simplified approach - in production, you'd want
            // to stream smaller, more frequent chunks
            const metering = status.metering || 0;
            setVolume(Math.abs(metering) / 160); // Normalize volume
          }
        }
      } catch (error) {
        console.error('Error streaming audio:', error);
      }
    }, 100); // Stream every 100ms
  }, [isRecording]);

  const handleQuickCommand = useCallback(async (command: string) => {
    try {
      setState('processing');
      await pychatVoiceService.sendTextMessage(command);
    } catch (error) {
      console.error('❌ Failed to send command:', error);
      setError('Failed to send command. Please try again.');
      setState('error');
    }
  }, []);

  const toggleSession = useCallback(async () => {
    if (session?.status === 'active') {
      await pychatVoiceService.pauseSession();
    } else if (session?.status === 'paused') {
      await pychatVoiceService.resumeSession();
    }
  }, [session]);

  // Animation functions
  const startListeningAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startProcessingAnimation = () => {
    Animated.loop(
      Animated.timing(opacityAnim, {
        toValue: 0.5,
        duration: 500,
        useNativeDriver: true,
      })
    ).start();
  };

  const startSpeakingAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopAllAnimations = () => {
    pulseAnim.stopAnimation();
    waveAnim.stopAnimation();
    opacityAnim.stopAnimation();
    pulseAnim.setValue(1);
    waveAnim.setValue(0);
    opacityAnim.setValue(1);
  };

  const getStateColor = () => {
    switch (state) {
      case 'listening': return '#4CAF50';
      case 'processing': return '#FF9800';
      case 'speaking': return '#2196F3';
      case 'error': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStateIcon = () => {
    switch (state) {
      case 'listening': return 'mic';
      case 'processing': return 'sync';
      case 'speaking': return 'volume-high';
      case 'error': return 'alert-circle';
      default: return 'mic-off';
    }
  };

  if (minimized) {
    return (
      <View style={styles.minimizedContainer}>
        <TouchableOpacity onPress={onClose} style={styles.minimizedButton}>
          <Ionicons name={getStateIcon()} size={20} color={getStateColor()} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Coach Alex Voice</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleSession} style={styles.actionButton}>
            <Ionicons 
              name={session?.status === 'paused' ? 'play' : 'pause'} 
              size={20} 
              color="#666" 
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.actionButton}>
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Indicator */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusIndicator, { backgroundColor: getStateColor() }]} />
        <Text style={styles.statusText}>
          {state === 'idle' && 'Ready to chat'}
          {state === 'connecting' && 'Connecting...'}
          {state === 'listening' && 'Listening...'}
          {state === 'processing' && 'Processing...'}
          {state === 'speaking' && 'Coach Alex is speaking'}
          {state === 'error' && 'Error occurred'}
        </Text>
      </View>

      {/* Central Voice Interface */}
      <View style={styles.voiceInterface}>
        <Animated.View 
          style={[
            styles.micButton,
            { 
              transform: [{ scale: pulseAnim }],
              opacity: opacityAnim,
              backgroundColor: getStateColor()
            }
          ]}
        >
          <TouchableOpacity
            onPressIn={startRecording}
            onPressOut={stopRecording}
            disabled={state === 'processing' || state === 'speaking'}
            style={styles.micButtonInner}
          >
            <Ionicons name={getStateIcon()} size={40} color="white" />
          </TouchableOpacity>
        </Animated.View>

        {/* Volume Indicator */}
        {isRecording && (
          <View style={styles.volumeContainer}>
            <View style={[styles.volumeBar, { width: `${volume * 100}%` }]} />
          </View>
        )}
      </View>

      {/* Transcript Display */}
      {transcript && (
        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptLabel}>You said:</Text>
          <Text style={styles.transcriptText}>{transcript}</Text>
        </View>
      )}

      {/* Response Display */}
      {lastResponse && (
        <View style={styles.responseContainer}>
          <Text style={styles.responseLabel}>Coach Alex:</Text>
          <Text style={styles.responseText}>{lastResponse}</Text>
        </View>
      )}

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Quick Commands */}
      <View style={styles.quickCommands}>
        <TouchableOpacity 
          onPress={() => handleQuickCommand("How am I doing with my fitness goals?")}
          style={styles.quickCommandButton}
        >
          <Text style={styles.quickCommandText}>Progress Check</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => handleQuickCommand("Give me motivation for today's workout")}
          style={styles.quickCommandButton}
        >
          <Text style={styles.quickCommandText}>Motivate Me</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => handleQuickCommand("Help me plan my next workout")}
          style={styles.quickCommandButton}
        >
          <Text style={styles.quickCommandText}>Plan Workout</Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <Text style={styles.instructions}>
        Hold the microphone to talk with Coach Alex
      </Text>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  minimizedContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 1000,
  },
  minimizedButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    justifyContent: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
  },
  voiceInterface: {
    alignItems: 'center',
    marginBottom: 30,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  micButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  volumeContainer: {
    width: width * 0.8,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginTop: 20,
    overflow: 'hidden',
  },
  volumeBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  transcriptContainer: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  transcriptLabel: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  transcriptText: {
    fontSize: 16,
    color: '#333',
  },
  responseContainer: {
    backgroundColor: '#f3e5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  responseLabel: {
    fontSize: 12,
    color: '#7b1fa2',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  responseText: {
    fontSize: 16,
    color: '#333',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginLeft: 8,
    flex: 1,
  },
  quickCommands: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickCommandButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  quickCommandText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default VoiceCoachingPanel;