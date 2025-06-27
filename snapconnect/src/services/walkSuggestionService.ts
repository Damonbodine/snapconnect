/**
 * Walk Suggestion Service
 * Core service for generating AI-powered, location-based walk suggestions
 */

import { googleMapsService, WalkingVenueType } from './googleMapsService';
import { locationService, LocationCoordinates } from './locationService';
import { openaiService } from './openaiService';
import {
  WalkSuggestion,
  WalkSuggestionRequest,
  UserWalkingProfile,
  WalkPreferences,
  ContextualFactors,
  WalkDifficulty,
  WalkType,
  SuggestionGenerationOptions,
  SuggestionCache,
  WalkSuggestionFeedback,
  SuggestionFilters,
} from '../types/walkSuggestion';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CachedSuggestions {
  [key: string]: SuggestionCache;
}

class WalkSuggestionService {
  private static instance: WalkSuggestionService;
  private suggestionCache: CachedSuggestions = {};
  private readonly CACHE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
  private readonly CACHE_KEY = 'walk_suggestions_cache';

  public static getInstance(): WalkSuggestionService {
    if (!WalkSuggestionService.instance) {
      WalkSuggestionService.instance = new WalkSuggestionService();
    }
    return WalkSuggestionService.instance;
  }

  constructor() {
    this.loadCacheFromStorage();
  }

