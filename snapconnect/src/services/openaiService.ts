/**
 * OpenAI Service
 * Handles GPT-4o and GPT-Image-1 integration for AI content generation
 * Uses standardized settings: "low" quality and "1024x1024" size for all images
 */

import OpenAI from 'openai';
import { PersonalityTraits, AIArchetype } from '../types/aiPersonality';
import { HealthContext, WorkoutSuggestion, CoachingMessage, TrainingReadiness } from '../types/health';

// OpenAI client configuration
let openai: OpenAI;

// Initialize OpenAI client lazily to ensure environment variables are loaded
function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key not configured. Please set EXPO_PUBLIC_OPENAI_API_KEY in your .env file');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

export interface TextGenerationRequest {
  prompt: string;
  personality: PersonalityTraits;
  archetype: AIArchetype;
  contentType: 'workout_post' | 'progress_update' | 'motivation' | 'education' | 'social';
  maxTokens?: number;
  temperature?: number;
}

export interface ImageGenerationRequest {
  prompt: string;
  archetype: AIArchetype;
  workoutType?: 'strength' | 'cardio' | 'flexibility' | 'outdoor' | 'sports';
}

export interface WalkSuggestionRequest {
  walkType: string;
  distance: number;
  duration: number;
  nearbyPlaces: string[];
  userFitnessLevel: string;
  userInterests: string[];
  socialPreference: string;
  weather?: string;
  timeOfDay?: string;
}

export interface GeneratedContent {
  caption: string;
  imageBase64: string;
  metadata: {
    userId: string;
    archetype: string;
    contentType: string;
    generatedAt: string;
  };
}

export interface HealthCoachingRequest {
  healthContext: HealthContext;
  messageType: 'motivation' | 'advice' | 'celebration' | 'suggestion' | 'check_in';
  userMessage?: string;
  maxTokens?: number;
  temperature?: number;
}

export class OpenAIService {
  private static instance: OpenAIService;

