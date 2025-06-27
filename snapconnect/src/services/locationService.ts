import * as Location from 'expo-location';
import { googleMapsService, PlaceResult, WalkingVenueType } from './googleMapsService';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationResult {
  coordinates: LocationCoordinates;
  address?: string;
  name?: string;
  placeId?: string;
  rating?: number;
  types?: string[];
}

export interface LocationError {
  type: 'permission' | 'unavailable' | 'timeout' | 'unknown';
  message: string;
}

class LocationService {
  private static instance: LocationService;
  private permissionStatus: Location.LocationPermissionResponse | null = null;

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async requestLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      this.permissionStatus = { status } as Location.LocationPermissionResponse;
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }

  async checkLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      this.permissionStatus = { status } as Location.LocationPermissionResponse;
      return status === 'granted';
    } catch (error) {
      console.error('Error checking location permission:', error);
      return false;
    }
  }

  async getCurrentLocation(options?: {
    timeout?: number;
    accuracy?: Location.LocationAccuracy;
  }): Promise<LocationResult> {
    const hasPermission = await this.checkLocationPermission();
    
    if (!hasPermission) {
      const granted = await this.requestLocationPermission();
      if (!granted) {
        throw {
          type: 'permission',
          message: 'Location permission denied. Please enable location access in settings.'
        } as LocationError;
      }
    }

    try {
      const locationOptions: Location.LocationOptions = {
        accuracy: options?.accuracy || Location.LocationAccuracy.Balanced,
        timeInterval: options?.timeout || 10000,
      };

      const location = await Location.getCurrentPositionAsync(locationOptions);
      
      const coordinates: LocationCoordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      return {
        coordinates,
      };
    } catch (error: any) {
      console.error('Error getting current location:', error);
      
      if (error.code === 'E_LOCATION_UNAVAILABLE') {
        throw {
          type: 'unavailable',
          message: 'Location services are disabled or unavailable.'
        } as LocationError;
      }
      
      if (error.code === 'E_LOCATION_TIMEOUT') {
        throw {
          type: 'timeout',
          message: 'Location request timed out. Please try again.'
        } as LocationError;
      }
      
      throw {
        type: 'unknown',
        message: 'Failed to get location. Please try again.'
      } as LocationError;
    }
  }

  async reverseGeocode(coordinates: LocationCoordinates): Promise<string | null> {
    try {
      const reverseGeocodedAddress = await Location.reverseGeocodeAsync({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });

      if (reverseGeocodedAddress.length > 0) {
        const address = reverseGeocodedAddress[0];
        const parts = [
          address.streetNumber,
          address.street,
          address.city,
          address.region,
        ].filter(Boolean);
        
        return parts.join(', ');
      }
      
      return null;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  }

  async getCurrentLocationWithAddress(options?: {
    timeout?: number;
    accuracy?: Location.LocationAccuracy;
  }): Promise<LocationResult> {
    const locationResult = await this.getCurrentLocation(options);
    
    try {
      const address = await this.reverseGeocode(locationResult.coordinates);
      return {
        ...locationResult,
        address: address || undefined,
      };
    } catch (error) {
      console.error('Error getting address for location:', error);
      return locationResult;
    }
  }

  async searchLocations(query: string): Promise<LocationResult[]> {
    try {
      // First try Google Places API for richer results
      const currentLocation = await this.getCurrentLocation().catch(() => null);
      
      if (currentLocation) {
        try {
          const googleResults = await googleMapsService.searchWalkingDestinations(
            query,
            currentLocation.coordinates,
            25000 // 25km radius
          );
          
          if (googleResults.length > 0) {
            return googleResults.map(this.mapPlaceToLocationResult);
          }
        } catch (error) {
          console.warn('Google Places search failed, falling back to geocoding:', error);
        }
      }

      // Fallback to basic geocoding
      const geocodedLocations = await Location.geocodeAsync(query);
      
      const results: LocationResult[] = [];
      
      for (const location of geocodedLocations) {
        const coordinates: LocationCoordinates = {
          latitude: location.latitude,
          longitude: location.longitude,
        };
        
        const address = await this.reverseGeocode(coordinates);
        
        results.push({
          coordinates,
          address: address || undefined,
          name: query,
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error searching locations:', error);
      return [];
    }
  }

  /**
   * Search for nearby walking venues using Google Places API
   */
  async searchNearbyWalkingVenues(
    location: LocationCoordinates,
    venueType: WalkingVenueType = 'all',
    radiusKm: number = 5
  ): Promise<LocationResult[]> {
    try {
      const places = await googleMapsService.findNearbyWalkingVenues(
        location,
        venueType,
        radiusKm * 1000,
        20
      );

      return places.map(this.mapPlaceToLocationResult);
    } catch (error) {
      console.error('Error searching nearby walking venues:', error);
      return [];
    }
  }

  /**
   * Enhanced location search with place type filtering
   */
  async searchLocationsWithPlaces(
    query: string,
    placeTypes: string[] = [],
    location?: LocationCoordinates
  ): Promise<LocationResult[]> {
    try {
      const searchLocation = location || (await this.getCurrentLocation()).coordinates;
      
      const googleResults = await googleMapsService.searchWalkingDestinations(
        `${query} ${placeTypes.join(' ')}`,
        searchLocation,
        15000 // 15km radius
      );

      return googleResults.map(this.mapPlaceToLocationResult);
    } catch (error) {
      console.error('Error searching locations with places:', error);
      return this.searchLocations(query); // Fallback to basic search
    }
  }

  /**
   * Get detailed information about a place by ID
   */
  async getPlaceDetails(placeId: string): Promise<LocationResult | null> {
    try {
      const place = await googleMapsService.getPlaceDetails(placeId);
      return place ? this.mapPlaceToLocationResult(place) : null;
    } catch (error) {
      console.error('Error getting place details:', error);
      return null;
    }
  }

  /**
   * Map Google Places PlaceResult to LocationResult
   */
  private mapPlaceToLocationResult(place: PlaceResult): LocationResult {
    return {
      coordinates: place.coordinates,
      address: place.formatted_address,
      name: place.name,
      placeId: place.place_id,
      rating: place.rating,
      types: place.types,
    };
  }

  formatCoordinatesForDatabase(coordinates: LocationCoordinates): string {
    return `POINT(${coordinates.longitude} ${coordinates.latitude})`;
  }

  parseCoordinatesFromDatabase(point: string): LocationCoordinates | null {
    try {
      const match = point.match(/POINT\(([^)]+)\)/);
      if (!match) return null;
      
      const [longitude, latitude] = match[1].split(' ').map(Number);
      return { latitude, longitude };
    } catch (error) {
      console.error('Error parsing coordinates from database:', error);
      return null;
    }
  }

  calculateDistance(
    coords1: LocationCoordinates,
    coords2: LocationCoordinates
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coords2.latitude - coords1.latitude);
    const dLon = this.toRadians(coords2.longitude - coords1.longitude);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coords1.latitude)) *
        Math.cos(this.toRadians(coords2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
  }
}

export const locationService = LocationService.getInstance();