import React, { useState } from 'react';
import { View, Text, Pressable, Alert, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ProfileOptionsButtonProps {
  onSignOut: () => void;
}

export const ProfileOptionsButton: React.FC<ProfileOptionsButtonProps> = ({ onSignOut }) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleSignOutPress = () => {
    setShowMenu(false);
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: onSignOut,
        },
      ]
    );
  };

  return (
    <>
      {/* Options button */}
      <Pressable 
        onPress={() => setShowMenu(true)}
        className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
      >
        <LinearGradient
          colors={['#374151', '#4B5563']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="w-10 h-10 rounded-full items-center justify-center"
        >
          <Text className="text-white text-lg">⋯</Text>
        </LinearGradient>
      </Pressable>

      {/* Options menu modal */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable 
          className="flex-1 bg-black/50"
          onPress={() => setShowMenu(false)}
        >
          <View className="flex-1 justify-center items-center">
            <View className="bg-gray-800 rounded-2xl p-4 m-6 min-w-[200px]">
              <Pressable
                onPress={handleSignOutPress}
                className="py-4 px-2 active:bg-gray-700 rounded-lg"
              >
                <Text className="text-red-400 text-center text-lg font-medium">
                  Sign Out
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};