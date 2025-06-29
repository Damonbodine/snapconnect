/**
 * Pypecat Voice Service
 * 🎙️ Real-time voice coaching service using Pypecat WebSocket pipeline
 * Integrates Deepgram STT, OpenAI LLM, and ElevenLabs TTS through Pypecat
 */

import { supabase } from './supabase';
import { healthContextService } from './healthContextService';

// WebSocket connection states
export type VoiceSessionStatus = 'connecting' | 'active' | 'paused' | 'completed' | 'error';

// Voice session interface
export interface VoiceSession {
  id: string;
  sessionToken: string;
  status: VoiceSessionStatus;
  startTime: Date;
  totalDuration: number;
  workoutContext?: any;
}

// Voice message interface for real-time communication
export interface VoiceStreamMessage {
  type: 'audio' | 'transcript' | 'response' | 'command' | 'status';
  data: any;
  timestamp: Date;
  sessionId: string;
}

// Voice command interface
export interface VoiceCommand {
  id: string;
  type: string;
  intent: string;
  parameters: any;
  confidence: number;
  status: 'pending' | 'executed' | 'failed';
}

export class PychatVoiceService {
  private static instance: PychatVoiceService;
  private websocket: WebSocket | null = null;
  private currentSession: VoiceSession | null = null;
  private messageHandlers: Map<string, (message: VoiceStreamMessage) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // WebSocket configuration  
  private readonly VOICE_SERVICE_URL = __DEV__ 
    ? 'ws://localhost:8002' // Development - works for web
    : 'ws://localhost:8002'; // Production
  
  // For React Native on device/simulator, we might need to use the host IP
  private getVoiceServiceUrl(): string {
    // Always use the host IP for React Native - localhost never works
    const hostIP = '192.168.1.66';
    const url = `ws://${hostIP}:8002`;
    console.log('🔗 Using WebSocket URL:', url);
    return url;
  }
  private readonly AUDIO_SAMPLE_RATE = 16000;
  private readonly AUDIO_CHUNK_SIZE = 1024;

  public static getInstance(): PychatVoiceService {
    if (!PychatVoiceService.instance) {
      PychatVoiceService.instance = new PychatVoiceService();
    }
    return PychatVoiceService.instance;
  }

  constructor() {
    this.setupEventHandlers();
  }

  /**
   * 🎙️ Start a new voice coaching session
   */
  async startVoiceSession(workoutContext?: any): Promise<VoiceSession> {
    try {
      console.log('🎙️ Starting new voice coaching session with Pypecat');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Generate simple session token
      const sessionToken = `session_${Date.now()}`;

      // Skip database for now - just connect
      const sessionData = sessionToken;

      // Create session object
      this.currentSession = {
        id: sessionData,
        sessionToken,
        status: 'connecting',
        startTime: new Date(),
        totalDuration: 0,
        workoutContext
      };

      // Connect to Pypecat WebSocket service
      await this.connectToVoiceService(sessionToken);

      console.log('✅ Voice session started successfully');
      return this.currentSession;

    } catch (error) {
      console.error('❌ Failed to start voice session:', error);
      throw error;
    }
  }

  /**
   * 🔌 Connect to Pypecat WebSocket service
   */
  private async connectToVoiceService(sessionToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connecting to Pypecat voice service...');

        const serviceUrl = this.getVoiceServiceUrl();
        console.log('🔗 Attempting WebSocket connection to:', serviceUrl);
        
        // Create WebSocket - no query params needed
        this.websocket = new WebSocket(serviceUrl);
        
        // Connection timeout handler
        const connectionTimeout = setTimeout(() => {
          if (this.websocket?.readyState !== WebSocket.OPEN) {
            console.error('❌ WebSocket connection timeout after 10 seconds');
            console.error('   🔍 Possible issues:');
            console.error('   - Python voice service not running on', serviceUrl);
            console.error('   - Firewall blocking connection');
            console.error('   - Incorrect IP address');
            
            if (this.websocket) {
              this.websocket.close();
            }
            reject(new Error(`Connection timeout to ${serviceUrl}`));
          }
        }, 10000);

        this.websocket.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('✅ Connected to Pypecat voice service successfully!');
          console.log('   📡 WebSocket state:', this.websocket?.readyState);
          this.reconnectAttempts = 0;
          
          if (this.currentSession) {
            this.currentSession.status = 'active';
            this.updateSessionStatus('active');
          }
          
          resolve();
        };

        this.websocket.onmessage = (event) => {
          console.log('📨 WebSocket message received:', typeof event.data);
          this.handleWebSocketMessage(event);
        };

        this.websocket.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log('🔌 WebSocket connection closed');
          console.log('   📊 Close code:', event.code, 'Reason:', event.reason);
          console.log('   🔍 Was clean:', event.wasClean);
          
