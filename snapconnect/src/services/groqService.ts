/**
 * GROQ Service
 * Handles Llama 3 integration via GROQ API for workout generation
 * Follows the same patterns as OpenAI service for consistency
 */

import { HealthContext } from '../types/health';

// GROQ client configuration using fetch (similar to OpenAI pattern)
let groqApiKey: string;

// Initialize GROQ API key lazily
function getGroqApiKey(): string {
  if (!groqApiKey) {
    groqApiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY || '';
    if (!groqApiKey || groqApiKey === 'your_groq_api_key_here') {
      throw new Error('GROQ API key not configured. Please set EXPO_PUBLIC_GROQ_API_KEY in your .env file');
    }
  }
  return groqApiKey;
}

export interface WorkoutGenerationRequest {
  category: WorkoutCategory;
  userFitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  availableTime: number; // in minutes
  equipment?: string[];
  goals?: string[];
  injuries?: string[];
  healthContext?: HealthContext;
}

export interface WorkoutCategory {
  id: string;
  name: string;
  description: string;
  primaryFocus: string[];
  intensity: 'low' | 'moderate' | 'high' | 'variable';
}

export interface GeneratedWorkout {
  title: string;
  description: string;
  category: string;
  duration: number;
  intensity: 'low' | 'moderate' | 'high';
  targetAudience: string;
  warmUp: Exercise[];
  mainWorkout: Exercise[];
  coolDown: Exercise[];
  tips: string[];
  modifications: string[];
  expectedBenefits: string[];
  metadata: {
    generatedAt: string;
    llmModel: string;
    category: string;
  };
}

export interface Exercise {
  name: string;
  description: string;
  duration?: string;
  reps?: string;
  sets?: string;
  restTime?: string;
  targetMuscles?: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment?: string[];
}

// Predefined workout categories following the specifications
export const WORKOUT_CATEGORIES: WorkoutCategory[] = [
  {
    id: 'upper_body_strength',
    name: 'Upper-Body Strength Builder',
    description: 'Focused on push (chest, shoulders, triceps) and pull (back, biceps) movements to develop balanced upper-body power.',
    primaryFocus: ['chest', 'shoulders', 'triceps', 'back', 'biceps'],
    intensity: 'high',
  },
  {
    id: 'lower_body_power',
    name: 'Lower-Body Power & Plyometrics',
    description: 'Combines traditional strength work (squats, deadlifts) with explosive jumps and bounds to boost leg power and speed.',
    primaryFocus: ['legs', 'glutes', 'power', 'explosiveness'],
    intensity: 'high',
  },
  {
    id: 'functional_flow',
    name: 'Full-Body Functional Flow',
    description: 'Integrates multijoint, real-world movements (lunges into rotations, bear crawls, kettlebell swings) for practical strength and coordination.',
    primaryFocus: ['full-body', 'coordination', 'functional'],
    intensity: 'moderate',
  },
  {
    id: 'hiit',
    name: 'High-Intensity Interval Training (HIIT)',
    description: 'Short bursts of maximum effort followed by brief rests—ideal for improving cardiovascular fitness and torching calories.',
    primaryFocus: ['cardio', 'fat-burning', 'endurance'],
    intensity: 'high',
  },
  {
    id: 'endurance_circuit',
    name: 'Endurance & Stamina Circuit',
    description: 'Longer circuits with moderate loads and lower rest to build muscular and cardiovascular endurance.',
    primaryFocus: ['endurance', 'stamina', 'cardio'],
    intensity: 'moderate',
  },
  {
    id: 'mobility_flexibility',
    name: 'Mobility & Flexibility Fusion',
    description: 'Dynamic and static stretching sequences plus joint-health drills to enhance range of motion and prevent injury.',
    primaryFocus: ['flexibility', 'mobility', 'recovery'],
    intensity: 'low',
  },
  {
    id: 'core_stability',
    name: 'Core Stability & Anti-Rotation',
    description: 'Targeted work on the deep abs, obliques, and posterior chain to improve posture, balance, and injury resilience.',
    primaryFocus: ['core', 'stability', 'posture'],
    intensity: 'moderate',
  },
  {
    id: 'calisthenics',
    name: 'Calisthenics & Bodyweight Mastery',
    description: 'Progressions of push-ups, pull-ups, dips, pistol squats, and more—no equipment needed, scalable for any level.',
    primaryFocus: ['bodyweight', 'strength', 'progression'],
    intensity: 'variable',
  },
  {
    id: 'yoga_strength',
    name: 'Yoga-Inspired Strength Flow',
    description: 'Blends yoga postures (e.g., warrior series, plank flows) with light resistance to build mindful strength and flexibility.',
    primaryFocus: ['yoga', 'mindfulness', 'flexibility', 'strength'],
    intensity: 'low',
  },
  {
    id: 'sport_specific',
    name: 'Sport-Specific Skill Prep',
    description: 'Drills tailored to a chosen sport (e.g., basketball footwork, tennis split-steps, soccer change-of-direction) plus supportive strength work.',
    primaryFocus: ['sport-specific', 'agility', 'skill'],
    intensity: 'moderate',
  },
  {
    id: 'recovery_protocol',
    name: 'Recovery & Regeneration Protocol',
    description: 'Low-intensity movement, foam rolling, mobility drills, and breathwork focused on active recovery days.',
    primaryFocus: ['recovery', 'regeneration', 'wellness'],
    intensity: 'low',
  },
  {
    id: 'hybrid_equipment',
    name: 'Hybrid Equipment Workouts',
    description: 'AI programs that combine free weights, resistance bands, kettlebells, and even unconventional tools (sandbags, tires) for variety and stimulus novelty.',
    primaryFocus: ['equipment-variety', 'full-body', 'novelty'],
    intensity: 'variable',
  },
];