  public static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  /**
   * Generate text content using GPT-4o based on personality and archetype
   */
  async generateTextContent(request: TextGenerationRequest): Promise<string> {
    try {
      console.log(`🤖 Generating ${request.contentType} content for ${request.archetype.name}`);

      const systemPrompt = this.buildSystemPrompt(request.personality, request.archetype, request.contentType);
      
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        max_tokens: request.maxTokens || 150,
        temperature: request.temperature || 0.8,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content generated from GPT-4o');
      }

      return content.trim();
    } catch (error) {
      console.error('❌ Text generation failed:', error);
      throw new Error(`Text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate image using GPT-Image-1 with standardized settings
   */
  async generateImage(request: ImageGenerationRequest): Promise<string> {
    try {
      console.log(`🎨 Generating image for ${request.archetype.name}: ${request.prompt.substring(0, 50)}...`);

      const imagePrompt = this.buildImagePrompt(request.prompt, request.archetype, request.workoutType);

      const response = await getOpenAIClient().images.generate({
        model: 'gpt-image-1',
        prompt: imagePrompt,
        size: '1024x1024', // Always use square format
        quality: 'low', // Always use low quality for cost optimization
        n: 1, // GPT-Image-1 only supports n=1
        response_format: 'b64_json', // GPT-Image-1 always returns base64
      });

      const imageData = response.data[0];
      if (!imageData.b64_json) {
        throw new Error('No image data returned from GPT-Image-1');
      }

      return imageData.b64_json;
    } catch (error) {
      console.error('❌ Image generation failed:', error);
      throw new Error(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate complete post content (caption + image) for a specific user
   * NEW FLOW: Generate image first, analyze it with vision, then create matching caption
   */
  async generateCompletePost(
    userId: string,
    personality: PersonalityTraits,
    archetype: AIArchetype,
    contentType: 'workout_post' | 'progress_update' | 'motivation' | 'education' | 'social'
  ): Promise<GeneratedContent> {
    try {
      console.log(`🚀 Generating complete post for user ${userId} (${archetype.name})`);

      // Step 1: Generate initial content concept for image generation
      const conceptPrompt = this.buildContentPrompt(contentType, personality, archetype);
      const workoutType = this.inferWorkoutTypeFromArchetype(archetype, contentType);

      // Step 2: Generate image first
      const imageRequest: ImageGenerationRequest = {
        prompt: conceptPrompt,
        archetype,
        workoutType,
      };

      const imageBase64 = await this.generateImage(imageRequest);

      // Step 3: Analyze the generated image with vision
      const imageAnalysis = await this.analyzeImageContent(imageBase64);
      console.log(`👁️ Image analysis: ${imageAnalysis.substring(0, 100)}...`);

      // Step 4: Generate caption based on what's actually in the image
      const visionGuidedPrompt = this.buildVisionGuidedPrompt(
        imageAnalysis, 
        personality, 
        archetype, 
        contentType
      );

      const textRequest: TextGenerationRequest = {
        prompt: visionGuidedPrompt,
        personality,
        archetype,
        contentType,
      };

      const caption = await this.generateTextContent(textRequest);

      return {
        caption,
        imageBase64,
        metadata: {
          userId,
          archetype: archetype.id,
          contentType,
          generatedAt: new Date().toISOString(),
          imageAnalysis: imageAnalysis.substring(0, 200), // Store first 200 chars for debugging
        },
      };
    } catch (error) {
      console.error(`❌ Complete post generation failed for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Generate personalized walk suggestion content
   */
  async generateWalkSuggestion(request: WalkSuggestionRequest): Promise<{
    title: string;
    description: string;
    fullDescription: string;
    eventTitle: string;
    eventDescription: string;
    socialPrompt: string;
    pointsOfInterest: string;
  }> {
    try {
      console.log(`🚶‍♀️ Generating walk suggestion for ${request.walkType}`);

      const prompt = this.buildWalkSuggestionPrompt(request);
      
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.buildWalkSuggestionSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 300,
        temperature: 0.8,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content generated for walk suggestion');
      }

      return this.parseWalkSuggestionResponse(content, request.walkType);
    } catch (error) {
      console.error('❌ Walk suggestion generation failed:', error);
      throw new Error(`Walk suggestion generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate motivational content for a specific walking route
   */
  async generateWalkMotivation(
    walkType: string,
    distance: number,
    places: string[],
    userInterests: string[]
  ): Promise<string> {
    try {
      const prompt = `Generate inspiring and motivational content for a ${walkType.replace('_', ' ')} that is ${distance}km long and passes by ${places.join(', ')}. 
      
      The user is interested in ${userInterests.join(', ')}. 
      
      Create content that highlights the benefits of this specific walk, mentions interesting features they'll encounter, and motivates them to take action. Keep it energetic and personal.
      
      Focus on:
      - Health and fitness benefits
      - Mental wellness aspects  
      - Discovery and exploration
      - Personal achievement
      - Connection with nature/community
      
      Write in an encouraging, friendly tone that makes them excited to start walking.`;

      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a motivational fitness coach specializing in walking and outdoor activities. Create inspiring content that gets people excited about walking and exploring their local area.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.9,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No motivational content generated');
      }

      return content.trim();
    } catch (error) {
      console.error('❌ Walk motivation generation failed:', error);
      throw new Error(`Walk motivation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate social invitation text for group walks
   */
  async generateSocialWalkInvitation(
    walkType: string,
    distance: number,
    duration: number,
    highlights: string[]
  ): Promise<string> {
    try {
      const prompt = `Create an engaging social media post inviting others to join a group walk.
      
      Walk details:
      - Type: ${walkType.replace('_', ' ')}
      - Distance: ${distance}km
      - Duration: ~${duration} minutes
      - Highlights: ${highlights.join(', ')}
      
      Make it friendly, inclusive, and exciting. Encourage people of all fitness levels to join. Include a call-to-action and highlight the social and health benefits.
      
      Keep it conversational and under 150 words.`;

      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a community organizer who creates welcoming, inclusive invitations for group fitness activities. Your goal is to bring people together for healthy, fun activities.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.8,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No social invitation content generated');
      }

      return content.trim();
    } catch (error) {
      console.error('❌ Social walk invitation generation failed:', error);
      throw new Error(`Social invitation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build walk suggestion system prompt
   */
  private buildWalkSuggestionSystemPrompt(): string {
    return `You are a personalized fitness and walking guide AI. Your goal is to create exciting, motivational, and practical walking suggestions that inspire people to get active and explore their local area.

You should:
- Create catchy, inspiring titles
- Write motivational descriptions that highlight benefits
- Consider the user's fitness level and interests
- Make suggestions feel personal and achievable
- Include social elements when appropriate
- Focus on discovery, health, and enjoyment
- ALWAYS highlight exactly 3 specific points of interest along the route

Format your response exactly as:
TITLE: [catchy title]
DESCRIPTION: [2-3 sentence motivational description]
FULL: [detailed motivational description with benefits and highlights, mentioning 3 specific stops]
POINTS: [Point 1: name - what makes it special] | [Point 2: name - what makes it special] | [Point 3: name - what makes it special]
EVENT_TITLE: [title for group event version]
EVENT_DESC: [description for group event]
SOCIAL: [invitation text for others to join]

Keep all content positive, encouraging, and action-oriented. The POINTS section should highlight real places from the nearby attractions list.`;
  }

  /**
   * Build walk suggestion prompt
   */
  private buildWalkSuggestionPrompt(request: WalkSuggestionRequest): string {
    const distance = Math.round(request.distance / 1000 * 100) / 100; // km with 2 decimals
    const duration = Math.round(request.duration / 60); // minutes
    
    const weatherText = request.weather ? ` The weather is ${request.weather}.` : '';
    const timeText = request.timeOfDay ? ` It's ${request.timeOfDay}.` : '';
    
    // Add variety prompts based on walk type
    const walkTypePrompts = {
      'park_loop': 'Create a nature-focused adventure that explores multiple green spaces, highlighting natural features and outdoor amenities.',
      'trail_hike': 'Design an outdoor expedition that leads to scenic destinations, emphasizing natural landmarks and viewpoints.',
      'urban_exploration': 'Craft a city adventure that weaves through urban attractions, focusing on cultural sites, architecture, and local gems.',
      'scenic_route': 'Build a destination walk that leads to beautiful viewpoints, highlighting photo-worthy spots and scenic overlooks.',
      'fitness_circuit': 'Design an active route that incorporates outdoor exercise opportunities and recovery spots.',
      'social_walk': 'Create a social journey perfect for conversation, ending at cafés or gathering places.'
    };
    
    const specificPrompt = walkTypePrompts[request.walkType as keyof typeof walkTypePrompts] || 
      'Create an engaging walk that explores interesting locations.';
    
    return `Create an inspiring and UNIQUE walk suggestion for a ${request.userFitnessLevel} fitness level person who enjoys ${request.userInterests.join(' and ')}.

IMPORTANT: ${specificPrompt} Make this walk distinctive with clear, interesting stops.

Walk details:
- Type: ${request.walkType.replace('_', ' ')}
- Distance: ${distance}km
- Duration: ~${duration} minutes
- Available nearby places: ${request.nearbyPlaces.join(', ')}
- Social preference: ${request.socialPreference}${weatherText}${timeText}

CRITICAL: You MUST select exactly 3 points of interest from the nearby places list above and explain what makes each special. These should be real places that someone would want to visit during their walk.

Focus on:
1. Creating a JOURNEY with a clear purpose and interesting destinations
2. Highlighting exactly 3 specific stops from the nearby places list
3. Explaining what makes each point of interest worth visiting
4. Making each suggestion feel like a curated mini-adventure
5. Emphasizing discovery and exploration

Make it personal, exciting, and highlight why this specific route and these 3 stops are worth experiencing.`;
  }

  /**
   * Parse walk suggestion AI response
   */
  private parseWalkSuggestionResponse(
    response: string,
    walkType: string
  ): {
    title: string;
    description: string;
    fullDescription: string;
    eventTitle: string;
    eventDescription: string;
    socialPrompt: string;
    pointsOfInterest: string;
  } {
    const lines = response.split('\n');
    const result = {
      title: '',
      description: '',
      fullDescription: '',
      eventTitle: '',
      eventDescription: '',
      socialPrompt: '',
      pointsOfInterest: '',
    };

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('TITLE:')) {
        result.title = trimmedLine.replace('TITLE:', '').trim();
      } else if (trimmedLine.startsWith('DESCRIPTION:')) {
        result.description = trimmedLine.replace('DESCRIPTION:', '').trim();
      } else if (trimmedLine.startsWith('FULL:')) {
        result.fullDescription = trimmedLine.replace('FULL:', '').trim();
      } else if (trimmedLine.startsWith('POINTS:')) {
        result.pointsOfInterest = trimmedLine.replace('POINTS:', '').trim();
      } else if (trimmedLine.startsWith('EVENT_TITLE:')) {
        result.eventTitle = trimmedLine.replace('EVENT_TITLE:', '').trim();
      } else if (trimmedLine.startsWith('EVENT_DESC:')) {
        result.eventDescription = trimmedLine.replace('EVENT_DESC:', '').trim();
      } else if (trimmedLine.startsWith('SOCIAL:')) {
        result.socialPrompt = trimmedLine.replace('SOCIAL:', '').trim();
      }
    }

    // Fallbacks if parsing fails
    if (!result.title) {
      result.title = this.getDefaultWalkTitle(walkType);
    }
    if (!result.description) {
      result.description = response.substring(0, 150) + '...';
    }
    if (!result.fullDescription) {
      result.fullDescription = response;
    }
    if (!result.eventTitle) {
      result.eventTitle = `Group ${result.title}`;
    }
    if (!result.eventDescription) {
      result.eventDescription = result.description;
    }
    if (!result.socialPrompt) {
      result.socialPrompt = `Join me for a ${walkType.replace('_', ' ')}! 🚶‍♀️ Walking Fitness`;
    }

    return result;
  }

  /**
   * Get default walk title based on type
   */
  private getDefaultWalkTitle(walkType: string): string {
    const titles = {
      park_loop: 'Beautiful Park Loop Walk',
      trail_hike: 'Nature Trail Adventure',
      urban_exploration: 'City Discovery Walk',
      scenic_route: 'Scenic Walking Route',
      fitness_circuit: 'Outdoor Fitness Circuit',
      social_walk: 'Community Walking Meet',
    };
    return titles[walkType as keyof typeof titles] || 'Walking Adventure';
  }

  /**
   * Build system prompt based on personality and archetype
   */
  private buildSystemPrompt(
    personality: PersonalityTraits,
    archetype: AIArchetype,
    contentType: string
  ): string {
    const basePrompt = `You are a ${archetype.name} - ${archetype.description}.

Your personality traits:
- Fitness Level: ${personality.fitness_level}
- Communication Style: ${personality.communication_style}
- Content Tone: ${personality.content_tone}
- Social Engagement: ${personality.social_engagement}
- Experience Sharing: ${personality.experience_sharing}

Generate a ${contentType} post that:
1. Matches your archetype's personality and communication style
2. Uses appropriate emojis based on your emoji usage preference (${personality.emoji_usage})
3. Includes hashtags in your style (${personality.hashtag_style})
4. Stays within ${personality.content_length_preference} length preference
5. Reflects your fitness goals: ${personality.primary_goals?.join(', ')}

Keep the content authentic to your archetype and personality. Write in first person as if you're posting on social media.`;

    return basePrompt;
  }

  /**
   * Build content prompt based on content type and personality
   */
  private buildContentPrompt(
    contentType: string,
    personality: PersonalityTraits,
    archetype: AIArchetype
  ): string {
    const contentPrompts = {
      workout_post: `Share details about a workout you just completed. Include what exercises you did, how you felt, and any achievements or challenges.`,
      progress_update: `Share an update on your fitness progress. This could be a new personal record, a milestone reached, or improvement you've noticed.`,
      motivation: `Share something motivational related to fitness. This could be a personal insight, encouragement for others, or inspiring thoughts.`,
      education: `Share educational fitness content. This could be a tip, technique explanation, or useful information about ${personality.preferred_workout_types?.join(' or ')}.`,
      social: `Share something social and engaging. Ask a question, start a discussion, or connect with the fitness community.`,
    };

    return contentPrompts[contentType as keyof typeof contentPrompts] || contentPrompts.workout_post;
  }

  /**
   * Build image prompt optimized for GPT-Image-1
   */
  private buildImagePrompt(
    textContent: string,
    archetype: AIArchetype,
    workoutType?: string
  ): string {
    const archetypeStyles = {
      fitness_newbie: 'friendly gym environment, beginner-friendly, encouraging atmosphere, approachable lighting',
      strength_warrior: 'intense gym setting, heavy weights, focused atmosphere, dramatic lighting',
      cardio_queen: 'energetic cardio environment, running or HIIT setup, dynamic movement, bright lighting',
      zen_master: 'peaceful yoga or meditation space, calming atmosphere, natural lighting, serene setting',
      outdoor_adventurer: 'outdoor fitness setting, nature background, adventure sports, natural lighting',
    };

    const style = archetypeStyles[archetype.id as keyof typeof archetypeStyles] || archetypeStyles.fitness_newbie;
    
    const basePrompt = `Create a high-quality fitness photograph showing ${style}. `;
    const contentContext = `The image should relate to: "${textContent.substring(0, 100)}". `;
    const technicalSpecs = `Professional photography, realistic style, good composition, appropriate for social media fitness content.`;

    return basePrompt + contentContext + technicalSpecs;
  }

  /**
   * Analyze image content using OpenAI Vision
   */
  async analyzeImageContent(imageBase64: string): Promise<string> {
    try {
      console.log('👁️ Analyzing generated image with OpenAI Vision...');

      const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert fitness image analyzer. Analyze this fitness-related image and describe:
1. What type of exercise/workout is shown (strength training, cardio, yoga, outdoor activity, etc.)
2. What specific exercises, equipment, or activities are visible
3. The setting/environment (gym, outdoors, home, studio, etc.)
4. The person's appearance and what they're doing
5. Any notable details about form, intensity, or progression

Keep your analysis factual and detailed but concise (under 150 words). Focus on what would help someone write an authentic social media caption about this workout.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this fitness image:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 200,
        temperature: 0.3, // Lower temperature for more factual analysis
      });

      const analysis = response.choices[0]?.message?.content;
      if (!analysis) {
        throw new Error('No image analysis returned from OpenAI Vision');
      }

      return analysis.trim();
    } catch (error) {
      console.error('❌ Image analysis failed:', error);
      // Fallback to generic description
      return 'A fitness-related workout image showing exercise activity.';
    }
  }

  /**
   * Build vision-guided prompt for caption generation
   */
  private buildVisionGuidedPrompt(
    imageAnalysis: string,
    personality: PersonalityTraits,
    archetype: AIArchetype,
    contentType: string
  ): string {
    return `Based on this image analysis of your workout photo: "${imageAnalysis}"

Write a social media caption that accurately describes what's shown in the image. Your caption should:
1. Match exactly what's visible in the photo (exercises, equipment, setting)
2. Sound authentic to your personality as a ${archetype.name}
3. Be appropriate for a ${contentType} post
4. Include your personal perspective and experience
5. Use your natural communication style (${personality.communication_style})

Make sure the caption aligns perfectly with what's actually shown in the image. Don't mention activities that aren't visible in the photo.`;
  }

  /**
   * Infer workout type from archetype and content type (for initial image generation)
   */
  private inferWorkoutTypeFromArchetype(archetype: AIArchetype, contentType: string): string {
    // Default based on archetype
    const defaults = {
      fitness_newbie: 'strength',
      strength_warrior: 'strength',
      cardio_queen: 'cardio',
      zen_master: 'flexibility',
      outdoor_adventurer: 'outdoor',
    };

    return defaults[archetype.id as keyof typeof defaults] || 'strength';
  }

  /**
   * Infer workout type from text content (legacy method)
   */
  private inferWorkoutType(content: string, archetype: AIArchetype): string {
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes('deadlift') || contentLower.includes('squat') || contentLower.includes('bench')) {
      return 'strength';
    }
    if (contentLower.includes('run') || contentLower.includes('cardio') || contentLower.includes('hiit')) {
      return 'cardio';
    }
    if (contentLower.includes('yoga') || contentLower.includes('stretch') || contentLower.includes('flexibility')) {
      return 'flexibility';
    }
    if (contentLower.includes('hike') || contentLower.includes('outdoor') || contentLower.includes('trail')) {
      return 'outdoor';
    }

    // Default based on archetype
    const defaults = {
      fitness_newbie: 'strength',
      strength_warrior: 'strength',
      cardio_queen: 'cardio',
      zen_master: 'flexibility',
      outdoor_adventurer: 'outdoor',
    };

    return defaults[archetype.id as keyof typeof defaults] || 'strength';
  }

