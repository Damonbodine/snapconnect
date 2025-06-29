/**
 * Voice Coach Service
 * 🎙️ NEXT-LEVEL Coach Alex with voice capabilities!
 * Combines speech-to-text, text-to-speech, and enhanced AI context
 * for natural voice conversations with your fitness coach
 */

import { healthContextService } from './healthContextService';
import { speechService } from './speechService';
import { supabase } from './supabase';
import * as Speech from 'expo-speech';
import OpenAI from 'openai';

// Types for voice interactions
export interface VoiceChatMessage {
  id: string;
  user_id: string;
  message_text: string;
  is_user_message: boolean;
  is_voice_message: boolean;
  audio_duration?: number;
  context_snapshot?: any;
  created_at: string;
}

export interface VoiceResponse {
  text: string;
  success: boolean;
  audioPlaying: boolean;
  conversationId: string;
}

export interface VoiceSettings {
  voiceEnabled: boolean;
  autoSpeak: boolean;
  voiceRate: number;
  voicePitch: number;
  preferredVoice: string;
}

export class VoiceCoachService {
  private static instance: VoiceCoachService;
  private openAI: OpenAI;
  private isSpeaking: boolean = false;
  private currentSpeechId: string | null = null;

  public static getInstance(): VoiceCoachService {
    if (!VoiceCoachService.instance) {
      VoiceCoachService.instance = new VoiceCoachService();
    }
    return VoiceCoachService.instance;
  }

