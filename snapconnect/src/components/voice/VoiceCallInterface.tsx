/**
 * Voice Call Interface - Phone Call Style UI for Coach Alex
 * 📞 Natural voice call experience with automatic conversation flow
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { pychatVoiceService, VoiceSession, VoiceStreamMessage } from '../../services/pychatVoiceService';
import { useAuthStore } from '../../stores/authStore';

interface VoiceCallInterfaceProps {
  visible: boolean;
  onClose: () => void;
  workoutContext?: any;
}

type CallState = 'dialing' | 'connected' | 'speaking' | 'listening' | 'thinking' | 'ending';

export const VoiceCallInterface: React.FC<VoiceCallInterfaceProps> = ({
  visible,
  onClose,
  workoutContext
}) => {
  // Call state
  const [callState, setCallState] = useState<CallState>('dialing');
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [lastTranscript, setLastTranscript] = useState('');
  const [coachMessage, setCoachMessage] = useState('');

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  // Timer for call duration
  const callTimer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<Date | null>(null);

  const { user } = useAuthStore();

  // Initialize call when modal opens
  useEffect(() => {
    if (visible && user) {
      startCall();
    } else if (!visible) {
      endCall();
    }

    return () => {
      if (callTimer.current) {
        clearInterval(callTimer.current);
      }
    };
  }, [visible, user]);

  // Call duration timer
  useEffect(() => {
    if (callState === 'connected') {
      startTime.current = new Date();
      callTimer.current = setInterval(() => {
        if (startTime.current) {
          const duration = Math.floor((new Date().getTime() - startTime.current.getTime()) / 1000);
          setCallDuration(duration);
        }
      }, 1000);
    }

    return () => {
      if (callTimer.current) {
        clearInterval(callTimer.current);
      }
    };
  }, [callState]);

  // Animations
  useEffect(() => {
    if (visible) {
      // Entry animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();
    }

    // State-based animations
    if (callState === 'dialing') {
      startDialingAnimation();
    } else if (callState === 'speaking' || callState === 'listening') {
      startConversationAnimation();
    } else {
      stopAllAnimations();
    }
  }, [visible, callState]);

  const startCall = useCallback(async () => {
    try {
      console.log('📞 Starting voice call with Coach Alex...');
      setCallState('dialing');

      // Connect directly
      const newSession = await pychatVoiceService.startVoiceSession(workoutContext);
      setSession(newSession);

      // Register message handlers
      pychatVoiceService.onMessage('voiceCall', handleVoiceMessage);

      setCallState('connected');
      
      // Send greeting
      setTimeout(() => {
        pychatVoiceService.sendTextMessage("Hello! I'm Coach Alex, ready to help with your fitness goals today!");
      }, 1000);

    } catch (error) {
      console.error('❌ Voice call failed:', error);
      setCallState('ending');
      setTimeout(onClose, 1000);
    }
  }, [workoutContext, onClose]);

  const endCall = useCallback(async () => {
    console.log('📞 Ending voice call...');
    setCallState('ending');

    // Stop session
    if (session) {
      try {
        await pychatVoiceService.endSession();
      } catch (error) {
        console.error('Error ending session:', error);
      }
    }

    // Unregister handlers
    pychatVoiceService.offMessage('voiceCall');

    // Close modal after animation
    setTimeout(() => {
      setSession(null);
      setCallState('dialing');
      setCallDuration(0);
      setLastTranscript('');
      setCoachMessage('');
      onClose();
    }, 1000);
  }, [session, onClose]);

  const handleVoiceMessage = useCallback((message: VoiceStreamMessage) => {
    console.log('📞 Voice call message:', message.type);

    switch (message.type) {
      case 'transcript':
        setLastTranscript(message.data.transcript || '');
        setCallState('thinking');
        break;

      case 'response':
        setCoachMessage(message.data.text || '');
        setCallState('speaking');
        
        // Auto-transition to listening after speaking
        setTimeout(() => {
          setCallState('listening');
        }, (message.data.text?.length || 50) * 60); // Estimate speaking time
        break;

      case 'status':
        if (message.data.error) {
          console.error('Voice call error:', message.data.error);
          endCall();
        }
        break;
    }
  }, [endCall]);

  // Animation functions
  const startDialingAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startConversationAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
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

  const stopAllAnimations = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const formatCallDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallStateText = (): string => {
    switch (callState) {
      case 'dialing': return 'Calling Coach Alex...';
      case 'connected': return 'Connected';
      case 'speaking': return 'Coach Alex is speaking';
      case 'listening': return 'Listening...';
      case 'thinking': return 'Coach Alex is thinking...';
      case 'ending': return 'Call ending...';
      default: return '';
    }
  };

  const getCallStateColor = (): string => {
    switch (callState) {
      case 'dialing': return '#FF9800';
      case 'connected': return '#4CAF50';
      case 'speaking': return '#2196F3';
      case 'listening': return '#4CAF50';
      case 'thinking': return '#FF9800';
      case 'ending': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={endCall}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.8)" />
      
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        
        <Animated.View 
          style={[
            styles.callContainer,
            {
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          {/* Coach Alex Avatar */}
          <View style={styles.avatarContainer}>
            <Animated.View
              style={[
                styles.avatarOuter,
                {
                  transform: [{ scale: pulseAnim }],
                  backgroundColor: getCallStateColor(),
                }
              ]}
            >
              <LinearGradient
                colors={['#7C3AED', '#EC4899']}
                style={styles.avatarInner}
              >
                <Text style={styles.avatarText}>🏋️</Text>
              </LinearGradient>
            </Animated.View>
          </View>

          {/* Coach Info */}
          <View style={styles.coachInfo}>
            <Text style={styles.coachName}>Coach Alex</Text>
            <Text style={styles.coachTitle}>Your AI Fitness Coach</Text>
          </View>

          {/* Call Status */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusIndicator, { backgroundColor: getCallStateColor() }]} />
            <Text style={styles.statusText}>{getCallStateText()}</Text>
          </View>

          {/* Call Duration */}
          {callState === 'connected' || callState === 'speaking' || callState === 'listening' || callState === 'thinking' ? (
            <Text style={styles.durationText}>{formatCallDuration(callDuration)}</Text>
          ) : null}

          {/* Conversation Display */}
          <View style={styles.conversationContainer}>
            {lastTranscript && (
              <View style={styles.transcriptBubble}>
                <Text style={styles.transcriptLabel}>You said:</Text>
                <Text style={styles.transcriptText}>{lastTranscript}</Text>
              </View>
            )}
            
            {coachMessage && (
              <View style={styles.responseBubble}>
                <Text style={styles.responseLabel}>Coach Alex:</Text>
                <Text style={styles.responseText}>{coachMessage}</Text>
              </View>
            )}
          </View>

          {/* Call Controls */}
          <View style={styles.controlsContainer}>
            {/* Hang Up Button */}
            <TouchableOpacity
              onPress={endCall}
              style={styles.hangUpButton}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#F44336', '#D32F2F']}
                style={styles.hangUpGradient}
              >
                <Ionicons name="call" size={32} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Call Tips */}
          {(callState === 'listening' || callState === 'connected') && (
            <Text style={styles.tipText}>
              💡 Just speak naturally - Coach Alex can hear you
            </Text>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callContainer: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarContainer: {
    marginBottom: 24,
  },
  avatarOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  avatarInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 48,
  },
  coachInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  coachName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  coachTitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
  durationText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginBottom: 24,
  },
  conversationContainer: {
    width: '100%',
    maxHeight: 200,
    marginBottom: 32,
  },
  transcriptBubble: {
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.3)',
  },
  transcriptLabel: {
    fontSize: 12,
    color: 'rgba(33, 150, 243, 1)',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 14,
    color: 'white',
  },
  responseBubble: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  responseLabel: {
    fontSize: 12,
    color: 'rgba(76, 175, 80, 1)',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 14,
    color: 'white',
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  hangUpButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  hangUpGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default VoiceCallInterface;