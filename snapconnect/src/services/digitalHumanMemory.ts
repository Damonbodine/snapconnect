/**
 * Digital Human Memory Service
 * Manages persistent conversation memory and relationship tracking for AI personas
 */

import { supabase } from './supabase';
import { healthAIService } from './healthAIService';

export interface ConversationMemory {
  memory_id: string;
  total_conversations: number;
  relationship_stage: 'new_connection' | 'getting_acquainted' | 'friendly_acquaintance' | 'good_friend' | 'close_friend';
  human_details_learned: Record<string, any>;
  shared_experiences: string[];
  last_conversation_summary: string | null;
  ongoing_topics: string[];
  recent_snapshots: ConversationSnapshot[];
}

export interface ConversationSnapshot {
  date: string;
  summary: string;
  topics: string[];
  emotional_tone: string;
}

export interface HumanDetails {
  name?: string;
  job?: string;
  goals?: string[];
  interests?: string[];
  personal_details?: Record<string, any>;
  fitness_level?: string;
  challenges?: string[];
  achievements?: string[];
  preferences?: Record<string, any>;
}

export interface ConversationSummary {
  summary: string;
  topics_discussed: string[];
  new_details_learned: HumanDetails;
  emotional_tone: 'positive' | 'neutral' | 'supportive' | 'concerned' | 'excited' | 'reflective';
  importance_score: 1 | 2 | 3 | 4 | 5;
  follow_ups: string[];
}

class DigitalHumanMemoryService {
  
  /**
   * Get conversation memory for AI context building
   */
  async getConversationMemory(
    aiUserId: string,
    humanUserId: string
  ): Promise<ConversationMemory | null> {
    try {
      console.log(`🧠 Retrieving conversation memory: AI ${aiUserId} with Human ${humanUserId}`);
      
      const { data, error } = await supabase.rpc('get_ai_conversation_memory', {
        p_ai_user_id: aiUserId,
        p_human_user_id: humanUserId
      });

      if (error) {
        console.error('❌ Error retrieving conversation memory:', error);
        return null;
      }

      if (!data || data.length === 0) {
        console.log('💭 No existing conversation memory found');
        return null;
      }

      const memory = data[0] as ConversationMemory;
      console.log(`✅ Retrieved memory: ${memory.total_conversations} conversations, ${memory.relationship_stage} relationship`);
      
      return memory;
    } catch (error) {
      console.error('❌ Failed to get conversation memory:', error);
      return null;
    }
  }

  /**
   * Update conversation memory after an interaction
   */
  async updateConversationMemory(
    aiUserId: string,
    humanUserId: string,
    messageCount: number = 1,
    conversationSummary?: ConversationSummary
  ): Promise<string | null> {
    try {
      console.log(`🧠 Updating conversation memory: ${messageCount} messages exchanged`);
      
      const { data: memoryId, error } = await supabase.rpc('update_ai_conversation_memory', {
        p_ai_user_id: aiUserId,
        p_human_user_id: humanUserId,
        p_conversation_summary: conversationSummary?.summary || null,
        p_new_details: conversationSummary?.new_details_learned || {},
        p_topics_discussed: conversationSummary?.topics_discussed || [],
        p_message_count: messageCount
      });

      if (error) {
        console.error('❌ Error updating conversation memory:', error);
        return null;
      }

      console.log('✅ Conversation memory updated successfully');
      return memoryId;
    } catch (error) {
      console.error('❌ Failed to update conversation memory:', error);
      return null;
    }
  }

  /**
   * Update human details learned by AI
   */
  async updateHumanDetailsLearned(
    aiUserId: string,
    humanUserId: string,
    newDetails: HumanDetails
  ): Promise<boolean> {
    try {
      console.log('🧠 Updating human details learned:', Object.keys(newDetails));
      
      const { data: success, error } = await supabase.rpc('update_human_details_learned', {
        p_ai_user_id: aiUserId,
        p_human_user_id: humanUserId,
        p_new_details: newDetails
      });

      if (error) {
        console.error('❌ Error updating human details:', error);
        return false;
      }

      console.log('✅ Human details updated successfully');
      return success;
    } catch (error) {
      console.error('❌ Failed to update human details:', error);
      return false;
    }
  }