  /**
   * Generate health coaching message based on health context
   */
  async generateHealthCoachingMessage(request: HealthCoachingRequest): Promise<string> {
    try {
      console.log(`🏃‍♂️ Generating ${request.messageType} coaching message`);

      const systemPrompt = this.buildHealthCoachingSystemPrompt();
      const userPrompt = this.buildHealthCoachingPrompt(request);
      
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: request.maxTokens || 200,
        temperature: request.temperature || 0.8,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No coaching message generated');
      }

      return content.trim();
    } catch (error) {
      console.error('❌ Health coaching message generation failed:', error);
      throw new Error(`Coaching message generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate workout suggestion based on health metrics and recovery data
   */
  async generateWorkoutSuggestion(healthContext: HealthContext): Promise<WorkoutSuggestion> {
    try {
      console.log('💪 Generating workout suggestion based on health data');

      const prompt = this.buildWorkoutSuggestionPrompt(healthContext);
      
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.buildWorkoutSuggestionSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No workout suggestion generated');
      }

      return this.parseWorkoutSuggestion(content, healthContext);
    } catch (error) {
      console.error('❌ Workout suggestion generation failed:', error);
      throw new Error(`Workout suggestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate celebration message for achievements
   */
  async generateCelebrationMessage(achievement: {
    type: string;
    title: string;
    value?: number;
    streak?: number;
  }, healthContext: HealthContext): Promise<string> {
    try {
      const prompt = `Celebrate this fitness achievement with enthusiasm and encouragement:
      
Achievement: ${achievement.title}
Type: ${achievement.type}
${achievement.value ? `Value: ${achievement.value}` : ''}
${achievement.streak ? `Streak: ${achievement.streak} days` : ''}

User's current fitness context:
- Current step streak: ${healthContext.currentStreak} days
- Today's steps: ${healthContext.todaysSteps}
- Fitness level: ${healthContext.fitnessLevel}
- Energy level: ${healthContext.energyLevel}

Create a celebratory message that:
1. Acknowledges the specific achievement
2. Relates it to their fitness journey
3. Encourages continued progress
4. Is enthusiastic but not overwhelming
5. Keeps it under 100 words

Use emojis sparingly and make it feel personal and genuine.`;

      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an enthusiastic but supportive fitness coach celebrating user achievements. Keep celebrations positive, personal, and motivating.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.9,
      });

      return completion.choices[0]?.message?.content?.trim() || 'Great job on your achievement!';
    } catch (error) {
      console.error('❌ Celebration message generation failed:', error);
      return 'Congratulations on your achievement! Keep up the great work! 🎉';
    }
  }

