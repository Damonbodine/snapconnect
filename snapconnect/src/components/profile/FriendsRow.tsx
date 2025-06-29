import React from 'react';
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Friend } from '../../services/friendService';

interface FriendsRowProps {
  friends: Friend[];
  friendsCount: number;
}

export const FriendsRow: React.FC<FriendsRowProps> = ({ friends, friendsCount }) => {
  const displayFriends = friends.slice(0, 8); // Show max 8 friends in the row

  const handleViewAllPress = () => {
    router.push('/friends');
  };

  const handleFriendPress = (friendId: string) => {
    router.push(`/user/${friendId}`);
  };

  return (
    <View className="mb-6">
      {/* Friends count header */}
      <View className="flex-row items-center justify-between mb-3 px-1">
        <Text className="text-white text-lg font-semibold">
          {friendsCount} {friendsCount === 1 ? 'friend' : 'friends'}
        </Text>
        {friendsCount > 8 && (
          <Pressable onPress={handleViewAllPress}>
            <Text className="text-[#EC4899] text-sm font-medium">View All</Text>
          </Pressable>
        )}
      </View>

      {/* Friends horizontal scroll */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="px-1"
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {displayFriends.map((friend, index) => (
          <Pressable 
            key={friend.id} 
            onPress={() => handleFriendPress(friend.id)}
            className="mr-4 items-center"
          >
            {/* Friend avatar with gradient border */}
            <View className="relative">
              <LinearGradient
                colors={['#7C3AED', '#EC4899', '#F472B6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="w-20 h-20 rounded-full items-center justify-center p-0.5"
              >
                <View className="w-full h-full rounded-full bg-gray-900 items-center justify-center p-1">
                  {friend.avatar_url ? (
                    <Image 
                      source={{ uri: friend.avatar_url }} 
                      className="w-full h-full rounded-full"
                    />
                  ) : (
                    <View className="w-full h-full rounded-full bg-gray-700 items-center justify-center">
                      <Text className="text-2xl">👤</Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
              
              {/* Online status indicator (optional - could be added later) */}
              <View className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900" />
            </View>
            
            {/* Friend name */}
            <Text className="text-white text-xs font-medium mt-2 text-center max-w-[80px]" numberOfLines={1}>
              {friend.full_name || friend.username}
            </Text>
          </Pressable>
        ))}
        
        {/* View all button at the end if there are more friends */}
        {friendsCount > 8 && (
          <Pressable onPress={handleViewAllPress} className="items-center ml-2">
            <View className="w-20 h-20 rounded-full bg-gray-800/50 border-2 border-gray-700 border-dashed items-center justify-center">
              <Text className="text-gray-400 text-2xl">+</Text>
            </View>
            <Text className="text-gray-400 text-xs font-medium mt-2 text-center">
              View All
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
};