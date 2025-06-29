/**
 * AI Chat Service
 * Manages conversations between AI personas and human users
 * Integrates with existing personality system and health AI service
 */

import { healthAIService, HealthCoachingRequest } from './healthAIService';
import { messageService, SendMessageParams } from './messageService';
import { supabase } from './supabase';
import { AI_ARCHETYPES } from '../types/aiPersonality';
import { digitalHumanService } from './digitalHuman/digitalHumanService';
import { DigitalHumanPersonality, digitalHumanMemoryService, digitalHumanAIService, type ConversationMemory, type DigitalHumanRequest } from './digitalHuman';

export interface AIPersonaProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  personality_traits: any;
  ai_response_style: any;
  conversation_context: any;
  archetype_id: string;
  is_digital_human?: boolean; // Flag to indicate if this AI has digital human enhancement
}

export interface ConversationMessage {
  id: string;
  content: string;
  is_from_ai: boolean;
  sent_at: string;
  message_type: string;
}

export interface ChatResponse {
  message_id: string;
  content: string;
  typing_delay_ms: number;
}

export interface AIChatRequest {
  ai_user_id: string;
  human_user_id: string;
  human_message: string;
  conversation_context?: ConversationMessage[];
}

class AIChatService {
  private static instance: AIChatService;

  public static getInstance(): AIChatService {
    if (!AIChatService.instance) {
      AIChatService.instance = new AIChatService();
    }
    return AIChatService.instance;
  }

  /**
   * Get all available AI users for chat
   */
  async getAvailableAIUsers(): Promise<AIPersonaProfile[]> {
    try {
      console.log('🤖 Fetching available AI users for chat');

      const { data, error } = await supabase.rpc('get_ai_users');

      if (error) {
        console.error('❌ Error fetching AI users:', error);
        throw new Error(error.message);
      }

      // Map to our interface and add archetype info
      const aiUsers: AIPersonaProfile[] = (data || []).map((user: any) => {
        // Extract archetype from personality traits or use a default
        const archetypeId = user.personality_traits?.archetype_id || 'fitness_newbie';
        
        return {
          id: user.user_id,
          username: user.username,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          personality_traits: user.personality_traits,
          ai_response_style: user.ai_response_style,
          conversation_context: user.conversation_context,
          archetype_id: archetypeId,
          is_digital_human: user.is_digital_human || false, // Check if this AI has digital human enhancement
        };
      });

      console.log(`✅ Found ${aiUsers.length} AI users available for chat`);
      return aiUsers;
    } catch (error) {
      console.error('❌ Failed to fetch AI users:', error);
      throw new Error('Failed to fetch AI users');
    }
  }

  /**
   * Get conversation context between AI and human user
   */
  async getConversationContext(
    ai_user_id: string,
    human_user_id: string,
    limit: number = 10
  ): Promise<ConversationMessage[]> {
    try {
      const { data, error } = await supabase.rpc('get_ai_conversation_context', {
        ai_user_id,
        human_user_id,
        message_limit: limit,
      });

      if (error) {
        console.error('❌ Error fetching conversation context:', error);
        return [];
      }

      return (data || []).map((msg: any) => ({
        id: msg.message_id,
        content: msg.content || '',
        is_from_ai: msg.is_from_ai,
        sent_at: msg.sent_at,
        message_type: msg.message_type,
      }));
    } catch (error) {
      console.error('❌ Failed to fetch conversation context:', error);
      return [];
    }
  }

