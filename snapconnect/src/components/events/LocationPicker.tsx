import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { GradientCard } from '../ui/GradientCard';
import { useEventStore } from '../../stores/eventStore';
import { LocationResult } from '../../services/locationService';

interface LocationPickerProps {
  onLocationSelect?: (location: LocationResult) => void;
  className?: string;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationSelect,
  className = '',
}) => {
  const {
    formData,
    updateFormData,
    getCurrentLocation,
    searchLocations,
    locationResults,
    isLoadingLocation,
    error,
  } = useEventStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Auto-search when user types
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchQuery.trim()) {
      const timeout = setTimeout(() => {
        searchLocations(searchQuery);
        setShowResults(true);
      }, 500);
      setSearchTimeout(timeout);
    } else {
      setShowResults(false);
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchQuery]);

  const handleUseCurrentLocation = async () => {
    try {
      await getCurrentLocation();
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  };

  const handleLocationSelect = (location: LocationResult) => {
    updateFormData({
      location_name: location.name || location.address || 'Selected Location',
      location_address: location.address || '',
      location_coordinates: location.coordinates,
    });

    setSearchQuery(location.name || location.address || '');
    setShowResults(false);
    
    if (onLocationSelect) {
      onLocationSelect(location);
    }
  };

  const handleLocationNameChange = (text: string) => {
    updateFormData({ location_name: text });
    setSearchQuery(text);
  };

  const renderLocationResult = (item: LocationResult, index: number) => (
    <Pressable
      key={`${item.coordinates.latitude}-${item.coordinates.longitude}-${index}`}
      onPress={() => handleLocationSelect(item)}
    >
      <View className="p-3 border-b border-white/10">
        <Text className="text-white font-medium">
          {item.name || 'Location'}
        </Text>
        {item.address && (
          <Text className="text-white/70 text-sm mt-1">
            {item.address}
          </Text>
        )}
      </View>
    </Pressable>
  );

  return (
    <View className={className}>
      <Text className="text-white text-lg font-semibold mb-3">Location</Text>
      
      {/* Main location input */}
      <GlassCard className="mb-4">
        <View className="space-y-3">
          <TextInput
            value={formData.location_name}
            onChangeText={handleLocationNameChange}
            placeholder="Event location name..."
            placeholderTextColor="#9CA3AF"
            className="text-white text-base"
            multiline={false}
          />
          
          {/* Address input */}
          <TextInput
            value={formData.location_address}
            onChangeText={(text) => updateFormData({ location_address: text })}
            placeholder="Address (optional)"
            placeholderTextColor="#9CA3AF"
            className="text-white text-base"
            multiline={false}
          />
          
          {/* Location details */}
          <TextInput
            value={formData.location_details}
            onChangeText={(text) => updateFormData({ location_details: text })}
            placeholder="Additional details (e.g., 'Meet at main entrance')"
            placeholderTextColor="#9CA3AF"
            className="text-white text-base"
            multiline={true}
            numberOfLines={2}
          />
        </View>
      </GlassCard>

      {/* Use Current Location Button */}
      <GradientCard
        gradient="primary"
        onPress={handleUseCurrentLocation}
        className="mb-4"
        disabled={isLoadingLocation}
      >
        <View className="flex-row items-center justify-center">
          {isLoadingLocation ? (
            <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />
          ) : (
            <Text className="text-white text-xl mr-2">📍</Text>
          )}
          <Text className="text-white font-semibold">
            {isLoadingLocation ? 'Getting Location...' : 'Use My Current Location'}
          </Text>
        </View>
      </GradientCard>

      {/* Current coordinates display */}
      {formData.location_coordinates && (
        <GlassCard className="mb-4">
          <View className="flex-row items-center">
            <Text className="text-white/70 text-sm">
              📍 {formData.location_coordinates.latitude.toFixed(4)}, {formData.location_coordinates.longitude.toFixed(4)}
            </Text>
          </View>
        </GlassCard>
      )}

      {/* Search Results */}
      {showResults && (
        <GlassCard className="max-h-60">
          {isLoadingLocation ? (
            <View className="items-center py-4">
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text className="text-white/70 text-sm mt-2">Searching locations...</Text>
            </View>
          ) : locationResults.length > 0 ? (
            <View>
              <Text className="text-white/70 text-sm mb-2 px-1">
                Search Results:
              </Text>
              <View className="max-h-48">
                {locationResults.slice(0, 5).map((item, index) => 
                  renderLocationResult(item, index)
                )}
                {locationResults.length > 5 && (
                  <View className="p-3 items-center">
                    <Text className="text-white/50 text-xs">
                      +{locationResults.length - 5} more results
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : searchQuery.trim() ? (
            <View className="items-center py-4">
              <Text className="text-white/70 text-sm">
                No locations found for "{searchQuery}"
              </Text>
            </View>
          ) : null}
        </GlassCard>
      )}

      {/* Error Display */}
      {error && (
        <GlassCard className="mt-2">
          <View className="flex-row items-center">
            <Text className="text-red-400 text-sm">
              ⚠️ {error}
            </Text>
          </View>
        </GlassCard>
      )}

      {/* Validation Error */}
      {!formData.location_name.trim() && (
        <Text className="text-red-400 text-sm mt-1">
          Location name is required
        </Text>
      )}
      
      {!formData.location_coordinates && (
        <Text className="text-red-400 text-sm mt-1">
          Please select a location or use your current location
        </Text>
      )}
    </View>
  );
};