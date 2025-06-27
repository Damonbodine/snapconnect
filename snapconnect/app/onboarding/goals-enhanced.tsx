import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '../../src/components/ui/GradientCard';

type Goal = 'weight_loss' | 'muscle_gain' | 'endurance' | 'wellness' | 'strength' | 'flexibility';
type TimeFrame = '4weeks' | '8weeks' | '3months' | '6months' | '1year';

interface SmartGoal {
  category: Goal;
  specific_target: string;
  target_value: string;
  target_unit: string;
  timeframe: TimeFrame;
  why_important: string;
}

export default function GoalsEnhancedScreen() {
  const { 
    fitnessLevel, 
    currentActivityLevel, 
    currentWeightKg, 
    targetWeightKg, 
    heightCm, 
    dailyStepGoal, 
    weeklyWorkoutGoal, 
    injuriesLimitations 
  } = useLocalSearchParams();

  const [selectedGoals, setSelectedGoals] = useState<Goal[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<Goal | null>(null);
  const [smartGoal, setSmartGoal] = useState<SmartGoal>({
    category: 'weight_loss',
    specific_target: '',
    target_value: '',
    target_unit: '',
    timeframe: '3months',
    why_important: '',
  });
  const [currentStep, setCurrentStep] = useState<'select' | 'primary' | 'smart'>('select');

  const goals = [
    {
      id: 'weight_loss' as Goal,
      title: 'Weight Loss',
      description: 'Burn calories and lose weight',
      emoji: '🎯',
      examples: ['Lose 10 pounds', 'Reduce body fat by 5%', 'Fit into old clothes'],
    },
    {
      id: 'muscle_gain' as Goal,
      title: 'Muscle Gain',
      description: 'Build muscle and strength',
      emoji: '💪',
      examples: ['Gain 5 lbs of muscle', 'Increase bench press by 20 lbs', 'Build visible abs'],
    },
    {
      id: 'endurance' as Goal,
      title: 'Endurance',
      description: 'Improve cardiovascular fitness',
      emoji: '🏃',
      examples: ['Run a 5K in under 25 minutes', 'Walk 10,000 steps daily', 'Climb stairs without getting winded'],
    },
    {
      id: 'strength' as Goal,
      title: 'Strength',
      description: 'Increase overall strength',
      emoji: '🏋️',
      examples: ['Deadlift my bodyweight', 'Do 10 push-ups', 'Lift groceries easily'],
    },
    {
      id: 'flexibility' as Goal,
      title: 'Flexibility',
      description: 'Improve mobility and flexibility',
      emoji: '🧘',
      examples: ['Touch my toes', 'Reduce back pain', 'Improve posture'],
    },
    {
      id: 'wellness' as Goal,
      title: 'Overall Wellness',
      description: 'Focus on mental and physical health',
      emoji: '✨',
      examples: ['Sleep 8 hours nightly', 'Reduce stress levels', 'Feel more energetic'],
    },
  ];

  const timeframes = [
    { id: '4weeks' as TimeFrame, title: '4 Weeks', subtitle: 'Quick wins' },
    { id: '8weeks' as TimeFrame, title: '8 Weeks', subtitle: 'Noticeable changes' },
    { id: '3months' as TimeFrame, title: '3 Months', subtitle: 'Solid progress' },
    { id: '6months' as TimeFrame, title: '6 Months', subtitle: 'Major transformation' },
    { id: '1year' as TimeFrame, title: '1 Year', subtitle: 'Life-changing results' },
  ];

  const getTargetDate = (timeframe: TimeFrame): string => {
    const now = new Date();
    switch (timeframe) {
      case '4weeks': 
        now.setDate(now.getDate() + 28);
        break;
      case '8weeks':
        now.setDate(now.getDate() + 56);
        break;
      case '3months':
        now.setMonth(now.getMonth() + 3);
        break;
      case '6months':
        now.setMonth(now.getMonth() + 6);
        break;
      case '1year':
        now.setFullYear(now.getFullYear() + 1);
        break;
    }
    return now.toISOString().split('T')[0];
  };

  const getGoalSuggestions = (goal: Goal) => {
    const currentWeight = parseFloat(currentWeightKg as string) || 70;
    const targetWeight = parseFloat(targetWeightKg as string) || currentWeight;
    const weightDiff = currentWeight - targetWeight;

    switch (goal) {
      case 'weight_loss':
        return {
          specific_target: `Lose ${Math.max(1, Math.round(weightDiff))} kg`,
          target_value: Math.max(1, Math.round(weightDiff)).toString(),
          target_unit: 'kg',
        };
      case 'muscle_gain':
        return {
          specific_target: 'Gain 2-3 kg of lean muscle',
          target_value: '2.5',
          target_unit: 'kg',
        };
      case 'endurance':
        return {
          specific_target: 'Run 5K without stopping',
          target_value: '5',
          target_unit: 'km',
        };
      case 'strength':
        return {
          specific_target: 'Do 20 push-ups in a row',
          target_value: '20',
          target_unit: 'reps',
        };
      case 'flexibility':
        return {
          specific_target: 'Touch toes without bending knees',
          target_value: '1',
          target_unit: 'achieved',
        };
      case 'wellness':
        return {
          specific_target: 'Feel energetic and stress-free daily',
          target_value: '8',
          target_unit: 'out of 10',
        };
      default:
        return {
          specific_target: '',
          target_value: '',
          target_unit: '',
        };
    }
  };

  const toggleGoal = (goalId: Goal) => {
    setSelectedGoals(prev => 
      prev.includes(goalId)
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    );
  };

  const handleSelectPrimary = () => {
    if (selectedGoals.length > 0) {
      setPrimaryGoal(selectedGoals[0]);
      const suggestions = getGoalSuggestions(selectedGoals[0]);
      setSmartGoal({
        category: selectedGoals[0],
        specific_target: suggestions.specific_target,
        target_value: suggestions.target_value,
        target_unit: suggestions.target_unit,
        timeframe: '3months',
        why_important: '',
      });
      setCurrentStep('primary');
    }
  };

  const handleSetupSmart = () => {
    if (primaryGoal) {
      setCurrentStep('smart');
    }
  };

  const handleContinue = () => {
    const targetDate = getTargetDate(smartGoal.timeframe);
    
    // Try new enhanced flow first, fallback to original
    try {
      router.push({
        pathname: '/onboarding/lifestyle-preferences',
        params: {
          fitnessLevel: fitnessLevel as string,
          currentActivityLevel: currentActivityLevel as string,
          currentWeightKg: currentWeightKg as string,
          targetWeightKg: targetWeightKg as string,
          heightCm: heightCm as string,
          dailyStepGoal: dailyStepGoal as string,
          weeklyWorkoutGoal: weeklyWorkoutGoal as string,
          injuriesLimitations: injuriesLimitations as string,
          goals: selectedGoals.join(','),
          primaryGoal: primaryGoal,
          smartGoalTarget: smartGoal.specific_target,
          smartGoalValue: smartGoal.target_value,
          smartGoalUnit: smartGoal.target_unit,
          smartGoalTimeframe: smartGoal.timeframe,
          smartGoalWhy: smartGoal.why_important,
          smartGoalTargetDate: targetDate,
        },
      });
    } catch (error) {
      // Fallback to original dietary preferences screen
      console.log('Using fallback navigation to dietary-preferences');
      router.push({
        pathname: '/onboarding/dietary-preferences',
        params: {
          fitnessLevel: fitnessLevel as string,
          goals: selectedGoals.join(','),
        },
      });
    }
  };

  if (currentStep === 'select') {
    return (
      <LinearGradient colors={['#0F0F0F', '#1F1F1F']} className="flex-1">
        <View className="flex-1 px-6 pt-16 pb-8">
          <View className="mb-12">
            <View className="flex-row items-center justify-between mb-4">
              <Pressable onPress={() => router.back()}>
                <Text className="text-[#EC4899] font-medium text-lg">← Back</Text>
              </Pressable>
              <Text className="text-gray-400">3 of 7</Text>
            </View>
            
            <Text className="text-3xl font-bold text-white mb-2">
              What are your goals?
            </Text>
            <Text className="text-gray-400 text-lg">
              Select all that apply (we'll help you prioritize next)
            </Text>
          </View>

          <ScrollView className="flex-1 mb-8" showsVerticalScrollIndicator={false}>
            <View className="flex-row flex-wrap justify-between">
              {goals.map((goal) => (
                <Pressable
                  key={goal.id}
                  onPress={() => toggleGoal(goal.id)}
                  className="w-[48%] mb-4"
                >
                  <View
                    className={`bg-gray-800/50 border-2 rounded-2xl p-4 min-h-[120px] ${
                      selectedGoals.includes(goal.id)
                        ? 'border-[#EC4899]' 
                        : 'border-gray-700'
                    }`}
                  >
                    <Text className="text-3xl mb-2 text-center">{goal.emoji}</Text>
                    <Text className="text-white font-bold text-lg text-center mb-1">
                      {goal.title}
                    </Text>
                    <Text className="text-gray-400 text-sm text-center">
                      {goal.description}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {selectedGoals.length > 0 && (
            <Text className="text-gray-400 text-center mb-4">
              {selectedGoals.length} goal{selectedGoals.length !== 1 ? 's' : ''} selected
            </Text>
          )}

          <GradientCard
            gradient="primary"
            onPress={handleSelectPrimary}
            disabled={selectedGoals.length === 0}
            className={selectedGoals.length === 0 ? 'opacity-50' : ''}
          >
            <Text className="text-white font-bold text-lg text-center">
              Continue
            </Text>
          </GradientCard>
        </View>
      </LinearGradient>
    );
  }

  if (currentStep === 'primary') {
    const primaryGoalInfo = goals.find(g => g.id === primaryGoal);
    return (
      <LinearGradient colors={['#0F0F0F', '#1F1F1F']} className="flex-1">
        <View className="flex-1 px-6 pt-16 pb-8">
          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Pressable onPress={() => setCurrentStep('select')}>
                <Text className="text-[#EC4899] font-medium text-lg">← Back</Text>
              </Pressable>
              <Text className="text-gray-400">3 of 7</Text>
            </View>
            
            <Text className="text-3xl font-bold text-white mb-2">
              Let's focus on your main goal
            </Text>
            <Text className="text-gray-400 text-lg">
              We'll create a specific, measurable plan for your primary goal
            </Text>
          </View>

          <View className="bg-gray-800/30 rounded-2xl p-6 mb-8">
            <View className="items-center mb-6">
              <Text className="text-6xl mb-3">{primaryGoalInfo?.emoji}</Text>
              <Text className="text-white text-2xl font-bold mb-2">{primaryGoalInfo?.title}</Text>
              <Text className="text-gray-400 text-center">{primaryGoalInfo?.description}</Text>
            </View>

            <View>
              <Text className="text-white font-semibold mb-3">Common examples:</Text>
              {primaryGoalInfo?.examples.map((example, index) => (
                <Text key={index} className="text-gray-300 text-sm mb-1">
                  • {example}
                </Text>
              ))}
            </View>
          </View>

          <View className="mb-8">
            <Text className="text-white font-semibold mb-3">Other selected goals:</Text>
            <View className="flex-row flex-wrap">
              {selectedGoals.filter(g => g !== primaryGoal).map((goalId) => {
                const goal = goals.find(g => g.id === goalId);
                return (
                  <View key={goalId} className="bg-gray-700/50 rounded-lg px-3 py-2 mr-2 mb-2">
                    <Text className="text-gray-300 text-sm">{goal?.emoji} {goal?.title}</Text>
                  </View>
                );
              })}
            </View>
            <Text className="text-gray-400 text-sm mt-2">
              We'll help you work on these too, but let's start with {primaryGoalInfo?.title.toLowerCase()}
            </Text>
          </View>

          <GradientCard gradient="primary" onPress={handleSetupSmart}>
            <Text className="text-white font-bold text-lg text-center">
              Create My Action Plan
            </Text>
          </GradientCard>
        </View>
      </LinearGradient>
    );
  }

  // SMART goal setup step
  return (
    <LinearGradient colors={['#0F0F0F', '#1F1F1F']} className="flex-1">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32 }}>
          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Pressable onPress={() => setCurrentStep('primary')}>
                <Text className="text-[#EC4899] font-medium text-lg">← Back</Text>
              </Pressable>
              <Text className="text-gray-400">3 of 7</Text>
            </View>
            
            <Text className="text-3xl font-bold text-white mb-2">
              Make it SMART
            </Text>
            <Text className="text-gray-400 text-lg">
              Let's create a Specific, Measurable, Achievable, Relevant, Time-bound goal
            </Text>
          </View>

          {/* Specific Target */}
          <View className="mb-6">
            <Text className="text-white font-semibold text-lg mb-3">
              🎯 Specific: What exactly do you want to achieve?
            </Text>
            <TextInput
              value={smartGoal.specific_target}
              onChangeText={(text) => setSmartGoal(prev => ({ ...prev, specific_target: text }))}
              placeholder="e.g., Lose 10 pounds, Run 5K without stopping"
              placeholderTextColor="#6B7280"
              className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
              multiline
            />
          </View>

          {/* Measurable */}
          <View className="mb-6">
            <Text className="text-white font-semibold text-lg mb-3">
              📏 Measurable: How will you track progress?
            </Text>
            <View className="flex-row space-x-3">
              <TextInput
                value={smartGoal.target_value}
                onChangeText={(text) => setSmartGoal(prev => ({ ...prev, target_value: text }))}
                placeholder="Number"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
              />
              <TextInput
                value={smartGoal.target_unit}
                onChangeText={(text) => setSmartGoal(prev => ({ ...prev, target_unit: text }))}
                placeholder="Unit (kg, reps, km)"
                placeholderTextColor="#6B7280"
                className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg"
              />
            </View>
          </View>

          {/* Time-bound */}
          <View className="mb-6">
            <Text className="text-white font-semibold text-lg mb-3">
              ⏰ Time-bound: When do you want to achieve this?
            </Text>
            <View className="space-y-3">
              {timeframes.map((timeframe) => (
                <Pressable
                  key={timeframe.id}
                  onPress={() => setSmartGoal(prev => ({ ...prev, timeframe: timeframe.id }))}
                  className={`bg-gray-800/50 border-2 rounded-xl p-4 ${
                    smartGoal.timeframe === timeframe.id 
                      ? 'border-[#EC4899]' 
                      : 'border-gray-700'
                  }`}
                >
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="text-white font-semibold text-lg">{timeframe.title}</Text>
                      <Text className="text-gray-400 text-sm">{timeframe.subtitle}</Text>
                    </View>
                    <Text className="text-gray-400 text-sm">
                      Target: {new Date(getTargetDate(timeframe.id)).toLocaleDateString()}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Why Important */}
          <View className="mb-8">
            <Text className="text-white font-semibold text-lg mb-3">
              💖 Why is this important to you?
            </Text>
            <Text className="text-gray-400 text-sm mb-3">
              This will help keep you motivated when things get tough
            </Text>
            <TextInput
              value={smartGoal.why_important}
              onChangeText={(text) => setSmartGoal(prev => ({ ...prev, why_important: text }))}
              placeholder="e.g., I want to feel confident in my clothes, have energy to play with my kids..."
              placeholderTextColor="#6B7280"
              multiline
              numberOfLines={3}
              className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-4 text-white text-base"
            />
          </View>

          <GradientCard
            gradient="primary"
            onPress={handleContinue}
            disabled={!smartGoal.specific_target || !smartGoal.target_value}
            className={(!smartGoal.specific_target || !smartGoal.target_value) ? 'opacity-50' : ''}
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