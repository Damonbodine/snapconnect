import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Alert, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useFriendsStore } from '../../src/stores/friendsStore';
import { GradientCard } from '../../src/components/ui/GradientCard';
import { supabase } from '../../src/services/supabase';
import { gradients } from '../../src/styles/gradients';

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  fitness_level: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  email: string;
  created_at: string;
}

interface UserStats {
  totalPosts: number;
  joinedDaysAgo: number;
  isOwnProfile: boolean;
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user: currentUser } = useAuthStore();
  const { 
    sendFriendRequest, 
    getFriendshipStatus, 
    fetchFriendsCount,
    isSendingRequest,
    error: friendsError 
  } = useFriendsStore();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [friendsCount, setFriendsCount] = useState<number>(0);

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Fetching profile for user:', userId);

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('❌ Error fetching user profile:', profileError);
        throw new Error('User not found');
      }

      console.log('✅ Profile data:', profileData);

      // Fetch user stats (post count)
      const { count: postCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Calculate days since joining
      const joinedDate = new Date(profileData.created_at);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - joinedDate.getTime()) / (1000 * 60 * 60 * 24));

      setProfile(profileData);
      setStats({
        totalPosts: postCount || 0,
        joinedDaysAgo: daysDiff,
        isOwnProfile: currentUser?.id === userId
      });

      // Fetch friendship status and friends count if not own profile
      if (currentUser?.id !== userId) {
        try {
          console.log('🔍 Fetching friendship status');
          const status = await getFriendshipStatus(userId);
          setFriendshipStatus(status);
        } catch (err) {
          console.error('❌ Error fetching friendship status:', err);
        }
      }

      // Fetch friends count for this user
      try {
        console.log('🔢 Fetching friends count');
        const count = await fetchFriendsCount(userId);
        setFriendsCount(count);
      } catch (err) {
        console.error('❌ Error fetching friends count:', err);
        setFriendsCount(0);
      }

    } catch (err: any) {
      console.error('❌ Error loading profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/discover');
    }
  };

  const handleAddFriend = async () => {
    if (!userId || !profile) return;

    try {
      console.log('🤝 Sending friend request to:', profile.username);
      await sendFriendRequest(userId);
      
      // Update local friendship status immediately
      setFriendshipStatus('sent');
      
      Alert.alert(
        'Friend Request Sent', 
        `Friend request sent to @${profile.username}!`
      );
    } catch (error: any) {
      console.error('❌ Error sending friend request:', error);
      Alert.alert(
        'Error', 
        error.message || 'Failed to send friend request. Please try again.'
      );
    }
  };

  const getFriendButtonText = () => {
    if (isSendingRequest) return 'Sending...';
    
    switch (friendshipStatus) {
      case 'friends':
        return 'Friends';
      case 'sent':
        return 'Request Sent';
      case 'received':
        return 'Accept Request';
      case 'blocked':
        return 'Blocked';
      default:
        return 'Add Friend';
    }
  };

  const getFriendButtonGradient = () => {
    switch (friendshipStatus) {
      case 'friends':
        return 'success';
      case 'sent':
        return 'secondary';
      case 'received':
        return 'primary';
      case 'blocked':
        return 'danger';
      default:
        return 'primary';
    }
  };

  const isFriendButtonDisabled = () => {
    return isSendingRequest || friendshipStatus === 'blocked' || friendshipStatus === 'sent';
  };

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  // Get gradient colors based on fitness level
  const getGradientForLevel = (level: string) => {
    const gradientMap: Record<string, keyof typeof gradients> = {
      beginner: 'beginner',
      intermediate: 'intermediate',
      advanced: 'advanced',
    };
    return gradientMap[level] || 'primary';
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0F0F0F', '#1F1F1F']} className="flex-1 items-center justify-center">
        <Text className="text-white text-lg">Loading profile...</Text>
      </LinearGradient>
    );
  }

  if (error || !profile) {
    return (
      <LinearGradient colors={['#0F0F0F', '#1F1F1F']} className="flex-1 items-center justify-center px-8">
        <Text className="text-4xl mb-4">😕</Text>
        <Text className="text-white text-xl font-semibold mb-2 text-center">
          Profile Not Found
        </Text>
        <Text className="text-gray-400 text-center mb-6">
          {error || 'This user profile could not be loaded.'}
        </Text>
        <GradientCard gradient="primary" onPress={handleGoBack}>
          <Text className="text-white font-semibold px-6">Go Back</Text>
        </GradientCard>
      </LinearGradient>
    );
  }

  const userGradient = getGradientForLevel(profile.fitness_level);

  return (
    <LinearGradient colors={['#0F0F0F', '#1F1F1F']} className="flex-1">
      <ScrollView className="flex-1">
        {/* Header with back button */}
        <View className="px-6 pt-16 pb-4 flex-row items-center">
          <Pressable onPress={handleGoBack} className="mr-4">
            <Text className="text-white text-2xl">←</Text>
          </Pressable>
          <Text className="text-white text-xl font-semibold">Profile</Text>
        </View>

        {/* Avatar and basic info */}
        <View className="items-center px-6 mb-8">
          <View className="relative mb-4">
            <LinearGradient
              colors={gradients[userGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="w-32 h-32 rounded-full items-center justify-center"
            >
              <View className="w-28 h-28 rounded-full overflow-hidden bg-gray-800">
                <Image
                  source={{ uri: profile.avatar_url || 'https://via.placeholder.com/112' }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
            </LinearGradient>
            
            {/* Fitness level indicator */}
            <View className="absolute -bottom-2 -right-2">
              <LinearGradient
                colors={gradients[userGradient]}
                className="w-10 h-10 rounded-full items-center justify-center"
              >
                <Text className="text-white text-sm font-bold">
                  {profile.fitness_level.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            </View>
          </View>

          <Text className="text-white text-2xl font-bold mb-1">
            {profile.full_name}
          </Text>
          <Text className="text-gray-400 text-lg mb-2">
            @{profile.username}
          </Text>
          <Text className="text-gray-400 text-sm capitalize">
            {profile.fitness_level} • Joined {formatJoinDate(profile.created_at)}
          </Text>
        </View>

        {/* Stats */}
        <View className="px-6 mb-8">
          <View className="flex-row justify-between">
            <View className="bg-gray-800/30 rounded-2xl p-4 flex-1 mr-2 items-center">
              <Text className="text-white text-2xl font-bold">{stats?.totalPosts || 0}</Text>
              <Text className="text-gray-400 text-sm">Posts</Text>
            </View>
            <View className="bg-gray-800/30 rounded-2xl p-4 flex-1 mx-1 items-center">
              <Text className="text-white text-2xl font-bold">{stats?.joinedDaysAgo || 0}</Text>
              <Text className="text-gray-400 text-sm">Days Active</Text>
            </View>
            <View className="bg-gray-800/30 rounded-2xl p-4 flex-1 ml-2 items-center">
              <Text className="text-white text-2xl font-bold">{friendsCount}</Text>
              <Text className="text-gray-400 text-sm">Friends</Text>
            </View>
          </View>
        </View>

        {/* Goals */}
        {profile.goals && profile.goals.length > 0 && (
          <View className="px-6 mb-8">
            <Text className="text-white text-lg font-semibold mb-4">🎯 Goals</Text>
            <View className="bg-gray-800/30 rounded-2xl p-4">
              {profile.goals.map((goal, index) => (
                <Text key={index} className="text-gray-300 text-sm mb-1">
                  • {goal}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Action buttons */}
        <View className="px-6 mb-8">
          {stats?.isOwnProfile ? (
            <GradientCard gradient="primary" onPress={() => router.push('/profile')}>
              <Text className="text-white font-semibold text-center">
                Edit Profile
              </Text>
            </GradientCard>
          ) : (
            <View className="space-y-3">
              <GradientCard 
                gradient={getFriendButtonGradient() as keyof typeof gradients} 
                onPress={handleAddFriend}
                disabled={isFriendButtonDisabled()}
                style={{
                  opacity: isFriendButtonDisabled() ? 0.6 : 1
                }}
              >
                <Text className="text-white font-semibold text-center">
                  {getFriendButtonText()}
                </Text>
              </GradientCard>
              <GradientCard 
                gradient="secondary" 
                onPress={() => {
                  if (friendshipStatus === 'friends') {
                    router.push(`/chat/${userId}`);
                  } else {
                    Alert.alert('Friends Only', 'You can only message friends. Send a friend request first!');
                  }
                }}
                disabled={friendshipStatus !== 'friends'}
                style={{
                  opacity: friendshipStatus === 'friends' ? 1 : 0.6
                }}
              >
                <Text className="text-white font-semibold text-center">
                  {friendshipStatus === 'friends' ? 'Send Message' : 'Message (Friends Only)'}
                </Text>
              </GradientCard>
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}