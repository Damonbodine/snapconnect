import React, { useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../ui/GlassCard';
import { GradientCard } from '../ui/GradientCard';
import { LocationPicker } from './LocationPicker';
import { CategorySelector } from './CategorySelector';
import { DateTimePickerComponent } from './DateTimePicker';
import { useEventStore } from '../../stores/eventStore';
import { useAuthStore } from '../../stores/authStore';

interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  visible,
  onClose,
}) => {
  const { user } = useAuthStore();
  const {
    formData,
    updateFormData,
    resetFormData,
    createEvent,
    isCreating,
    error,
    clearError,
    validateForm,
  } = useEventStore();

  useEffect(() => {
    if (visible) {
      // Reset form when modal opens
      resetFormData();
      clearError();
    }
  }, [visible]);

  const handleCreateEvent = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create an event');
      return;
    }

    if (!validateForm()) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    try {
      await createEvent(user.id);
      
      Alert.alert(
        'Success! 🎉',
        'Your event has been created successfully!',
        [
          {
            text: 'Done',
            onPress: () => onClose(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create event. Please try again.');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Event Creation',
      'Are you sure you want to cancel? Your changes will be lost.',
      [
        { text: "Don't Cancel", style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            resetFormData();
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <LinearGradient
        colors={['#0F0F0F', '#1F2937']}
        className="flex-1"
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView 
            className="flex-1 px-4 pt-16 pb-24"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View className="flex-row justify-between items-center mb-6">
              <Pressable onPress={handleCancel}>
                <GlassCard className="px-4 py-2">
                  <Text className="text-white text-sm font-semibold">✕ Cancel</Text>
                </GlassCard>
              </Pressable>
              
              <Text className="text-white text-xl font-bold">Create Event</Text>
              
              <View className="w-16" />
            </View>

            {/* Error Display */}
            {error && (
              <GlassCard className="mb-4 border-red-500/30">
                <View className="flex-row items-center">
                  <Text className="text-red-400 text-sm flex-1">
                    ⚠️ {error}
                  </Text>
                  <Pressable onPress={clearError}>
                    <Text className="text-red-400 text-lg ml-2">✕</Text>
                  </Pressable>
                </View>
              </GlassCard>
            )}

            {/* Event Title */}
            <View className="mb-6">
              <Text className="text-white text-lg font-semibold mb-3">Event Title *</Text>
              <GlassCard>
                <TextInput
                  value={formData.title}
                  onChangeText={(text) => updateFormData({ title: text })}
                  placeholder="What's your event called?"
                  placeholderTextColor="#9CA3AF"
                  className="text-white text-base"
                  maxLength={100}
                />
              </GlassCard>
            </View>

            {/* Event Description */}
            <View className="mb-6">
              <Text className="text-white text-lg font-semibold mb-3">Description</Text>
              <GlassCard>
                <TextInput
                  value={formData.description}
                  onChangeText={(text) => updateFormData({ description: text })}
                  placeholder="Tell people what to expect..."
                  placeholderTextColor="#9CA3AF"
                  className="text-white text-base"
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />
              </GlassCard>
            </View>

            {/* Category Selection */}
            <CategorySelector className="mb-6" />

            {/* Date & Time */}
            <DateTimePickerComponent className="mb-6" />

            {/* Location */}
            <LocationPicker className="mb-6" />

            {/* Create Button */}
            <GradientCard
              gradient="primary"
              onPress={handleCreateEvent}
              disabled={isCreating || !validateForm()}
              className={`mt-8 ${(!validateForm() || isCreating) ? 'opacity-50' : ''}`}
            >
              <View className="flex-row items-center justify-center py-2">
                {isCreating ? (
                  <>
                    <Text className="text-white text-lg font-bold mr-2">Creating...</Text>
                    <View className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </>
                ) : (
                  <>
                    <Text className="text-white text-xl mr-2">✨</Text>
                    <Text className="text-white text-lg font-bold">Create Event</Text>
                  </>
                )}
              </View>
            </GradientCard>

            {/* Form Validation Help */}
            {!validateForm() && (
              <GlassCard className="mt-4">
                <Text className="text-white/70 text-sm mb-2">Required fields:</Text>
                <View className="space-y-1">
                  {!formData.title.trim() && (
                    <Text className="text-red-400 text-sm">• Event title</Text>
                  )}
                  {!formData.category_id && (
                    <Text className="text-red-400 text-sm">• Category</Text>
                  )}
                  {!formData.location_name.trim() && (
                    <Text className="text-red-400 text-sm">• Location name</Text>
                  )}
                  {!formData.location_coordinates && (
                    <Text className="text-red-400 text-sm">• Location coordinates</Text>
                  )}
                  {!formData.start_time && (
                    <Text className="text-red-400 text-sm">• Start date and time</Text>
                  )}
                </View>
              </GlassCard>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Modal>
  );
};