/**
 * Coach Alex Voice + Text Chat Screen
 * 🎙️ THE FUTURE OF FITNESS COACHING! 
 * Revolutionary voice-enabled AI coach with full behavioral context
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { voiceCoachService, VoiceChatMessage } from '../src/services/voiceCoachService';
import { supabase } from '../src/services/supabase';

const { width, height } = Dimensions.get('window');

interface ChatBubbleProps {
  message: VoiceChatMessage;
  isLatest: boolean;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isLatest }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const isUser = message.is_user_message;
  const isVoice = message.is_voice_message;

  useEffect(() => {
    if (isLatest) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [isLatest]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Animated.View 
      style={{
        transform: [{ scale: scaleAnim }],
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        marginVertical: 4,
        marginHorizontal: 16,
        maxWidth: width * 0.8,
      }}
    >
      <View
        style={{
          backgroundColor: isUser ? '#7C3AED' : '#F3F4F6',
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomRightRadius: isUser ? 4 : 20,
          borderBottomLeftRadius: isUser ? 20 : 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        {/* Voice indicator */}
        {isVoice && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 6,
          }}>
            <MaterialIcons 
              name="mic" 
              size={14} 
              color={isUser ? '#DDD6FE' : '#6B7280'} 
            />
            <Text style={{
              fontSize: 11,
              color: isUser ? '#DDD6FE' : '#6B7280',
              marginLeft: 4,
              fontWeight: '500',
            }}>
              Voice {message.audio_duration ? `• ${message.audio_duration}s` : ''}
            </Text>
          </View>
        )}

        {/* Message text */}
        <Text
          style={{
            color: isUser ? '#FFFFFF' : '#1F2937',
            fontSize: 16,
            lineHeight: 22,
            fontWeight: isUser ? '500' : '400',
          }}
          numberOfLines={isExpanded ? undefined : 10}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          {message.message_text}
        </Text>

        {/* Timestamp */}
        <Text
          style={{
            color: isUser ? '#DDD6FE' : '#9CA3AF',
            fontSize: 11,
            marginTop: 4,
            alignSelf: 'flex-end',
            fontWeight: '500',
          }}
        >
          {formatTime(message.created_at)}
        </Text>
      </View>

      {/* Coach Alex avatar for coach messages */}
      {!isUser && (
        <View
          style={{
            position: 'absolute',
            left: -8,
            bottom: 0,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#10B981',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' }}>
            🏃‍♂️
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

// Conversation state for natural flow
type ConversationState = 'ready' | 'listening' | 'processing' | 'speaking';

export default function CoachChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showVoiceHint, setShowVoiceHint] = useState(true);
  const [conversationState, setConversationState] = useState<ConversationState>('ready');
  
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recordingAnim = useRef(new Animated.Value(0)).current;

  // Initialize chat with greeting
  useFocusEffect(
    useCallback(() => {
      initializeChat();
      return () => {
        // Stop any ongoing speech when leaving screen
        voiceCoachService.stopSpeaking();
      };
    }, [])
  );

  const initializeChat = async () => {
    try {
      setIsInitializing(true);
      
      // Load conversation history
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const history = await voiceCoachService.getConversationHistory(user.id, 20);
      
      if (history.length === 0) {
        // Generate initial greeting for new conversation
        const greeting = await voiceCoachService.generateVoiceGreeting();
        setMessages([{
          id: `greeting_${Date.now()}`,
          user_id: user.id,
          message_text: greeting.text,
          is_user_message: false,
          is_voice_message: false,
          created_at: new Date().toISOString(),
        }]);
        setIsSpeaking(greeting.audioPlaying);
      } else {
        setMessages(history);
      }
    } catch (error) {
      console.error('Failed to initialize chat:', error);
      Alert.alert('Error', 'Failed to start conversation with Coach Alex');
    } finally {
      setIsInitializing(false);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Voice button pulse animation
  useEffect(() => {
    if (showVoiceHint) {
      const pulseLoop = () => {
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (showVoiceHint) pulseLoop();
        });
      };
      pulseLoop();
    }
  }, [showVoiceHint]);

  // Recording animation
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(recordingAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      recordingAnim.setValue(0);
    }
  }, [isRecording]);

  const sendTextMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    setInputText('');
    setIsLoading(true);
    setShowVoiceHint(false);

    // Add user message immediately
    const userMessageObj: VoiceChatMessage = {
      id: `user_${Date.now()}`,
      user_id: 'temp',
      message_text: userMessage,
      is_user_message: true,
      is_voice_message: false,
      created_at: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessageObj]);

    try {
      // Get Coach Alex response
      const response = await voiceCoachService.processVoiceMessage(userMessage, false);
      
      if (response.success) {
        const coachMessage: VoiceChatMessage = {
          id: `coach_${Date.now()}`,
          user_id: 'temp',
          message_text: response.text,
          is_user_message: false,
          is_voice_message: false,
          created_at: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, coachMessage]);
        setIsSpeaking(response.audioPlaying);
        
        // Haptic feedback for successful response
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const startVoiceRecording = async () => {
    try {
      // 🎯 INTERRUPTION: If Alex is speaking, interrupt him immediately
      if (isSpeaking || conversationState === 'speaking') {
        console.log('🛑 User interrupted Alex - stopping speech');
        voiceCoachService.stopSpeaking();
        setIsSpeaking(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Update conversation state
      setConversationState('listening');
      setIsRecording(true);
      setShowVoiceHint(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Start real speech-to-text recording
      const result = await voiceCoachService.startVoiceRecording();
      
      if (!result.success) {
        setIsRecording(false);
        Alert.alert('Voice Error', result.error || 'Could not start voice recording');
        return;
      }
      
      console.log('🎤 Voice recording started (Alex interrupted if speaking)');
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      Alert.alert('Voice Error', 'Could not start voice recording');
    }
  };

  const stopVoiceRecording = async () => {
    try {
      if (!isRecording) return;
      
      setConversationState('processing');
      setIsLoading(true);
      
      // Stop recording and get transcript
      const result = await voiceCoachService.stopVoiceRecording();
      setIsRecording(false);
      
      if (!result.success || !result.transcript.trim()) {
        setIsLoading(false);
        if (result.error) {
          Alert.alert('Voice Error', result.error);
        }
        return;
      }
      
      console.log(`🎤 Voice transcribed: "${result.transcript}" (${result.confidence}% confidence)`);
      
      // Add user voice message
      const userMessage: VoiceChatMessage = {
        id: `voice_user_${Date.now()}`,
        user_id: 'temp',
        message_text: result.transcript,
        is_user_message: true,
        is_voice_message: true,
        audio_duration: Math.round(result.duration),
        created_at: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // Get Coach Alex voice response
      const response = await voiceCoachService.processVoiceMessage(result.transcript, true);
      
      if (response.success) {
        const coachMessage: VoiceChatMessage = {
          id: `voice_coach_${Date.now()}`,
          user_id: 'temp',
          message_text: response.text,
          is_user_message: false,
          is_voice_message: true,
          created_at: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, coachMessage]);
        setIsSpeaking(response.audioPlaying);
        setConversationState(response.audioPlaying ? 'speaking' : 'ready');
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setConversationState('ready');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to process voice:', error);
      setIsRecording(false);
      setIsLoading(false);
      setConversationState('ready');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Voice Error', 'Failed to process voice message');
    }
  };

  const stopSpeaking = () => {
    voiceCoachService.stopSpeaking();
    setIsSpeaking(false);
    setConversationState('ready');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderMessage = ({ item, index }: { item: VoiceChatMessage; index: number }) => {
    return (
      <ChatBubble 
        message={item} 
        isLatest={index === messages.length - 1}
      />
    );
  };

  if (isInitializing) {
    return (
      <LinearGradient
        colors={['#7C3AED', '#EC4899']}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 18, marginTop: 16, fontWeight: '600' }}>
          Starting conversation with Coach Alex...
        </Text>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <LinearGradient
        colors={['#7C3AED', '#EC4899']}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.2)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={{ flex: 1, marginLeft: 16 }}
          onPress={isSpeaking ? stopSpeaking : undefined}
          activeOpacity={isSpeaking ? 0.7 : 1}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }}>
            Coach Alex
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: isSpeaking ? '#EF4444' : '#10B981', // Red when speaking
                marginRight: 6,
              }}
            />
            <Text style={{ color: '#DDD6FE', fontSize: 14 }}>
              {isSpeaking ? '🔊 Speaking... (Tap to stop)' : 'Voice & Text Ready'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Stop speaking button - More prominent when speaking */}
        {isSpeaking && (
          <TouchableOpacity
            onPress={stopSpeaking}
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: '#EF4444', // Red background for urgent stop
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <MaterialIcons name="stop" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={{ flex: 1, backgroundColor: '#F9FAFB' }}
        contentContainerStyle={{ paddingVertical: 16 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Voice hint */}
      {showVoiceHint && (
        <View
          style={{
            backgroundColor: '#EDE9FE',
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginHorizontal: 16,
            borderRadius: 12,
            marginBottom: 8,
          }}
        >
          <Text style={{ textAlign: 'center', color: '#7C3AED', fontWeight: '600' }}>
            🎙️ Tap and hold the mic to talk with Coach Alex!
          </Text>
        </View>
      )}

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Text input */}
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor="#9CA3AF"
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              maxHeight: 100,
              marginRight: 12,
            }}
            multiline
            onSubmitEditing={sendTextMessage}
            returnKeyType="send"
            editable={!isLoading && !isRecording}
          />

          {/* Voice button */}
          <Animated.View
            style={{
              transform: [{ scale: showVoiceHint ? pulseAnim : 1 }],
            }}
          >
            <TouchableOpacity
              onPressIn={startVoiceRecording}
              onPressOut={stopVoiceRecording}
              disabled={isLoading}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: isRecording ? '#EF4444' : '#7C3AED',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              {isRecording ? (
                <Animated.View
                  style={{
                    opacity: recordingAnim,
                  }}
                >
                  <MaterialIcons name="mic" size={28} color="#FFFFFF" />
                </Animated.View>
              ) : (
                <MaterialIcons name="mic" size={28} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Send button */}
          <TouchableOpacity
            onPress={sendTextMessage}
            disabled={!inputText.trim() || isLoading || isRecording}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: inputText.trim() ? '#10B981' : '#E5E7EB',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons 
                name="send" 
                size={24} 
                color={inputText.trim() ? '#FFFFFF' : '#9CA3AF'} 
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Recording indicator */}
        {isRecording && (
          <View
            style={{
              marginTop: 12,
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: '#FEE2E2',
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Animated.View
              style={{
                opacity: recordingAnim,
                marginRight: 8,
              }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#EF4444',
                }}
              />
            </Animated.View>
            <Text style={{ color: '#DC2626', fontWeight: '600' }}>
              Recording... Release to send
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

