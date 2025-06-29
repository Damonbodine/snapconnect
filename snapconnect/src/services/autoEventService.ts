/**
 * Auto Event Service
 * Handles automatic event creation and RSVP for AI-generated suggestions
 * Unifies walk suggestions and workout suggestions into events
 */

import { eventService, CreateEventData, Event } from './eventService';
import { locationService, LocationCoordinates } from './locationService';
import { WalkSuggestion } from '../types/walkSuggestion';
import { GeneratedWorkout } from './groqService';

export interface AutoEventOptions {
  scheduledFor?: string; // ISO timestamp, defaults to 1 hour from now
  visibility?: 'public' | 'friends' | 'private';
  maxParticipants?: number;
  additionalNotes?: string;
  userLocation?: LocationCoordinates;
}

export interface AutoEventResult {
  event: Event;
  rsvpStatus: 'going' | 'maybe' | 'not_going';
  created: boolean; // true if event was created, false if it already existed
}

class AutoEventService {
  /**
   * Create event and RSVP user from AI walk suggestion
   */
  async createEventFromWalkSuggestion(
    suggestion: WalkSuggestion,
    userId: string,
    options: AutoEventOptions = {}
  ): Promise<AutoEventResult> {
    try {
      console.log(`🚶‍♀️ Auto-creating event from walk suggestion: ${suggestion.title}`);

      // Get walking category ID (or create default)
      const walkingCategory = await this.getOrCreateWalkingCategory();
      
      // Calculate start time (default to 1 hour from now)
      const startTime = options.scheduledFor || this.getDefaultStartTime();
      const endTime = this.calculateEndTime(startTime, suggestion.estimatedDuration);

      // Use suggestion's start location or user location
      const eventLocation = suggestion.startLocation || options.userLocation;
      if (!eventLocation) {
        throw new Error('No location available for event creation');
      }

      // Build event data from walk suggestion
      const eventData: CreateEventData = {
        title: suggestion.suggestedEventTitle || suggestion.title,
        description: this.buildWalkEventDescription(suggestion, options.additionalNotes),
        category_id: walkingCategory.id,
        location_name: this.extractLocationName(suggestion),
        location_address: this.extractLocationAddress(suggestion),
        location_coordinates: eventLocation,
        location_details: this.buildLocationDetails(suggestion),
        start_time: startTime,
        end_time: endTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        max_participants: options.maxParticipants || this.getDefaultMaxParticipants(suggestion),
        min_participants: 1,
        fitness_levels: [suggestion.fitnessLevel],
        equipment_needed: this.getWalkingEquipment(suggestion),
        cost_cents: 0, // Walks are free
        cost_currency: 'USD',
        visibility: options.visibility || 'public',
      };

      // Create the event
      const event = await eventService.createEvent(eventData, userId);
      
      // Auto-RSVP the creator as "going"
      await eventService.rsvpToEvent(event.id, userId, 'going');

      console.log(`✅ Successfully created walk event: ${event.id}`);
      
      return {
        event,
        rsvpStatus: 'going',
        created: true,
      };
    } catch (error) {
      console.error('❌ Failed to create event from walk suggestion:', error);
      throw new Error(`Failed to create walk event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create event and RSVP user from AI workout suggestion
   */
  async createEventFromWorkout(
    workout: GeneratedWorkout,
    userId: string,
    options: AutoEventOptions = {}
  ): Promise<AutoEventResult> {
    try {
      console.log(`🏋️‍♀️ Auto-creating event from workout: ${workout.title}`);

      // Get workout category ID based on workout type
      const workoutCategory = await this.getOrCreateWorkoutCategory(workout.category);
      
      // Calculate start time (default to 1 hour from now)
      const startTime = options.scheduledFor || this.getDefaultStartTime();
      const endTime = this.calculateEndTime(startTime, workout.duration);

      // Use user location or default location
      const eventLocation = options.userLocation || await this.getDefaultWorkoutLocation();
      if (!eventLocation) {
        throw new Error('No location available for workout event creation');
      }

      // Build event data from workout
      const eventData: CreateEventData = {
        title: workout.title,
        description: this.buildWorkoutEventDescription(workout, options.additionalNotes),
        category_id: workoutCategory.id,
        location_name: this.getWorkoutLocationName(workout),
        location_address: 'Local Area', // Generic for workouts
        location_coordinates: eventLocation,
        location_details: this.buildWorkoutLocationDetails(workout),
        start_time: startTime,
        end_time: endTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        max_participants: options.maxParticipants || this.getDefaultWorkoutMaxParticipants(workout),
        min_participants: 1,
        fitness_levels: [workout.targetAudience.includes('beginner') ? 'beginner' : 
                        workout.targetAudience.includes('advanced') ? 'advanced' : 'intermediate'],
        equipment_needed: this.extractWorkoutEquipment(workout),
        cost_cents: 0, // AI workouts are free
        cost_currency: 'USD',
        visibility: options.visibility || 'public',
        workout_details: workout, // Save the complete workout data
      };

      // Create the event
      const event = await eventService.createEvent(eventData, userId);
      
      // Auto-RSVP the creator as "going"
      await eventService.rsvpToEvent(event.id, userId, 'going');

      console.log(`✅ Successfully created workout event: ${event.id}`);
      
      return {
        event,
        rsvpStatus: 'going',
        created: true,
      };
    } catch (error) {
      console.error('❌ Failed to create event from workout:', error);
      throw new Error(`Failed to create workout event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get or create walking category
   */
  private async getOrCreateWalkingCategory() {
    const categories = await eventService.getEventCategories();
    
    // Look for existing walking/hiking category
    let walkingCategory = categories.find(cat => 
      cat.name.toLowerCase().includes('walk') || 
      cat.name.toLowerCase().includes('hik') ||
      cat.name.toLowerCase().includes('outdoor')
    );

    if (!walkingCategory) {
      // Use first available category as fallback
      walkingCategory = categories[0];
      if (!walkingCategory) {
        throw new Error('No event categories available');
      }
    }

    return walkingCategory;
  }

  /**
   * Get or create workout category based on workout type
   */
  private async getOrCreateWorkoutCategory(workoutType: string) {
    const categories = await eventService.getEventCategories();
    
    // Map workout types to category names
    const categoryMapping: { [key: string]: string[] } = {
      'strength': ['strength', 'weight', 'muscle'],
      'cardio': ['cardio', 'running', 'hiit'],
      'flexibility': ['yoga', 'stretch', 'flexibility'],
      'functional': ['functional', 'cross', 'boot'],
      'calisthenics': ['bodyweight', 'calisthenics'],
      'core': ['core', 'abs'],
    };

    // Find best matching category
    const workoutTypeLower = workoutType.toLowerCase();
    let bestCategory = null;

    for (const [type, keywords] of Object.entries(categoryMapping)) {
      if (keywords.some(keyword => workoutTypeLower.includes(keyword))) {
        bestCategory = categories.find(cat => 
          keywords.some(keyword => cat.name.toLowerCase().includes(keyword))
        );
        if (bestCategory) break;
      }
    }

    // Fallback to workout category or first available
    if (!bestCategory) {
      bestCategory = categories.find(cat => 
        cat.name.toLowerCase().includes('workout') ||
        cat.name.toLowerCase().includes('fitness')
      ) || categories[0];
    }

    if (!bestCategory) {
      throw new Error('No event categories available');
    }

    return bestCategory;
  }

  /**
   * Build event description for walk suggestion
   */
  private buildWalkEventDescription(suggestion: WalkSuggestion, additionalNotes?: string): string {
    const parts = [
      suggestion.description,
      '',
      `🚶‍♀️ **Walk Details:**`,
      `• Distance: ${(suggestion.distance / 1000).toFixed(1)}km`,
      `• Duration: ${suggestion.estimatedDuration} minutes`,
      `• Difficulty: ${suggestion.difficulty}`,
      `• Type: ${suggestion.walkType.replace('_', ' ')}`,
    ];

    if (suggestion.pointsOfInterest && suggestion.pointsOfInterest.length > 0) {
      parts.push('', '📍 **Points of Interest:**');
      suggestion.pointsOfInterest.slice(0, 3).forEach(poi => {
        parts.push(`• ${poi.name}`);
      });
    }

    if (suggestion.socialPrompt) {
      parts.push('', '👥 **Join the Adventure:**');
      parts.push(suggestion.socialPrompt);
    }

    if (additionalNotes) {
      parts.push('', '📝 **Additional Notes:**');
      parts.push(additionalNotes);
    }

    parts.push('', '🤖 *This walk was suggested by AI and auto-created as an event*');

    return parts.join('\n');
  }

  /**
   * Build event description for workout
   */
  private buildWorkoutEventDescription(workout: GeneratedWorkout, additionalNotes?: string): string {
    const parts = [
      workout.description,
      '',
      `💪 **Workout Details:**`,
      `• Duration: ${workout.duration} minutes`,
      `• Intensity: ${workout.intensity}`,
      `• Category: ${workout.category}`,
      `• Target: ${workout.targetAudience}`,
    ];

    if (workout.expectedBenefits && workout.expectedBenefits.length > 0) {
      parts.push('', '🎯 **Expected Benefits:**');
      workout.expectedBenefits.slice(0, 3).forEach(benefit => {
        parts.push(`• ${benefit}`);
      });
    }

    if (workout.tips && workout.tips.length > 0) {
      parts.push('', '💡 **Key Tips:**');
      workout.tips.slice(0, 2).forEach(tip => {
        parts.push(`• ${tip}`);
      });
    }

    if (additionalNotes) {
      parts.push('', '📝 **Additional Notes:**');
      parts.push(additionalNotes);
    }

    parts.push('', '🤖 *This workout was generated by AI and auto-created as an event*');

    return parts.join('\n');
  }

  /**
   * Extract location information from walk suggestion
   */
  private extractLocationName(suggestion: WalkSuggestion): string {
    if (suggestion.pointsOfInterest && suggestion.pointsOfInterest.length > 0) {
      return suggestion.pointsOfInterest[0].name;
    }
    return suggestion.title.includes('Walk') ? suggestion.title : `${suggestion.title} Walk`;
  }

  private extractLocationAddress(suggestion: WalkSuggestion): string {
    if (suggestion.pointsOfInterest && suggestion.pointsOfInterest.length > 0) {
      return suggestion.pointsOfInterest[0].formatted_address || 'Local Area';
    }
    return 'Local Area';
  }

  private buildLocationDetails(suggestion: WalkSuggestion): string {
    const details = [];
    
    if (suggestion.route && suggestion.route.summary) {
      details.push(`Route: ${suggestion.route.summary}`);
    }
    
    if (suggestion.elevationGain) {
      details.push(`Elevation gain: ${suggestion.elevationGain}m`);
    }

    details.push(`Walk type: ${suggestion.walkType.replace('_', ' ')}`);
    
    return details.join(' • ');
  }

  /**
   * Get walking equipment based on suggestion
   */
  private getWalkingEquipment(suggestion: WalkSuggestion): string[] {
    const equipment = ['comfortable_shoes'];
    
    if (suggestion.walkType === 'trail_hike') {
      equipment.push('hiking_shoes', 'water_bottle');
    }
    
    if (suggestion.difficulty === 'challenging') {
      equipment.push('water_bottle', 'first_aid');
    }
    
    if (suggestion.estimatedDuration > 60) {
      equipment.push('water_bottle', 'snacks');
    }

    return equipment;
  }

  /**
   * Get workout location name
   */
  private getWorkoutLocationName(workout: GeneratedWorkout): string {
    if (workout.category.toLowerCase().includes('outdoor')) {
      return 'Outdoor Area';
    }
    
    if (workout.category.toLowerCase().includes('yoga')) {
      return 'Yoga/Fitness Studio';
    }

    return 'Local Fitness Area';
  }

  /**
   * Build workout location details
   */
  private buildWorkoutLocationDetails(workout: GeneratedWorkout): string {
    const details = [];
    
    details.push(`${workout.category} workout`);
    details.push(`${workout.intensity} intensity`);
    
    if (workout.mainWorkout && workout.mainWorkout.length > 0) {
      details.push(`${workout.mainWorkout.length} exercises`);
    }

    return details.join(' • ');
  }

  /**
   * Extract equipment from workout
   */
  private extractWorkoutEquipment(workout: GeneratedWorkout): string[] {
    const equipment = new Set<string>();
    
    // Check exercises for equipment mentions
    const allExercises = [
      ...workout.warmUp,
      ...workout.mainWorkout,
      ...workout.coolDown,
    ];

    allExercises.forEach(exercise => {
      if (exercise.equipment) {
        exercise.equipment.forEach(eq => equipment.add(eq.toLowerCase()));
      }
      
      // Infer equipment from exercise names
      const exerciseName = exercise.name.toLowerCase();
      if (exerciseName.includes('dumbbell')) equipment.add('dumbbells');
      if (exerciseName.includes('kettlebell')) equipment.add('kettlebell');
      if (exerciseName.includes('resistance') || exerciseName.includes('band')) equipment.add('resistance_bands');
      if (exerciseName.includes('mat') || exerciseName.includes('yoga')) equipment.add('exercise_mat');
      if (exerciseName.includes('pull-up') || exerciseName.includes('pullup')) equipment.add('pull_up_bar');
    });

    // Default to bodyweight if no equipment detected
    if (equipment.size === 0) {
      equipment.add('bodyweight_only');
    }

    return Array.from(equipment);
  }

  /**
   * Calculate default start time (1 hour from now)
   */
  private getDefaultStartTime(): string {
    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    return startTime.toISOString();
  }

  /**
   * Calculate end time based on duration
   */
  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return end.toISOString();
  }

  /**
   * Get default max participants for walk
   */
  private getDefaultMaxParticipants(suggestion: WalkSuggestion): number {
    if (suggestion.socialPrompt) return 8; // Social walks can be larger
    if (suggestion.difficulty === 'challenging') return 4; // Challenging walks smaller group
    return 6; // Default medium group size
  }

  /**
   * Get default max participants for workout
   */
  private getDefaultWorkoutMaxParticipants(workout: GeneratedWorkout): number {
    if (workout.category.toLowerCase().includes('hiit')) return 12; // HIIT classes can be larger
    if (workout.category.toLowerCase().includes('yoga')) return 8; // Yoga classes medium size
    if (workout.category.toLowerCase().includes('strength')) return 6; // Strength training smaller
    return 8; // Default size
  }

  /**
   * Get default location for workouts (user's current location or fallback)
   */
  private async getDefaultWorkoutLocation(): Promise<LocationCoordinates | null> {
    try {
      // Try to get user's current location
      const userLocation = await locationService.getCurrentLocation();
      return userLocation;
    } catch (error) {
      console.log('Could not get user location for workout event');
      // Return a generic location (this should be handled better in production)
      return {
        latitude: 37.7749, // San Francisco default
        longitude: -122.4194,
      };
    }
  }
}

export const autoEventService = new AutoEventService();