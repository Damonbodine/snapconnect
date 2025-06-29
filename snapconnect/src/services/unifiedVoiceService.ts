/**
 * Unified Voice Service - Single source of truth for Coach Alex voice functionality
 * Combines the best of all existing services with proper error handling and fallback
 */
import { speechService } from './speechService';
import { voiceCoachService } from './voiceCoachService';
import { pychatVoiceService } from './pychatVoiceService';
import { supabase } from './supabase';

export type CallState = 'dialing' | 'connected' | 'speaking' | 'listening' | 'thinking' | 'ending' | 'error';

export interface UnifiedVoiceSession {
  id: string;
  state: CallState;
  isUsingPypecat: boolean;
  startTime: Date;
  duration: number;
  lastTranscript?: string;
  lastResponse?: string;
}

export interface VoiceMessage {
  text: string;
  isUser: boolean;
  isVoice: boolean;
  timestamp: Date;
}

export class UnifiedVoiceService {
  private static instance: UnifiedVoiceService;
  private currentSession: UnifiedVoiceSession | null = null;
  private stateCallbacks: Map<string, (state: CallState) => void> = new Map();
  private messageCallbacks: Map<string, (message: VoiceMessage) => void> = new Map();

  public static getInstance(): UnifiedVoiceService {
    if (!UnifiedVoiceService.instance) {
      UnifiedVoiceService.instance = new UnifiedVoiceService();
    }
    return UnifiedVoiceService.instance;
  }

  /**
   * Start a voice call with Coach Alex
   * Tries Pypecat first, falls back to direct services
   */
  async startCall(workoutContext?: any): Promise<UnifiedVoiceSession> {
    console.log('🎙️ Starting unified voice call with Coach Alex...');
    
    const sessionId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      id: sessionId,
      state: 'dialing',
      isUsingPypecat: false,
      startTime: new Date(),
      duration: 0,
    };

    this.notifyStateChange('dialing');

    try {
      // Try Pypecat approach first with timeout
      console.log('🔄 Attempting Pypecat connection...');
      
      const pychatPromise = pychatVoiceService.startVoiceSession(workoutContext);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Pypecat connection timeout')), 5000)
      );

      const pychatSession = await Promise.race([pychatPromise, timeoutPromise]);
      
