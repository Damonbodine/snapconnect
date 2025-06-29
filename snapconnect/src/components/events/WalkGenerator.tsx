import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Modal, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../ui/GlassCard';
import { GradientCard } from '../ui/GradientCard';
import { WalkSuggestionCard } from './WalkSuggestionCard';
import { RouteMap } from './RouteMap';
import { AppHeader } from '../ui/AppHeader';
import { useEventStore } from '../../stores/eventStore';
import { useAuthStore } from '../../stores/authStore';
import { WalkSuggestion } from '../../types/walkSuggestion';

// Walk Type Selector Component
const WalkTypeSelector: React.FC<{
  onSelectType: (walkType: string) => void;
  onClose: () => void;
}> = ({ onSelectType, onClose }) => {
  const walkTypes = [
    {
      id: 'park_loop',
      name: 'Park Loop',
      description: 'Nature-focused green space exploration',
      icon: '🌳',
      gradient: 'success',
    },
    {
      id: 'trail_hike',
      name: 'Trail Hike',
      description: 'Outdoor expeditions to scenic destinations',
      icon: '🥾',
      gradient: 'primary',
    },
    {
      id: 'urban_exploration',
      name: 'Urban Exploration',
      description: 'City adventures through cultural sites',
      icon: '🏙️',
      gradient: 'secondary',
    },
    {
      id: 'scenic_route',
      name: 'Scenic Route',
      description: 'Destination walks to viewpoints',
      icon: '🌅',
      gradient: 'cardio',
    },
    {
      id: 'fitness_circuit',
      name: 'Fitness Circuit',
      description: 'Active routes with exercise opportunities',
      icon: '💪',
      gradient: 'strength',
    },
    {
      id: 'social_walk',
      name: 'Social Walk',
      description: 'Conversation-friendly routes ending at cafés',
      icon: '👥',
      gradient: 'recovery',
    },
  ];

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F2937']}
      className="flex-1"
    >
      <SafeAreaView className="flex-1">
        <AppHeader 
          title="Choose Walk Type"
          showBackButton={true}
          onBackPress={onClose}
        />
        
        <ScrollView className="flex-1 px-4">
          <Text className="text-white/70 text-sm text-center mb-6">
            Select a walk type to generate personalized route suggestions
          </Text>
          
          <View className="space-y-3">
            {walkTypes.map((walkType) => (
              <Pressable 
                key={walkType.id}
                onPress={() => onSelectType(walkType.id)}
              >
                <GradientCard gradient={walkType.gradient}>
                  <View className="flex-row items-start">
                    <Text className="text-3xl mr-4">
                      {walkType.icon}
                    </Text>
                    <View className="flex-1">
                      <Text className="text-white text-lg font-semibold mb-2">
                        {walkType.name}
                      </Text>
                      <Text className="text-white/80 text-sm">
                        {walkType.description}
                      </Text>
                    </View>
                  </View>
                </GradientCard>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// Generated Walk Suggestions Display Component
const WalkSuggestionsDisplay: React.FC<{
  suggestions: WalkSuggestion[];
  onClose: () => void;
  onViewRoute: (suggestion: WalkSuggestion) => void;
  onGenerateMore: () => void;
  isLoading: boolean;
}> = ({ suggestions, onClose, onViewRoute, onGenerateMore, isLoading }) => {
  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F2937']}
      className="flex-1"
    >
      <SafeAreaView className="flex-1">
        <AppHeader 
          title="Walk Suggestions"
          showBackButton={true}
          onBackPress={onClose}
        />
        
        <ScrollView className="flex-1 px-4">
          {isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator size="large" color="#EC4899" />
              <Text className="text-white/70 text-sm mt-4">
                🤖 Generating personalized walks with AI...
              </Text>
            </View>
          ) : (
            <>
              <Text className="text-white/70 text-sm text-center mb-6">
                AI-generated walk suggestions based on your location and preferences
              </Text>
              
              <View className="space-y-4">
                {suggestions.map((suggestion) => (
                  <WalkSuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onViewRoute={onViewRoute}
                  />
                ))}
              </View>

              {/* Generate More Button */}
              <View className="mt-6 mb-8">
                <Pressable onPress={onGenerateMore}>
                  <GlassCard>
                    <View className="flex-row items-center justify-center py-4">
                      <Text className="text-white font-medium mr-2">
                        🔄 Generate More Walks
                      </Text>
                    </View>
                  </GlassCard>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// Main Walk Generator Component
export const WalkGenerator: React.FC = () => {
  const { user } = useAuthStore();
  const { 
    generateWalkSuggestions, 
    walkSuggestions, 
    isLoadingSuggestions, 
    suggestionError,
    userLocation 
  } = useEventStore();
  
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionForMap, setSelectedSuggestionForMap] = useState<WalkSuggestion | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleGenerateWalks = async (walkType?: string) => {
    if (!user || !userLocation) {
      setError('Location is required to generate walk suggestions');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setShowTypeSelector(false);
    
    try {
      console.log('🚶‍♀️ Generating walk suggestions...');
      
      await generateWalkSuggestions(user.id, { 
        count: 3, 
        diversityFactor: 0.8, 
        useCache: false, 
        forceRefresh: true 
      });
      
      setShowSuggestions(true);
    } catch (err) {
      console.error('❌ Failed to generate walk suggestions:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate walks');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewRoute = (suggestion: WalkSuggestion) => {
    console.log('🗺️ View Route pressed for:', suggestion.title);
    console.log('🗺️ Suggestion data:', {
      id: suggestion.id,
      hasRoute: !!suggestion.route,
      waypoints: suggestion.route?.waypoints?.length || 0,
      pointsOfInterest: suggestion.pointsOfInterest?.length || 0
    });
    
    // Close the suggestions modal first, then open route map
    setShowSuggestions(false);
    
    // Small delay to ensure suggestions modal closes first
    setTimeout(() => {
      setSelectedSuggestionForMap(suggestion);
      console.log('🗺️ State updated, selectedSuggestionForMap should now be:', suggestion.id);
    }, 300);
  };

  const handleGenerateMore = async () => {
    if (!user) return;
    await handleGenerateWalks();
  };

  if (isGenerating) {
    return (
      <View className="mb-6">
        <GlassCard>
          <View className="flex-row items-center py-4">
            <ActivityIndicator size="small" color="#EC4899" />
            <Text className="text-white/70 text-sm ml-3">
              🤖 Generating walks with AI...
            </Text>
          </View>
        </GlassCard>
      </View>
    );
  }

  if (error) {
    return (
      <View className="mb-6">
        <GlassCard className="border-red-500/30">
          <View className="flex-row items-center justify-between">
            <Text className="text-red-400 text-sm flex-1">
              ⚠️ {error}
            </Text>
            <Pressable onPress={() => setError(null)}>
              <Text className="text-red-400 text-lg ml-2">✕</Text>
            </Pressable>
          </View>
        </GlassCard>
      </View>
    );
  }

  return (
    <>
      <View className="mb-6">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-white text-lg font-semibold">
            ✨ Walk Generator
          </Text>
        </View>

        <Pressable onPress={() => handleGenerateWalks()}>
          <GlassCard>
            <View className="flex-row items-center justify-between py-4">
              <View className="flex-row items-center flex-1">
                <Text className="text-2xl mr-3">🚶‍♀️</Text>
                <View>
                  <Text className="text-white font-medium">
                    🤖 Generate Walks
                  </Text>
                  <Text className="text-white/60 text-sm">
                    AI-powered route suggestions
                  </Text>
                </View>
              </View>
              <Text className="text-white/60 text-lg">›</Text>
            </View>
          </GlassCard>
        </Pressable>
      </View>

      {/* Walk Type Selector Modal */}
      <Modal
        visible={showTypeSelector}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <WalkTypeSelector
          onSelectType={handleGenerateWalks}
          onClose={() => setShowTypeSelector(false)}
        />
      </Modal>

      {/* Walk Suggestions Display Modal */}
      <Modal
        visible={showSuggestions}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <WalkSuggestionsDisplay
          suggestions={walkSuggestions}
          onClose={() => setShowSuggestions(false)}
          onViewRoute={handleViewRoute}
          onGenerateMore={handleGenerateMore}
          isLoading={isLoadingSuggestions}
        />
      </Modal>

      {/* Route Map Modal */}
      <Modal
        visible={selectedSuggestionForMap !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onShow={() => {
          console.log('🗺️ Modal onShow triggered');
        }}
        onRequestClose={() => {
          console.log('🗺️ Modal onRequestClose triggered');
          setSelectedSuggestionForMap(null);
        }}
      >
        {selectedSuggestionForMap ? (
          <RouteMap
            key={selectedSuggestionForMap.id} // Force remount when suggestion changes
            suggestion={selectedSuggestionForMap}
            showFullScreen={true}
            onClose={() => {
              console.log('🗺️ RouteMap onClose triggered');
              setSelectedSuggestionForMap(null);
              // Reopen suggestions modal when map closes
              setTimeout(() => {
                setShowSuggestions(true);
              }, 300);
            }}
          />
        ) : (
          <View className="flex-1 bg-black items-center justify-center">
            <Text className="text-white">Loading map...</Text>
          </View>
        )}
      </Modal>
    </>
  );
};