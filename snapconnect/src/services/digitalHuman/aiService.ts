/**
 * Digital Human AI Service
 * Dedicated AI service for digital human personas - separate from Coach Alex system
 * Includes safety features to prevent hallucinations and ensure personality consistency
 */

import OpenAI from 'openai';
import { healthAIService } from '../healthAIService'; // Fallback service

// Separate OpenAI client for digital humans
let digitalHumanOpenAI: OpenAI;

function getDigitalHumanOpenAIClient(): OpenAI {
  if (!digitalHumanOpenAI) {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key not configured for digital humans');
    }
    digitalHumanOpenAI = new OpenAI({ apiKey });
  }
  return digitalHumanOpenAI;
}

export interface DigitalHumanRequest {
  systemPrompt: string; // Complete personality prompt
  conversationContext: string; // Memory and conversation context
  currentMessage: string; // Human's current message
  personaName: string; // Expected persona name for validation
  personaId: string; // For logging and debugging
  maxTokens?: number;
  temperature?: number;
}

export interface DigitalHumanResponse {
  content: string;
  isValid: boolean;
  validationIssues: string[];
  usedFallback: boolean;
}

interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

export class DigitalHumanAIService {
  private static instance: DigitalHumanAIService;

  public static getInstance(): DigitalHumanAIService {
    if (!DigitalHumanAIService.instance) {
      DigitalHumanAIService.instance = new DigitalHumanAIService();
    }
    return DigitalHumanAIService.instance;
  }

