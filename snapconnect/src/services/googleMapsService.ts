/**
 * Google Maps Service
 * Handles Google Places API integration for finding fitness-related venues
 * and generating walking routes for AI-powered suggestions
 * React Native compatible implementation using fetch
 */

import { LocationCoordinates } from './locationService';

export interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  coordinates: LocationCoordinates;
  rating?: number;
  types: string[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  price_level?: number;
  user_ratings_total?: number;
  distance_meters?: number;
}

export interface RouteResult {
  waypoints: LocationCoordinates[];
  distance_meters: number;
  duration_seconds: number;
  polyline: string;
  steps: Array<{
    instruction: string;
    distance_meters: number;
    duration_seconds: number;
    start_location: LocationCoordinates;
    end_location: LocationCoordinates;
  }>;
}

export type PlaceType = 
  | 'park'
  | 'gym'
  | 'hiking_trail'
  | 'tourist_attraction'
  | 'natural_feature'
  | 'recreation_center'
  | 'stadium'
  | 'establishment';

export type WalkingVenueType = 
  | 'parks'
  | 'trails'
  | 'fitness_centers'
  | 'outdoor_recreation'
  | 'scenic_points'
  | 'all';

class GoogleMapsService {
  private apiKey: string;
  private baseUrl: string = 'https://maps.googleapis.com/maps/api';

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey || this.apiKey === 'your_google_maps_api_key_here') {
      console.warn('Google Maps API key not configured. Some features may not work.');
    }
  }

  /**
   * Find nearby places suitable for walking activities
   */
  async findNearbyWalkingVenues(
    location: LocationCoordinates,
    venueType: WalkingVenueType = 'all',
    radiusMeters: number = 5000,
    maxResults: number = 20
  ): Promise<PlaceResult[]> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const placeTypes = this.getPlaceTypesForVenue(venueType);
      const allResults: PlaceResult[] = [];

      // Search for each place type
      for (const type of placeTypes) {
        const url = `${this.baseUrl}/place/nearbysearch/json?` +
          `location=${location.latitude},${location.longitude}&` +
          `radius=${radiusMeters}&` +
          `type=${type}&` +
          `key=${this.apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results) {
          const mappedResults = data.results
            .slice(0, Math.ceil(maxResults / placeTypes.length))
            .map(this.mapPlaceResult.bind(this));
          
          allResults.push(...mappedResults);
        } else if (data.status === 'ZERO_RESULTS') {
          // No results for this type, continue
          continue;
        } else {
          console.warn(`Places API returned status: ${data.status} for type: ${type}`);
        }
      }

      // Calculate distances and sort by distance
      const resultsWithDistance = allResults.map(place => ({
        ...place,
        distance_meters: this.calculateDistance(location, place.coordinates) * 1000,
      }));

      return resultsWithDistance
        .sort((a, b) => (a.distance_meters || 0) - (b.distance_meters || 0))
        .slice(0, maxResults);

    } catch (error) {
      console.error('Error finding nearby walking venues:', error);
      throw new Error('Failed to find nearby walking venues');
    }
  }

  /**
   * Get detailed information about a specific place
   */
  async getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const fields = [
        'place_id',
        'name',
        'formatted_address',
        'geometry',
        'rating',
        'types',
        'opening_hours',
        'photos',
        'price_level',
        'user_ratings_total',
      ].join(',');

      const url = `${this.baseUrl}/place/details/json?` +
        `place_id=${placeId}&` +
        `fields=${fields}&` +
        `key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        return this.mapPlaceResult(data.result);
      }

      return null;
    } catch (error) {
      console.error('Error getting place details:', error);
      return null;
    }
  }

  /**
   * Calculate walking route between multiple waypoints using Routes API v2
   */
  async calculateWalkingRoute(
    origin: LocationCoordinates,
    destination: LocationCoordinates,
    waypoints?: LocationCoordinates[]
  ): Promise<RouteResult | null> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;
      
      // Build intermediate waypoints for Routes API v2
      const intermediates = waypoints?.map(wp => ({
        location: {
          latLng: {
            latitude: wp.latitude,
            longitude: wp.longitude
          }
        }
      })) || [];

      const requestBody = {
        origin: {
          location: {
            latLng: {
              latitude: origin.latitude,
              longitude: origin.longitude
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.latitude,
              longitude: destination.longitude
            }
          }
        },
        ...(intermediates.length > 0 && { intermediates }),
        travelMode: 'WALK',
        routingPreference: 'TRAFFIC_UNAWARE',
        computeAlternativeRoutes: false,
        routeModifiers: {
          avoidIndoor: true // Prefer outdoor paths for walking
        },
        languageCode: 'en-US',
        units: 'METRIC'
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const legs = route.legs || [];
        
        // Calculate total distance and duration
        const totalDistance = route.distanceMeters || 0;
        const totalDuration = route.duration ? this.parseDuration(route.duration) : 0;
        
        // Extract steps from all legs
        const allSteps: any[] = [];
        legs.forEach((leg: any) => {
          if (leg.steps) {
            allSteps.push(...leg.steps.map((step: any) => ({
              instruction: step.navigationInstruction?.instructions || '',
              distance_meters: step.distanceMeters || 0,
              duration_seconds: step.staticDuration ? this.parseDuration(step.staticDuration) : 0,
              start_location: {
                latitude: step.startLocation?.latLng?.latitude || 0,
                longitude: step.startLocation?.latLng?.longitude || 0,
              },
              end_location: {
                latitude: step.endLocation?.latLng?.latitude || 0,
                longitude: step.endLocation?.latLng?.longitude || 0,
              },
            })));
          }
        });

        return {
          waypoints: [origin, ...(waypoints || []), destination],
          distance_meters: totalDistance,
          duration_seconds: totalDuration,
          polyline: route.polyline?.encodedPolyline || '',
          steps: allSteps,
        };
      }

      return null;
    } catch (error) {
      console.error('Error calculating walking route with Routes API:', error);
      
      // Fallback to legacy Directions API if Routes API fails
      console.log('Falling back to legacy Directions API...');
      return this.calculateWalkingRouteLegacy(origin, destination, waypoints);
    }
  }

  /**
   * Legacy Directions API fallback method
   */
  private async calculateWalkingRouteLegacy(
    origin: LocationCoordinates,
    destination: LocationCoordinates,
    waypoints?: LocationCoordinates[]
  ): Promise<RouteResult | null> {
    try {
      let url = `${this.baseUrl}/directions/json?` +
        `origin=${origin.latitude},${origin.longitude}&` +
        `destination=${destination.latitude},${destination.longitude}&` +
        `mode=walking&` +
        `key=${this.apiKey}`;

      if (waypoints && waypoints.length > 0) {
        const waypointString = waypoints.map(wp => `${wp.latitude},${wp.longitude}`).join('|');
        url += `&waypoints=${waypointString}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];

        return {
          waypoints: [origin, ...(waypoints || []), destination],
          distance_meters: leg.distance?.value || 0,
          duration_seconds: leg.duration?.value || 0,
          polyline: route.overview_polyline?.points || '',
          steps: leg.steps?.map((step: any) => ({
            instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || '',
            distance_meters: step.distance?.value || 0,
            duration_seconds: step.duration?.value || 0,
            start_location: {
              latitude: step.start_location.lat,
              longitude: step.start_location.lng,
            },
            end_location: {
              latitude: step.end_location.lat,
              longitude: step.end_location.lng,
            },
          })) || [],
        };
      }

      return null;
    } catch (error) {
      console.error('Error with legacy Directions API:', error);
      return null;
    }
  }

  /**
   * Parse duration string from Routes API (e.g., "123s" to 123)
   */
  private parseDuration(duration: string): number {
    if (typeof duration === 'string' && duration.endsWith('s')) {
      return parseInt(duration.slice(0, -1), 10);
    }
    return 0;
  }

  /**
   * Find optimized walking loop starting and ending at the same location
   */
  async generateWalkingLoop(
    startLocation: LocationCoordinates,
    targetDistanceKm: number = 2,
    venueType: WalkingVenueType = 'parks'
  ): Promise<RouteResult | null> {
    try {
      // Find nearby interesting places
      const places = await this.findNearbyWalkingVenues(
        startLocation,
        venueType,
        targetDistanceKm * 1000 / 2, // Search within half the target distance
        10
      );

      if (places.length === 0) {
        return null;
      }

      // Select places to create a loop
      const selectedPlaces = this.selectPlacesForLoop(places, targetDistanceKm);
      
      if (selectedPlaces.length === 0) {
        return null;
      }

      // Calculate route through selected places back to start
      return await this.calculateWalkingRoute(
        startLocation,
        startLocation,
        selectedPlaces.map(p => p.coordinates)
      );

    } catch (error) {
      console.error('Error generating walking loop:', error);
      return null;
    }
  }

  /**
   * Search for specific walking destinations by text query
   */
  async searchWalkingDestinations(
    query: string,
    location: LocationCoordinates,
    radiusMeters: number = 10000
  ): Promise<PlaceResult[]> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const url = `${this.baseUrl}/place/textsearch/json?` +
        `query=${encodeURIComponent(query + ' walking trails parks near me')}&` +
        `location=${location.latitude},${location.longitude}&` +
        `radius=${radiusMeters}&` +
        `key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results) {
        return data.results
          .map(this.mapPlaceResult.bind(this))
          .map(place => ({
            ...place,
            distance_meters: this.calculateDistance(location, place.coordinates) * 1000,
          }))
          .sort((a, b) => (a.distance_meters || 0) - (b.distance_meters || 0));
      }

      return [];
    } catch (error) {
      console.error('Error searching walking destinations:', error);
      return [];
    }
  }

  /**
   * Get place types based on venue type
   */
  private getPlaceTypesForVenue(venueType: WalkingVenueType): PlaceType[] {
    const typeMapping: Record<WalkingVenueType, PlaceType[]> = {
      parks: ['park'],
      trails: ['park', 'natural_feature', 'tourist_attraction'],
      fitness_centers: ['gym', 'stadium', 'recreation_center'],
      outdoor_recreation: ['park', 'natural_feature', 'tourist_attraction'],
      scenic_points: ['tourist_attraction', 'natural_feature', 'park'],
      all: ['park', 'gym', 'natural_feature', 'tourist_attraction', 'recreation_center'],
    };

    return typeMapping[venueType] || typeMapping.all;
  }

  /**
   * Map Google Places API result to our PlaceResult interface
   */
  private mapPlaceResult(place: any): PlaceResult {
    return {
      place_id: place.place_id,
      name: place.name || 'Unknown Place',
      formatted_address: place.formatted_address,
      coordinates: {
        latitude: place.geometry?.location?.lat || 0,
        longitude: place.geometry?.location?.lng || 0,
      },
      rating: place.rating,
      types: place.types || [],
      opening_hours: place.opening_hours ? {
        open_now: place.opening_hours.open_now,
        weekday_text: place.opening_hours.weekday_text,
      } : undefined,
      photos: place.photos?.map((photo: any) => ({
        photo_reference: photo.photo_reference,
        height: photo.height,
        width: photo.width,
      })),
      price_level: place.price_level,
      user_ratings_total: place.user_ratings_total,
    };
  }

  /**
   * Select places for creating an optimal walking loop
   */
  private selectPlacesForLoop(places: PlaceResult[], targetDistanceKm: number): PlaceResult[] {
    // Simple algorithm: select 2-3 places that form a reasonable loop
    const maxPlaces = Math.min(3, places.length);
    const selectedPlaces: PlaceResult[] = [];
    
    // Start with the highest-rated close place
    const sortedByRating = places
      .filter(p => (p.distance_meters || 0) < targetDistanceKm * 1000)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));

    if (sortedByRating.length > 0) {
      selectedPlaces.push(sortedByRating[0]);
    }

    // Add places that are not too close to each other
    for (let i = 1; i < sortedByRating.length && selectedPlaces.length < maxPlaces; i++) {
      const candidate = sortedByRating[i];
      const tooClose = selectedPlaces.some(selected => 
        this.calculateDistance(selected.coordinates, candidate.coordinates) < 0.3 // 300m minimum
      );

      if (!tooClose) {
        selectedPlaces.push(candidate);
      }
    }

    return selectedPlaces;
  }

  /**
   * Calculate distance between two coordinates in kilometers
   */
  private calculateDistance(coord1: LocationCoordinates, coord2: LocationCoordinates): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coord2.latitude - coord1.latitude);
    const dLon = this.toRadians(coord2.longitude - coord1.longitude);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.latitude)) *
        Math.cos(this.toRadians(coord2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get photo URL for a place photo reference
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    if (!this.apiKey) {
      return '';
    }
    return `https://maps.googleapis.com/maps/api/place/photo?photoreference=${photoReference}&maxwidth=${maxWidth}&key=${this.apiKey}`;
  }
}

export const googleMapsService = new GoogleMapsService();