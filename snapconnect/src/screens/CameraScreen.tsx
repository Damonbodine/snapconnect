import React, { useEffect, useState } from 'react';
import { View, Text, Linking, AppState } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import { GradientCard } from '../components/ui/GradientCard';

export const CameraScreen = () => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  
  // Use isFocused to activate/deactivate the camera when the screen is shown/hidden
  const isFocused = useIsFocused();
  const appState = AppState.currentState;
  const isActive = isFocused && appState === 'active';

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F0F' }}>
        <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, marginBottom: 20, paddingHorizontal: 20 }}>
          SnapConnect needs camera access to capture your moments.
        </Text>
        <GradientCard onPress={() => Linking.openSettings()} gradient="primary">
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Open Settings</Text>
        </GradientCard>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F0F' }}>
        <Text style={{ color: 'white', textAlign: 'center', fontSize: 18 }}>
          Sorry, no camera device was found on this simulator.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Camera
        style={{ flex: 1 }}
        device={device}
        isActive={isActive}
        photo={true}
        video={true}
        audio={true}
      />
    </View>
  );
};