  /**
   * Generate conversation response for digital human persona
   */
  async generateConversation(request: DigitalHumanRequest): Promise<DigitalHumanResponse> {
    console.log(`🎭 Generating response for ${request.personaName} (${request.personaId})`);
    
    try {
      // Build the complete prompt with safety constraints
      const safeSystemPrompt = this.addSafetyConstraints(request.systemPrompt, request.personaName);
      const userPrompt = this.buildConversationPrompt(request);
      
      // Generate response with OpenAI
      const completion = await getDigitalHumanOpenAIClient().chat.completions.create({
        model: 'gpt-3.5-turbo', // Use 3.5 for cost efficiency and consistency
        messages: [
          {
            role: 'system',
            content: safeSystemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: request.maxTokens || 150,
        temperature: request.temperature || 0.7, // Lower temperature for consistency
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response generated from OpenAI');
      }

      // Validate the response
      const validation = this.validateResponse(content, request.personaName, request.personaId);
      
      if (validation.isValid) {
        console.log(`✅ Valid response generated for ${request.personaName}`);
        return {
          content: content.trim(),
          isValid: true,
          validationIssues: [],
          usedFallback: false
        };
      } else {
        console.warn(`⚠️ Response validation failed for ${request.personaName}:`, validation.issues);
        
        // Try once more with stricter prompt
        const retryResult = await this.retryWithStricterPrompt(request);
        if (retryResult) {
          return retryResult;
        }
        
        // Fall back to health AI service as safety net
        console.log(`🔄 Using fallback service for ${request.personaName}`);
        const fallbackResponse = await this.useFallbackService(request);
        
        return {
          content: fallbackResponse,
          isValid: false,
          validationIssues: validation.issues,
          usedFallback: true
        };
      }

    } catch (error) {
      console.error(`❌ Error generating response for ${request.personaName}:`, error);
      
      // Use fallback service
      try {
        const fallbackResponse = await this.useFallbackService(request);
        return {
          content: fallbackResponse,
          isValid: false,
          validationIssues: ['OpenAI service error'],
          usedFallback: true
        };
      } catch (fallbackError) {
        console.error('❌ Fallback service also failed:', fallbackError);
        
        // Final fallback - simple response
        return {
          content: `Hey! I'm having some technical difficulties right now, but I'm still here to chat. How are you doing?`,
          isValid: false,
          validationIssues: ['Complete service failure'],
          usedFallback: true
        };
      }
    }
  }

  /**
   * Add safety constraints to system prompt
   */
  private addSafetyConstraints(systemPrompt: string, personaName: string): string {
    const firstName = personaName.split(' ')[0];
    
    return `${systemPrompt}

CRITICAL SAFETY CONSTRAINTS:
- You MUST always identify yourself as ${personaName} (people call you ${firstName})
- NEVER identify yourself as "Alex" or any other name
- If you're unsure about something, say "I don't know" rather than making something up
- Stay factual about your background story - don't add details not in your personality
- If asked about topics outside your expertise, acknowledge your limitations
- Keep responses conversational and authentic to your personality
- Focus on building genuine relationships, not providing professional advice

RESPONSE VALIDATION:
- Start responses naturally (don't always say your name, but be clear who you are when relevant)
- Reference your established personality and memories when appropriate
- Ask follow-up questions to show genuine interest
- Balance sharing about yourself with learning about them`;
  }

  /**
   * Build conversation prompt with context
   */
  private buildConversationPrompt(request: DigitalHumanRequest): string {
    return `${request.conversationContext}

CURRENT MESSAGE FROM HUMAN: "${request.currentMessage}"

Please respond as ${request.personaName} in a natural, authentic way. Remember to:
1. Stay true to your personality and background
2. Reference your memories of this person if you have any
3. Be genuine and conversational
4. Ask follow-up questions to show interest
5. Share relevant details about your own life when appropriate

Generate a warm, engaging response that feels like it's coming from a real person.`;
  }

  /**
   * Validate response for personality consistency and safety
   */
  private validateResponse(response: string, expectedPersonaName: string, personaId: string): ValidationResult {
    const issues: string[] = [];
    const responseLower = response.toLowerCase();
    const expectedFirstName = expectedPersonaName.split(' ')[0].toLowerCase();
    
    // Check for Alex contamination
    if (responseLower.includes("i'm alex") || responseLower.includes("i am alex")) {
      issues.push('Response identifies as Alex instead of correct persona');
    }
    
    // Check for Coach/trainer language (should be conversational, not professional)
    const coachingLanguage = [
      'as your trainer', 'as your coach', 'let me help you design',
      'here\'s a workout plan', 'as a fitness professional'
    ];
    
    if (coachingLanguage.some(phrase => responseLower.includes(phrase))) {
      issues.push('Response uses professional coaching language instead of personal conversation');
    }
    
    // Check for obviously fabricated details
    const suspiciousPatterns = [
      'my phd in', 'my degree from harvard', 'when i was competing in the olympics',
      'my certification in', 'my 20 years of experience'
    ];
    
    if (suspiciousPatterns.some(pattern => responseLower.includes(pattern))) {
      issues.push('Response contains potentially fabricated credentials or achievements');
    }
    
    // Check response length (should be conversational, not essay-length)
    if (response.length > 800) {
      issues.push('Response is too long for natural conversation');
    }
    
    // Check if response is too generic
    if (response.length < 20) {
      issues.push('Response is too short/generic');
    }
    
    // Log validation for debugging
    console.log(`🔍 Validation for ${expectedPersonaName}: ${issues.length} issues found`);
    if (issues.length > 0) {
      console.log(`   Issues:`, issues);
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Retry with stricter prompt if first attempt fails validation
   */
  private async retryWithStricterPrompt(request: DigitalHumanRequest): Promise<DigitalHumanResponse | null> {
    console.log(`🔄 Retrying with stricter prompt for ${request.personaName}`);
    
    try {
      const stricterPrompt = `${request.systemPrompt}

ABSOLUTE REQUIREMENTS:
- You are ${request.personaName} - say this clearly if you introduce yourself
- NEVER mention "Alex" or claim to be a trainer/coach
- Keep response under 300 characters
- Be conversational and personal, not professional
- Reference your established background only

${request.conversationContext}

Human said: "${request.currentMessage}"

Respond as ${request.personaName} would - personally and authentically. Keep it natural and friendly.`;

      const completion = await getDigitalHumanOpenAIClient().chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: stricterPrompt,
          },
        ],
        max_tokens: 100, // Shorter response
        temperature: 0.6, // Even more consistent
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return null;
      }

      // Validate retry attempt
      const validation = this.validateResponse(content, request.personaName, request.personaId);
      
      if (validation.isValid) {
        console.log(`✅ Retry successful for ${request.personaName}`);
        return {
          content: content.trim(),
          isValid: true,
          validationIssues: [],
          usedFallback: false
        };
      } else {
        console.log(`❌ Retry also failed validation for ${request.personaName}`);
        return null;
      }

    } catch (error) {
      console.error(`❌ Retry attempt failed for ${request.personaName}:`, error);
      return null;
    }
  }

  /**
   * Use health AI service as fallback (but modify response to remove Alex)
   */
  private async useFallbackService(request: DigitalHumanRequest): Promise<string> {
    console.log(`🆘 Using fallback service for ${request.personaName}`);
    
    try {
      // Use existing health AI service but modify the response
      const fallbackResponse = await healthAIService.generateHealthCoachingMessage({
        healthContext: {
          profile: { fitness_level: 'intermediate', goals: ['general_fitness'] },
          currentStats: { energy_level: 5, stress_level: 3 },
          preferences: { coaching_style: 'conversational' }
        },
        messageType: 'conversation',
        userMessage: request.currentMessage,
        additionalContext: `Respond as a friendly person who enjoys fitness, not as a professional coach. Keep it personal and conversational.`,
        maxTokens: 100,
        temperature: 0.7
      });
      
      // Clean up the response to remove Alex references and coaching language
      const cleanedResponse = this.cleanFallbackResponse(fallbackResponse, request.personaName);
      
      return cleanedResponse;
      
    } catch (error) {
      console.error('❌ Fallback service failed:', error);
      throw error;
    }
  }

  /**
   * Clean fallback response to match persona
   */
  private cleanFallbackResponse(response: string, personaName: string): string {
    const firstName = personaName.split(' ')[0];
    
    // Remove Alex references
    let cleaned = response
      .replace(/I'm Alex/gi, `I'm ${firstName}`)
      .replace(/I am Alex/gi, `I am ${firstName}`)
      .replace(/Alex here/gi, `${firstName} here`);
    
    // Remove overly professional language
    cleaned = cleaned
      .replace(/As your trainer/gi, 'From my experience')
      .replace(/As your coach/gi, 'In my opinion')
      .replace(/Let me help you design/gi, 'You might want to try')
      .replace(/I recommend/gi, 'I think')
      .replace(/As a fitness professional/gi, 'As someone who loves fitness');
    
    // Make it more conversational
    if (cleaned.length > 200) {
      // Truncate long responses
      const sentences = cleaned.split('. ');
      cleaned = sentences.slice(0, 2).join('. ');
      if (!cleaned.endsWith('.')) {
        cleaned += '.';
      }
    }
    
    return cleaned;
  }

  /**
   * Get service status for monitoring
   */
  getServiceStatus(): {
    isHealthy: boolean;
    hasOpenAIAccess: boolean;
    fallbackAvailable: boolean;
  } {
    try {
      return {
        isHealthy: !!digitalHumanOpenAI || this.canCreateOpenAIClient(),
        hasOpenAIAccess: this.canCreateOpenAIClient(),
        fallbackAvailable: true // Health AI service is available as fallback
      };
    } catch (error) {
      return {
        isHealthy: false,
        hasOpenAIAccess: false,
        fallbackAvailable: true
      };
    }
  }

  /**
   * Check if OpenAI client can be created
   */
  private canCreateOpenAIClient(): boolean {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    return !!(apiKey && apiKey !== 'your_openai_api_key_here');
  }
}

// Export singleton instance
export const digitalHumanAIService = DigitalHumanAIService.getInstance();
export default digitalHumanAIService;