  constructor() {
    // Initialize OpenAI client for voice chat
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key not configured for voice coaching');
    }
    this.openAI = new OpenAI({ apiKey });
  }

  /**
   * 🎙️ Process voice message from user and respond with voice
   */
  async processVoiceMessage(
    userMessage: string,
    isVoiceInput: boolean = true,
    shouldRespond: boolean = true
  ): Promise<VoiceResponse> {
    try {
      console.log('🎙️ Processing voice message to Coach Alex');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get comprehensive context + conversation history
      const [enhancedContext, conversationHistory] = await Promise.all([
        healthContextService.generateCoachingContext(user.id),
        this.getRecentVoiceConversation(user.id, 8) // More context for voice
      ]);

      // Store user message
      await this.storeVoiceMessage(user.id, userMessage, true, isVoiceInput, enhancedContext);

      if (!shouldRespond) {
        return {
          text: userMessage,
          success: true,
          audioPlaying: false,
          conversationId: `${user.id}_${Date.now()}`,
        };
      }

      // Generate Coach Alex voice response
      const systemPrompt = this.buildVoiceOptimizedPrompt(enhancedContext, conversationHistory);
      const coachResponse = await this.getVoiceResponse(userMessage, systemPrompt, conversationHistory);

      // Store Coach Alex response
      await this.storeVoiceMessage(user.id, coachResponse, false, false, enhancedContext);

      // Speak the response automatically
      const audioPlaying = await this.speakResponse(coachResponse);

      console.log('✅ Voice message processed successfully');

      return {
        text: coachResponse,
        success: true,
        audioPlaying,
        conversationId: `${user.id}_${Date.now()}`,
      };
    } catch (error) {
      console.error('❌ Failed to process voice message:', error);
      
      const fallbackResponse = "I'm having trouble hearing you right now. Let me try again! 🎙️";
      await this.speakResponse(fallbackResponse);
      
      return {
        text: fallbackResponse,
        success: false,
        audioPlaying: true,
        conversationId: '',
      };
    }
  }

  /**
   * 🎤 Speak text using enhanced speech service
   */
  async speakResponse(text: string, settings?: Partial<VoiceSettings>): Promise<boolean> {
    try {
      if (this.isSpeaking) {
        await this.stopSpeaking();
      }

      console.log('🔊 Coach Alex speaking:', text.substring(0, 50) + '...');

      this.isSpeaking = true;
      this.currentSpeechId = `speech_${Date.now()}`;

      // Use enhanced speech service
      const result = await speechService.speak(text, {
        rate: settings?.voiceRate || 0.85,
        pitch: settings?.voicePitch || 1.0,
        voice: settings?.preferredVoice,
        language: 'en-US',
        volume: 1.0,
      });

      if (!result.success) {
        this.isSpeaking = false;
        this.currentSpeechId = null;
        console.error('❌ Speech service error:', result.error);
        return false;
      }

      // The speech service handles the callback management
      // We'll update our state when it completes
      setTimeout(() => {
        this.isSpeaking = speechService.isCurrentlySpeaking();
        if (!this.isSpeaking) {
          this.currentSpeechId = null;
        }
      }, 100);

      return true;
    } catch (error) {
      console.error('❌ Failed to speak response:', error);
      this.isSpeaking = false;
      this.currentSpeechId = null;
      return false;
    }
  }

  /**
   * ⏸️ Stop current speech
   */
  async stopSpeaking(): Promise<void> {
    try {
      if (this.isSpeaking) {
        await speechService.stopSpeaking();
        this.isSpeaking = false;
        this.currentSpeechId = null;
        console.log('⏸️ Speech stopped by user');
      }
    } catch (error) {
      console.error('❌ Failed to stop speech:', error);
    }
  }

  /**
   * 🎯 Generate initial voice greeting
   */
  async generateVoiceGreeting(): Promise<VoiceResponse> {
    try {
      console.log('👋 Generating Coach Alex voice greeting');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check conversation history
      const existingMessages = await this.getRecentVoiceConversation(user.id, 3);
      const isFirstVoiceChat = existingMessages.length === 0;

      // Get enhanced context
      const enhancedContext = await healthContextService.generateCoachingContext(user.id);

      // Build greeting prompt
      const systemPrompt = this.buildVoiceGreetingPrompt(enhancedContext, isFirstVoiceChat);

      // Generate greeting
      const greeting = await this.getVoiceResponse(
        isFirstVoiceChat ? "Generate first voice greeting" : "Generate welcome back voice greeting",
        systemPrompt,
        []
      );

      // Store greeting
      await this.storeVoiceMessage(user.id, greeting, false, false, enhancedContext);

      // Speak greeting
      const audioPlaying = await this.speakResponse(greeting);

      return {
        text: greeting,
        success: true,
        audioPlaying,
        conversationId: `${user.id}_${Date.now()}`,
      };
    } catch (error) {
      console.error('❌ Failed to generate voice greeting:', error instanceof Error ? error.message : 'Unknown error');
      
      const fallbackGreeting = "Hey there! I'm Coach Alex, your voice-powered fitness buddy! How are you feeling today?";
      const audioPlaying = await this.speakResponse(fallbackGreeting);
      
      return {
        text: fallbackGreeting,
        success: false,
        audioPlaying,
        conversationId: '',
      };
    }
  }

  /**
   * 📜 Get conversation history
   */
  async getConversationHistory(userId: string, limit: number = 50): Promise<VoiceChatMessage[]> {
    try {
      const { data: messages, error } = await supabase
        .from('coach_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.log('Conversation history not available (table may not exist)');
        return [];
      }

      return messages || [];
    } catch (error) {
      console.error('❌ Failed to get voice conversation history:', error);
      return [];
    }
  }

  /**
   * 🗑️ Clear conversation history
   */
  async clearConversation(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('coach_conversations')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      
      console.log('✅ Voice conversation history cleared');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear conversation:', error);
      return false;
    }
  }

  /**
   * 🎤 Start voice recording for user input
   */
  async startVoiceRecording(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🎤 Starting voice recording');
      return await speechService.startSpeechToText({
        maxDuration: 30, // 30 seconds max
        language: 'en-US',
        enablePartialResults: true,
        enableVAD: true,
      });
    } catch (error) {
      console.error('❌ Failed to start voice recording:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * ⏹️ Stop voice recording and get transcript
   */
  async stopVoiceRecording(): Promise<{
    transcript: string;
    success: boolean;
    duration: number;
    confidence: number;
    error?: string;
  }> {
    try {
      console.log('⏹️ Stopping voice recording');
      const result = await speechService.stopSpeechToText();
      
      return {
        transcript: result.transcript,
        success: result.success,
        duration: result.duration,
        confidence: result.confidence,
        error: result.error,
      };
    } catch (error) {
      console.error('❌ Failed to stop voice recording:', error);
      return {
        transcript: '',
        success: false,
        duration: 0,
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * ❓ Check if currently speaking
   */
  isCurrentlySpeaking(): boolean {
    return this.isSpeaking || speechService.isCurrentlySpeaking();
  }

  /**
   * ❓ Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return speechService.isCurrentlyRecording();
  }

  // Private helper methods

  /**
   * Get recent conversation for context
   */
  private async getRecentVoiceConversation(userId: string, limit: number = 8): Promise<VoiceChatMessage[]> {
    try {
      const { data: messages, error } = await supabase
        .from('coach_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        // If table doesn't exist, return empty array for now
        console.log('Coach conversations table not found, using empty conversation history');
        return [];
      }

      return (messages || []).reverse();
    } catch (error) {
      console.error('❌ Failed to get recent voice conversation:', error);
      return [];
    }
  }

  /**
   * Store voice message in database
   */
  private async storeVoiceMessage(
    userId: string,
    messageText: string,
    isUserMessage: boolean,
    isVoiceMessage: boolean,
    contextSnapshot?: any,
    audioDuration?: number
  ): Promise<VoiceChatMessage> {
    try {
      const messageRecord = {
        user_id: userId,
        message_text: messageText,
        is_user_message: isUserMessage,
        is_voice_message: isVoiceMessage,
        audio_duration: audioDuration,
        context_snapshot: contextSnapshot,
      };

      const { data, error } = await supabase
        .from('coach_conversations')
        .insert(messageRecord)
        .select()
        .single();

      if (error) {
        console.log('Could not store message in database (table may not exist):', error.message);
        // Return a mock message object for now
        return {
          id: `mock_${Date.now()}`,
          user_id: userId,
          message_text: messageText,
          is_user_message: isUserMessage,
          is_voice_message: isVoiceMessage,
          audio_duration: audioDuration,
          context_snapshot: contextSnapshot,
          created_at: new Date().toISOString(),
        };
      }

      return data;
    } catch (error) {
      console.error('Failed to store voice message:', error);
      // Return mock message
      return {
        id: `mock_${Date.now()}`,
        user_id: userId,
        message_text: messageText,
        is_user_message: isUserMessage,
        is_voice_message: isVoiceMessage,
        audio_duration: audioDuration,
        context_snapshot: contextSnapshot,
        created_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Get voice response from OpenAI
   */
  private async getVoiceResponse(
    userMessage: string,
    systemPrompt: string,
    conversationHistory: VoiceChatMessage[]
  ): Promise<string> {
    try {
      // Build conversation for OpenAI
      const messages: any[] = [
        {
          role: 'system',
          content: systemPrompt,
        }
      ];

      // Add recent conversation (last 6 messages for context)
      const recentHistory = conversationHistory.slice(-6);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.is_user_message ? 'user' : 'assistant',
          content: msg.message_text,
        });
      });

      // Add current message
      messages.push({
        role: 'user',
        content: userMessage,
      });

      // Call OpenAI with voice-optimized settings  
      const openAIClient = new OpenAI({ 
        apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY 
      });
      const completion = await openAIClient.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 150, // Shorter for voice
        temperature: 0.9, // More personality for voice
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response generated');
      }

      return response.trim();
    } catch (error) {
      console.error('❌ OpenAI voice response failed:', error);
      throw error;
    }
  }

  /**
   * Build voice-optimized system prompt
   */
  private buildVoiceOptimizedPrompt(enhancedContext: any, conversationHistory: VoiceChatMessage[]): string {
    const { userProfile, healthMetrics, socialContext, eventContext, conversationContext, behavioralInsights } = enhancedContext;

    return `You are Coach Alex, an expert AI fitness coach having a natural VOICE conversation. You speak like a real personal trainer who genuinely cares about your client's success.

USER CONTEXT:
- Steps today: ${healthMetrics.todaysSteps} (${healthMetrics.stepGoalProgress}% of goal)
- Current streak: ${healthMetrics.currentStreak} days
- Energy level: ${healthMetrics.energyLevel}
- Fitness level: ${userProfile.fitnessLevel}
- Primary goal: ${userProfile.smartGoals?.primaryGoal || 'General fitness'}
${eventContext.upcoming_events.length > 0 ? `- Upcoming event: ${eventContext.upcoming_events[0].title} in ${eventContext.upcoming_events[0].days_until} days` : ''}
- Social engagement: ${socialContext.posting_frequency}
- Preferred coaching: ${userProfile.coachingPreferences?.style || 'motivational'}

VOICE COACHING PRINCIPLES:
🎯 CONVERSATIONAL FLOW:
- Respond like you're talking to a friend at the gym
- Keep responses 50-80 words (10-15 seconds when spoken)
- Use contractions ("you're" not "you are", "let's" not "let us")
- Include natural speech patterns like "you know", "actually", "honestly"
- Ask follow-up questions to keep the conversation alive

💪 COACHING STYLE:
- Be encouraging but realistic
- Reference their specific data naturally ("Nice! You're at ${healthMetrics.stepGoalProgress}% today")
- Give actionable advice they can implement immediately
- Celebrate small wins and progress
- Address concerns with empathy

🗣️ SPEECH OPTIMIZATION:
- Use simple sentence structures
- Avoid complex fitness jargon unless explaining it
- Include natural pauses with periods
- Sound like you're actually excited about their progress
- Use "we" language ("Let's work on this together")

${conversationHistory.length > 0 ? 
  `CONVERSATION FLOW:\n${conversationHistory.slice(-3).map(msg => 
    `${msg.is_user_message ? 'Them' : 'You'}: ${msg.message_text}`
  ).join('\n')}\n\nBuild on this conversation naturally.`
  : 'This is your first voice interaction. Start with energy and make them feel welcomed.'
}

Remember: You're not just an AI, you're their personal coach who happens to have access to all their fitness data. Be human, be helpful, be motivating.`;
  }

  /**
   * Build voice greeting prompt
   */
  private buildVoiceGreetingPrompt(enhancedContext: any, isFirstChat: boolean): string {
    const { userProfile, healthMetrics, eventContext } = enhancedContext;

    const baseContext = `
USER INFO:
- Fitness level: ${userProfile.fitnessLevel}
- Goal: ${userProfile.smartGoals?.primaryGoal || 'General fitness'}
- Today's steps: ${healthMetrics.todaysSteps}
- Streak: ${healthMetrics.currentStreak} days
${eventContext.upcoming_events.length > 0 ? `- Upcoming event: ${eventContext.upcoming_events[0].title}` : ''}`;

    if (isFirstChat) {
      return `You are Coach Alex greeting someone for their FIRST VOICE chat. Generate a warm 60-80 word spoken greeting that:
- Introduces yourself as their voice fitness coach
- Mentions you can see their fitness data
- Sounds excited about helping them
- Asks how they're feeling today
- Make it sound natural when spoken aloud

${baseContext}

Generate a natural first voice greeting.`;
    } else {
      return `You are Coach Alex welcoming someone back to voice chat. Generate a 40-60 word spoken greeting that:
- Welcomes them back enthusiastically
- References something from their recent progress
- Asks how they're doing
- Sounds natural when spoken

${baseContext}

Generate a natural welcome back voice greeting.`;
    }
  }

  /**
   * Optimize text for speech synthesis
   */
  private optimizeTextForSpeech(text: string): string {
    return text
      // Replace common fitness abbreviations
      .replace(/\bPR\b/g, 'personal record')
      .replace(/\bHR\b/g, 'heart rate')
      .replace(/\bRPE\b/g, 'rate of perceived exertion')
      // Replace symbols with words
      .replace(/&/g, 'and')
      .replace(/\+/g, 'plus')
      .replace(/@/g, 'at')
      // Remove excessive punctuation
      .replace(/\.\.\./g, '.')
      .replace(/!{2,}/g, '!')
      .replace(/\?{2,}/g, '?')
      // Add natural pauses
      .replace(/\. ([A-Z])/g, '. $1') // Ensure pause after sentences
      .trim();
  }

  /**
   * Get optimal voice for Coach Alex
   */
  private getOptimalVoice(): string {
    // iOS voices (higher quality)
    const iosVoices = [
      'com.apple.ttsbundle.Samantha-compact', // Friendly female
      'com.apple.ttsbundle.Alex-compact',     // Clear male
      'com.apple.ttsbundle.Victoria-compact', // Energetic female
    ];

    // Android fallbacks
    const androidVoices = [
      'en-US-language',
      'en-us-x-sfg#female_1-local',
      'en-us-x-sfg#male_1-local',
    ];

    // Try to detect platform and return appropriate voice
    // For now, return a safe default
    return 'com.apple.ttsbundle.Samantha-compact';
  }
}

// Export singleton instance
export const voiceCoachService = VoiceCoachService.getInstance();