  /**
   * Build health coaching system prompt
   */
  private buildHealthCoachingSystemPrompt(): string {
    return `You are Alex, a knowledgeable and supportive fitness coach with expertise in health data analysis and personalized guidance. Your personality is:

- Encouraging and positive, but realistic
- Data-driven in your recommendations
- Adaptable to different fitness levels and goals
- Focused on sustainable, long-term progress
- Knowledgeable about exercise science and recovery

Your responses should:
1. Be conversational and supportive
2. Reference specific health data when relevant
3. Provide actionable advice
4. Consider the user's fitness level and goals
5. Prioritize safety and proper recovery
6. Keep messages concise (under 150 words unless specifically asked for more)
7. Use occasional emojis but don't overdo it

You have access to the user's:
- Daily step counts and streaks
- Sleep quality and duration
- Heart rate data and trends
- Recent workout history
- Energy levels and recovery metrics
- Fitness goals and preferences

Always consider the user's current state and provide advice that's appropriate for their situation.`;
  }

  /**
   * Build health coaching prompt
   */
  private buildHealthCoachingPrompt(request: HealthCoachingRequest): string {
    const { healthContext, messageType, userMessage } = request;
    
    const baseContext = `Current Health Data:
- Today's steps: ${healthContext.todaysSteps} (${healthContext.stepGoalProgress}% of goal)
- Current streak: ${healthContext.currentStreak} days (best: ${healthContext.bestStreak})
- Sleep: ${healthContext.averageSleepHours} hours (quality: ${healthContext.sleepQuality}/10)
- Energy level: ${healthContext.energyLevel}
- Activity level: ${healthContext.activityLevel}
- Recovery score: ${healthContext.recoveryScore}/10
- Days since rest: ${healthContext.daysSinceRest}
- Recent workouts: ${healthContext.recentWorkouts.map(w => w.type).join(', ') || 'None'}

User Profile:
- Fitness level: ${healthContext.fitnessLevel}
- Primary goal: ${healthContext.userGoals.primary}
- Preferred workouts: ${healthContext.preferredWorkoutTypes.join(', ')}
- Available time: ${healthContext.availableTime} minutes`;

    const messageTypes = {
      motivation: `Generate a motivational message that encourages the user based on their current progress and helps them stay committed to their fitness goals.`,
      
      advice: `Provide helpful fitness advice based on their health data. Focus on actionable recommendations for improving their fitness routine or addressing any concerning patterns.`,
      
      celebration: `Celebrate their recent progress! Acknowledge their achievements and encourage them to keep up the momentum.`,
      
      suggestion: `Suggest a specific action they could take today based on their health data and recovery status. This could be a workout, rest day, or lifestyle adjustment.`,
      
      check_in: `Check in on how they're feeling and progressing. Ask a thoughtful question about their fitness journey and provide supportive guidance.`,
    };

    let prompt = `${baseContext}

Task: ${messageTypes[messageType]}`;

    if (userMessage) {
      prompt += `

The user said: "${userMessage}"

Please respond to their message while incorporating the health coaching guidance above.`;
    }

    return prompt;
  }

