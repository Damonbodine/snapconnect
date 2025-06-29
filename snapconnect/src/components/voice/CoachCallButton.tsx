/**
 * Coach Call Button - Simple call button for voice coaching
 * 📞 One-tap to start voice call with Coach Alex
 */

import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VoiceCallInterface } from './VoiceCallInterface';

interface CoachCallButtonProps {
  workoutContext?: any;
  style?: any;
}

export const CoachCallButton: React.FC<CoachCallButtonProps> = ({
  workoutContext,
  style
}) => {
  const [showVoiceCall, setShowVoiceCall] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          console.log('📞 CoachCallButton pressed - opening voice call interface');
          setShowVoiceCall(true);
        }}
        style={[styles.container, style]}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#4CAF50', '#45A049']}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <Ionicons name="call" size={24} color="white" />
            <View style={styles.textContainer}>
              <Text style={styles.title}>Call Coach Alex</Text>
              <Text style={styles.subtitle}>Voice coaching session</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <VoiceCallInterface
        visible={showVoiceCall}
        onClose={() => setShowVoiceCall(false)}
        workoutContext={workoutContext}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  gradient: {
    borderRadius: 16,
    padding: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    marginLeft: 16,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default CoachCallButton;