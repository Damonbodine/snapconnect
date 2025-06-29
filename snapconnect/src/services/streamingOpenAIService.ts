/**
 * Streaming OpenAI Service
 * Adds streaming response capability to existing OpenAI service
 */

import OpenAI from 'openai';
import { PersonalityTraits, AIArchetype } from '../types/aiPersonality';

// Initialize OpenAI client
let openai: OpenAI;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key not configured');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

export interface StreamingChatRequest {
  prompt: string;
  personality: PersonalityTraits;
  archetype: AIArchetype;
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export class StreamingOpenAIService {
  
  /**
   * Generate streaming AI response for chat messages
   */
  static async generateStreamingChatResponse({
    prompt,
    personality,
    archetype,
    onToken,
    onComplete,
    onError
  }: StreamingChatRequest): Promise<void> {
    try {
      const client = getOpenAIClient();
      
      // Build personality-aware system prompt
      const systemPrompt = this.buildPersonalityPrompt(personality, archetype);
      
      // Create streaming completion
      const stream = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        stream: true,
        max_tokens: 500,
        temperature: 0.8,
      });

      let fullResponse = '';

      // Process streaming tokens
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        
        if (content) {
          fullResponse += content;
          onToken?.(content);
        }
      }

      onComplete?.(fullResponse);
      
    } catch (error: any) {
      console.error('❌ Streaming generation failed:', error);
      onError?.(error);
    }
  }

  /**
   * Generate non-streaming response (fallback)
   */
  static async generateChatResponse({
    prompt,
    personality,
    archetype
  }: Omit<StreamingChatRequest, 'onToken' | 'onComplete' | 'onError'>): Promise<string> {
    try {
      const client = getOpenAIClient();
      
      const systemPrompt = this.buildPersonalityPrompt(personality, archetype);
      
      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.8,
      });

      return completion.choices[0]?.message?.content || '';
      
    } catch (error: any) {
      console.error('❌ Chat generation failed:', error);
      throw error;
    }
  }

  /**
   * Build personality-aware system prompt
   */
  private static buildPersonalityPrompt(
    personality: PersonalityTraits, 
    archetype: AIArchetype
  ): string {
    return `You are a ${archetype.name}, a ${archetype.description}.

Personality Traits:
- Energy Level: ${personality.energy_level}/10
- Enthusiasm: ${personality.enthusiasm}/10  
- Empathy: ${personality.empathy}/10
- Directness: ${personality.directness}/10
- Humor: ${personality.humor}/10

Communication Style:
- Be ${personality.energy_level > 7 ? 'energetic and upbeat' : 'calm and measured'}
- ${personality.enthusiasm > 7 ? 'Show excitement about fitness topics' : 'Be supportive but measured'}
- ${personality.empathy > 7 ? 'Be very understanding and emotionally supportive' : 'Be practical and solution-focused'}
- ${personality.directness > 7 ? 'Be direct and straightforward' : 'Be gentle and diplomatic'}
- ${personality.humor > 7 ? 'Use light humor when appropriate' : 'Keep tone professional and supportive'}

Keep responses conversational, helpful, and under 100 words. Focus on fitness, health, and motivation.`;
  }
}

export default StreamingOpenAIService;