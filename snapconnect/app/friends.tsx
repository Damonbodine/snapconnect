import React, { useEffect } from 'react';
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/stores/authStore';
import { useFriendsStore } from '../src/stores/friendsStore';
import { getWorkoutIntensityEmoji } from '../src/types/user';

export default function FriendsScreen() {
  const { user } = useAuthStore();
  const { 
    friends, 
    pendingRequests, 
    fetchFriends, 
    fetchPendingRequests, 
    acceptFriendRequest, 
    declineFriendRequest,
    isAcceptingRequest,
    isDecliningRequest 
  } = useFriendsStore();

  // Fetch friends and pending requests when component mounts
  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchPendingRequests();
    }
  }, [user]);

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F1F1F']}
      className="flex-1"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-16 pb-4">
        <Pressable 
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        
        <Text className="text-white text-xl font-bold">
          Friends ({friends.length})
          {pendingRequests.length > 0 && (
            <Text className="text-pink-400 text-sm font-normal">
              {' '}• {pendingRequests.length} requests
            </Text>
          )}
        </Text>
        
        <View className="w-10 h-10" />
      </View>

      {/* Friends List */}
      <ScrollView className="flex-1 px-6">
        {/* Pending Friend Requests */}
        {pendingRequests.length > 0 && (
          <View className="mb-6">
            <Text className="text-white text-lg font-bold mb-3">
              Friend Requests ({pendingRequests.length})
            </Text>
            {pendingRequests.map((request) => (
              <View
                key={request.friendship_id}
                className="bg-pink-500/10 border border-pink-500/20 rounded-2xl p-4 mb-3"
              >
                <View className="flex-row items-center">
                  {/* Avatar */}
                  <View className="w-16 h-16 rounded-full bg-gray-700 items-center justify-center mr-4">
                    {request.avatar_url ? (
                      <Image 
                        source={{ uri: request.avatar_url }} 
                        className="w-16 h-16 rounded-full"
                      />
                    ) : (
                      <Text className="text-3xl">👤</Text>
                    )}
                  </View>
                  
                  {/* Request Info */}
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-lg">
                      {request.full_name || request.username}
                    </Text>
                    <Text className="text-gray-400 text-sm">
                      @{request.username}
                    </Text>
                    {request.fitness_level && (
                      <Text className="text-gray-400 text-sm mt-1">
                        {request.fitness_level.charAt(0).toUpperCase() + request.fitness_level.slice(1)} level
                      </Text>
                    )}
                    <Text className="text-gray-500 text-xs mt-1">
                      {new Date(request.request_date).toLocaleDateString()} • Wants to be friends
                    </Text>
                  </View>
                </View>
                
                {/* Action Buttons */}
                <View className="flex-row space-x-3 mt-4">
                  <Pressable
                    onPress={() => acceptFriendRequest(request.friendship_id)}
                    disabled={isAcceptingRequest || isDecliningRequest}
                    className="flex-1 bg-green-500 rounded-xl py-3 items-center active:bg-green-600 disabled:opacity-50"
                  >
                    <Text className="text-white font-semibold">
                      {isAcceptingRequest ? 'Accepting...' : 'Accept'}
                    </Text>
                  </Pressable>
                  
                  <Pressable
                    onPress={() => declineFriendRequest(request.friendship_id)}
                    disabled={isAcceptingRequest || isDecliningRequest}
                    className="flex-1 bg-gray-600 rounded-xl py-3 items-center active:bg-gray-700 disabled:opacity-50"
                  >
                    <Text className="text-white font-semibold">
                      {isDecliningRequest ? 'Declining...' : 'Decline'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Current Friends */}
        {friends.length === 0 && pendingRequests.length === 0 ? (
          <View className="flex-1 items-center justify-center mt-20">
            <Text className="text-6xl mb-4">👥</Text>
            <Text className="text-white text-xl font-semibold mb-2">No Friends Yet</Text>
            <Text className="text-gray-400 text-center text-sm">
              Start connecting with other fitness enthusiasts to see them here!
            </Text>
          </View>
        ) : (
          <View className="pb-6">
            {friends.length > 0 && (
              <Text className="text-white text-lg font-bold mb-3">
                Friends ({friends.length})
              </Text>
            )}
            {friends.map((friend) => (
              <Pressable
                key={friend.id}
                onPress={() => router.push(`/user/${friend.id}`)}
                className="bg-gray-800/30 rounded-2xl p-4 mb-3 active:bg-gray-800/50"
              >
                <View className="flex-row items-center">
                  {/* Avatar */}
                  <View className="w-16 h-16 rounded-full bg-gray-700 items-center justify-center mr-4">
                    {friend.avatar_url ? (
                      <Image 
                        source={{ uri: friend.avatar_url }} 
                        className="w-16 h-16 rounded-full"
                      />
                    ) : (
                      <Text className="text-3xl">👤</Text>
                    )}
                  </View>
                  
                  {/* Friend Info */}
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-lg">
                      {friend.full_name || friend.username}
                    </Text>
                    <Text className="text-gray-400 text-sm">
                      @{friend.username}
                    </Text>
                    {friend.bio && (
                      <Text className="text-gray-300 text-sm italic mt-1" numberOfLines={1}>
                        "{friend.bio}"
                      </Text>
                    )}
                    <View className="flex-row items-center space-x-2 mt-1">
                      <Text className="text-gray-400 text-sm">
                        {friend.fitness_level.charAt(0).toUpperCase() + friend.fitness_level.slice(1)} level
                      </Text>
                      <Text className="text-gray-400 text-sm">
                        • {getWorkoutIntensityEmoji(friend.workout_intensity)} {friend.workout_intensity}
                      </Text>
                      {friend.city && (
                        <Text className="text-gray-400 text-sm">
                          • 📍 {friend.city}
                        </Text>
                      )}
                    </View>
                    <Text className="text-gray-500 text-xs mt-1">
                      Friends since {new Date(friend.friendship_created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  {/* Arrow Icon */}
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}