  /**
   * Generate conversation summary using AI
   */
  async generateConversationSummary(
    conversationMessages: Array<{
      content: string;
      is_ai_sender: boolean;
      sent_at: string;
    }>,
    aiPersonaName: string,
    humanName?: string
  ): Promise<ConversationSummary | null> {
    try {
      console.log(`🧠 Generating conversation summary for ${conversationMessages.length} messages`);
      
      // Build conversation text
      const conversationText = conversationMessages
        .map(msg => `${msg.is_ai_sender ? aiPersonaName : (humanName || 'Human')}: ${msg.content}`)
        .join('\n');

      // Create summarization prompt
      const summarizationPrompt = `Analyze this conversation between ${aiPersonaName} (AI) and ${humanName || 'a human user'} and provide a structured summary:

CONVERSATION:
${conversationText}

Please provide a JSON response with the following structure:
{
  "summary": "Brief 2-3 sentence summary of the conversation",
  "topics_discussed": ["array", "of", "main", "topics"],
  "new_details_learned": {
    "name": "if mentioned",
    "job": "if mentioned", 
    "goals": ["if mentioned"],
    "interests": ["if mentioned"],
    "personal_details": {"any": "other details"},
    "fitness_level": "if mentioned",
    "challenges": ["if mentioned"],
    "achievements": ["if mentioned"]
  },
  "emotional_tone": "positive|neutral|supportive|concerned|excited|reflective",
  "importance_score": 1-5,
  "follow_ups": ["things to ask about next time"]
}

Focus on what ${aiPersonaName} learned about the human user, not fitness advice given. Only include details that were actually mentioned in the conversation.`;

      // Generate summary using health AI service
      const response = await healthAIService.generateHealthCoachingMessage({
        healthContext: {
          profile: { fitness_level: 'intermediate', goals: ['general_fitness'] },
          currentStats: { energy_level: 5, stress_level: 3 },
          preferences: { coaching_style: 'analytical' }
        },
        messageType: 'analysis',
        userMessage: summarizationPrompt,
        maxTokens: 300,
        temperature: 0.3
      });

      // Parse AI response as JSON
      try {
        const summary = JSON.parse(response) as ConversationSummary;
        console.log('✅ Generated conversation summary successfully');
        return summary;
      } catch (parseError) {
        console.warn('⚠️ Could not parse AI summary as JSON, creating basic summary');
        
        // Fallback to basic summary
        return {
          summary: `Conversation between ${aiPersonaName} and ${humanName || 'user'} with ${conversationMessages.length} messages exchanged.`,
          topics_discussed: ['general conversation'],
          new_details_learned: {},
          emotional_tone: 'neutral',
          importance_score: 2,
          follow_ups: []
        };
      }
    } catch (error) {
      console.error('❌ Failed to generate conversation summary:', error);
      return null;
    }
  }

  /**
   * Build memory-aware context for AI responses
   */
  buildMemoryContext(
    memory: ConversationMemory | null,
    humanName?: string
  ): string {
    if (!memory) {
      return `This appears to be your first conversation with this person. Be friendly and introduce yourself naturally.`;
    }

    const detailsLearned = memory.human_details_learned;
    const name = detailsLearned.name || humanName || 'them';
    
    let context = `CONVERSATION MEMORY CONTEXT:\n`;
    
    // Relationship stage
    context += `- You've had ${memory.total_conversations} conversation${memory.total_conversations > 1 ? 's' : ''} with ${name}\n`;
    context += `- Relationship stage: ${memory.relationship_stage.replace('_', ' ')}\n`;
    
    // What you know about them
    if (Object.keys(detailsLearned).length > 0) {
      context += `- What you know about ${name}:\n`;
      
      if (detailsLearned.name) context += `  • Name: ${detailsLearned.name}\n`;
      if (detailsLearned.job) context += `  • Job: ${detailsLearned.job}\n`;
      if (detailsLearned.goals && detailsLearned.goals.length > 0) {
        context += `  • Goals: ${Array.isArray(detailsLearned.goals) ? detailsLearned.goals.join(', ') : detailsLearned.goals}\n`;
      }
      if (detailsLearned.interests && detailsLearned.interests.length > 0) {
        context += `  • Interests: ${Array.isArray(detailsLearned.interests) ? detailsLearned.interests.join(', ') : detailsLearned.interests}\n`;
      }
      if (detailsLearned.fitness_level) context += `  • Fitness level: ${detailsLearned.fitness_level}\n`;
      if (detailsLearned.challenges && detailsLearned.challenges.length > 0) {
        context += `  • Challenges: ${Array.isArray(detailsLearned.challenges) ? detailsLearned.challenges.join(', ') : detailsLearned.challenges}\n`;
      }
      
      // Add any other personal details
      if (detailsLearned.personal_details && typeof detailsLearned.personal_details === 'object') {
        Object.entries(detailsLearned.personal_details).forEach(([key, value]) => {
          context += `  • ${key}: ${value}\n`;
        });
      }
    }
    
    // Shared experiences
    if (memory.shared_experiences && memory.shared_experiences.length > 0) {
      context += `- Shared experiences: ${memory.shared_experiences.join(', ')}\n`;
    }
    
    // Ongoing topics
    if (memory.ongoing_topics && memory.ongoing_topics.length > 0) {
      context += `- Ongoing topics: ${memory.ongoing_topics.join(', ')}\n`;
    }
    
    // Last conversation
    if (memory.last_conversation_summary) {
      context += `- Last conversation: ${memory.last_conversation_summary}\n`;
    }
    
    // Recent conversation highlights
    if (memory.recent_snapshots && memory.recent_snapshots.length > 0) {
      context += `- Recent conversation highlights:\n`;
      memory.recent_snapshots.slice(0, 3).forEach((snapshot, index) => {
        context += `  ${index + 1}. ${snapshot.date}: ${snapshot.summary}\n`;
      });
    }
    
    context += `\nRemember: Reference these details naturally in conversation. Ask follow-up questions about things they've mentioned before. Show that you remember and care about their life and progress.`;
    
    return context;
  }

