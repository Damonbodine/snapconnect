import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../../src/components/ui/GradientCard';

type WeightUnit = 'kg' | 'lbs';
type HeightUnit = 'cm' | 'ft';

export default function HealthBaselineScreen() {
  const { fitnessLevel, currentActivityLevel } = useLocalSearchParams();
  
  // Weight inputs
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  
  // Height inputs
  const [heightCm, setHeightCm] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  
  // Goals
  const [dailyStepGoal, setDailyStepGoal] = useState('10000');
  const [weeklyWorkoutGoal, setWeeklyWorkoutGoal] = useState('3');
  
  // Health status
  const [injuriesLimitations, setInjuriesLimitations] = useState('');
  const [hasHealthIssues, setHasHealthIssues] = useState<boolean | null>(null);

  // Convert weight to kg if needed
  const getWeightInKg = (weight: string, unit: WeightUnit): number => {
    const num = parseFloat(weight);
    if (isNaN(num)) return 0;
    return unit === 'lbs' ? num * 0.453592 : num;
  };

  // Convert height to cm if needed
  const getHeightInCm = (): number => {
    if (heightUnit === 'cm') {
      return parseFloat(heightCm) || 0;
    } else {
      const feet = parseFloat(heightFeet) || 0;
      const inches = parseFloat(heightInches) || 0;
      return (feet * 12 + inches) * 2.54;
    }
  };

  const handleContinue = () => {
    const currentWeightKg = getWeightInKg(currentWeight, weightUnit);
    const targetWeightKg = getWeightInKg(targetWeight, weightUnit);
    const heightInCm = getHeightInCm();

    router.push({
      pathname: '/onboarding/goals-enhanced',
      params: {
        fitnessLevel: fitnessLevel as string,
        currentActivityLevel: currentActivityLevel as string,
        currentWeightKg: currentWeightKg.toString(),
        targetWeightKg: targetWeightKg.toString(),
        heightCm: heightInCm.toString(),
        dailyStepGoal: dailyStepGoal,
        weeklyWorkoutGoal: weeklyWorkoutGoal,
        injuriesLimitations: injuriesLimitations || '',
      },
    });
  };

  const isValid = () => {
    const hasWeight = currentWeight.length > 0;
    const hasHeight = heightUnit === 'cm' ? heightCm.length > 0 : (heightFeet.length > 0 || heightInches.length > 0);
    const hasGoals = dailyStepGoal.length > 0 && weeklyWorkoutGoal.length > 0;
    return hasWeight && hasHeight && hasGoals;
  };

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F1F1F']}
      className="flex-1"
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32 }}>
          {/* Header */}
          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Pressable onPress={() => router.back()}>
                <Text className="text-[#EC4899] font-medium text-lg">← Back</Text>
              </Pressable>
              <Text className="text-gray-400">2 of 7</Text>
            </View>
            
            <Text className="text-3xl font-bold text-white mb-2">
              Health Baseline
            </Text>
            <Text className="text-gray-400 text-lg">
              Help us personalize your fitness journey with some basic health info
            </Text>
          </View>

          {/* Current Weight */}
          <View className="mb-6">
            <Text className="text-white font-semibold text-lg mb-3">Current Weight</Text>
            <View className="flex-row items-center space-x-3">
              <TextInput
                value={currentWeight}
                onChangeText={setCurrentWeight}
                placeholder="Enter weight"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
              />
              <View className="flex-row bg-gray-800/50 border border-gray-700 rounded-xl">
                <Pressable
                  onPress={() => setWeightUnit('kg')}
                  className={`px-4 py-4 rounded-l-xl ${weightUnit === 'kg' ? 'bg-[#EC4899]' : ''}`}
                >
                  <Text className={`font-semibold ${weightUnit === 'kg' ? 'text-white' : 'text-gray-400'}`}>kg</Text>
                </Pressable>
                <Pressable
                  onPress={() => setWeightUnit('lbs')}
                  className={`px-4 py-4 rounded-r-xl ${weightUnit === 'lbs' ? 'bg-[#EC4899]' : ''}`}
                >
                  <Text className={`font-semibold ${weightUnit === 'lbs' ? 'text-white' : 'text-gray-400'}`}>lbs</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Target Weight */}
          <View className="mb-6">
            <Text className="text-white font-semibold text-lg mb-3">Target Weight (Optional)</Text>
            <TextInput
              value={targetWeight}
              onChangeText={setTargetWeight}
              placeholder="Enter target weight"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
            />
          </View>

          {/* Height */}
          <View className="mb-6">
            <Text className="text-white font-semibold text-lg mb-3">Height</Text>
            <View className="flex-row items-center space-x-3 mb-3">
              <View className="flex-row bg-gray-800/50 border border-gray-700 rounded-xl">
                <Pressable
                  onPress={() => setHeightUnit('cm')}
                  className={`px-4 py-3 rounded-l-xl ${heightUnit === 'cm' ? 'bg-[#EC4899]' : ''}`}
                >
                  <Text className={`font-semibold ${heightUnit === 'cm' ? 'text-white' : 'text-gray-400'}`}>cm</Text>
                </Pressable>
                <Pressable
                  onPress={() => setHeightUnit('ft')}
                  className={`px-4 py-3 rounded-r-xl ${heightUnit === 'ft' ? 'bg-[#EC4899]' : ''}`}
                >
                  <Text className={`font-semibold ${heightUnit === 'ft' ? 'text-white' : 'text-gray-400'}`}>ft/in</Text>
                </Pressable>
              </View>
            </View>
            
            {heightUnit === 'cm' ? (
              <TextInput
                value={heightCm}
                onChangeText={setHeightCm}
                placeholder="Enter height in cm"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
              />
            ) : (
              <View className="flex-row space-x-3">
                <TextInput
                  value={heightFeet}
                  onChangeText={setHeightFeet}
                  placeholder="Feet"
                  placeholderTextColor="#6B7280"
                  keyboardType="numeric"
                  className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
                />
                <TextInput
                  value={heightInches}
                  onChangeText={setHeightInches}
                  placeholder="Inches"
                  placeholderTextColor="#6B7280"
                  keyboardType="numeric"
                  className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
                />
              </View>
            )}
          </View>

          {/* Daily Step Goal */}
          <View className="mb-6">
            <Text className="text-white font-semibold text-lg mb-3">Daily Step Goal</Text>
            <View className="flex-row flex-wrap">
              {['5000', '7500', '10000', '12500', '15000'].map((steps) => (
                <Pressable
                  key={steps}
                  onPress={() => setDailyStepGoal(steps)}
                  className={`mr-3 mb-3 px-4 py-3 rounded-xl border-2 ${
                    dailyStepGoal === steps 
                      ? 'bg-[#EC4899] border-[#EC4899]' 
                      : 'bg-gray-800/50 border-gray-700'
                  }`}
                >
                  <Text className={`font-semibold ${dailyStepGoal === steps ? 'text-white' : 'text-gray-300'}`}>
                    {parseInt(steps).toLocaleString()}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={dailyStepGoal}
              onChangeText={setDailyStepGoal}
              placeholder="Custom step goal"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white"
            />
          </View>

          {/* Weekly Workout Goal */}
          <View className="mb-6">
            <Text className="text-white font-semibold text-lg mb-3">Weekly Workout Goal</Text>
            <View className="flex-row">
              {['1', '2', '3', '4', '5', '6', '7'].map((workouts) => (
                <Pressable
                  key={workouts}
                  onPress={() => setWeeklyWorkoutGoal(workouts)}
                  className={`mr-3 px-4 py-3 rounded-xl border-2 ${
                    weeklyWorkoutGoal === workouts 
                      ? 'bg-[#EC4899] border-[#EC4899]' 
                      : 'bg-gray-800/50 border-gray-700'
                  }`}
                >
                  <Text className={`font-semibold ${weeklyWorkoutGoal === workouts ? 'text-white' : 'text-gray-300'}`}>
                    {workouts}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Injuries/Limitations */}
          <View className="mb-8">
            <Text className="text-white font-semibold text-lg mb-3">Injuries or Limitations (Optional)</Text>
            <Text className="text-gray-400 text-sm mb-3">
              Tell us about any injuries, health conditions, or physical limitations we should consider
            </Text>
            <TextInput
              value={injuriesLimitations}
              onChangeText={setInjuriesLimitations}
              placeholder="e.g., Knee injury, back pain, heart condition..."
              placeholderTextColor="#6B7280"
              multiline
              numberOfLines={3}
              className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-base"
            />
          </View>

          {/* Continue Button */}
          <GradientCard
            gradient="primary"
            onPress={handleContinue}
            disabled={!isValid()}
            className={!isValid() ? 'opacity-50' : ''}
          >
            <Text className="text-white font-bold text-lg text-center">
              Continue
            </Text>
          </GradientCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}