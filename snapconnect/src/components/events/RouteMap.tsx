import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, Dimensions, Platform, Linking } from 'react-native';
import MapView, { Marker, Polyline, Region, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import { WalkSuggestion } from '../../types/walkSuggestion';
import { LocationCoordinates } from '../../services/locationService';
import { GlassCard } from '../ui/GlassCard';
import { GradientCard } from '../ui/GradientCard';

interface RouteMapProps {
  suggestion: WalkSuggestion;
  showFullScreen?: boolean;
  height?: number;
  onClose?: () => void;
  className?: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const RouteMap: React.FC<RouteMapProps> = ({
  suggestion,
  showFullScreen = false,
  height = 200,
  onClose,
  className = '',
}) => {
  const mapRef = useRef<MapView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [realWalkingPath, setRealWalkingPath] = useState<LocationCoordinates[] | null>(null);

  // Calculate the region to show all waypoints
  const getRegionForWaypoints = (waypoints: LocationCoordinates[]): Region => {
    if (waypoints.length === 0) {
      return {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    const latitudes = waypoints.map(point => point.latitude);
    const longitudes = waypoints.map(point => point.longitude);
    
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    
    const latDelta = (maxLat - minLat) * 1.4; // Add padding
    const lonDelta = (maxLon - minLon) * 1.4;
    
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(latDelta, 0.005), // Minimum zoom level
      longitudeDelta: Math.max(lonDelta, 0.005),
    };
  };

  const fitToWaypoints = () => {
    if (mapRef.current && suggestion.route.waypoints.length > 0) {
      const coordinates = suggestion.route.waypoints.map(point => ({
        latitude: point.latitude,
        longitude: point.longitude,
      }));
      
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  };

  // Generate more realistic walking path waypoints
  const generateWalkingPath = () => {
    if (suggestion.route.waypoints.length < 2) return suggestion.route.waypoints;
    
    const enhancedPath: LocationCoordinates[] = [];
    const pois = suggestion.pointsOfInterest || [];
    
    // Create a path that goes through or near POIs for more interesting routes
    const allPoints = [...suggestion.route.waypoints];
    
    // Add POIs as intermediate destinations
    pois.forEach(poi => {
      allPoints.push(poi.coordinates);
    });
    
    // Sort points to create a logical walking order
    const sortedPoints = allPoints.slice(1).sort((a, b) => {
      const distA = Math.abs(a.latitude - allPoints[0].latitude) + Math.abs(a.longitude - allPoints[0].longitude);
      const distB = Math.abs(b.latitude - allPoints[0].latitude) + Math.abs(b.longitude - allPoints[0].longitude);
      return distA - distB;
    });
    
    const orderedPoints = [allPoints[0], ...sortedPoints.slice(0, 4)]; // Limit to 5 total points
    
    // Generate curved paths between points
    for (let i = 0; i < orderedPoints.length - 1; i++) {
      const start = orderedPoints[i];
      const end = orderedPoints[i + 1];
      
      enhancedPath.push(start);
      
      const latDiff = end.latitude - start.latitude;
      const lonDiff = end.longitude - start.longitude;
      const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
      
      // More intermediate points for longer distances
      const steps = Math.max(3, Math.min(8, Math.floor(distance * 10000)));
      
      for (let j = 1; j < steps; j++) {
        const progress = j / steps;
        
        // Create curved path that avoids straight lines
        const curve = Math.sin(progress * Math.PI) * 0.0003;
        const randomOffset = (Math.random() - 0.5) * 0.0002;
        
        enhancedPath.push({
          latitude: start.latitude + latDiff * progress + curve + randomOffset,
          longitude: start.longitude + lonDiff * progress + curve + randomOffset,
        });
      }
    }
    
    if (orderedPoints.length > 0) {
      enhancedPath.push(orderedPoints[orderedPoints.length - 1]);
    }
    
    return enhancedPath;
  };

  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return km < 1 ? `${Math.round(meters)}m` : `${km.toFixed(1)}km`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const handleMapReady = () => {
    setMapReady(true);
    setIsLoading(false);
    setTimeout(() => {
      fitToWaypoints();
    }, 500);
  };

  const getMarkerColor = (index: number, total: number) => {
    if (index === 0) return 'green'; // Start
    if (index === total - 1) return 'red'; // End
    return 'orange'; // Waypoints
  };

  const getMarkerTitle = (index: number, total: number) => {
    if (index === 0) return 'Start';
    if (index === total - 1) return 'Finish';
    return `Stop ${index}`;
  };

  const initialRegion = getRegionForWaypoints(suggestion.route.waypoints);
  
  // Use Apple Maps on iOS for better walking directions
  const mapProvider = Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE;

  // Fetch real walking directions for this specific route
  useEffect(() => {
    const fetchRealWalkingDirections = async () => {
      if (!suggestion?.route?.waypoints || suggestion.route.waypoints.length < 2) return;
      
      try {
        const waypoints = suggestion.route.waypoints;
        const startPoint = waypoints[0];
        
        // Find a meaningful destination from this specific suggestion
        let destinationPoint;
        if (suggestion.pointsOfInterest.length > 0) {
          destinationPoint = suggestion.pointsOfInterest[0].coordinates;
        } else if (waypoints.length > 1) {
          destinationPoint = waypoints[waypoints.length - 1];
        } else {
          return;
        }
        
        // Use Google Directions API for the walking route (even on iOS)
        // This gives us the real walking path data
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/directions/json?` +
          `origin=${startPoint.latitude},${startPoint.longitude}&` +
          `destination=${destinationPoint.latitude},${destinationPoint.longitude}&` +
          `mode=walking&` +
          `key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
        );
        
        const data = await response.json();
        
        if (data.status === 'OK' && data.routes?.[0]?.legs?.[0]?.steps) {
          const steps = data.routes[0].legs[0].steps;
          const pathPoints: LocationCoordinates[] = [];
          
          steps.forEach((step: any) => {
            pathPoints.push({
              latitude: step.start_location.lat,
              longitude: step.start_location.lng,
            });
            
            // Decode polyline if available for more detailed path
            if (step.polyline?.points) {
              const decoded = decodePolyline(step.polyline.points);
              pathPoints.push(...decoded);
            }
          });
          
          // Add final destination
          if (steps.length > 0) {
            const lastStep = steps[steps.length - 1];
            pathPoints.push({
              latitude: lastStep.end_location.lat,
              longitude: lastStep.end_location.lng,
            });
          }
          
          setRealWalkingPath(pathPoints);
        }
      } catch (error) {
        console.error('Failed to fetch real walking directions:', error);
        // Fall back to original waypoints
        setRealWalkingPath(suggestion.route.waypoints);
      }
    };
    
    fetchRealWalkingDirections();
  }, [suggestion.id]); // Re-fetch when suggestion changes

  // Simple polyline decoder
  const decodePolyline = (encoded: string): LocationCoordinates[] => {
    const points: LocationCoordinates[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    
    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      
      points.push({
        latitude: lat * 1e-5,
        longitude: lng * 1e-5,
      });
    }
    
    return points;
  };

  // Safety check - ensure we have valid data
  if (!suggestion?.route?.waypoints || suggestion.route.waypoints.length === 0) {
    console.warn('RouteMap: Invalid route data', suggestion?.route);
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white text-center">
          No route data available
        </Text>
        {onClose && (
          <Pressable onPress={onClose} className="mt-4 p-2">
            <Text className="text-white text-lg">✕ Close</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (showFullScreen) {
    return (
      <View className="flex-1 bg-black">
        {/* Header */}
        <View className="absolute top-12 left-4 right-4 z-10">
          <GlassCard>
            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-white font-bold text-lg">
                  {suggestion.title}
                </Text>
                <Text className="text-white/80 text-sm">
                  {formatDistance(suggestion.distance)} • {formatDuration(suggestion.estimatedDuration)}
                </Text>
              </View>
              {onClose && (
                <Pressable onPress={onClose} className="p-2">
                  <Text className="text-white text-xl">✕</Text>
                </Pressable>
              )}
            </View>
          </GlassCard>
        </View>

        {/* Map */}
        <MapView
          ref={mapRef}
          style={{ width: screenWidth, height: screenHeight }}
          initialRegion={initialRegion}
          onMapReady={handleMapReady}
          showsUserLocation={true}
          showsMyLocationButton={true}
          mapType="standard"
          provider={mapProvider}
          onError={(error) => {
            console.error('MapView error:', error);
            setIsLoading(false);
          }}
        >
          {/* Route Polyline */}
          {(realWalkingPath || suggestion.route.waypoints).length > 1 && (
            <Polyline
              coordinates={realWalkingPath || generateWalkingPath()}
              strokeColor="#EC4899"
              strokeWidth={4}
              strokePattern={[1]}
              lineDashPhase={0}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Waypoint Markers */}
          {suggestion.route.waypoints.map((point, index) => (
            <Marker
              key={index}
              coordinate={point}
              title={getMarkerTitle(index, suggestion.route.waypoints.length)}
              description={index === 0 ? 'Start your walk here' : 
                          index === suggestion.route.waypoints.length - 1 ? 'End point' : 
                          'Waypoint'}
              pinColor={getMarkerColor(index, suggestion.route.waypoints.length)}
            />
          ))}

          {/* Points of Interest Markers */}
          {suggestion.pointsOfInterest.map((place, index) => (
            <Marker
              key={`poi-${index}`}
              coordinate={place.coordinates}
              title={place.name}
              description="Point of Interest"
            >
              <View className="bg-blue-500 rounded-full p-2">
                <Text className="text-white text-xs font-bold">📍</Text>
              </View>
            </Marker>
          ))}
        </MapView>

        {/* Bottom Info Panel */}
        <View className="absolute bottom-8 left-4 right-4 z-10">
          <GlassCard>
            <View className="space-y-2">
              <Text className="text-white font-medium">Route Details</Text>
              <View className="flex-row justify-between">
                <Text className="text-white/80 text-sm">Distance:</Text>
                <Text className="text-white text-sm">{formatDistance(suggestion.distance)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-white/80 text-sm">Duration:</Text>
                <Text className="text-white text-sm">{formatDuration(suggestion.estimatedDuration)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-white/80 text-sm">Difficulty:</Text>
                <Text className="text-white text-sm capitalize">{suggestion.difficulty}</Text>
              </View>
              {suggestion.pointsOfInterest.length > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-white/80 text-sm">Stops:</Text>
                  <Text className="text-white text-sm">{suggestion.pointsOfInterest.length} places</Text>
                </View>
              )}
              
              {/* Apple Maps Walking Directions Button */}
              {Platform.OS === 'ios' && (
                <Pressable 
                  className="mt-3 bg-blue-600 rounded-lg p-3 items-center"
                  onPress={() => {
                    const waypoints = suggestion.route.waypoints;
                    const startPoint = waypoints[0];
                    
                    console.log('Route waypoints:', waypoints.length);
                    console.log('Points of interest:', suggestion.pointsOfInterest.length);
                    console.log('Start point:', startPoint);
                    
                    // Create a destination that's guaranteed to be different
                    let destinationPoint;
                    
                    // Try points of interest first, but ensure they're far enough away
                    if (suggestion.pointsOfInterest.length > 0) {
                      for (const poi of suggestion.pointsOfInterest) {
                        const distance = Math.abs(poi.coordinates.latitude - startPoint.latitude) + 
                                       Math.abs(poi.coordinates.longitude - startPoint.longitude);
                        if (distance > 0.001) { // At least ~100m difference
                          destinationPoint = poi.coordinates;
                          console.log('Using POI as destination:', poi.name);
                          break;
                        }
                      }
                    }
                    
                    // Try waypoints if POI didn't work
                    if (!destinationPoint && waypoints.length > 1) {
                      for (let i = 1; i < waypoints.length; i++) {
                        const distance = Math.abs(waypoints[i].latitude - startPoint.latitude) + 
                                       Math.abs(waypoints[i].longitude - startPoint.longitude);
                        if (distance > 0.001) { // At least ~100m difference
                          destinationPoint = waypoints[i];
                          console.log('Using waypoint as destination:', i);
                          break;
                        }
                      }
                    }
                    
                    // Guaranteed fallback: create a point 500m away
                    if (!destinationPoint) {
                      destinationPoint = {
                        latitude: startPoint.latitude + 0.005, // ~500m north
                        longitude: startPoint.longitude + 0.005 // ~500m east
                      };
                      console.log('Using fallback destination 500m away');
                    }
                    
                    console.log('Final destination:', destinationPoint);
                    
                    const url = `http://maps.apple.com/?saddr=${startPoint.latitude},${startPoint.longitude}&daddr=${destinationPoint.latitude},${destinationPoint.longitude}&dirflg=w`;
                    
                    Linking.openURL(url).catch(err => console.error('Error opening Apple Maps:', err));
                  }}
                >
                  <Text className="text-white font-semibold">🚶‍♀️ Start Walking Route</Text>
                </Pressable>
              )}
            </View>
          </GlassCard>
        </View>

        {/* Loading Overlay */}
        {isLoading && (
          <View className="absolute inset-0 bg-black/50 items-center justify-center z-20">
            <ActivityIndicator size="large" color="#EC4899" />
            <Text className="text-white mt-2">Loading map...</Text>
          </View>
        )}
      </View>
    );
  }

  // Compact map view
  return (
    <View className={`${className}`} style={{ height }}>
      <MapView
        ref={mapRef}
        style={{ width: '100%', height: '100%', borderRadius: 12 }}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        mapType="standard"
        provider={mapProvider}
        onError={(error) => {
          console.error('MapView compact error:', error);
          setIsLoading(false);
        }}
      >
        {/* Route Polyline */}
        {(realWalkingPath || suggestion.route.waypoints).length > 1 && (
          <Polyline
            coordinates={realWalkingPath || generateWalkingPath()}
            strokeColor="#EC4899"
            strokeWidth={3}
            strokePattern={[1]}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Start and End Markers */}
        {suggestion.route.waypoints.length > 0 && (
          <>
            <Marker
              coordinate={suggestion.route.waypoints[0]}
              title="Start"
              pinColor="green"
            />
            {suggestion.route.waypoints.length > 1 && (
              <Marker
                coordinate={suggestion.route.waypoints[suggestion.route.waypoints.length - 1]}
                title="End"
                pinColor="red"
              />
            )}
          </>
        )}

        {/* Points of Interest */}
        {suggestion.pointsOfInterest.slice(0, 3).map((place, index) => (
          <Marker
            key={`poi-${index}`}
            coordinate={place.coordinates}
            title={place.name}
          >
            <View className="bg-blue-500 rounded-full p-1">
              <Text className="text-white text-xs">📍</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Overlay Info */}
      <View className="absolute top-2 left-2 right-2">
        <GlassCard className="bg-black/50">
          <View className="flex-row justify-between items-center">
            <Text className="text-white text-sm font-medium">
              {formatDistance(suggestion.distance)}
            </Text>
            <Text className="text-white text-sm">
              {formatDuration(suggestion.estimatedDuration)}
            </Text>
          </View>
        </GlassCard>
      </View>

      {/* Loading Overlay */}
      {isLoading && (
        <View className="absolute inset-0 bg-black/30 items-center justify-center rounded-xl">
          <ActivityIndicator size="small" color="#EC4899" />
        </View>
      )}
    </View>
  );
};