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
        model: 'llama3-8b-8192', // Using Llama 3 8B for faster response times
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
        max_tokens: 800,
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
    console.log('📝 Raw response from GROQ:');
    console.log('=====================================');
    console.log(response);
    console.log('=====================================');
    
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
      
      console.log(`🔍 Processing line: "${line}"`);
      
      // Parse header fields
      if (line.startsWith('TITLE:')) {
        workout.title = line.replace('TITLE:', '').trim();
        console.log(`  ✅ Found title: ${workout.title}`);
      } else if (line.startsWith('DESCRIPTION:')) {
        workout.description = line.replace('DESCRIPTION:', '').trim();
        console.log(`  ✅ Found description: ${workout.description}`);
      } else if (line.startsWith('DURATION:')) {
        const duration = line.replace('DURATION:', '').trim();
        workout.duration = parseInt(duration) || request.availableTime;
        console.log(`  ✅ Found duration: ${workout.duration}`);
      } else if (line.startsWith('INTENSITY:')) {
        const intensity = line.replace('INTENSITY:', '').trim().toLowerCase();
        workout.intensity = ['low', 'moderate', 'high'].includes(intensity) 
          ? intensity as any 
          : request.category.intensity;
        console.log(`  ✅ Found intensity: ${workout.intensity}`);
      } else if (line.startsWith('TARGET:')) {
        workout.targetAudience = line.replace('TARGET:', '').trim();
        console.log(`  ✅ Found target: ${workout.targetAudience}`);
      }
      
      // Parse sections
      else if (line.startsWith('WARM_UP:')) {
        currentSection = 'warmUp';
        console.log('  🔥 Entering WARM_UP section');
      } else if (line.startsWith('MAIN_WORKOUT:')) {
        currentSection = 'mainWorkout';
        console.log('  💪 Entering MAIN_WORKOUT section');
      } else if (line.startsWith('COOL_DOWN:')) {
        currentSection = 'coolDown';
        console.log('  🧘 Entering COOL_DOWN section');
      } else if (line.startsWith('TIPS:')) {
        currentSection = 'tips';
        console.log('  💡 Entering TIPS section');
      } else if (line.startsWith('MODIFICATIONS:')) {
        currentSection = 'modifications';
        console.log('  🔧 Entering MODIFICATIONS section');
      } else if (line.startsWith('BENEFITS:')) {
        currentSection = 'benefits';
        console.log('  🎯 Entering BENEFITS section');
      }
      
      // Parse section content
      else if (line.startsWith('- ')) {
        const content = line.replace('- ', '');
        console.log(`  ➡️ Found content in ${currentSection}: ${content}`);
        
        if (currentSection === 'tips') {
          workout.tips!.push(content);
          console.log(`    ✅ Added tip (total: ${workout.tips!.length})`);
        } else if (currentSection === 'modifications') {
          workout.modifications!.push(content);
          console.log(`    ✅ Added modification (total: ${workout.modifications!.length})`);
        } else if (currentSection === 'benefits') {
          workout.expectedBenefits!.push(content);
          console.log(`    ✅ Added benefit (total: ${workout.expectedBenefits!.length})`);
        } else if (['warmUp', 'mainWorkout', 'coolDown'].includes(currentSection)) {
          const exercise = this.parseExerciseLine(content, currentSection === 'mainWorkout');
          console.log(`    🏋️ Parsed exercise:`, exercise);
          
          if (currentSection === 'warmUp') {
            workout.warmUp!.push(exercise);
            console.log(`    ✅ Added warm-up exercise (total: ${workout.warmUp!.length})`);
          } else if (currentSection === 'mainWorkout') {
            workout.mainWorkout!.push(exercise);
            console.log(`    ✅ Added main workout exercise (total: ${workout.mainWorkout!.length})`);
          } else if (currentSection === 'coolDown') {
            workout.coolDown!.push(exercise);
            console.log(`    ✅ Added cool-down exercise (total: ${workout.coolDown!.length})`);
          }
        }
      }
    }

    // Provide fallbacks for missing data
    const finalWorkout = {
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

    console.log('📊 Final parsed workout structure:');
    console.log('=====================================');
    console.log('Title:', finalWorkout.title);
    console.log('Description:', finalWorkout.description);
    console.log('Duration:', finalWorkout.duration);
    console.log('Intensity:', finalWorkout.intensity);
    console.log('Target Audience:', finalWorkout.targetAudience);
    console.log('Warm-up exercises:', finalWorkout.warmUp.length);
    console.log('Main workout exercises:', finalWorkout.mainWorkout.length);
    console.log('Cool-down exercises:', finalWorkout.coolDown.length);
    console.log('Tips:', finalWorkout.tips.length);
    console.log('Modifications:', finalWorkout.modifications.length);
    console.log('Benefits:', finalWorkout.expectedBenefits.length);
    console.log('=====================================');

    // If no exercises were parsed, provide fallback exercises
    if (finalWorkout.mainWorkout.length === 0) {
      console.log('⚠️ No main workout exercises found, providing fallback workout');
      const fallbackWorkout = this.generateFallbackWorkout(request);
      return {
        ...finalWorkout,
        warmUp: fallbackWorkout.warmUp,
        mainWorkout: fallbackWorkout.mainWorkout,
        coolDown: fallbackWorkout.coolDown,
        tips: fallbackWorkout.tips,
        modifications: fallbackWorkout.modifications,
        expectedBenefits: fallbackWorkout.expectedBenefits,
      };
    }

    return finalWorkout;
  }

  /**
   * Generate fallback workout when AI parsing fails
   */
  private generateFallbackWorkout(request: WorkoutGenerationRequest): Partial<GeneratedWorkout> {
    const { category } = request;
    
    // Create category-specific fallback workouts
    const fallbackWorkouts = {
      'upper_body_strength': {
        warmUp: [
          { name: 'Arm Circles', description: 'Circle your arms forward and backward', duration: '30 seconds', difficulty: 'beginner' as const, equipment: [] },
          { name: 'Shoulder Rolls', description: 'Roll shoulders forward and backward', duration: '30 seconds', difficulty: 'beginner' as const, equipment: [] },
          { name: 'Arm Swings', description: 'Swing arms across your body', duration: '30 seconds', difficulty: 'beginner' as const, equipment: [] },
        ],
        mainWorkout: [
          { name: 'Push-ups', description: 'Standard push-ups targeting chest, shoulders, and triceps', sets: '3 sets of 8-12 reps', restTime: '60 seconds', difficulty: 'intermediate' as const, targetMuscles: ['chest', 'shoulders', 'triceps'], equipment: [] },
          { name: 'Pike Push-ups', description: 'Push-ups in pike position for shoulder emphasis', sets: '3 sets of 6-10 reps', restTime: '60 seconds', difficulty: 'intermediate' as const, targetMuscles: ['shoulders', 'triceps'], equipment: [] },
          { name: 'Tricep Dips', description: 'Dips using a chair or elevated surface', sets: '3 sets of 8-12 reps', restTime: '60 seconds', difficulty: 'intermediate' as const, targetMuscles: ['triceps', 'shoulders'], equipment: ['chair'] },
          { name: 'Plank to Push-up', description: 'Transition from plank to push-up position', sets: '3 sets of 6-8 reps', restTime: '60 seconds', difficulty: 'intermediate' as const, targetMuscles: ['chest', 'shoulders', 'core'], equipment: [] },
          { name: 'Diamond Push-ups', description: 'Push-ups with hands in diamond formation', sets: '2 sets of 5-8 reps', restTime: '60 seconds', difficulty: 'advanced' as const, targetMuscles: ['triceps', 'chest'], equipment: [] },
        ],
        coolDown: [
          { name: 'Chest Stretch', description: 'Stretch chest muscles against a wall', duration: '30 seconds', difficulty: 'beginner' as const, equipment: [] },
          { name: 'Shoulder Stretch', description: 'Cross-body shoulder stretch', duration: '30 seconds each arm', difficulty: 'beginner' as const, equipment: [] },
          { name: 'Tricep Stretch', description: 'Overhead tricep stretch', duration: '30 seconds each arm', difficulty: 'beginner' as const, equipment: [] },
        ],
      },
      'lower_body_power': {
        warmUp: [
          { name: 'Leg Swings', description: 'Swing legs forward and backward', duration: '30 seconds each leg', difficulty: 'beginner' as const, equipment: [] },
          { name: 'Hip Circles', description: 'Circle hips clockwise and counterclockwise', duration: '30 seconds each direction', difficulty: 'beginner' as const, equipment: [] },
          { name: 'Bodyweight Squats', description: 'Light squats to warm up', duration: '30 seconds', difficulty: 'beginner' as const, equipment: [] },
        ],
        mainWorkout: [
          { name: 'Jump Squats', description: 'Explosive squat jumps', sets: '4 sets of 8-12 reps', restTime: '90 seconds', difficulty: 'intermediate' as const, targetMuscles: ['quadriceps', 'glutes', 'calves'], equipment: [] },
          { name: 'Lunge Jumps', description: 'Alternating jump lunges', sets: '4 sets of 10-16 reps', restTime: '90 seconds', difficulty: 'intermediate' as const, targetMuscles: ['quadriceps', 'glutes', 'hamstrings'], equipment: [] },
          { name: 'Single-Leg Squats', description: 'Pistol squats or assisted single-leg squats', sets: '3 sets of 5-8 reps each leg', restTime: '90 seconds', difficulty: 'advanced' as const, targetMuscles: ['quadriceps', 'glutes'], equipment: [] },
          { name: 'Broad Jumps', description: 'Jump forward for distance', sets: '3 sets of 5-8 jumps', restTime: '90 seconds', difficulty: 'intermediate' as const, targetMuscles: ['quadriceps', 'glutes'], equipment: [] },
          { name: 'Calf Raises', description: 'Single or double leg calf raises', sets: '3 sets of 15-20 reps', restTime: '60 seconds', difficulty: 'beginner' as const, targetMuscles: ['calves'], equipment: [] },
        ],
        coolDown: [
          { name: 'Quad Stretch', description: 'Standing quad stretch', duration: '30 seconds each leg', difficulty: 'beginner' as const, equipment: [] },
          { name: 'Hamstring Stretch', description: 'Seated or standing hamstring stretch', duration: '30 seconds each leg', difficulty: 'beginner' as const, equipment: [] },
          { name: 'Calf Stretch', description: 'Wall calf stretch', duration: '30 seconds each leg', difficulty: 'beginner' as const, equipment: [] },
        ],
      },
      'default': {
        warmUp: [
          { name: 'Jumping Jacks', description: 'Classic cardio warm-up', duration: '60 seconds', difficulty: 'beginner' as const, equipment: [] },
          { name: 'Arm Circles', description: 'Circle your arms to warm up shoulders', duration: '30 seconds', difficulty: 'beginner' as const, equipment: [] },
          { name: 'Bodyweight Squats', description: 'Light squats to warm up', duration: '30 seconds', difficulty: 'beginner' as const, equipment: [] },
        ],
        mainWorkout: [
          { name: 'Push-ups', description: 'Standard push-ups', sets: '3 sets of 8-12 reps', restTime: '60 seconds', difficulty: 'intermediate' as const, targetMuscles: ['chest', 'shoulders', 'triceps'], equipment: [] },
          { name: 'Squats', description: 'Bodyweight squats', sets: '3 sets of 12-15 reps', restTime: '60 seconds', difficulty: 'intermediate' as const, targetMuscles: ['quadriceps', 'glutes'], equipment: [] },
          { name: 'Plank', description: 'Hold plank position', sets: '3 sets of 30-60 seconds', restTime: '60 seconds', difficulty: 'intermediate' as const, targetMuscles: ['core'], equipment: [] },
          { name: 'Lunges', description: 'Alternating forward lunges', sets: '3 sets of 10-12 reps each leg', restTime: '60 seconds', difficulty: 'intermediate' as const, targetMuscles: ['quadriceps', 'glutes', 'hamstrings'], equipment: [] },
          { name: 'Mountain Climbers', description: 'High-intensity cardio exercise', sets: '3 sets of 30 seconds', restTime: '60 seconds', difficulty: 'intermediate' as const, targetMuscles: ['core', 'cardio'], equipment: [] },
        ],
        coolDown: [
          { name: 'Forward Fold', description: 'Stretch hamstrings and back', duration: '30 seconds', difficulty: 'beginner' as const, equipment: [] },
          { name: 'Chest Stretch', description: 'Stretch chest muscles', duration: '30 seconds', difficulty: 'beginner' as const, equipment: [] },
          { name: 'Quad Stretch', description: 'Standing quad stretch', duration: '30 seconds each leg', difficulty: 'beginner' as const, equipment: [] },
        ],
      },
    };

    const workoutType = (fallbackWorkouts as any)[category.id] || fallbackWorkouts.default;
    
    return {
      warmUp: workoutType.warmUp,
      mainWorkout: workoutType.mainWorkout,
      coolDown: workoutType.coolDown,
      tips: [
        'Focus on proper form over speed',
        'Rest between sets as needed',
        'Stay hydrated throughout the workout',
        'Listen to your body and modify as needed',
      ],
      modifications: [
        'Beginner: Reduce reps or sets as needed',
        'Advanced: Increase reps, sets, or add weight',
        'Injuries: Skip exercises that cause pain',
        'Limited space: All exercises can be done in a small area',
      ],
      expectedBenefits: [
        'Improved strength and muscle tone',
        'Better functional movement patterns',
        'Increased cardiovascular fitness',
        'Enhanced mental well-being',
      ],
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