  /**
   * Generate personalized walk suggestions for a user
   */
  async generateWalkSuggestions(
    request: WalkSuggestionRequest,
    options: SuggestionGenerationOptions = {
      count: 3,
      diversityFactor: 0.7,
      useCache: true,
      forceRefresh: false,
    }
  ): Promise<WalkSuggestion[]> {
    try {
      console.log('🚶‍♀️ Generating walk suggestions for user:', request.userProfile.userId);

      // Check cache first (unless force refresh)
      if (options.useCache && !options.forceRefresh) {
        const cachedSuggestions = await this.getCachedSuggestions(
          request.userProfile.userId,
          request.userLocation,
          5000 // 5km cache radius
        );

        if (cachedSuggestions.length > 0) {
          console.log('📋 Using cached suggestions:', cachedSuggestions.length);
          return this.selectDiverseSuggestions(cachedSuggestions, options.count, options.diversityFactor);
        }
      }

      // Generate new suggestions
      const suggestions = await this.generateNewSuggestions(request, options);

      // Cache the results
      if (options.useCache && suggestions.length > 0) {
        await this.cacheSuggestions(
          request.userProfile.userId,
          request.userLocation,
          suggestions,
          5000 // 5km cache radius
        );
      }

      return suggestions;

    } catch (error) {
      console.error('❌ Error generating walk suggestions:', error);
      throw new Error(`Failed to generate walk suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate new walk suggestions using AI and location data
   */
  private async generateNewSuggestions(
    request: WalkSuggestionRequest,
    options: SuggestionGenerationOptions
  ): Promise<WalkSuggestion[]> {
    const { userLocation, userProfile, preferences, contextualFactors } = request;
    const suggestions: WalkSuggestion[] = [];

    // Step 1: Find nearby places of interest
    const nearbyPlaces = await this.findNearbyWalkingPlaces(userLocation, preferences);
    
    if (nearbyPlaces.length === 0) {
      console.warn('⚠️ No nearby places found for walk suggestions');
      return [];
    }

    // Step 2: Generate different types of walk suggestions
    const suggestionTypes = this.selectSuggestionTypes(preferences, options.count);

    for (const walkType of suggestionTypes) {
      try {
        const suggestion = await this.generateSuggestionForType(
          walkType,
          userLocation,
          userProfile,
          preferences,
          nearbyPlaces,
          contextualFactors
        );

        if (suggestion) {
          suggestions.push(suggestion);
        }

        // Stop if we have enough suggestions
        if (suggestions.length >= options.count) {
          break;
        }
      } catch (error) {
        console.error(`❌ Error generating ${walkType} suggestion:`, error);
        // Continue with other types
      }
    }

    return suggestions;
  }

  /**
   * Generate a single walk suggestion for a specific type
   */
  private async generateSuggestionForType(
    walkType: WalkType,
    userLocation: LocationCoordinates,
    userProfile: UserWalkingProfile,
    preferences: WalkPreferences,
    nearbyPlaces: any[],
    contextualFactors?: ContextualFactors
  ): Promise<WalkSuggestion | null> {
    try {
      // Step 1: Generate dynamic start/end points FIRST for variety
      const dynamicStartEnd = this.getDynamicStartEndPoints(walkType, nearbyPlaces, userLocation);
      
      // Step 2: Create route based on walk type using dynamic start point
      const route = await this.createRouteForWalkType(
        walkType,
        dynamicStartEnd.start,
        nearbyPlaces,
        userProfile.preferredDistance,
        preferences
      );

      if (!route) {
        return null;
      }

      // Step 3: Determine difficulty based on route characteristics
      const difficulty = this.calculateWalkDifficulty(route, userProfile.fitnessLevel);

      // Step 4: Generate AI content
      const aiContent = await this.generateAIContent(
        walkType,
        route,
        userProfile,
        nearbyPlaces,
        contextualFactors
      );
      
      const suggestion: WalkSuggestion = {
        id: this.generateSuggestionId(),
        title: aiContent.title,
        description: aiContent.description,
        aiGeneratedContent: aiContent.fullDescription,
        route: route,
        startLocation: dynamicStartEnd.start,
        endLocation: dynamicStartEnd.end,
        pointsOfInterest: nearbyPlaces.slice(0, 3), // Top 3 places
        walkType,
        difficulty,
        estimatedDuration: Math.round(route.duration_seconds / 60),
        distance: route.distance_meters,
        personalizedFor: userProfile.userId,
        fitnessLevel: userProfile.fitnessLevel,
        interests: userProfile.interests,
        weatherConsidered: contextualFactors?.weather?.condition,
        timeOfDay: contextualFactors?.timeOfDay,
        generatedAt: new Date().toISOString(),
        status: 'generated',
        canCreateEvent: true,
        suggestedEventTitle: aiContent.eventTitle,
        suggestedEventDescription: aiContent.eventDescription,
        socialPrompt: aiContent.socialPrompt,
        suggestedGroupSize: this.getSuggestedGroupSize(walkType, userProfile.socialPreference),
      };

      return suggestion;

    } catch (error) {
      console.error(`❌ Error generating ${walkType} suggestion:`, error);
      return null;
    }
  }

  /**
   * Generate dynamic start and end points for variety
   */
  private getDynamicStartEndPoints(
    walkType: WalkType,
    nearbyPlaces: any[],
    userLocation: LocationCoordinates
  ): { start: LocationCoordinates; end: LocationCoordinates } {
    console.log(`🎯 Generating dynamic start/end for ${walkType} with ${nearbyPlaces.length} places`);
    
    const availablePlaces = nearbyPlaces.filter(place => 
      place.coordinates && 
      place.distance_meters && 
      place.distance_meters < 5000 // Increased to 5km for more options
    );

    console.log(`📍 Found ${availablePlaces.length} places with coordinates within 5km`);
    if (availablePlaces.length > 0) {
      console.log(`📍 Sample places:`, availablePlaces.slice(0, 3).map(p => ({ name: p.name, types: p.types, distance: p.distance_meters })));
    }

    switch (walkType) {
      case 'park_loop':
        // Start at the best park, end at another park or nearby point
        if (availablePlaces.length >= 1) {
          const parks = availablePlaces.filter(p => p.types?.includes('park'));
          const park1 = parks.length > 0 ? parks[0] : availablePlaces[0];
          const park2 = parks.length > 1 
            ? parks.find(p => p.place_id !== park1.place_id)
            : availablePlaces.find(p => p.place_id !== park1.place_id) || this.getRandomNearbyPoint(park1.coordinates, 1.0);
          
          console.log(`🌳 Park loop: ${park1.name} to ${park2.name || 'nearby point'}`);
          return { start: park1.coordinates, end: park2.coordinates || park2 };
        }
        break;

      case 'trail_hike':
        // Start at a trailhead, end at a scenic point
        if (availablePlaces.length >= 1) {
          const trailStart = availablePlaces.find(p => 
            p.types.includes('natural_feature') || p.name.toLowerCase().includes('trail')
          ) || availablePlaces[0];
          const scenicEnd = availablePlaces.find(p => 
            p.types.includes('tourist_attraction') && p.place_id !== trailStart.place_id
          ) || this.getRandomNearbyPoint(trailStart.coordinates, 1);
          return { start: trailStart.coordinates, end: scenicEnd.coordinates || scenicEnd };
        }
        break;

      case 'urban_exploration':
        // Start at an interesting place, end at another
        if (availablePlaces.length >= 1) {
          const highRated = availablePlaces.filter(p => p.rating && p.rating >= 4.0);
          const urbanStart = highRated.length > 0 ? highRated[0] : availablePlaces[0];
          const urbanEnd = availablePlaces.length > 1
            ? availablePlaces.find(p => p.place_id !== urbanStart.place_id) || this.getRandomNearbyPoint(urbanStart.coordinates, 1.0)
            : this.getRandomNearbyPoint(urbanStart.coordinates, 1.0);
          
          console.log(`🏙️ Urban exploration: ${urbanStart.name} to ${urbanEnd.name || 'nearby point'}`);
          return { start: urbanStart.coordinates, end: urbanEnd.coordinates || urbanEnd };
        }
        break;

      case 'scenic_route':
        // Start near home, end at the most scenic place
        if (availablePlaces.length >= 1) {
          const scenicDestination = availablePlaces.find(p => 
            p.types.includes('tourist_attraction') || p.rating >= 4.5
          ) || availablePlaces[0];
          const nearbyStart = this.getRandomNearbyPoint(userLocation, 0.5); // 500m from home
          return { start: nearbyStart, end: scenicDestination.coordinates };
        }
        break;

      case 'fitness_circuit':
        // Start at gym/recreation center, end at park
        if (availablePlaces.length >= 1) {
          const fitnessStart = availablePlaces.find(p => 
            p.types.includes('gym') || p.types.includes('recreation_center')
          ) || userLocation;
          const parkEnd = availablePlaces.find(p => 
            p.types.includes('park') && p.place_id !== fitnessStart.place_id
          ) || this.getRandomNearbyPoint(userLocation, 1);
          return { 
            start: fitnessStart.coordinates || fitnessStart, 
            end: parkEnd.coordinates || parkEnd 
          };
        }
        break;

      case 'social_walk':
        // Start at a popular meeting place, end at a café or social venue
        if (availablePlaces.length >= 2) {
          const meetingPoint = availablePlaces.find(p => 
            p.types.includes('park') || p.types.includes('tourist_attraction')
          ) || availablePlaces[0];
          const socialEnd = availablePlaces.find(p => 
            (p.types.includes('cafe') || p.types.includes('restaurant')) && 
            p.place_id !== meetingPoint.place_id
          ) || availablePlaces[1];
          return { start: meetingPoint.coordinates, end: socialEnd.coordinates };
        }
        break;

      default:
        break;
    }

    // Enhanced fallback: try to use any available places as start points
    if (availablePlaces.length > 0) {
      console.log(`📍 Using fallback with available places`);
      const startPlace = availablePlaces[Math.floor(Math.random() * availablePlaces.length)];
      const endPlace = availablePlaces.length > 1 
        ? availablePlaces.find(p => p.place_id !== startPlace.place_id) || this.getRandomNearbyPoint(userLocation, 1.5)
        : this.getRandomNearbyPoint(startPlace.coordinates, 1.0);
      
      console.log(`📍 Fallback start: ${startPlace.name}, end: ${endPlace.name || 'random point'}`);
      return { 
        start: startPlace.coordinates, 
        end: endPlace.coordinates || endPlace 
      };
    }
    
    // Last resort: create varied start/end points near user location
    console.log(`📍 Last resort: random points near user location`);
    const randomStart = this.getRandomNearbyPoint(userLocation, 1.0); // 1km radius
    const randomEnd = this.getRandomNearbyPoint(userLocation, 1.5);   // 1.5km radius
    return { start: randomStart, end: randomEnd };
  }

  /**
   * Generate a random point near a location
   */
  private getRandomNearbyPoint(center: LocationCoordinates, radiusKm: number): LocationCoordinates {
    const radiusDegrees = radiusKm / 111; // Rough conversion
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusDegrees;
    
    return {
      latitude: center.latitude + distance * Math.cos(angle),
      longitude: center.longitude + distance * Math.sin(angle),
    };
  }

  /**
   * Find nearby places suitable for walking
   */
  private async findNearbyWalkingPlaces(
    location: LocationCoordinates,
    preferences: WalkPreferences
  ): Promise<any[]> {
    const venueTypes: WalkingVenueType[] = ['parks', 'trails', 'scenic_points'];
    const allPlaces: any[] = [];

    for (const venueType of venueTypes) {
      try {
        const places = await googleMapsService.findNearbyWalkingVenues(
          location,
          venueType,
          Math.max(preferences.avoidBusyAreas ? 3000 : 5000, 2000), // Adjust radius based on preferences
          10
        );
        allPlaces.push(...places);
      } catch (error) {
        console.warn(`⚠️ Failed to find ${venueType}:`, error);
      }
    }

    // Remove duplicates and sort by rating
    const uniquePlaces = allPlaces.filter(
      (place, index, self) => self.findIndex(p => p.place_id === place.place_id) === index
    );

    return uniquePlaces
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 20); // Top 20 places
  }

  /**
   * Create a route based on walk type
   */
  private async createRouteForWalkType(
    walkType: WalkType,
    startLocation: LocationCoordinates,
    nearbyPlaces: any[],
    preferredDistance: { min: number; max: number },
    preferences: WalkPreferences
  ): Promise<any> {
    // Add variety by using random distance within preferred range
    const minDistance = preferredDistance.min;
    const maxDistance = preferredDistance.max;
    const targetDistance = minDistance + Math.random() * (maxDistance - minDistance);
    
    console.log(`🎯 Target distance for ${walkType}: ${targetDistance.toFixed(1)}km (range: ${minDistance}-${maxDistance}km)`);

    switch (walkType) {
      case 'park_loop':
        return await this.createParkLoop(startLocation, nearbyPlaces, targetDistance);
      
      case 'trail_hike':
        return await this.createTrailRoute(startLocation, nearbyPlaces, targetDistance);
      
      case 'urban_exploration':
        return await this.createUrbanRoute(startLocation, nearbyPlaces, targetDistance);
      
      case 'scenic_route':
        return await this.createScenicRoute(startLocation, nearbyPlaces, targetDistance);
      
      case 'fitness_circuit':
        return await this.createFitnessCircuit(startLocation, nearbyPlaces, targetDistance);
      
      case 'social_walk':
        return await this.createSocialWalkRoute(startLocation, nearbyPlaces, targetDistance);
      
      default:
        return await this.createParkLoop(startLocation, nearbyPlaces, targetDistance);
    }
  }

  /**
   * Create a park loop route
   */
  private async createParkLoop(
    startLocation: LocationCoordinates,
    nearbyPlaces: any[],
    targetDistanceKm: number
  ): Promise<any> {
    console.log('🌳 Creating park loop with', nearbyPlaces.length, 'nearby places');
    
    // If no places found, create a simple circular route
    if (nearbyPlaces.length === 0) {
      console.log('🔄 No places found, creating simple circular route');
      return this.createSimpleCircularRoute(startLocation, targetDistanceKm);
    }

    const parks = nearbyPlaces.filter(place => 
      place.types && (place.types.includes('park') || place.types.includes('natural_feature'))
    );

    if (parks.length > 0) {
      try {
        // Try to create a loop through the nearest park
        const result = await googleMapsService.generateWalkingLoop(
          startLocation,
          targetDistanceKm,
          'parks'
        );
        if (result) return result;
      } catch (error) {
        console.warn('❌ Failed to generate walking loop:', error);
      }
    }

    // Fallback: create a simple route to the nearest place and back
    const nearestPlace = nearbyPlaces[0];
    if (nearestPlace && nearestPlace.coordinates) {
      try {
        return await googleMapsService.calculateWalkingRoute(
          startLocation,
          startLocation,
          [nearestPlace.coordinates]
        );
      } catch (error) {
        console.warn('❌ Failed to calculate walking route:', error);
      }
    }

    // Final fallback: simple circular route
    return this.createSimpleCircularRoute(startLocation, targetDistanceKm);
  }

  /**
   * Create simple circular route when no places are found
   */
  private createSimpleCircularRoute(
    startLocation: LocationCoordinates,
    targetDistanceKm: number
  ): any {
    // Create a simple square-ish route around the starting location
    const radiusKm = targetDistanceKm / 4; // Quarter of target distance for each side
    const radiusDegrees = radiusKm / 111; // Rough conversion to degrees

    const waypoints: LocationCoordinates[] = [
      {
        latitude: startLocation.latitude + radiusDegrees,
        longitude: startLocation.longitude + radiusDegrees,
      },
      {
        latitude: startLocation.latitude + radiusDegrees,
        longitude: startLocation.longitude - radiusDegrees,
      },
      {
        latitude: startLocation.latitude - radiusDegrees,
        longitude: startLocation.longitude - radiusDegrees,
      },
      {
        latitude: startLocation.latitude - radiusDegrees,
        longitude: startLocation.longitude + radiusDegrees,
      },
    ];

    const distanceMeters = targetDistanceKm * 1000;
    const estimatedDurationSeconds = distanceMeters / 1.4; // ~1.4 m/s walking speed

    return {
      waypoints: [startLocation, ...waypoints, startLocation],
      distance_meters: distanceMeters,
      duration_seconds: estimatedDurationSeconds,
      polyline: '', // Would need encoding for real polyline
      steps: [],
    };
  }

  /**
   * Create trail route
   */
  private async createTrailRoute(
    startLocation: LocationCoordinates,
    nearbyPlaces: any[],
    targetDistanceKm: number
  ): Promise<any> {
    try {
      const result = await googleMapsService.generateWalkingLoop(
        startLocation,
        targetDistanceKm,
        'trails'
      );
      if (result) return result;
    } catch (error) {
      console.warn('❌ Failed to create trail route:', error);
    }
    
    // Fallback to simple route
    return this.createSimpleCircularRoute(startLocation, targetDistanceKm);
  }

  /**
   * Create urban exploration route
   */
  private async createUrbanRoute(
    startLocation: LocationCoordinates,
    nearbyPlaces: any[],
    targetDistanceKm: number
  ): Promise<any> {
    const interestingPlaces = nearbyPlaces
      .filter(place => place.rating && place.rating >= 4.0)
      .slice(0, 3);

    if (interestingPlaces.length >= 2) {
      try {
        const result = await googleMapsService.calculateWalkingRoute(
          startLocation,
          startLocation,
          interestingPlaces.map(p => p.coordinates)
        );
        if (result) return result;
      } catch (error) {
        console.warn('❌ Failed to create urban route:', error);
      }
    }

    // Fallback to simple route
    return this.createSimpleCircularRoute(startLocation, targetDistanceKm);
  }

  /**
   * Create scenic route
   */
  private async createScenicRoute(
    startLocation: LocationCoordinates,
    nearbyPlaces: any[],
    targetDistanceKm: number
  ): Promise<any> {
    try {
      const result = await googleMapsService.generateWalkingLoop(
        startLocation,
        targetDistanceKm,
        'scenic_points'
      );
      if (result) return result;
    } catch (error) {
      console.warn('❌ Failed to create scenic route:', error);
    }
    
    return this.createSimpleCircularRoute(startLocation, targetDistanceKm);
  }

  /**
   * Create fitness circuit
   */
  private async createFitnessCircuit(
    startLocation: LocationCoordinates,
    nearbyPlaces: any[],
    targetDistanceKm: number
  ): Promise<any> {
    try {
      const result = await googleMapsService.generateWalkingLoop(
        startLocation,
        targetDistanceKm,
        'outdoor_recreation'
      );
      if (result) return result;
    } catch (error) {
      console.warn('❌ Failed to create fitness circuit:', error);
    }
    
    return this.createSimpleCircularRoute(startLocation, targetDistanceKm);
  }

  /**
   * Create social walk route
   */
  private async createSocialWalkRoute(
    startLocation: LocationCoordinates,
    nearbyPlaces: any[],
    targetDistanceKm: number
  ): Promise<any> {
    try {
      const result = await googleMapsService.generateWalkingLoop(
        startLocation,
        targetDistanceKm,
        'parks'
      );
      if (result) return result;
    } catch (error) {
      console.warn('❌ Failed to create social walk route:', error);
    }
    
    return this.createSimpleCircularRoute(startLocation, targetDistanceKm);
  }

  /**
   * Generate AI content for the walk suggestion
   */
  private async generateAIContent(
    walkType: WalkType,
    route: any,
    userProfile: UserWalkingProfile,
    nearbyPlaces: any[],
    contextualFactors?: ContextualFactors
  ): Promise<{
    title: string;
    description: string;
    fullDescription: string;
    eventTitle: string;
    eventDescription: string;
    socialPrompt: string;
    pointsOfInterest: string;
  }> {
    const distance = Math.round(route.distance_meters / 1000 * 100) / 100; // km with 2 decimals
    const duration = Math.round(route.duration_seconds / 60); // minutes
    const placeNames = nearbyPlaces.slice(0, 10).map(p => p.name); // Top 10 places for variety
    
    // Use simple text generation to avoid circular dependencies
    const response = await openaiService.generateTextContent({
      prompt: this.buildAIPrompt(walkType, route, userProfile, nearbyPlaces, contextualFactors),
      personality: {
        fitness_level: userProfile.fitnessLevel,
        communication_style: 'encouraging',
        content_tone: 'positive',
        social_engagement: userProfile.socialPreference === 'solo' ? 'low' : 'high',
        experience_sharing: 'medium',
        emoji_usage: 'moderate',
        hashtag_style: 'fitness',
        content_length_preference: 'medium',
        primary_goals: ['fitness', 'exploration'],
        preferred_workout_types: ['walking', 'outdoor'],
      },
      archetype: {
        id: 'outdoor_adventurer',
        name: 'Outdoor Adventurer',
        description: 'Loves exploring nature and outdoor activities',
        personality_traits: {
          fitness_level: userProfile.fitnessLevel,
          communication_style: 'encouraging',
          content_tone: 'positive',
          social_engagement: 'high',
          experience_sharing: 'high',
        },
      },
      contentType: 'motivation',
      maxTokens: 200,
      temperature: 0.8,
    });

    return this.parseAIResponse(response, walkType);
  }

  /**
   * Build AI prompt for walk suggestion generation
   */
  private buildAIPrompt(
    walkType: WalkType,
    route: any,
    userProfile: UserWalkingProfile,
    nearbyPlaces: any[],
    contextualFactors?: ContextualFactors
  ): string {
    const distance = Math.round(route.distance_meters / 1000 * 100) / 100; // km with 2 decimals
    const duration = Math.round(route.duration_seconds / 60); // minutes
    
    const placeNames = nearbyPlaces.slice(0, 3).map(p => p.name).join(', ');
    const weather = contextualFactors?.weather ? ` The weather is ${contextualFactors.weather.condition} with ${contextualFactors.weather.temperature}°C.` : '';
    const timeContext = contextualFactors?.timeOfDay ? ` It's ${contextualFactors.timeOfDay}.` : '';

    return `Create an inspiring walk suggestion for a ${userProfile.fitnessLevel} fitness level person who enjoys ${userProfile.interests.join(' and ')}.

Walk details:
- Type: ${walkType.replace('_', ' ')}
- Distance: ${distance}km
- Duration: ~${duration} minutes
- Nearby attractions: ${placeNames}
- Social preference: ${userProfile.socialPreference}${weather}${timeContext}

IMPORTANT: You MUST highlight exactly 3 specific points of interest from the nearby attractions list. Select the most interesting ones and explain what makes each special.

Generate a motivational title, description, and social invitation that would inspire someone to take this walk. Make it personal and exciting, highlighting the benefits and the 3 specific stops along the way.

Format your response as:
TITLE: [catchy title]
DESCRIPTION: [2-3 sentence description]
FULL: [detailed motivational description mentioning 3 specific stops]
POINTS: [Point 1: name - what makes it special] | [Point 2: name - what makes it special] | [Point 3: name - what makes it special]
EVENT_TITLE: [suggested event title if creating a group walk]
EVENT_DESC: [event description]
SOCIAL: [invitation text for others to join]`;
  }

  /**
   * Parse AI response into structured content
   */
  private parseAIResponse(
    response: string,
    walkType: WalkType
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
      if (line.startsWith('TITLE:')) {
        result.title = line.replace('TITLE:', '').trim();
      } else if (line.startsWith('DESCRIPTION:')) {
        result.description = line.replace('DESCRIPTION:', '').trim();
      } else if (line.startsWith('FULL:')) {
        result.fullDescription = line.replace('FULL:', '').trim();
      } else if (line.startsWith('EVENT_TITLE:')) {
        result.eventTitle = line.replace('EVENT_TITLE:', '').trim();
      } else if (line.startsWith('EVENT_DESC:')) {
        result.eventDescription = line.replace('EVENT_DESC:', '').trim();
      } else if (line.startsWith('POINTS:')) {
        result.pointsOfInterest = line.replace('POINTS:', '').trim();
      } else if (line.startsWith('SOCIAL:')) {
        result.socialPrompt = line.replace('SOCIAL:', '').trim();
      }
    }

    // Fallbacks if parsing fails
    if (!result.title) {
      result.title = this.getDefaultTitle(walkType);
    }
    if (!result.description) {
      result.description = response.substring(0, 150) + '...';
    }
    if (!result.fullDescription) {
      result.fullDescription = response;
    }

    return result;
  }

  /**
   * Calculate walk difficulty based on route and user fitness
   */
  private calculateWalkDifficulty(route: any, userFitnessLevel: string): WalkDifficulty {
    const distanceKm = route.distance_meters / 1000;
    const durationHours = route.duration_seconds / 3600;
    
    // Simple difficulty calculation
    let difficultyScore = 0;
    
    // Distance factor
    if (distanceKm > 5) difficultyScore += 2;
    else if (distanceKm > 2) difficultyScore += 1;
    
    // Duration factor
    if (durationHours > 2) difficultyScore += 2;
    else if (durationHours > 1) difficultyScore += 1;
    
    // Adjust based on user fitness level
    if (userFitnessLevel === 'beginner') difficultyScore += 1;
    else if (userFitnessLevel === 'advanced') difficultyScore -= 1;
    
    if (difficultyScore >= 3) return 'challenging';
    if (difficultyScore >= 1) return 'moderate';
    return 'easy';
  }

  /**
   * Select diverse suggestion types
   */
  private selectSuggestionTypes(preferences: WalkPreferences, count: number): WalkType[] {
    const preferredTypes = preferences.preferredTypes.length > 0 
      ? preferences.preferredTypes 
      : ['park_loop', 'trail_hike', 'scenic_route', 'social_walk'];
    
    const selected: WalkType[] = [];
    const available = [...preferredTypes];
    
    for (let i = 0; i < count && available.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * available.length);
      selected.push(available.splice(randomIndex, 1)[0]);
    }
    
    return selected;
  }

