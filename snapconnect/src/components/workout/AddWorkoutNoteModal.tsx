import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  Modal, 
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../ui/GlassCard';
import { workoutNotesService, WORKOUT_TYPES, WorkoutType } from '../../services/workoutNotesService';

interface AddWorkoutNoteModalProps {
  visible: boolean;
  onClose: () => void;
  onNoteAdded: () => void;
}

export const AddWorkoutNoteModal: React.FC<AddWorkoutNoteModalProps> = ({
  visible,
  onClose,
  onNoteAdded,
}) => {
  const [selectedType, setSelectedType] = useState<WorkoutType>('Strength');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!note.trim()) {
      Alert.alert('Missing Info', 'Please add a note about your workout!');
      return;
    }

    setIsLoading(true);
    try {
      await workoutNotesService.createNote({
        workout_type: selectedType,
        note: note.trim(),
      });

      // Reset form
      setNote('');
      setSelectedType('Strength');
      
      // Notify parent and close
      onNoteAdded();
      onClose();
      
    } catch (error) {
      console.error('Failed to create note:', error);
      Alert.alert('Error', 'Failed to save your workout note. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setNote('');
    setSelectedType('Strength');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <LinearGradient
        colors={['#0F0F0F', '#1F2937']}
        className="flex-1"
      >
        <View className="flex-1 px-4 pt-8">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-white text-xl font-bold">Add Workout Note</Text>
            <Pressable onPress={handleClose}>
              <Text className="text-white/70 text-lg">✕</Text>
            </Pressable>
          </View>

          <ScrollView className="flex-1">
            {/* Workout Type Selection */}
            <View className="mb-6">
              <Text className="text-white text-lg font-semibold mb-3">
                What did you do?
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                className="mb-4"
                contentContainerStyle={{ paddingRight: 20 }}
              >
                {WORKOUT_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setSelectedType(type)}
                    className={`mr-3 px-4 py-2 rounded-full ${
                      selectedType === type 
                        ? 'bg-purple-600' 
                        : 'bg-white/10'
                    }`}
                  >
                    <Text className="text-white font-medium">
                      {workoutNotesService.getWorkoutEmoji(type)} {type}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Note Input */}
            <View className="mb-6">
              <Text className="text-white text-lg font-semibold mb-3">
                How did it go?
              </Text>
              <GlassCard>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Quick note about your workout..."
                  placeholderTextColor="#888"
                  multiline
                  numberOfLines={4}
                  maxLength={200}
                  className="text-white text-base leading-6"
                  style={{ 
                    minHeight: 100,
                    textAlignVertical: 'top',
                    padding: 0
                  }}
                />
              </GlassCard>
              <Text className="text-white/50 text-xs mt-1 text-right">
                {note.length}/200
              </Text>
            </View>

            {/* Example prompts */}
            <View className="mb-8">
              <Text className="text-white/70 text-sm mb-2">Quick ideas:</Text>
              <View className="flex-row flex-wrap">
                {[
                  'Felt strong today! 💪',
                  'Great cardio session',
                  'New personal best!',
                  'Tough but worth it',
                  'Perfect morning workout'
                ].map((example, index) => (
                  <Pressable
                    key={index}
                    onPress={() => setNote(example)}
                    className="bg-white/5 px-3 py-1 rounded-full mr-2 mb-2"
                  >
                    <Text className="text-white/60 text-xs">{example}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Submit Button */}
          <View className="pb-8">
            <Pressable
              onPress={handleSubmit}
              disabled={isLoading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-lg"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-center font-bold text-lg">
                  Add Note
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
};