  /**
   * Build workout suggestion system prompt
   */
  private buildWorkoutSuggestionSystemPrompt(): string {
    return `You are a fitness expert specializing in personalized workout recommendations based on health data and recovery metrics.

Analyze the user's current state and recommend an appropriate workout that considers:
1. Recovery indicators (sleep, heart rate, previous workouts)
2. Current energy and activity levels
3. Fitness goals and preferences
4. Available time
5. Injury prevention and progressive overload

Respond in this exact format:
TYPE: [cardio/strength/flexibility/rest/mixed]
INTENSITY: [low/moderate/high]
DURATION: [number in minutes]
REASONING: [brief explanation of why this workout is appropriate]
EXERCISES: [list 3-5 specific exercises or activities]
TIMING: [now/morning/evening/later]

Always prioritize safety and appropriate recovery. If the user shows signs of overtraining or fatigue, recommend rest or low-intensity activity.`;
  }

  /**
   * Build workout suggestion prompt
   */
  private buildWorkoutSuggestionPrompt(healthContext: HealthContext): string {
    return `Analyze this user's health data and recommend an appropriate workout:

Recovery Indicators:
- Sleep: ${healthContext.averageSleepHours} hours, quality ${healthContext.sleepQuality}/10
- Resting heart rate: ${healthContext.restingHeartRate || 'Unknown'} bpm
- Recovery score: ${healthContext.recoveryScore}/10
- Days since last rest: ${healthContext.daysSinceRest}
- Last workout intensity: ${healthContext.lastWorkoutIntensity}

Current State:
- Energy level: ${healthContext.energyLevel}
- Activity level: ${healthContext.activityLevel}
- Today's steps: ${healthContext.todaysSteps}
- Step goal progress: ${healthContext.stepGoalProgress}%

User Profile:
- Fitness level: ${healthContext.fitnessLevel}
- Primary goal: ${healthContext.userGoals.primary}
- Preferred workouts: ${healthContext.preferredWorkoutTypes.join(', ')}
- Available time: ${healthContext.availableTime} minutes

Recent Activity:
- Recent workouts: ${healthContext.recentWorkouts.slice(0, 3).map(w => 
    `${w.type} (${w.duration}min, ${w.intensity || 'unknown'} intensity)`
  ).join(', ') || 'None this week'}

Trends:
- Step trend: ${healthContext.stepTrends}
- Workout frequency: ${healthContext.workoutFrequencyTrend}

Current time context: It's currently ${new Date().getHours()}:00

Recommend a workout that's appropriate for their current state and goals.`;
  }

