/**
 * ElevenLabs Voice Service
 * 🎙️ Ultra-realistic voice synthesis for Coach Alex
 * Professional-grade text-to-speech with emotion and personality
 */

export interface ElevenLabsVoiceOptions {
  voice_id?: string;
  model_id?: string;
  voice_settings?: {
    stability: number;        // 0.0 - 1.0 (higher = more stable)
    similarity_boost: number; // 0.0 - 1.0 (higher = more similar to training)
    style: number;           // 0.0 - 1.0 (higher = more expressive)
    use_speaker_boost: boolean;
  };
  pronunciation_dictionary_locators?: string[];
}

export interface ElevenLabsResponse {
  success: boolean;
  audioUri?: string;
  error?: string;
  duration?: number;
}

export class ElevenLabsService {
  private static instance: ElevenLabsService;
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  // Pre-selected Coach Alex voices (professional fitness coach personalities)
  private readonly COACH_VOICES = {
    // Male voices - energetic and supportive
    alex_male: 'pNInz6obpgDQGcFmaJgB', // Adam - clear and motivational
    alex_confident: 'VR6AewLTigWG4xSOukaG', // Josh - confident and encouraging
    alex_friendly: 'CYw3kZ02Hs0563khs1Fj', // Gideon - warm and approachable
    
    // Female voices - supportive and energetic  
    alex_female: 'EXAVITQu4vr4xnSDxMaL', // Bella - clear and encouraging
    alex_energetic: 'MF3mGyEYCl7XYWbV9V6O', // Elli - energetic and positive
    alex_supportive: 'oWAxZDx7w5VEj9dCyTzz', // Grace - supportive and calm
  };