  /**
   * Extract human details from conversation messages
   */
  extractHumanDetails(
    conversationMessages: Array<{
      content: string;
      is_ai_sender: boolean;
    }>
  ): HumanDetails {
    const humanMessages = conversationMessages
      .filter(msg => !msg.is_ai_sender)
      .map(msg => msg.content)
      .join(' ');
    
    const details: HumanDetails = {};
    
    // Simple extraction patterns (you could enhance this with NLP)
    const nameMatch = humanMessages.match(/(?:i'm|i am|my name is|call me)\s+([a-zA-Z]+)/i);
    if (nameMatch) details.name = nameMatch[1];
    
    const jobMatches = humanMessages.match(/(?:i work|i'm a|i am a|my job)\s+(?:as\s+)?([^.!?]+)/i);
    if (jobMatches) details.job = jobMatches[1].trim();
    
    // Goals extraction
    if (humanMessages.match(/(?:want to|trying to|goal|hoping to)/i)) {
      details.goals = ['mentioned fitness goals'];
    }
    
    // Fitness level
    if (humanMessages.match(/(?:beginner|new to|just started)/i)) {
      details.fitness_level = 'beginner';
    } else if (humanMessages.match(/(?:advanced|experienced|been doing)/i)) {
      details.fitness_level = 'advanced';
    }
    
    return details;
  }

  /**
   * Determine relationship stage based on conversation history
   */
  determineRelationshipStage(
    totalConversations: number,
    detailsLearned: Record<string, any>
  ): ConversationMemory['relationship_stage'] {
    if (totalConversations === 1) return 'new_connection';
    if (totalConversations <= 3) return 'getting_acquainted';
    
    const detailCount = Object.keys(detailsLearned).length;
    if (totalConversations <= 8 && detailCount < 5) return 'friendly_acquaintance';
    if (totalConversations <= 15 || detailCount < 8) return 'good_friend';
    
    return 'close_friend';
  }

  /**
   * Store generated system prompt for AI user
   */
  async storeSystemPrompt(
    aiUserId: string,
    systemPrompt: string
  ): Promise<boolean> {
    try {
      console.log(`🧠 Storing system prompt for AI user: ${aiUserId}`);
      
      const { data: success, error } = await supabase.rpc('generate_ai_system_prompt', {
        p_ai_user_id: aiUserId,
        p_system_prompt: systemPrompt
      });

      if (error) {
        console.error('❌ Error storing system prompt:', error);
        return false;
      }

      console.log('✅ System prompt stored successfully');
      return success;
    } catch (error) {
      console.error('❌ Failed to store system prompt:', error);
      return false;
    }
  }

  /**
   * Get stored system prompt for AI user
   */
  async getStoredSystemPrompt(aiUserId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('generated_system_prompt, personality_generated_at')
        .eq('id', aiUserId)
        .eq('is_mock_user', true)
        .single();

      if (error) {
        console.error('❌ Error retrieving system prompt:', error);
        return null;
      }

      return data?.generated_system_prompt || null;
    } catch (error) {
      console.error('❌ Failed to get system prompt:', error);
      return null;
    }
  }
}

// Export singleton instance
export const digitalHumanMemoryService = new DigitalHumanMemoryService();
export default digitalHumanMemoryService;