      if (pychatSession && pychatVoiceService.isConnected()) {
        console.log('✅ Pypecat connection successful - using real-time voice pipeline');
        this.currentSession.isUsingPypecat = true;
        this.currentSession.state = 'connected';
        this.notifyStateChange('connected');

        // Register for Pypecat messages
        pychatVoiceService.onMessage('unifiedCall', (message) => {
          this.handlePychatMessage(message);
        });

        // Send initial greeting
        setTimeout(() => {
          pychatVoiceService.sendTextMessage("Start the call with a warm, energetic greeting and ask how they're feeling today");
        }, 1000);

        return this.currentSession;
      }
    } catch (error) {
      console.warn('⚠️ Pypecat connection failed, falling back to direct services:', error.message || error);
    }

    // Fallback to direct voice services
    console.log('🔄 Using direct voice services fallback...');
    this.currentSession.isUsingPypecat = false;
    this.currentSession.state = 'connected';
    this.notifyStateChange('connected');

    // Generate initial greeting using voice coach service
    setTimeout(async () => {
      try {
        console.log('👋 Generating Coach Alex greeting...');
        const greeting = await voiceCoachService.generateVoiceGreeting();
        
        this.currentSession!.state = 'speaking';
        this.currentSession!.lastResponse = greeting.text;
        this.notifyStateChange('speaking');
        
        this.notifyMessage({
          text: greeting.text,
          isUser: false,
          isVoice: false,
          timestamp: new Date()
        });
        
        // Auto-transition to listening after speaking
        setTimeout(() => {
          if (this.currentSession) {
            this.currentSession.state = 'listening';
            this.notifyStateChange('listening');
          }
        }, Math.max(greeting.text.length * 60, 3000)); // Minimum 3 seconds
      } catch (error) {
        console.error('Failed to generate greeting:', error);
        this.currentSession!.state = 'error';
        this.notifyStateChange('error');
      }
    }, 1500);

    return this.currentSession;
  }

  /**
   * Send voice input (handles both Pypecat and direct approaches)
   */
  async sendVoiceInput(transcript: string): Promise<void> {
    if (!this.currentSession) throw new Error('No active session');

    console.log('🎤 Processing voice input:', transcript);
    this.currentSession.state = 'thinking';
    this.currentSession.lastTranscript = transcript;
    this.notifyStateChange('thinking');

    this.notifyMessage({
      text: transcript,
      isUser: true,
      isVoice: true,
      timestamp: new Date()
    });

    try {
      if (this.currentSession.isUsingPypecat) {
        // Use Pypecat
        console.log('📡 Sending to Pypecat pipeline...');
        await pychatVoiceService.sendTextMessage(transcript);
      } else {
        // Use direct voice coach service
        console.log('🤖 Processing with direct voice coach...');
        const response = await voiceCoachService.processVoiceMessage(transcript, true);
        
        if (response.success) {
          this.currentSession.state = 'speaking';
          this.currentSession.lastResponse = response.text;
          this.notifyStateChange('speaking');
          
          this.notifyMessage({
            text: response.text,
            isUser: false,
            isVoice: false,
            timestamp: new Date()
          });
          
          // Auto-transition to listening after speaking
          setTimeout(() => {
            if (this.currentSession) {
              this.currentSession.state = 'listening';
              this.notifyStateChange('listening');
            }
          }, Math.max(response.text.length * 60, 2000)); // Minimum 2 seconds
        } else {
          throw new Error('Voice processing failed');
        }
      }
    } catch (error) {
      console.error('Failed to process voice input:', error);
      this.currentSession.state = 'error';
      this.notifyStateChange('error');
    }
  }

  /**
   * Start recording user voice
   */
  async startRecording(): Promise<void> {
    if (!this.currentSession) throw new Error('No active session');
    
    console.log('🎤 Starting voice recording...');
    
    // Stop any ongoing speech first
    if (speechService.isCurrentlySpeaking()) {
      console.log('🛑 Stopping ongoing speech before recording');
      await speechService.stopSpeaking();
    }
    
    this.currentSession.state = 'listening';
    this.notifyStateChange('listening');

    try {
      const result = await speechService.startSpeechToText();
      if (!result.success) {
        throw new Error(result.error || 'Failed to start recording');
      }
      console.log('✅ Voice recording started successfully');
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.currentSession.state = 'error';
      this.notifyStateChange('error');
      throw error;
    }
  }

  /**
   * Stop recording and process
   */
  async stopRecording(): Promise<void> {
    if (!this.currentSession) throw new Error('No active session');

    console.log('⏹️ Stopping voice recording and processing...');
    this.currentSession.state = 'thinking';
    this.notifyStateChange('thinking');

    try {
      const result = await speechService.stopSpeechToText();
      
      if (result.success && result.transcript.trim()) {
        console.log(`📝 Transcript received: "${result.transcript}" (${result.confidence}% confidence)`);
        await this.sendVoiceInput(result.transcript);
      } else {
        console.log('⚠️ No valid transcript received, returning to listening');
        // Go back to listening if no valid transcript
        this.currentSession.state = 'listening';
        this.notifyStateChange('listening');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.currentSession.state = 'error';
      this.notifyStateChange('error');
      throw error;
    }
  }

  /**
   * Send a text message (for testing or fallback)
   */
  async sendTextMessage(message: string): Promise<void> {
    if (!this.currentSession) throw new Error('No active session');

    console.log('💬 Sending text message:', message);
    await this.sendVoiceInput(message);
  }

  /**
   * End the call
   */
  async endCall(): Promise<void> {
    if (!this.currentSession) return;

    console.log('📞 Ending voice call...');
    this.currentSession.state = 'ending';
    this.notifyStateChange('ending');

    try {
      // Stop any ongoing speech
      if (speechService.isCurrentlySpeaking()) {
        await speechService.stopSpeaking();
      }

      // Stop any ongoing recording
      if (speechService.isCurrentlyRecording()) {
        await speechService.stopSpeechToText();
      }

      // End Pypecat session if active
      if (this.currentSession.isUsingPypecat) {
        await pychatVoiceService.endSession();
        pychatVoiceService.offMessage('unifiedCall');
      }

      // Calculate final duration
      this.currentSession.duration = Math.floor(
        (new Date().getTime() - this.currentSession.startTime.getTime()) / 1000
      );

      console.log(`✅ Call ended. Duration: ${this.currentSession.duration}s`);
      
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      this.currentSession = null;
      this.notifyStateChange('ending');
    }
  }

  /**
   * Get current session info
   */
  getCurrentSession(): UnifiedVoiceSession | null {
    return this.currentSession;
  }

  /**
   * Check if call is active
   */
  isCallActive(): boolean {
    return this.currentSession !== null && this.currentSession.state !== 'ending';
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.currentSession?.state === 'listening' && speechService.isCurrentlyRecording();
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.currentSession?.state === 'speaking' && speechService.isCurrentlySpeaking();
  }

  /**
   * Register for state change notifications
   */
  onStateChange(callbackId: string, callback: (state: CallState) => void): void {
    this.stateCallbacks.set(callbackId, callback);
  }

  /**
   * Unregister state change notifications
   */
  offStateChange(callbackId: string): void {
    this.stateCallbacks.delete(callbackId);
  }

  /**
   * Register for message notifications
   */
  onMessage(callbackId: string, callback: (message: VoiceMessage) => void): void {
    this.messageCallbacks.set(callbackId, callback);
  }

  /**
   * Unregister message notifications
   */
  offMessage(callbackId: string): void {
    this.messageCallbacks.delete(callbackId);
  }

  // Private methods
  private notifyStateChange(state: CallState): void {
    console.log(`🔄 Call state changed to: ${state}`);
    this.stateCallbacks.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('Error in state change callback:', error);
      }
    });
  }

  private notifyMessage(message: VoiceMessage): void {
    this.messageCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error in message callback:', error);
      }
    });
  }

  private handlePychatMessage(message: any): void {
    console.log('📨 Pypecat message:', message.type);

    switch (message.type) {
      case 'transcript':
        if (this.currentSession) {
          this.currentSession.state = 'thinking';
          this.currentSession.lastTranscript = message.data.transcript;
          this.notifyStateChange('thinking');
          
          this.notifyMessage({
            text: message.data.transcript,
            isUser: true,
            isVoice: true,
            timestamp: new Date()
          });
        }
        break;
      case 'response':
        if (this.currentSession) {
          this.currentSession.state = 'speaking';
          this.currentSession.lastResponse = message.data.text;
          this.notifyStateChange('speaking');
          
          this.notifyMessage({
            text: message.data.text,
            isUser: false,
            isVoice: false,
            timestamp: new Date()
          });
          
          // Auto-transition to listening after speaking
          setTimeout(() => {
            if (this.currentSession) {
              this.currentSession.state = 'listening';
              this.notifyStateChange('listening');
            }
          }, Math.max((message.data.text?.length || 50) * 60, 2000));
        }
        break;
      case 'status':
        if (message.data.error && this.currentSession) {
          console.error('Pypecat error:', message.data.error);
          this.currentSession.state = 'error';
          this.notifyStateChange('error');
        }
        break;
    }
  }
}

export const unifiedVoiceService = UnifiedVoiceService.getInstance();