  public static getInstance(): ElevenLabsService {
    if (!ElevenLabsService.instance) {
      ElevenLabsService.instance = new ElevenLabsService();
    }
    return ElevenLabsService.instance;
  }

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not configured');
    } else {
      console.log('🔑 ElevenLabs API key found:', this.apiKey.substring(0, 8) + '...');
    }
  }

  /**
   * 🎙️ Generate ultra-realistic Coach Alex voice
   */
  async generateSpeech(
    text: string, 
    options: Partial<ElevenLabsVoiceOptions> = {}
  ): Promise<ElevenLabsResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('ElevenLabs API key not configured');
      }

      console.log('🎙️ Generating ElevenLabs voice for Coach Alex:', text.substring(0, 50) + '...');

      // Default Coach Alex voice settings
      const defaultOptions: ElevenLabsVoiceOptions = {
        voice_id: this.COACH_VOICES.alex_male, // Default to confident male voice
        model_id: 'eleven_multilingual_v2', // Latest model with best quality
        voice_settings: {
          stability: 0.5,           // Balanced stability
          similarity_boost: 0.8,    // High similarity to training
          style: 0.6,              // Moderate expressiveness
          use_speaker_boost: true,  // Enhanced clarity
        },
      };

      const finalOptions = { ...defaultOptions, ...options };

      // Optimize text for Coach Alex personality
      const optimizedText = this.optimizeTextForCoachAlex(text);

      const response = await fetch(`${this.baseUrl}/text-to-speech/${finalOptions.voice_id}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: optimizedText,
          model_id: finalOptions.model_id,
          voice_settings: finalOptions.voice_settings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('ElevenLabs API Response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          error: errorData
        });
        throw new Error(`ElevenLabs API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      // Get audio as blob
      const audioBlob = await response.blob();
      
      // Convert to base64 for React Native
      const reader = new FileReader();
      const audioUri = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      console.log('✅ ElevenLabs voice generated successfully');

      return {
        success: true,
        audioUri,
        duration: this.estimateAudioDuration(optimizedText),
      };

    } catch (error) {
      console.error('❌ ElevenLabs voice generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown ElevenLabs error',
      };
    }
  }

  /**
   * 🎯 Get available Coach Alex voice options
   */
  getCoachVoiceOptions(): { id: string; name: string; description: string }[] {
    return [
      {
        id: this.COACH_VOICES.alex_male,
        name: 'Coach Alex (Male)',
        description: 'Confident and motivational male coach'
      },
      {
        id: this.COACH_VOICES.alex_confident,
        name: 'Coach Alex (Confident)',
        description: 'Strong and encouraging leadership style'
      },
      {
        id: this.COACH_VOICES.alex_friendly,
        name: 'Coach Alex (Friendly)',
        description: 'Warm and approachable coaching style'
      },
      {
        id: this.COACH_VOICES.alex_female,
        name: 'Coach Alex (Female)',
        description: 'Clear and encouraging female coach'
      },
      {
        id: this.COACH_VOICES.alex_energetic,
        name: 'Coach Alex (Energetic)',
        description: 'High-energy and positive motivation'
      },
      {
        id: this.COACH_VOICES.alex_supportive,
        name: 'Coach Alex (Supportive)',
        description: 'Calm and understanding guidance'
      },
    ];
  }

  /**
   * 🔧 Get voice settings based on coaching context
   */
  getContextualVoiceSettings(context: {
    energyLevel?: string;
    motivationNeeded?: boolean;
    isEncouraging?: boolean;
  }): ElevenLabsVoiceOptions['voice_settings'] {
    const { energyLevel, motivationNeeded, isEncouraging } = context;

    // High energy situations
    if (energyLevel === 'high' || motivationNeeded) {
      return {
        stability: 0.4,           // Less stable = more dynamic
        similarity_boost: 0.8,
        style: 0.8,              // More expressive
        use_speaker_boost: true,
      };
    }

    // Supportive/encouraging situations  
    if (isEncouraging || energyLevel === 'low') {
      return {
        stability: 0.7,           // More stable = calmer
        similarity_boost: 0.9,
        style: 0.4,              // Less expressive = more soothing
        use_speaker_boost: true,
      };
    }

    // Default balanced settings
    return {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.6,
      use_speaker_boost: true,
    };
  }

  /**
   * 🔧 Test API key validity
   */
  async testApiKey(): Promise<{ valid: boolean; error?: string }> {
    try {
      if (!this.apiKey) {
        return { valid: false, error: 'No API key configured' };
      }

      console.log('🔑 Testing ElevenLabs API key...');
      
      const response = await fetch(`${this.baseUrl}/user`, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
          'Accept': 'application/json',
        },
      });

      const responseText = await response.text();
      console.log('ElevenLabs test response:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText.substring(0, 200)
      });

      if (!response.ok) {
        return { 
          valid: false, 
          error: `API test failed: ${response.status} - ${responseText}` 
        };
      }

      console.log('✅ ElevenLabs API key is valid');
      return { valid: true };
    } catch (error) {
      console.error('❌ Failed to test ElevenLabs API key:', error);
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 📈 Check API usage and quota
   */
  async getUsageInfo(): Promise<{
    character_count: number;
    character_limit: number;
    can_extend_character_limit: boolean;
  } | null> {
    try {
      if (!this.apiKey) return null;

      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.subscription || null;
    } catch (error) {
      console.error('Failed to get ElevenLabs usage info:', error);
      return null;
    }
  }

  // Private helper methods

  /**
   * Optimize text specifically for Coach Alex personality
   */
  private optimizeTextForCoachAlex(text: string): string {
    return text
      // Add natural coaching enthusiasm
      .replace(/\bgreat\b/gi, 'fantastic')
      .replace(/\bgood job\b/gi, 'amazing work')
      .replace(/\bokay\b/gi, 'perfect')
      
      // Enhance motivational language
      .replace(/\byou can\b/gi, "you've got this")
      .replace(/\btry\b/gi, 'go for it')
      
      // Add natural speech patterns
      .replace(/\. /g, '. ')
      .replace(/! /g, '! ')
      .replace(/\? /g, '? ')
      
      // Fitness-specific optimizations
      .replace(/\bPR\b/g, 'personal record')
      .replace(/\bHR\b/g, 'heart rate')
      .replace(/\bRPE\b/g, 'rate of perceived exertion')
      
      // Remove any markup that might interfere
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      
      .trim();
  }

  /**
   * Estimate audio duration based on text length
   */
  private estimateAudioDuration(text: string): number {
    // Average speaking rate: ~150 words per minute = 2.5 words per second
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / 2.5);
  }
}

// Export singleton instance
export const elevenLabsService = ElevenLabsService.getInstance();