  /**
   * Generate AI response to human message with memory and personality
   */
  async generateAIResponse(request: AIChatRequest): Promise<ChatResponse> {
    try {
      console.log(`🤖 Generating AI response for user ${request.ai_user_id}`);

      // Get AI persona profile
      const aiUsers = await this.getAvailableAIUsers();
      const aiPersona = aiUsers.find(user => user.id === request.ai_user_id);
      
      if (!aiPersona) {
        throw new Error('AI persona not found');
      }

      // Get or generate digital human system prompt
      let systemPrompt = await digitalHumanMemoryService.getStoredSystemPrompt(request.ai_user_id);
      if (!systemPrompt) {
        console.log('🎭 Generating new digital human personality...');
        systemPrompt = DigitalHumanPersonality.generateSystemPrompt(aiPersona);
        await digitalHumanMemoryService.storeSystemPrompt(request.ai_user_id, systemPrompt);
      }

      // Get conversation memory for relationship context
      const conversationMemory = await digitalHumanMemoryService.getConversationMemory(
        request.ai_user_id,
        request.human_user_id
      );
      
      if (conversationMemory) {
        console.log(`🧠 Memory loaded: ${conversationMemory.total_conversations} conversations, ${conversationMemory.relationship_stage} relationship`);
      } else {
        console.log('🧠 No previous memory found - this appears to be a first conversation');
      }

      // Get complete user profile for personalization
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', request.human_user_id)
        .single();

      const humanName = userProfile?.full_name || 
        conversationMemory?.human_details_learned?.name || 
        'this person';

      // Build memory-aware context
      const memoryContext = digitalHumanMemoryService.buildMemoryContext(conversationMemory, humanName);

      // Get recent conversation context if not provided
      const conversationContext = request.conversation_context || 
        await this.getConversationContext(request.ai_user_id, request.human_user_id, 8);

      // Build comprehensive context combining personality, memory, and current conversation
      const comprehensiveContext = this.buildMemoryAwareChatContext(
        systemPrompt,
        memoryContext,
        request.human_message,
        conversationContext,
        userProfile
      );

      // Generate response using dedicated digital human AI service
      const digitalHumanRequest: DigitalHumanRequest = {
        systemPrompt: systemPrompt,
        conversationContext: comprehensiveContext,
        currentMessage: request.human_message,
        personaName: aiPersona.full_name,
        personaId: aiPersona.id,
        maxTokens: this.getMaxTokensForPersona(aiPersona),
        temperature: this.getTemperatureForPersona(aiPersona),
      };

      const aiResponseResult = await digitalHumanAIService.generateConversation(digitalHumanRequest);
      
      // Log validation results for monitoring
      if (!aiResponseResult.isValid) {
        console.warn(`⚠️ Digital human response validation issues for ${aiPersona.full_name}:`, aiResponseResult.validationIssues);
        if (aiResponseResult.usedFallback) {
          console.warn(`🔄 Used fallback service for ${aiPersona.full_name}`);
        }
      }
      
      const aiResponse = aiResponseResult.content;
      
      // Calculate realistic typing delay
      const typingDelay = this.calculateTypingDelay(aiResponse, aiPersona);

      // Send AI message using the special AI messaging function
      const messageId = await this.sendAIMessage({
        ai_user_id: request.ai_user_id,
        receiver_id: request.human_user_id,
        content: aiResponse,
        personality_type: aiPersona.archetype_id,
        response_context: {
          human_message: request.human_message,
          conversation_length: conversationContext.length,
          has_memory: !!conversationMemory,
          relationship_stage: conversationMemory?.relationship_stage || 'new_connection',
          response_validation: {
            is_valid: aiResponseResult.isValid,
            used_fallback: aiResponseResult.usedFallback,
            validation_issues: aiResponseResult.validationIssues
          }
        },
      });

      // Update conversation memory after interaction
      await this.updateConversationMemoryAfterResponse(
        request.ai_user_id,
        request.human_user_id,
        request.human_message,
        aiResponse,
        conversationContext,
        aiPersona.full_name,
        humanName
      );

      console.log(`✅ AI response generated and sent: ${messageId}`);

      return {
        message_id: messageId,
        content: aiResponse,
        typing_delay_ms: typingDelay,
      };
    } catch (error) {
      console.error('❌ Failed to generate AI response:', error);
      throw new Error(`AI response generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send AI message using special AI messaging function
   */
  private async sendAIMessage(params: {
    ai_user_id: string;
    receiver_id: string;
    content: string;
    media_url?: string;
    media_type?: 'photo' | 'video';
    personality_type?: string;
    response_context?: any;
  }): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('send_ai_message', {
        ai_user_id: params.ai_user_id,
        receiver_user_id: params.receiver_id,
        message_content: params.content,
        message_media_url: params.media_url || null,
        message_media_type: params.media_type || null,
        personality_type: params.personality_type || null,
        context_data: params.response_context || null,
      });

      if (error) {
        console.error('❌ Error sending AI message:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('❌ Failed to send AI message:', error);
      throw new Error(`Failed to send AI message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build memory-aware context combining personality, memory, and conversation
   */
  private buildMemoryAwareChatContext(
    systemPrompt: string,
    memoryContext: string,
    humanMessage: string,
    conversationContext: ConversationMessage[],
    userProfile: any
  ): string {
    const recentConversation = conversationContext.length > 0
      ? `RECENT CONVERSATION:\n${conversationContext.slice(-6).map(msg => 
          `${msg.is_from_ai ? 'You' : 'Them'}: ${msg.content}`
        ).join('\n')}\n\n`
      : '';

    return `${systemPrompt}

${memoryContext}

${recentConversation}CURRENT MESSAGE: "${humanMessage}"

RESPONSE INSTRUCTIONS:
- Stay in character as described in your personality
- Reference your memory of this person and your relationship naturally
- Respond as a real person would, not as a fitness coach or trainer
- Ask about their life, share relevant details about your own life
- Build on previous conversations and show you remember what they've shared
- Keep the conversation balanced between fitness and other life topics
- Be genuine, warm, and engaging

Remember: You're a real person who loves fitness, not a professional coach. Respond authentically!`;
  }

  /**
   * Update conversation memory after an AI response
   */
  private async updateConversationMemoryAfterResponse(
    aiUserId: string,
    humanUserId: string,
    humanMessage: string,
    aiResponse: string,
    conversationContext: ConversationMessage[],
    aiName: string,
    humanName: string
  ): Promise<void> {
    try {
      // Extract any new details about the human from their message
      const newDetails = digitalHumanMemoryService.extractHumanDetails([
        { content: humanMessage, is_ai_sender: false }
      ]);

      // Update memory if we learned something new
      if (Object.keys(newDetails).length > 0) {
        await digitalHumanMemoryService.updateHumanDetailsLearned(
          aiUserId,
          humanUserId,
          newDetails
        );
      }

      // Update basic conversation tracking
      await digitalHumanMemoryService.updateConversationMemory(
        aiUserId,
        humanUserId,
        2 // Human message + AI response
      );

      // Every few conversations, generate a detailed summary
      const conversationCount = conversationContext.length + 2;
      if (conversationCount % 6 === 0) { // Every 6 messages (3 exchanges)
        console.log('🧠 Generating conversation summary for memory...');
        
        const recentMessages = [
          ...conversationContext.slice(-4), // Last 4 messages
          { content: humanMessage, is_ai_sender: false, sent_at: new Date().toISOString() },
          { content: aiResponse, is_ai_sender: true, sent_at: new Date().toISOString() }
        ];
        
        const summary = await digitalHumanMemoryService.generateConversationSummary(
          recentMessages,
          aiName,
          humanName
        );

        if (summary) {
          await digitalHumanMemoryService.updateConversationMemory(
            aiUserId,
            humanUserId,
            0, // Don't double-count messages
            summary
          );
        }
      }

    } catch (error) {
      console.error('❌ Failed to update conversation memory:', error);
      // Don't throw - memory updates shouldn't break the conversation
    }
  }

  /**
   * Build enhanced context for AI chat responses (legacy method, kept for compatibility)
   */
  private buildEnhancedChatContext(
    aiPersona: AIPersonaProfile,
    conversationContext: ConversationMessage[],
    humanMessage: string,
    userHealthContext?: any
  ): string {
    const archetype = AI_ARCHETYPES.find(a => a.id === aiPersona.archetype_id);
    const archetypeName = archetype?.name || 'Fitness Enthusiast';

    const conversationSummary = conversationContext.length > 0
      ? `Recent conversation (${conversationContext.length} messages):
${conversationContext.slice(0, 3).map(msg => 
  `- ${msg.is_from_ai ? 'You' : 'User'}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
).join('\n')}`
      : 'This is the start of your conversation.';

    const personalityTraits = aiPersona.personality_traits || {};
    const responseStyle = aiPersona.ai_response_style || {};

    // Extract user profile information
    const userProfile = userHealthContext?.profile || {};
    const userStats = userHealthContext?.currentStats || {};
    const userPrefs = userHealthContext?.preferences || {};

    const userContext = userProfile.full_name ? `
USER PROFILE CONTEXT:
- Name: ${userProfile.full_name}
- Fitness Level: ${userProfile.fitness_level || 'intermediate'}
- Goals: ${Array.isArray(userProfile.goals) ? userProfile.goals.join(', ') : 'general fitness'}
- Activity Level: ${userProfile.current_activity_level || 'lightly_active'}
- Workout Frequency: ${userProfile.workout_frequency || 3} times per week
- Preferred Duration: ${userProfile.preferred_workout_duration || 30} minutes
- Workout Intensity: ${userProfile.workout_intensity || 'moderate'}
- Location: ${userProfile.location || 'not specified'}
- Dietary Preferences: ${Array.isArray(userProfile.dietary_preferences) && userProfile.dietary_preferences.length > 0 ? userProfile.dietary_preferences.join(', ') : 'none specified'}
- Energy Level: ${userStats.energy_level || 5}/10
- Stress Level: ${userStats.stress_level || 3}/10
- Coaching Style Preference: ${userPrefs.coaching_style || 'motivational'}
- Motivation Style: ${userPrefs.motivation_style || 'encouraging'}
${userProfile.biggest_fitness_challenge ? `- Biggest Challenge: ${userProfile.biggest_fitness_challenge}` : ''}
${userProfile.primary_motivation ? `- Primary Motivation: ${userProfile.primary_motivation}` : ''}
${userProfile.injuries_limitations ? `- Injuries/Limitations: ${userProfile.injuries_limitations}` : ''}` : '';

    return `
PERSONA CONTEXT:
- You are ${aiPersona.full_name} (@${aiPersona.username})
- Archetype: ${archetypeName}
- Fitness Level: ${personalityTraits.fitness_level || 'intermediate'}
- Communication Style: ${responseStyle.communication_style || 'friendly'}
- Response Length: ${responseStyle.average_message_length || 'medium'}
- Emoji Usage: ${responseStyle.emoji_usage || 'moderate'}
${userContext}

CONVERSATION CONTEXT:
${conversationSummary}

CURRENT MESSAGE CONTEXT:
- User just said: "${humanMessage}"
- Respond as ${aiPersona.full_name} would, staying in character
- Use the user's profile information to personalize your response
- Reference their fitness level, goals, and preferences naturally
- Be helpful with fitness advice while maintaining your personality
- Keep your response conversational and engaging

PERSONALITY GUIDELINES:
- Communication tone: ${responseStyle.communication_tone || 'encouraging'}
- Encouragement style: ${responseStyle.encouragement_style || 'supportive'}
- Technical detail level: ${responseStyle.technical_detail_level || 'moderate'}
- Personal story sharing: ${responseStyle.shares_personal_stories ? 'occasionally share relevant experiences' : 'focus on the user'}`;
  }

  /**
   * Determine appropriate message type based on human input
   */
  private determineMessageType(
    humanMessage: string,
    conversationContext: ConversationMessage[]
  ): HealthCoachingRequest['messageType'] {
    const message = humanMessage.toLowerCase();

    // Check for celebration cues
    if (message.includes('achieved') || message.includes('completed') || 
        message.includes('finished') || message.includes('won') ||
        message.includes('pr') || message.includes('personal record')) {
      return 'celebration';
    }

    // Check for advice seeking
    if (message.includes('how') || message.includes('what should') || 
        message.includes('advice') || message.includes('recommend') ||
        message.includes('help') || message.includes('?')) {
      return 'advice';
    }

    // Check for motivation needs
    if (message.includes('tired') || message.includes('unmotivated') ||
        message.includes('struggling') || message.includes('hard') ||
        message.includes('difficult')) {
      return 'motivation';
    }

    // Check for check-in responses
    if (conversationContext.length === 0 || 
        message.includes('doing') || message.includes('feeling')) {
      return 'check_in';
    }

    // Default to suggestion for other messages
    return 'suggestion';
  }

  /**
   * Get appropriate max tokens for AI persona
   */
  private getMaxTokensForPersona(aiPersona: AIPersonaProfile): number {
    const responseStyle = aiPersona.ai_response_style || {};
    const messageLength = responseStyle.average_message_length || 'medium';

    switch (messageLength) {
      case 'short':
        return 100;
      case 'long':
        return 250;
      case 'medium':
      default:
        return 150;
    }
  }

  /**
   * Get appropriate temperature for AI persona
   */
  private getTemperatureForPersona(aiPersona: AIPersonaProfile): number {
    const personalityTraits = aiPersona.personality_traits || {};
    const creativityLevel = personalityTraits.creativity_level || 'medium';

    switch (creativityLevel) {
      case 'high':
        return 0.9;
      case 'low':
        return 0.6;
      case 'medium':
      default:
        return 0.8;
    }
  }

  /**
   * Personalize response to match AI persona style
   */
  private personalizeResponseForAI(response: string, aiPersona: AIPersonaProfile): string {
    const responseStyle = aiPersona.ai_response_style || {};
    const emojiUsage = responseStyle.emoji_usage || 'moderate';

    let personalizedResponse = response;

    // Adjust emoji usage based on persona
    if (emojiUsage === 'minimal') {
      personalizedResponse = personalizedResponse.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '');
    } else if (emojiUsage === 'frequent') {
      // Add extra emojis if the response doesn't have many
      const emojiCount = (personalizedResponse.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
      if (emojiCount < 2) {
        const archetype = AI_ARCHETYPES.find(a => a.id === aiPersona.archetype_id);
        if (archetype?.id === 'cardio_queen') {
          personalizedResponse += ' 🏃‍♀️';
        } else if (archetype?.id === 'strength_warrior') {
          personalizedResponse += ' 💪';
        } else if (archetype?.id === 'zen_master') {
          personalizedResponse += ' ✨';
        } else if (archetype?.id === 'outdoor_adventurer') {
          personalizedResponse += ' 🏔️';
        } else {
          personalizedResponse += ' 😊';
        }
      }
    }

    return personalizedResponse;
  }

  /**
   * Calculate realistic typing delay based on message length and persona
   */
  private calculateTypingDelay(message: string, aiPersona: AIPersonaProfile): number {
    const responseStyle = aiPersona.ai_response_style || {};
    const responseSpeed = responseStyle.response_speed || 'normal';

    // Base calculation: ~40 WPM typing speed
    const words = message.split(' ').length;
    const baseTypingTimeMs = (words / 40) * 60 * 1000;

    // Add thinking time
    const thinkingTimeMs = Math.random() * 2000 + 1000; // 1-3 seconds

    // Adjust based on persona response speed
    let speedMultiplier = 1;
    switch (responseSpeed) {
      case 'fast':
        speedMultiplier = 0.7;
        break;
      case 'slow':
        speedMultiplier = 1.5;
        break;
      case 'normal':
      default:
        speedMultiplier = 1;
        break;
    }

    const totalDelay = (baseTypingTimeMs + thinkingTimeMs) * speedMultiplier;

    // Cap delays between 2 and 15 seconds for good UX
    return Math.max(2000, Math.min(15000, Math.round(totalDelay)));
  }

  /**
   * Handle incoming message and trigger AI response with natural delay
   */
  async handleIncomingMessage(
    messageId: string,
    senderId: string,
    content: string
  ): Promise<void> {
    try {
      console.log(`📨 Handling incoming message for AI response: ${messageId}`);

      // Check if sender is an AI user (if so, don't respond)
      const aiUsers = await this.getAvailableAIUsers();
      const isFromAI = aiUsers.some(ai => ai.id === senderId);
      if (isFromAI) {
        console.log('🤖 Message is from AI user, skipping response');
        return;
      }

      // For now, randomly select an AI user to respond (in production, you might have logic for this)
      // Or you could implement "friend" relationships between humans and AIs
      const randomAI = aiUsers[Math.floor(Math.random() * Math.min(3, aiUsers.length))]; // Pick from top 3
      
      if (!randomAI) {
        console.log('❌ No AI users available to respond');
        return;
      }

      // Generate response with delay
      const response = await this.generateAIResponse({
        ai_user_id: randomAI.id,
        human_user_id: senderId,
        human_message: content,
      });

      // Apply the natural typing delay
      setTimeout(() => {
        console.log(`✅ AI response sent after ${response.typing_delay_ms}ms delay`);
      }, response.typing_delay_ms);

    } catch (error) {
      console.error('❌ Failed to handle incoming message for AI response:', error);
    }
  }

  /**
   * Start a conversation with a specific AI user
   */
  async startConversationWithAI(aiUserId: string, humanUserId: string): Promise<ChatResponse> {
    try {
      console.log(`💬 Starting conversation between human ${humanUserId} and AI ${aiUserId}`);

      const aiUsers = await this.getAvailableAIUsers();
      const aiPersona = aiUsers.find(user => user.id === aiUserId);
      
      if (!aiPersona) {
        throw new Error('AI persona not found');
      }

      // Generate a greeting message
      const greetingMessage = this.generateGreeting(aiPersona);

      const response = await this.generateAIResponse({
        ai_user_id: aiUserId,
        human_user_id: humanUserId,
        human_message: greetingMessage, // Use as prompt for the AI system
      });

      return response;
    } catch (error) {
      console.error('❌ Failed to start AI conversation:', error);
      throw new Error(`Failed to start conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate appropriate greeting for AI persona
   */
  private generateGreeting(aiPersona: AIPersonaProfile): string {
    const archetype = AI_ARCHETYPES.find(a => a.id === aiPersona.archetype_id);
    
    // This is used as context for the AI system, not as the actual greeting
    return `Generate a friendly greeting message to start a conversation. Introduce yourself as ${aiPersona.full_name} and mention your fitness interests based on your ${archetype?.name || 'fitness enthusiast'} personality.`;
  }
}

// Export singleton instance
export const aiChatService = AIChatService.getInstance();
export default aiChatService;