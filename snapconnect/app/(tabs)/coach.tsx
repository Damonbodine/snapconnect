/**
 * AI Health Coach Tab
 * Main screen for health coaching, dashboard, and AI interaction
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useHealthStore } from '../../src/stores/healthStore';
import { aiCoachService } from '../../src/services/aiCoachService';
import { GradientCard } from '../../src/components/ui/GradientCard';

export default function CoachScreen() {
  const {
    isInitialized,
    isLoading,
    error,
    todaysSteps,
    stepGoalProgress,
    stepGoal,
    currentStreak,
    bestStreak,
    weeklyAverage,
    healthContext,
    initialize,
    refreshAllData,
    clearError,
    requestHealthPermissions,
    getPermissionStatus,
  } = useHealthStore();

  const [coachMessage, setCoachMessage] = useState<string>('');
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<{
    isAvailable: boolean;
    hasPermissions: boolean;
    isInitialized: boolean;
    usingMockData: boolean;
  } | null>(null);
  const [requestingPermissions, setRequestingPermissions] = useState(false);
  const [showHealthStatus, setShowHealthStatus] = useState(false);
  const [showTodaysProgress, setShowTodaysProgress] = useState(false);

  // Initialize health store when component mounts
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Generate daily check-in message when health context is available
  useEffect(() => {
    if (healthContext && !coachMessage && !isGeneratingMessage) {
      generateDailyCheckIn();
    }
  }, [healthContext, coachMessage, isGeneratingMessage]);

  // Check permission status on mount
  useEffect(() => {
    const checkPermissionStatus = async () => {
      const status = await getPermissionStatus();
      setPermissionStatus(status);
    };
    
    checkPermissionStatus();
  }, [getPermissionStatus]);

  const handleRequestPermissions = async () => {
    setRequestingPermissions(true);
    
    try {
      const success = await requestHealthPermissions();
      
      if (success) {
        const newStatus = await getPermissionStatus();
        setPermissionStatus(newStatus);
      }
    } catch (error) {
      console.error('Failed to request permissions:', error);
    } finally {
      setRequestingPermissions(false);
    }
  };

  const generateDailyCheckIn = async () => {
    if (!healthContext) return;
    
    try {
      setIsGeneratingMessage(true);
      const message = await aiCoachService.generateDailyCheckIn(healthContext);
      setCoachMessage(message);
    } catch (error) {
      console.error('Failed to generate daily check-in:', error);
      setCoachMessage("Hey there! I'm Alex, your AI fitness coach. Let's work together to reach your health and fitness goals! 💪");
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAllData();
      // Regenerate coach message with fresh data
      if (healthContext) {
        await generateDailyCheckIn();
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleQuickAction = async (action: 'motivation' | 'suggestion' | 'workout') => {
    if (!healthContext) return;

    try {
      setIsGeneratingMessage(true);
      let message: string;

      switch (action) {
        case 'motivation':
          message = await aiCoachService.generateMotivationalMessage(healthContext);
          break;
        case 'suggestion':
          const suggestions = await aiCoachService.generateSmartSuggestions(healthContext);
          message = suggestions.primary;
          break;
        case 'workout':
          const workout = await aiCoachService.generateWorkoutSuggestion(healthContext);
          message = `🏃‍♂️ **Workout Suggestion:**\n\n**${workout.type.toUpperCase()}** (${workout.intensity} intensity)\n⏱️ ${workout.duration} minutes\n\n**Reasoning:** ${workout.reasoning}\n\n**Exercises:**\n${workout.exercises?.map(ex => `• ${ex}`).join('\n')}`;
          break;
        default:
          message = "I'm here to help with your fitness journey!";
      }

      setCoachMessage(message);
    } catch (error) {
      console.error(`Failed to generate ${action} message:`, error);
      setCoachMessage("I'm having trouble responding right now. Please try again in a moment.");
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  // Show loading state during initialization
  if (!isInitialized) {
    return (
      <LinearGradient
        colors={['#0F0F0F', '#1F1F1F']}
        className="flex-1 justify-center items-center"
      >
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text className="text-white mt-4 text-lg">Initializing your AI coach...</Text>
        <Text className="text-gray-400 mt-2 text-center px-8">
          Setting up your personalized health dashboard
        </Text>
      </LinearGradient>
    );
  }

  // Show error state
  if (error) {
    return (
      <LinearGradient
        colors={['#0F0F0F', '#1F1F1F']}
        className="flex-1 justify-center items-center px-6"
      >
        <Text className="text-red-400 text-lg font-bold mb-4">⚠️ Setup Error</Text>
        <Text className="text-gray-300 text-center mb-6">{error}</Text>
        <TouchableOpacity
          onPress={() => {
            clearError();
            initialize();
          }}
          className="bg-purple-600 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-semibold">Try Again</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F1F1F']}
      className="flex-1"
    >
      <ScrollView 
        className="flex-1 px-6 pt-16"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View className="mb-8">
          <Text className="text-white text-3xl font-bold mb-2">AI Health Coach</Text>
          <Text className="text-gray-400 text-base">Your personalized fitness companion</Text>
        </View>

        {/* Health Data Permission Status - Collapsible */}
        {permissionStatus && (
          <TouchableOpacity 
            onPress={() => setShowHealthStatus(!showHealthStatus)}
            className="mb-4"
          >
            <View className="bg-gray-800/40 rounded-lg px-4 py-3 border border-gray-700/50">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Text className="text-white text-sm font-medium mr-3">Health Data</Text>
                  <View className={`px-2 py-1 rounded-full ${permissionStatus.usingMockData ? 'bg-yellow-600/30' : 'bg-green-600/30'}`}>
                    <Text className={`text-xs font-medium ${permissionStatus.usingMockData ? 'text-yellow-300' : 'text-green-300'}`}>
                      {permissionStatus.usingMockData ? 'Mock' : 'HealthKit'}
                    </Text>
                  </View>
                </View>
                <Text className="text-gray-400 text-sm">
                  {showHealthStatus ? '▼' : '▶'}
                </Text>
              </View>
              
              {showHealthStatus && (
                <View className="mt-4 pt-3 border-t border-gray-700/50">
                  <Text className="text-white/80 text-sm mb-4">
                    {permissionStatus.usingMockData 
                      ? 'Using simulated health data for testing. Enable HealthKit to track your real activity.'
                      : 'Connected to your HealthKit data for accurate health tracking.'
                    }
                  </Text>
                  
                  {permissionStatus.usingMockData && (
                    <View className="space-y-3">
                      <TouchableOpacity
                        onPress={handleRequestPermissions}
                        disabled={requestingPermissions}
                        className="bg-blue-600 px-4 py-3 rounded-lg flex-row items-center justify-center"
                      >
                        {requestingPermissions ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <>
                            <Text className="text-white font-semibold mr-2">Enable HealthKit</Text>
                            <Text className="text-white">📱</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      
                      {__DEV__ && (
                        <TouchableOpacity
                          onPress={() => {
                            setPermissionStatus({
                              ...permissionStatus,
                              usingMockData: false,
                              hasPermissions: true
                            });
                          }}
                          className="bg-orange-600 px-4 py-2 rounded-lg"
                        >
                          <Text className="text-white text-sm font-semibold text-center">
                            🧪 Simulate HealthKit (Dev Only)
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  
                  {!permissionStatus.isAvailable && (
                    <View className="bg-gray-600/30 px-4 py-3 rounded-lg">
                      <Text className="text-gray-300 text-sm text-center">
                        HealthKit not available on this device
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Today's Progress Card - Collapsible */}
        <TouchableOpacity 
          onPress={() => setShowTodaysProgress(!showTodaysProgress)}
          className="mb-4"
        >
          <GradientCard gradient="primary">
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center">
                <Text className="text-white text-lg font-bold mr-3">Today's Progress</Text>
                <Text className="text-white/80 text-sm">{stepGoalProgress}% • {todaysSteps.toLocaleString()} steps</Text>
              </View>
              <Text className="text-white/70 text-sm">
                {showTodaysProgress ? '▼' : '▶'}
              </Text>
            </View>
            
            {showTodaysProgress && (
              <View className="mt-4 pt-4 border-t border-white/20">
                <View className="mb-4">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-white/90 text-base">Steps</Text>
                    <Text className="text-white text-base font-semibold">
                      {todaysSteps.toLocaleString()} / {stepGoal.toLocaleString()}
                    </Text>
                  </View>
                  
                  {/* Progress Bar */}
                  <View className="bg-white/20 h-3 rounded-full overflow-hidden">
                    <View 
                      className="bg-white h-full rounded-full"
                      style={{ width: `${Math.min(stepGoalProgress, 100)}%` }}
                    />
                  </View>
                </View>

                <View className="flex-row justify-between">
                  <View className="items-center">
                    <Text className="text-white/70 text-sm">Streak</Text>
                    <Text className="text-white text-xl font-bold">{currentStreak}</Text>
                    <Text className="text-white/70 text-xs">days</Text>
                  </View>
                  
                  <View className="items-center">
                    <Text className="text-white/70 text-sm">Best Streak</Text>
                    <Text className="text-white text-xl font-bold">{bestStreak}</Text>
                    <Text className="text-white/70 text-xs">days</Text>
                  </View>
                  
                  <View className="items-center">
                    <Text className="text-white/70 text-sm">Weekly Avg</Text>
                    <Text className="text-white text-xl font-bold">{weeklyAverage.toLocaleString()}</Text>
                    <Text className="text-white/70 text-xs">steps</Text>
                  </View>
                </View>
              </View>
            )}
          </GradientCard>
        </TouchableOpacity>

        {/* AI Coach Message Card */}
        <GradientCard gradient="success" className="mb-6">
          <View className="flex-row items-center mb-3">
            <Text className="text-2xl mr-2">🤖</Text>
            <Text className="text-white text-xl font-bold">Coach Alex</Text>
          </View>
          
          {isGeneratingMessage ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="white" />
              <Text className="text-white/80 ml-2">Alex is thinking...</Text>
            </View>
          ) : (
            <Text className="text-white text-base leading-6">{coachMessage}</Text>
          )}
        </GradientCard>

        {/* Quick Actions */}
        <View className="mb-8">
          <Text className="text-white text-xl font-bold mb-4">Quick Actions</Text>
          
          <View className="flex-row justify-between">
            <TouchableOpacity
              onPress={() => handleQuickAction('motivation')}
              disabled={isGeneratingMessage}
              className="bg-purple-600 rounded-lg px-4 py-3 flex-1 mr-2"
            >
              <Text className="text-center text-white font-semibold">💪 Motivate Me</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => handleQuickAction('suggestion')}
              disabled={isGeneratingMessage}
              className="bg-green-600 rounded-lg px-4 py-3 flex-1 mx-1"
            >
              <Text className="text-center text-white font-semibold">💡 Get Tips</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => handleQuickAction('workout')}
              disabled={isGeneratingMessage}
              className="bg-pink-600 rounded-lg px-4 py-3 flex-1 ml-2"
            >
              <Text className="text-center text-white font-semibold">🏃‍♂️ Workout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Health Status Indicators */}
        {healthContext && (
          <View className="bg-gray-800/30 rounded-2xl p-6 mb-8">
            <Text className="text-white text-xl font-bold mb-4">Health Status</Text>
            
            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-300">Energy Level</Text>
              <Text className="text-white font-semibold capitalize">{healthContext.energyLevel}</Text>
            </View>
            
            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-300">Activity Level</Text>
              <Text className="text-white font-semibold capitalize">{healthContext.activityLevel}</Text>
            </View>
            
            <View className="flex-row justify-between mb-3">
              <Text className="text-gray-300">Recovery Score</Text>
              <Text className="text-white font-semibold">{healthContext.recoveryScore}/10</Text>
            </View>
            
            <View className="flex-row justify-between">
              <Text className="text-gray-300">Sleep Quality</Text>
              <Text className="text-white font-semibold">{healthContext.sleepQuality}/10</Text>
            </View>
          </View>
        )}

        {/* Debug Info (only in development) */}
        {__DEV__ && healthContext && (
          <View className="bg-gray-900/50 rounded-lg p-4 mb-8">
            <Text className="text-gray-400 text-sm font-bold mb-2">Debug Info</Text>
            <Text className="text-gray-500 text-xs">Fitness Level: {healthContext.fitnessLevel}</Text>
            <Text className="text-gray-500 text-xs">Goal: {healthContext.userGoals.primary}</Text>
            <Text className="text-gray-500 text-xs">Recent Workouts: {healthContext.recentWorkouts.length}</Text>
            <Text className="text-gray-500 text-xs">Using Mock Data: {isLoading ? 'Loading...' : 'Yes'}</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}