  /**
   * Cache management methods
   */
  private async loadCacheFromStorage(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cached) {
        this.suggestionCache = JSON.parse(cached);
      }
    } catch (error) {
      console.error('Error loading suggestion cache:', error);
    }
  }

  private async saveCacheToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(this.suggestionCache));
    } catch (error) {
      console.error('Error saving suggestion cache:', error);
    }
  }

  private async getCachedSuggestions(
    userId: string,
    location: LocationCoordinates,
    radiusMeters: number
  ): Promise<WalkSuggestion[]> {
    const cacheKey = `${userId}_${Math.round(location.latitude * 100)}_${Math.round(location.longitude * 100)}`;
    const cached = this.suggestionCache[cacheKey];
    
    if (!cached || new Date(cached.expiresAt).getTime() < Date.now()) {
      return [];
    }
    
    // Check if cached location is within radius
    const distance = locationService.calculateDistance(location, cached.location);
    if (distance * 1000 > radiusMeters) {
      return [];
    }
    
    return cached.suggestions;
  }

  private async cacheSuggestions(
    userId: string,
    location: LocationCoordinates,
    suggestions: WalkSuggestion[],
    radiusMeters: number
  ): Promise<void> {
    const cacheKey = `${userId}_${Math.round(location.latitude * 100)}_${Math.round(location.longitude * 100)}`;
    
    this.suggestionCache[cacheKey] = {
      userId,
      location,
      radius: radiusMeters,
      suggestions,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.CACHE_DURATION_MS).toISOString(),
    };
    
    await this.saveCacheToStorage();
  }

  /**
   * Utility methods
   */
  private generateSuggestionId(): string {
    return `walk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultTitle(walkType: WalkType): string {
    const titles = {
      park_loop: 'Beautiful Park Loop Walk',
      trail_hike: 'Nature Trail Adventure',
      urban_exploration: 'City Discovery Walk',
      scenic_route: 'Scenic Walking Route',
      fitness_circuit: 'Outdoor Fitness Circuit',
      social_walk: 'Community Walking Meet',
    };
    return titles[walkType] || 'Walking Adventure';
  }

  private getSuggestedGroupSize(walkType: WalkType, socialPreference: string): number {
    if (socialPreference === 'solo') return 1;
    if (walkType === 'social_walk') return 8;
    if (walkType === 'fitness_circuit') return 6;
    return 4;
  }

  private selectDiverseSuggestions(
    suggestions: WalkSuggestion[],
    count: number,
    diversityFactor: number
  ): WalkSuggestion[] {
    // Simple diversity algorithm - ensure different walk types
    const selected: WalkSuggestion[] = [];
    const usedTypes = new Set<WalkType>();
    
    // First, select one of each type
    for (const suggestion of suggestions) {
      if (!usedTypes.has(suggestion.walkType) && selected.length < count) {
        selected.push(suggestion);
        usedTypes.add(suggestion.walkType);
      }
    }
    
    // Fill remaining slots with best suggestions
    for (const suggestion of suggestions) {
      if (selected.length >= count) break;
      if (!selected.includes(suggestion)) {
        selected.push(suggestion);
      }
    }
    
    return selected.slice(0, count);
  }

  /**
   * Public utility methods
   */
  async clearCache(): Promise<void> {
    this.suggestionCache = {};
    await AsyncStorage.removeItem(this.CACHE_KEY);
  }

  async submitFeedback(feedback: WalkSuggestionFeedback): Promise<void> {
    // This would typically save to a backend service
    console.log('📝 Walk suggestion feedback submitted:', feedback);
    // TODO: Implement feedback storage
  }
}

export const walkSuggestionService = WalkSuggestionService.getInstance();