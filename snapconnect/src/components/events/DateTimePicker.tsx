import React, { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GlassCard } from '../ui/GlassCard';
import { useEventStore } from '../../stores/eventStore';

interface DateTimePickerProps {
  className?: string;
}

export const DateTimePickerComponent: React.FC<DateTimePickerProps> = ({
  className = '',
}) => {
  const { formData, updateFormData } = useEventStore();
  
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const now = new Date();
  const minimumDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    const eventType = event?.type || 'set';
    
    // Always close the picker first
    setShowStartDatePicker(false);
    
    // Only update if user confirmed (not dismissed)
    if (eventType === 'set' && selectedDate) {
      const currentStart = formData.start_time || minimumDate;
      const newStartDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        currentStart.getHours(),
        currentStart.getMinutes()
      );
      
      updateFormData({ start_time: newStartDate });
      
      // Auto-adjust end time to be 1 hour later if not set or if it's before start time
      if (!formData.end_time || (formData.end_time && formData.end_time <= newStartDate)) {
        const newEndTime = new Date(newStartDate.getTime() + 60 * 60 * 1000);
        updateFormData({ end_time: newEndTime });
      }
    }
  };

  const handleStartTimeChange = (event: any, selectedTime?: Date) => {
    const eventType = event?.type || 'set';
    
    // Always close the picker first
    setShowStartTimePicker(false);
    
    // Only update if user confirmed (not dismissed)
    if (eventType === 'set' && selectedTime) {
      const currentStart = formData.start_time || minimumDate;
      const newStartTime = new Date(
        currentStart.getFullYear(),
        currentStart.getMonth(),
        currentStart.getDate(),
        selectedTime.getHours(),
        selectedTime.getMinutes()
      );
      
      updateFormData({ start_time: newStartTime });
      
      // Auto-adjust end time if it's before the new start time
      if (formData.end_time && formData.end_time <= newStartTime) {
        const newEndTime = new Date(newStartTime.getTime() + 60 * 60 * 1000);
        updateFormData({ end_time: newEndTime });
      }
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    const eventType = event?.type || 'set';
    
    // Always close the picker first
    setShowEndDatePicker(false);
    
    // Only update if user confirmed (not dismissed)
    if (eventType === 'set' && selectedDate && formData.start_time) {
      const newEndDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        formData.end_time?.getHours() || formData.start_time.getHours() + 1,
        formData.end_time?.getMinutes() || formData.start_time.getMinutes()
      );
      
      // Ensure end date is not before start date
      if (newEndDate > formData.start_time) {
        updateFormData({ end_time: newEndDate });
      }
    }
  };

  const handleEndTimeChange = (event: any, selectedTime?: Date) => {
    const eventType = event?.type || 'set';
    
    // Always close the picker first
    setShowEndTimePicker(false);
    
    // Only update if user confirmed (not dismissed)
    if (eventType === 'set' && selectedTime && formData.start_time) {
      const currentEnd = formData.end_time || formData.start_time;
      const newEndTime = new Date(
        currentEnd.getFullYear(),
        currentEnd.getMonth(),
        currentEnd.getDate(),
        selectedTime.getHours(),
        selectedTime.getMinutes()
      );
      
      // Ensure end time is after start time
      if (newEndTime > formData.start_time) {
        updateFormData({ end_time: newEndTime });
      }
    }
  };

  const clearEndTime = () => {
    updateFormData({ end_time: null });
  };

  const setDefaultEndTime = () => {
    if (formData.start_time) {
      const defaultEnd = new Date(formData.start_time.getTime() + 60 * 60 * 1000);
      updateFormData({ end_time: defaultEnd });
    }
  };

  return (
    <View className={className}>
      <Text className="text-white text-lg font-semibold mb-3">Date & Time</Text>
      
      {/* Start Date & Time */}
      <View className="mb-4">
        <Text className="text-white/80 text-sm mb-2">Start Time *</Text>
        <View className="flex-row space-x-3">
          {/* Start Date */}
          <View className="flex-1">
            <Pressable 
              onPress={() => {
                // Ensure all other pickers are closed first
                setShowStartTimePicker(false);
                setShowEndDatePicker(false);
                setShowEndTimePicker(false);
                // Then open this one
                setShowStartDatePicker(true);
              }}
            >
              <GlassCard>
                <View className="flex-row items-center justify-between">
                  <Text className="text-white">
                    {formatDate(formData.start_time) || 'Select Date'}
                  </Text>
                  <Text className="text-white/70">📅</Text>
                </View>
              </GlassCard>
            </Pressable>
          </View>
          
          {/* Start Time */}
          <View className="flex-1">
            <Pressable 
              onPress={() => {
                // Ensure all other pickers are closed first
                setShowStartDatePicker(false);
                setShowEndDatePicker(false);
                setShowEndTimePicker(false);
                // Then open this one
                setShowStartTimePicker(true);
              }}
            >
              <GlassCard>
                <View className="flex-row items-center justify-between">
                  <Text className="text-white">
                    {formatTime(formData.start_time) || 'Select Time'}
                  </Text>
                  <Text className="text-white/70">🕐</Text>
                </View>
              </GlassCard>
            </Pressable>
          </View>
        </View>
      </View>

      {/* End Date & Time */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-white/80 text-sm">End Time (Optional)</Text>
          {formData.end_time ? (
            <Pressable onPress={clearEndTime}>
              <Text className="text-white/70 text-sm">Clear</Text>
            </Pressable>
          ) : (
            <Pressable onPress={setDefaultEndTime}>
              <Text className="text-primary-purple text-sm">+ Add End Time</Text>
            </Pressable>
          )}
        </View>
        
        {formData.end_time && (
          <View className="flex-row space-x-3">
            {/* End Date */}
            <View className="flex-1">
              <Pressable 
                onPress={() => {
                  // Ensure all other pickers are closed first
                  setShowStartDatePicker(false);
                  setShowStartTimePicker(false);
                  setShowEndTimePicker(false);
                  // Then open this one
                  setShowEndDatePicker(true);
                }}
              >
                <GlassCard>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white">
                      {formatDate(formData.end_time)}
                    </Text>
                    <Text className="text-white/70">📅</Text>
                  </View>
                </GlassCard>
              </Pressable>
            </View>
            
            {/* End Time */}
            <View className="flex-1">
              <Pressable 
                onPress={() => {
                  // Ensure all other pickers are closed first
                  setShowStartDatePicker(false);
                  setShowStartTimePicker(false);
                  setShowEndDatePicker(false);
                  // Then open this one
                  setShowEndTimePicker(true);
                }}
              >
                <GlassCard>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white">
                      {formatTime(formData.end_time)}
                    </Text>
                    <Text className="text-white/70">🕐</Text>
                  </View>
                </GlassCard>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Duration Display */}
      {formData.start_time && formData.end_time && (
        <GlassCard className="mb-4">
          <View className="flex-row items-center">
            <Text className="text-white/70 text-sm">
              Duration: {Math.round((formData.end_time.getTime() - formData.start_time.getTime()) / (1000 * 60))} minutes
            </Text>
          </View>
        </GlassCard>
      )}

      {/* Date/Time Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={formData.start_time || minimumDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          onChange={handleStartDateChange}
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={formData.start_time || minimumDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartTimeChange}
        />
      )}

      {showEndDatePicker && formData.start_time && (
        <DateTimePicker
          value={formData.end_time || formData.start_time}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={formData.start_time}
          onChange={handleEndDateChange}
        />
      )}

      {showEndTimePicker && formData.start_time && (
        <DateTimePicker
          value={formData.end_time || formData.start_time}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndTimeChange}
        />
      )}

      {/* Validation Errors */}
      {!formData.start_time && (
        <Text className="text-red-400 text-sm mt-1">
          Start date and time are required
        </Text>
      )}
      
      {formData.start_time && formData.start_time <= now && (
        <Text className="text-red-400 text-sm mt-1">
          Start time must be in the future
        </Text>
      )}
    </View>
  );
};