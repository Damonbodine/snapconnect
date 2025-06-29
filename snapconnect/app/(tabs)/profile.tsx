import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Image, Alert, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { useAuthStore } from '../../src/stores/authStore';
import { useFriendsStore } from '../../src/stores/friendsStore';
import { GradientCard } from '../../src/components/ui/GradientCard';
import { RSVPStatsCard } from '../../src/components/profile/RSVPStatsCard';
import { MyEventsSection } from '../../src/components/profile/MyEventsSection';
import { FriendsRow } from '../../src/components/profile/FriendsRow';
import { ProfileOptionsButton } from '../../src/components/profile/ProfileOptionsButton';
import { useEventStore } from '../../src/stores/eventStore';
import { supabase } from '../../src/services/supabase';
import { getWorkoutIntensityEmoji, getWorkoutIntensityLabel } from '../../src/types/user';

export default function ProfileScreen() {
  const { user, profile, signOut, updateProfile } = useAuthStore();
  const { 
    friends,
    pendingRequests, 
    acceptFriendRequest, 
    declineFriendRequest,
    fetchPendingRequests,
    fetchFriends,
    isAcceptingRequest,
    isDecliningRequest 
  } = useFriendsStore();
  const [uploading, setUploading] = useState(false);
  const { getUserRSVPStats } = useEventStore();
  const [userStreak, setUserStreak] = useState<number>(0);

  // Fetch user streak data
  useEffect(() => {
    const fetchStreak = async () => {
      if (user?.id) {
        try {
          const stats = await getUserRSVPStats(user.id);
          setUserStreak(stats.currentStreak);
        } catch (error) {
          console.error('Failed to fetch user streak:', error);
        }
      }
    };
    fetchStreak();
  }, [user?.id]);

  // Debug logging
  console.log('ProfileScreen - profile data:', profile);
  console.log('ProfileScreen - avatar_url:', profile?.avatar_url);

  // Fetch friends and pending requests when component mounts
  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchPendingRequests();
    }
  }, [user]);

  const handleAcceptRequest = async (friendshipId: string, username: string) => {
    try {
      await acceptFriendRequest(friendshipId);
      Alert.alert('Friend Added!', `You are now friends with @${username}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept friend request');
    }
  };

  const handleDeclineRequest = async (friendshipId: string, username: string) => {
    try {
      await declineFriendRequest(friendshipId);
      Alert.alert('Request Declined', `Declined friend request from @${username}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to decline friend request');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Navigate back to the root, which will redirect to login
      router.replace('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    try {
      setUploading(true);
      
      // Get file extension
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      
      console.log('Uploading avatar:', { fileName, userId: user?.id, uri });

      // Get file info first
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('File info:', fileInfo);

      // Read the file as base64 using expo-file-system
      const base64 = await FileSystem.readAsStringAsync(uri, { 
        encoding: FileSystem.EncodingType.Base64 
      });

      console.log('Base64 string length:', base64.length);

      // Try direct base64 upload approach for React Native
      let uploadData;
      let uploadError;

      try {
        // Approach 1: Try ArrayBuffer (works for smaller files)
        const arrayBuffer = decode(base64);
        console.log('ArrayBuffer size:', arrayBuffer.byteLength);
        
        const result = await supabase.storage
          .from('avatars')
          .upload(fileName, arrayBuffer, {
            contentType: `image/${fileExt}`,
            upsert: true
          });
        
        uploadData = result.data;
        uploadError = result.error;
      } catch (err) {
        console.log('ArrayBuffer approach failed, trying alternative...');
        
        // Approach 2: Use fetch to create a proper blob
        const response = await fetch(uri);
        const blob = await response.blob();
        console.log('Blob size:', blob.size, 'Blob type:', blob.type);
        
        const result = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, {
            contentType: `image/${fileExt}`,
            upsert: true
          });
        
        uploadData = result.data;
        uploadError = result.error;
      }

      const { data, error } = { data: uploadData, error: uploadError };

      if (error) {
        console.error('Storage error:', error);
        throw error;
      }

      console.log('Upload successful:', data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('Updating profile with avatar URL:', publicUrl);
      
      // Add cache buster to ensure fresh image
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
      await updateProfile({ avatar_url: urlWithCacheBuster });
      
      Alert.alert('Success', 'Profile photo updated!');
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      Alert.alert('Error', error.message || 'Failed to update profile photo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F1F1F']}
      className="flex-1"
    >
      {/* Header with options button */}
      <View className="flex-row items-center justify-between px-6 pt-16 pb-4">
        <Text className="text-white text-2xl font-bold">Profile</Text>
        <ProfileOptionsButton onSignOut={handleSignOut} />
      </View>
      
      <ScrollView className="flex-1 px-6">
        {/* Avatar Section */}
        <View className="items-center mb-8">
          <Pressable onPress={pickImage} disabled={uploading}>
            {profile?.avatar_url ? (
              <Image 
                source={{ uri: profile.avatar_url }} 
                className="w-32 h-32 rounded-full mb-2"
              />
            ) : (
              <View className="w-32 h-32 rounded-full bg-gray-800 items-center justify-center mb-2">
                <Text className="text-6xl">👤</Text>
              </View>
            )}
            <Text className="text-[#EC4899] text-sm">
              {uploading ? 'Uploading...' : 'Change Photo'}
            </Text>
          </Pressable>
          <Text className="text-2xl font-bold text-white mt-2">@{profile?.username}</Text>
          
          {/* Friends, streak, and location row */}
          <View className="flex-row items-center justify-center space-x-8 mt-3">
            <View className="items-center">
              <Text className="text-white text-lg font-semibold">{friends.length}</Text>
              <Text className="text-gray-400 text-sm">{friends.length === 1 ? 'friend' : 'friends'}</Text>
            </View>
            <View className="items-center">
              <View className="flex-row items-center">
                <Text className="text-orange-400 text-lg mr-1">🔥</Text>
                <Text className="text-white text-lg font-semibold">{userStreak}</Text>
              </View>
              <Text className="text-gray-400 text-sm">day streak</Text>
            </View>
            {profile?.city && (
              <View className="items-center">
                <Text className="text-white text-lg font-semibold">📍</Text>
                <Text className="text-gray-400 text-sm">{profile.city}</Text>
              </View>
            )}
          </View>
          
          {/* Bio */}
          {profile?.bio && (
            <Text className="text-gray-300 text-center text-sm mt-3 mx-4 italic">
              "{profile.bio}"
            </Text>
          )}
          
          {/* Edit Profile and Messages Buttons */}
          <View className="flex-row space-x-3 mt-3">
            <Pressable 
              onPress={() => router.push('/edit-profile')}
              className="bg-gray-700 px-4 py-2 rounded-lg"
            >
              <Text className="text-white text-sm font-medium">Edit Profile</Text>
            </Pressable>
            
            <Pressable 
              onPress={() => router.push('/messages')}
              className="bg-gray-700 px-4 py-2 rounded-lg"
            >
              <Text className="text-white text-sm font-medium">Messages</Text>
            </Pressable>
          </View>
        </View>
        
        {/* Friends Section */}
        {friends.length > 0 && (
          <FriendsRow friends={friends} friendsCount={friends.length} />
        )}

        {/* Friend Requests Section */}
        {pendingRequests.length > 0 && (
          <View className="mb-8">
            <Text className="text-white text-xl font-bold mb-4">
              Friend Requests ({pendingRequests.length})
            </Text>
            
            {pendingRequests.map((request) => (
              <View key={request.friendship_id} className="bg-gray-800/30 rounded-2xl p-4 mb-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="w-12 h-12 rounded-full bg-gray-700 items-center justify-center mr-3">
                      {request.avatar_url ? (
                        <Image 
                          source={{ uri: request.avatar_url }} 
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <Text className="text-2xl">👤</Text>
                      )}
                    </View>
                    
                    <View className="flex-1">
                      <Text className="text-white font-semibold text-lg">
                        {request.full_name || request.username}
                      </Text>
                      <Text className="text-gray-400 text-sm">
                        @{request.username} • {request.fitness_level}
                      </Text>
                    </View>
                  </View>
                  
                  <View className="flex-row space-x-2">
                    <Pressable
                      onPress={() => handleAcceptRequest(request.friendship_id, request.username)}
                      disabled={isAcceptingRequest}
                      className="bg-green-600 px-4 py-2 rounded-lg"
                    >
                      <Text className="text-white font-semibold text-sm">
                        {isAcceptingRequest ? 'Accepting...' : 'Accept'}
                      </Text>
                    </Pressable>
                    
                    <Pressable
                      onPress={() => handleDeclineRequest(request.friendship_id, request.username)}
                      disabled={isDecliningRequest}
                      className="bg-red-600 px-4 py-2 rounded-lg"
                    >
                      <Text className="text-white font-semibold text-sm">
                        {isDecliningRequest ? 'Declining...' : 'Decline'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </LinearGradient>
  );
}