export class GroqService {
  private static instance: GroqService;

  public static getInstance(): GroqService {
    if (!GroqService.instance) {
      GroqService.instance = new GroqService();
    }
    return GroqService.instance;
  }

  /**
   * Generate a complete workout using Llama 3 via GROQ API
   */
  async generateWorkout(request: WorkoutGenerationRequest): Promise<GeneratedWorkout> {
    try {
      console.log(`🏋️‍♀️ Generating ${request.category.name} workout via GROQ Llama 3`);

      const systemPrompt = this.buildWorkoutSystemPrompt();
      const userPrompt = this.buildWorkoutPrompt(request);

      const response = await this.callGroqAPI(systemPrompt, userPrompt);
      
      return this.parseWorkoutResponse(response, request);
    } catch (error) {
      console.error('❌ GROQ workout generation failed:', error);
      throw new Error(`Workout generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call GROQ API using fetch (since they don't have an official JS SDK yet)
   */
  private async callGroqAPI(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = getGroqApiKey();
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192', // Using Llama 3 70B for better reasoning
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
        max_tokens: 2000,
        temperature: 0.8,
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      throw new Error(`GROQ API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from GROQ API');
    }

    return data.choices[0].message.content;
  }

  /**
   * Build system prompt for workout generation
   */
  private buildWorkoutSystemPrompt(): string {
    return `You are Alex, an expert fitness trainer and exercise scientist with over 15 years of experience designing personalized workout programs. You specialize in creating safe, effective, and engaging workouts for all fitness levels.

Your expertise includes:
- Exercise physiology and biomechanics
- Progressive overload and periodization
- Injury prevention and modification strategies
- Functional movement patterns
- Various training methodologies (strength, cardio, flexibility, etc.)

Your workout designs are known for:
- Clear, detailed exercise instructions
- Proper progression and regression options
- Emphasis on safety and form
- Practical modifications for different abilities
- Motivational and encouraging tone

CRITICAL FORMATTING REQUIREMENTS:
You must respond in this EXACT JSON-like format (but as plain text, not actual JSON):

TITLE: [Creative, motivating workout title]
DESCRIPTION: [2-3 sentence overview of the workout's purpose and benefits]
DURATION: [Total workout time in minutes]
INTENSITY: [low/moderate/high]
TARGET: [Who this workout is best suited for]

WARM_UP:
- Exercise Name | Description | Duration/Reps | Difficulty | Equipment
- Exercise Name | Description | Duration/Reps | Difficulty | Equipment
- Exercise Name | Description | Duration/Reps | Difficulty | Equipment

MAIN_WORKOUT:
- Exercise Name | Description | Sets x Reps or Duration | Rest | Difficulty | Target Muscles | Equipment
- Exercise Name | Description | Sets x Reps or Duration | Rest | Difficulty | Target Muscles | Equipment
- Exercise Name | Description | Sets x Reps or Duration | Rest | Difficulty | Target Muscles | Equipment
- Exercise Name | Description | Sets x Reps or Duration | Rest | Difficulty | Target Muscles | Equipment
- Exercise Name | Description | Sets x Reps or Duration | Rest | Difficulty | Target Muscles | Equipment

COOL_DOWN:
- Exercise Name | Description | Duration | Difficulty | Equipment
- Exercise Name | Description | Duration | Difficulty | Equipment
- Exercise Name | Description | Duration | Difficulty | Equipment

TIPS:
- [Safety tip or form cue]
- [Progression/modification tip]
- [Motivation/mindset tip]

MODIFICATIONS:
- [Beginner modification]
- [Advanced progression]
- [Equipment alternative]

BENEFITS:
- [Physical benefit]
- [Performance benefit]
- [Mental/lifestyle benefit]

Follow this format exactly. Each exercise should be detailed enough for someone to perform safely. Use the pipe (|) symbol as separators in exercise listings.`;
  }

  /**
   * Build user prompt for specific workout request
   */
  private buildWorkoutPrompt(request: WorkoutGenerationRequest): string {
    const { category, userFitnessLevel, availableTime, equipment = [], goals = [], injuries = [] } = request;
    
    const equipmentText = equipment.length > 0 ? equipment.join(', ') : 'minimal/bodyweight';
    const goalsText = goals.length > 0 ? goals.join(', ') : 'general fitness';
    const injuriesText = injuries.length > 0 ? ` Note: User has these limitations/injuries: ${injuries.join(', ')}` : '';
    
    let healthContextText = '';
    if (request.healthContext) {
      const hc = request.healthContext;
      healthContextText = `
      
Current Health Context:
- Energy Level: ${hc.energyLevel}
- Recovery Score: ${hc.recoveryScore}/10
- Days Since Rest: ${hc.daysSinceRest}
- Recent Activity: ${hc.activityLevel}
- Sleep Quality: ${hc.sleepQuality}/10`;
    }

    return `Create a ${category.name} workout with these specifications:

Category: ${category.name}
Description: ${category.description}
Primary Focus Areas: ${category.primaryFocus.join(', ')}

User Profile:
- Fitness Level: ${userFitnessLevel}
- Available Time: ${availableTime} minutes
- Available Equipment: ${equipmentText}
- Fitness Goals: ${goalsText}${injuriesText}${healthContextText}

REQUIREMENTS:
1. Design a complete ${availableTime}-minute workout
2. Include proper warm-up (5-8 minutes), main workout (${availableTime - 15} minutes), and cool-down (5-7 minutes)
3. Choose exercises that align with the category's focus: ${category.primaryFocus.join(', ')}
4. Provide 5-8 exercises for the main workout
5. Make it appropriate for ${userFitnessLevel} level
6. Include clear form cues and safety considerations
7. Provide modifications for different abilities
8. Focus on the primary benefits: ${category.description}

Create a workout that is engaging, safe, and effective for building ${category.primaryFocus.join(' and ')}.`;
  }

  /**
   * Parse the Llama 3 response into a structured workout object
   */
  private parseWorkoutResponse(response: string, request: WorkoutGenerationRequest): GeneratedWorkout {
    console.log('🔍 Parsing GROQ workout response...');
    
    const lines = response.split('\n').map(line => line.trim());
    const workout: Partial<GeneratedWorkout> = {
      category: request.category.name,
      warmUp: [],
      mainWorkout: [],
      coolDown: [],
      tips: [],
      modifications: [],
      expectedBenefits: [],
    };

    let currentSection = '';
    
    for (const line of lines) {
      if (!line) continue;
      
      // Parse header fields
      if (line.startsWith('TITLE:')) {
        workout.title = line.replace('TITLE:', '').trim();
      } else if (line.startsWith('DESCRIPTION:')) {
        workout.description = line.replace('DESCRIPTION:', '').trim();
      } else if (line.startsWith('DURATION:')) {
        const duration = line.replace('DURATION:', '').trim();
        workout.duration = parseInt(duration) || request.availableTime;
      } else if (line.startsWith('INTENSITY:')) {
        const intensity = line.replace('INTENSITY:', '').trim().toLowerCase();
        workout.intensity = ['low', 'moderate', 'high'].includes(intensity) 
          ? intensity as any 
          : request.category.intensity;
      } else if (line.startsWith('TARGET:')) {
        workout.targetAudience = line.replace('TARGET:', '').trim();
      }
      
      // Parse sections
      else if (line.startsWith('WARM_UP:')) {
        currentSection = 'warmUp';
      } else if (line.startsWith('MAIN_WORKOUT:')) {
        currentSection = 'mainWorkout';
      } else if (line.startsWith('COOL_DOWN:')) {
        currentSection = 'coolDown';
      } else if (line.startsWith('TIPS:')) {
        currentSection = 'tips';
      } else if (line.startsWith('MODIFICATIONS:')) {
        currentSection = 'modifications';
      } else if (line.startsWith('BENEFITS:')) {
        currentSection = 'benefits';
      }
      
      // Parse section content
      else if (line.startsWith('- ')) {
        const content = line.replace('- ', '');
        
        if (currentSection === 'tips') {
          workout.tips!.push(content);
        } else if (currentSection === 'modifications') {
          workout.modifications!.push(content);
        } else if (currentSection === 'benefits') {
          workout.expectedBenefits!.push(content);
        } else if (['warmUp', 'mainWorkout', 'coolDown'].includes(currentSection)) {
          const exercise = this.parseExerciseLine(content, currentSection === 'mainWorkout');
          if (currentSection === 'warmUp') {
            workout.warmUp!.push(exercise);
          } else if (currentSection === 'mainWorkout') {
            workout.mainWorkout!.push(exercise);
          } else if (currentSection === 'coolDown') {
            workout.coolDown!.push(exercise);
          }
        }
      }
    }

    // Provide fallbacks for missing data
    return {
      title: workout.title || `${request.category.name} Workout`,
      description: workout.description || request.category.description,
      category: workout.category!,
      duration: workout.duration || request.availableTime,
      intensity: workout.intensity || (request.category.intensity === 'variable' ? 'moderate' : request.category.intensity),
      targetAudience: workout.targetAudience || `${request.userFitnessLevel} level fitness enthusiasts`,
      warmUp: workout.warmUp!,
      mainWorkout: workout.mainWorkout!,
      coolDown: workout.coolDown!,
      tips: workout.tips!,
      modifications: workout.modifications!,
      expectedBenefits: workout.expectedBenefits!,
      metadata: {
        generatedAt: new Date().toISOString(),
        llmModel: 'llama3-70b-8192',
        category: request.category.id,
      },
    };
  }

  /**
   * Parse individual exercise line from the response
   */
  private parseExerciseLine(line: string, isMainWorkout: boolean): Exercise {
    const parts = line.split(' | ').map(part => part.trim());
    
    const exercise: Exercise = {
      name: parts[0] || 'Exercise',
      description: parts[1] || 'Perform as instructed',
      difficulty: 'intermediate',
    };

    if (isMainWorkout) {
      // Main workout format: Name | Description | Sets x Reps or Duration | Rest | Difficulty | Target Muscles | Equipment
      exercise.sets = parts[2] || '3 sets';
      exercise.restTime = parts[3] || '30-60 seconds';
      exercise.difficulty = this.parseDifficulty(parts[4]);
      exercise.targetMuscles = parts[5] ? parts[5].split(',').map(m => m.trim()) : [];
      exercise.equipment = parts[6] ? parts[6].split(',').map(e => e.trim()) : [];
    } else {
      // Warm-up/Cool-down format: Name | Description | Duration/Reps | Difficulty | Equipment
      exercise.duration = parts[2] || '30 seconds';
      exercise.difficulty = this.parseDifficulty(parts[3]);
      exercise.equipment = parts[4] ? parts[4].split(',').map(e => e.trim()) : [];
    }

    return exercise;
  }

  /**
   * Parse difficulty level from string
   */
  private parseDifficulty(difficultyStr?: string): 'beginner' | 'intermediate' | 'advanced' {
    if (!difficultyStr) return 'intermediate';
    
    const lower = difficultyStr.toLowerCase();
    if (lower.includes('beginner') || lower.includes('easy')) return 'beginner';
    if (lower.includes('advanced') || lower.includes('hard')) return 'advanced';
    return 'intermediate';
  }

  /**
   * Get workout category by ID
   */
  getWorkoutCategory(categoryId: string): WorkoutCategory | undefined {
    return WORKOUT_CATEGORIES.find(cat => cat.id === categoryId);
  }

  /**
   * Get all workout categories
   */
  getAllWorkoutCategories(): WorkoutCategory[] {
    return WORKOUT_CATEGORIES;
  }

  /**
   * Get categories filtered by intensity or focus
   */
  getFilteredCategories(filters: {
    intensity?: 'low' | 'moderate' | 'high' | 'variable';
    focus?: string[];
    maxDuration?: number;
  }): WorkoutCategory[] {
    return WORKOUT_CATEGORIES.filter(category => {
      if (filters.intensity && category.intensity !== filters.intensity && filters.intensity !== 'variable') {
        return false;
      }
      
      if (filters.focus && filters.focus.length > 0) {
        const hasMatchingFocus = filters.focus.some(focus => 
          category.primaryFocus.some(primary => 
            primary.toLowerCase().includes(focus.toLowerCase())
          )
        );
        if (!hasMatchingFocus) return false;
      }
      
      return true;
    });
  }
}

// Export singleton instance
export const groqService = GroqService.getInstance();