          // Don't call handleDisconnection on initial connection failure
          if (this.reconnectAttempts === 0 && event.code !== 1006) {
            this.handleDisconnection();
          }
        };

        this.websocket.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('❌ WebSocket error details:');
          console.error('   🔗 URL attempted:', fullUrl);
          console.error('   📊 WebSocket state:', this.websocket?.readyState);
          console.error('   🚨 Error object:', error);
          console.error('   💡 Troubleshooting:');
          console.error('     1. Check if Python voice service is running');
          console.error('     2. Verify IP address is correct');
          console.error('     3. Check firewall settings');
          
          reject(new Error(`WebSocket connection failed to ${serviceUrl}`));
        };

      } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  /**
   * 📨 Handle incoming WebSocket messages from Pypecat
   */
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      let messageData;
      
      if (typeof event.data === 'string') {
        // Handle non-JSON responses from Pipecat
        if (event.data.startsWith('{')) {
          messageData = JSON.parse(event.data);
        } else {
          // Handle plain text responses
          console.log('📨 Received text from Pipecat:', event.data);
          messageData = {
            type: 'response',
            data: { text: event.data }
          };
        }
      } else if (event.data instanceof Blob) {
        // Handle audio data from TTS
        this.handleAudioResponse(event.data);
        return;
      } else {
        messageData = event.data;
      }

      const message: VoiceStreamMessage = {
        type: messageData.type || 'response',
        data: messageData.data || messageData,
        timestamp: new Date(),
        sessionId: this.currentSession?.id || ''
      };

      console.log('📨 Received message from Pipecat:', message.type, message.data);

      // Route message to appropriate handler
      switch (message.type) {
        case 'transcript':
          this.handleTranscriptReceived(message);
          break;
        case 'response':
          this.handleAIResponse(message);
          break;
        case 'command':
          this.handleVoiceCommand(message);
          break;
        case 'audio':
          this.handleAudioResponse(message.data);
          break;
        case 'status':
          this.handleStatusUpdate(message);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }

      // Notify registered handlers
      this.messageHandlers.forEach(handler => handler(message));

    } catch (error) {
      console.error('❌ Failed to handle WebSocket message:', error);
    }
  }

  /**
   * 🎤 Send audio data to Pypecat for processing
   */
  async sendAudioChunk(audioData: ArrayBuffer): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    try {
      // Send binary audio data directly to Pypecat
      this.websocket.send(audioData);
    } catch (error) {
      console.error('❌ Failed to send audio chunk:', error);
      throw error;
    }
  }

  /**
   * 💬 Send text message to voice coach
   */
  async sendTextMessage(message: string): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    try {
      const textMessage = {
        type: 'text_input',
        data: {
          text: message,
          timestamp: Date.now(),
          session_id: this.currentSession?.sessionToken
        }
      };

      this.websocket.send(JSON.stringify(textMessage));
      console.log('💬 Sent text message to Pypecat');

    } catch (error) {
      console.error('❌ Failed to send text message:', error);
      throw error;
    }
  }

  /**
   * ⏸️ Pause the current voice session
   */
  async pauseSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      this.currentSession.status = 'paused';
      await this.updateSessionStatus('paused');

      if (this.websocket) {
        this.websocket.send(JSON.stringify({
          type: 'pause_session',
          session_id: this.currentSession.sessionToken
        }));
      }

      console.log('⏸️ Voice session paused');
    } catch (error) {
      console.error('❌ Failed to pause session:', error);
      throw error;
    }
  }

  /**
   * ▶️ Resume the current voice session
   */
  async resumeSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      this.currentSession.status = 'active';
      await this.updateSessionStatus('active');

      if (this.websocket) {
        this.websocket.send(JSON.stringify({
          type: 'resume_session',
          session_id: this.currentSession.sessionToken
        }));
      }

      console.log('▶️ Voice session resumed');
    } catch (error) {
      console.error('❌ Failed to resume session:', error);
      throw error;
    }
  }

  /**
   * ⏹️ End the current voice session
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const sessionDuration = Math.floor((new Date().getTime() - this.currentSession.startTime.getTime()) / 1000);
      
      this.currentSession.status = 'completed';
      this.currentSession.totalDuration = sessionDuration;

      await this.updateSessionStatus('completed', sessionDuration);

      if (this.websocket) {
        this.websocket.send(JSON.stringify({
          type: 'end_session',
          session_id: this.currentSession.sessionToken
        }));

        this.websocket.close();
        this.websocket = null;
      }

      console.log('⏹️ Voice session ended');
      this.currentSession = null;

    } catch (error) {
      console.error('❌ Failed to end session:', error);
      throw error;
    }
  }

  /**
   * 📊 Get current session status
   */
  getCurrentSession(): VoiceSession | null {
    return this.currentSession;
  }

  /**
   * 🎧 Register message handler
   */
  onMessage(handlerId: string, handler: (message: VoiceStreamMessage) => void): void {
    this.messageHandlers.set(handlerId, handler);
  }

  /**
   * 🔇 Unregister message handler
   */
  offMessage(handlerId: string): void {
    this.messageHandlers.delete(handlerId);
  }

  /**
   * ❓ Check if currently connected
   */
  isConnected(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN;
  }

  /**
   * ❓ Check if session is active
   */
  isSessionActive(): boolean {
    return this.currentSession?.status === 'active';
  }

  // Private helper methods

  private async updateSessionStatus(
    status: VoiceSessionStatus, 
    duration?: number, 
    metrics?: any
  ): Promise<void> {
    if (!this.currentSession) return;

    try {
      await supabase.rpc('update_voice_session_status', {
        session_token: this.currentSession.sessionToken,
        new_status: status,
        duration_update: duration,
        metrics_update: metrics
      });
    } catch (error) {
      console.error('❌ Failed to update session status:', error);
    }
  }

  private handleTranscriptReceived(message: VoiceStreamMessage): void {
    console.log('📝 Transcript received:', message.data.transcript);
    
    // Store transcript in conversation history
    this.storeConversationMessage(
      message.data.transcript,
      true, // is_user_message
      true, // is_voice_message
      message.data.confidence
    );
  }

  private handleAIResponse(message: VoiceStreamMessage): void {
    console.log('🤖 AI response received:', message.data.text);
    
    // Store AI response in conversation history
    this.storeConversationMessage(
      message.data.text,
      false, // is_user_message
      false, // is_voice_message
      undefined,
      message.data.processing_time
    );
  }

  private handleAudioResponse(audioData: Blob | ArrayBuffer): void {
    console.log('🔊 Audio response received');
    
    // Play audio response directly
    this.playAudioResponse(audioData);
  }

  private handleVoiceCommand(message: VoiceStreamMessage): void {
    console.log('🎯 Voice command detected:', message.data);
    
    // Record command in database
    this.recordVoiceCommand(message.data);
  }

  private handleStatusUpdate(message: VoiceStreamMessage): void {
    console.log('📊 Status update:', message.data);
    
    if (this.currentSession) {
      // Update session metrics
      this.updateSessionStatus(
        this.currentSession.status,
        undefined,
        message.data
      );
    }
  }

  private handleDisconnection(): void {
    console.log('🔌 WebSocket disconnected, attempting reconnection...');
    
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.currentSession) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connectToVoiceService(this.currentSession!.sessionToken)
          .catch(error => {
            console.error('❌ Reconnection failed:', error);
          });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
      if (this.currentSession) {
        this.currentSession.status = 'error';
        this.updateSessionStatus('error');
      }
    }
  }

  private async storeConversationMessage(
    text: string,
    isUserMessage: boolean,
    isVoiceMessage: boolean,
    confidence?: number,
    processingLatency?: number
  ): Promise<void> {
    if (!this.currentSession) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('coach_conversations')
        .insert({
          user_id: user.id,
          voice_session_id: this.currentSession.id,
          message_text: text,
          is_user_message: isUserMessage,
          is_voice_message: isVoiceMessage,
          speech_confidence: confidence,
          processing_latency: processingLatency
        });

    } catch (error) {
      console.error('❌ Failed to store conversation message:', error);
    }
  }

  private async recordVoiceCommand(commandData: any): Promise<void> {
    if (!this.currentSession) return;

    try {
      await supabase.rpc('record_voice_command', {
        session_token: this.currentSession.sessionToken,
        command_type: commandData.type,
        command_intent: commandData.intent,
        command_parameters: commandData.parameters || {},
        confidence_score: commandData.confidence
      });

    } catch (error) {
      console.error('❌ Failed to record voice command:', error);
    }
  }

  private async playAudioResponse(audioData: Blob | ArrayBuffer): Promise<void> {
    try {
      let audioBlob: Blob;
      
      if (audioData instanceof ArrayBuffer) {
        audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
      } else {
        audioBlob = audioData;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      console.log('🔊 Playing AI voice response');

    } catch (error) {
      console.error('❌ Failed to play audio response:', error);
    }
  }

  private setupEventHandlers(): void {
    // Handle app lifecycle events
    // Note: React Native uses AppState instead of window events
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('beforeunload', () => {
        if (this.currentSession) {
          this.endSession();
        }
      });
    }
  }
}

// Export singleton instance
export const pychatVoiceService = PychatVoiceService.getInstance();