  /**
   * Parse workout suggestion response
   */
  private parseWorkoutSuggestion(response: string, healthContext: HealthContext): WorkoutSuggestion {
    const lines = response.split('\n');
    const suggestion: Partial<WorkoutSuggestion> = {};

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('TYPE:')) {
        const type = trimmedLine.replace('TYPE:', '').trim().toLowerCase();
        suggestion.type = ['cardio', 'strength', 'flexibility', 'rest', 'mixed'].includes(type) 
          ? type as WorkoutSuggestion['type'] 
          : 'cardio';
      } else if (trimmedLine.startsWith('INTENSITY:')) {
        const intensity = trimmedLine.replace('INTENSITY:', '').trim().toLowerCase();
        suggestion.intensity = ['low', 'moderate', 'high'].includes(intensity)
          ? intensity as WorkoutSuggestion['intensity']
          : 'moderate';
      } else if (trimmedLine.startsWith('DURATION:')) {
        const duration = trimmedLine.replace('DURATION:', '').trim();
        suggestion.duration = parseInt(duration) || healthContext.availableTime;
      } else if (trimmedLine.startsWith('REASONING:')) {
        suggestion.reasoning = trimmedLine.replace('REASONING:', '').trim();
      } else if (trimmedLine.startsWith('EXERCISES:')) {
        const exercises = trimmedLine.replace('EXERCISES:', '').trim();
        suggestion.exercises = exercises.split(',').map(e => e.trim());
      } else if (trimmedLine.startsWith('TIMING:')) {
        const timing = trimmedLine.replace('TIMING:', '').trim().toLowerCase();
        suggestion.timing = ['now', 'morning', 'evening', 'later'].includes(timing)
          ? timing as WorkoutSuggestion['timing']
          : 'now';
      }
    }

    // Provide defaults for any missing fields
    return {
      type: suggestion.type || 'cardio',
      intensity: suggestion.intensity || 'moderate',
      duration: suggestion.duration || healthContext.availableTime,
      reasoning: suggestion.reasoning || 'Recommended based on your current health data',
      exercises: suggestion.exercises || ['Walking', 'Stretching', 'Light movement'],
      timing: suggestion.timing || 'now',
      recoveryFocus: healthContext.recoveryScore < 6,
    };
  }
}

// Export singleton instance
export const openaiService = OpenAIService.getInstance();