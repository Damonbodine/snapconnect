/**
 * Type definitions for AI-powered walk suggestions
 */

import { LocationCoordinates } from '../services/locationService';
import { PlaceResult, RouteResult } from '../services/googleMapsService';

export type WalkDifficulty = 'easy' | 'moderate' | 'challenging';
export type WalkType = 'park_loop' | 'trail_hike' | 'urban_exploration' | 'scenic_route' | 'fitness_circuit' | 'social_walk';
export type SuggestionStatus = 'generated' | 'saved' | 'completed' | 'dismissed';

export interface WalkSuggestion {
  id: string;
  title: string;
  description: string;
  aiGeneratedContent: string; // The full AI-generated motivational description
  
  // Route information
  route: RouteResult;
  startLocation: LocationCoordinates;
  endLocation: LocationCoordinates;
  pointsOfInterest: PlaceResult[];
  
  // Walk characteristics
  walkType: WalkType;
  difficulty: WalkDifficulty;
  estimatedDuration: number; // in minutes
  distance: number; // in meters
  elevationGain?: number; // in meters
  
  // Context and personalization
  personalizedFor: string; // user ID
  fitnessLevel: string; // user's fitness level
  interests: string[]; // user's interests that influenced this suggestion
  weatherConsidered?: string; // weather conditions considered
  timeOfDay?: string; // suggested time of day
  
  // Metadata
  generatedAt: string; // ISO timestamp
  expiresAt?: string; // Optional expiration for time-sensitive suggestions
  status: SuggestionStatus;
  userRating?: number; // 1-5 rating if user completed the walk
  
  // Social aspects
  suggestedGroupSize?: number;
  socialPrompt?: string; // AI-generated text encouraging others to join
  
  // Event creation potential
  canCreateEvent: boolean;
  suggestedEventTitle?: string;
  suggestedEventDescription?: string;
}

export interface WalkSuggestionRequest {
  userLocation: LocationCoordinates;
  userProfile: UserWalkingProfile;
  preferences: WalkPreferences;
  contextualFactors?: ContextualFactors;
}

export interface UserWalkingProfile {
  userId: string;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredDistance: {
    min: number; // km
    max: number; // km
  };
  preferredDuration: {
    min: number; // minutes
    max: number; // minutes
  };
  interests: WalkingInterest[];
  limitations?: string[]; // e.g., 'no steep hills', 'paved paths only'
  socialPreference: 'solo' | 'small_group' | 'large_group' | 'any';
}

export type WalkingInterest = 
  | 'nature'
  | 'photography'
  | 'fitness'
  | 'meditation'
  | 'urban_exploration'
  | 'historical_sites'
  | 'scenic_views'
  | 'wildlife'
  | 'architecture'
  | 'social_interaction';

export interface WalkPreferences {
  preferredTypes: WalkType[];
  avoidBusyAreas?: boolean;
  requireShade?: boolean;
  preferPavedPaths?: boolean;
  includeRestStops?: boolean;
  maxElevationGain?: number; // meters
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'any';
}

export interface ContextualFactors {
  weather?: {
    temperature: number; // Celsius
    condition: 'sunny' | 'cloudy' | 'rainy' | 'windy';
    humidity?: number; // percentage
  };
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  dayOfWeek: 'weekday' | 'weekend';
  season: 'spring' | 'summer' | 'fall' | 'winter';
  currentActivity?: string; // what user was doing before requesting suggestions
}

export interface SuggestionFilters {
  difficulty?: WalkDifficulty[];
  walkType?: WalkType[];
  maxDistance?: number; // km
  maxDuration?: number; // minutes
  requiresPoints?: boolean; // must have points of interest
  rating?: number; // minimum rating
  generatedAfter?: string; // ISO timestamp
}

export interface SuggestionGenerationOptions {
  count: number; // number of suggestions to generate
  diversityFactor: number; // 0-1, higher means more diverse suggestions
  useCache: boolean; // whether to use cached suggestions
  forceRefresh: boolean; // force new generation even if cache exists
}

export interface WalkSuggestionFeedback {
  suggestionId: string;
  userId: string;
  completed: boolean;
  rating?: number; // 1-5
  feedback?: string;
  actualDuration?: number; // minutes
  actualDifficulty?: WalkDifficulty;
  wouldRecommend: boolean;
  improvementSuggestions?: string;
  submittedAt: string;
}

export interface SuggestionCache {
  userId: string;
  location: LocationCoordinates;
  radius: number; // meters
  suggestions: WalkSuggestion[];
  generatedAt: string;
  expiresAt: string;
}

// Helper type for creating events from suggestions
export interface SuggestionToEventData {
  suggestion: WalkSuggestion;
  scheduledFor: string; // ISO timestamp
  isPublic: boolean;
  maxParticipants?: number;
  additionalNotes?: string;
}

// Metrics and analytics types
export interface SuggestionMetrics {
  totalGenerated: number;
  totalCompleted: number;
  averageRating: number;
  popularWalkTypes: Array<{
    type: WalkType;
    count: number;
  }>;
  averageCompletionTime: number; // minutes
  topRatedSuggestions: WalkSuggestion[];
}

export interface UserWalkingStats {
  userId: string;
  totalSuggestionsReceived: number;
  totalSuggestionsCompleted: number;
  totalDistanceWalked: number; // meters
  totalTimeWalked: number; // minutes
  favoriteWalkType: WalkType;
  averageRating: number;
  streakDays: number; // consecutive days with walk activities
  badges: WalkingBadge[];
}

export interface WalkingBadge {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  earnedAt: string;
  category: 'distance' | 'frequency' | 'exploration' | 'social' | 'special';
}

// Export utility type guards
export const isValidWalkDifficulty = (value: string): value is WalkDifficulty => {
  return ['easy', 'moderate', 'challenging'].includes(value);
};

export const isValidWalkType = (value: string): value is WalkType => {
  return ['park_loop', 'trail_hike', 'urban_exploration', 'scenic_route', 'fitness_circuit', 'social_walk'].includes(value);
};

export const isValidSuggestionStatus = (value: string): value is SuggestionStatus => {
  return ['generated', 'saved', 'completed', 'dismissed'].includes(value);
};