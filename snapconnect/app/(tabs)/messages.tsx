import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Pressable, 
  Image, 
  RefreshControl,
  Alert 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMessagesStore } from '../../src/stores/messagesStore';
import { useAuthStore } from '../../src/stores/authStore';
import { Conversation } from '../../src/services/messageService';
import { gradients } from '../../src/styles/gradients';

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({ conversation, onPress }) => {
  const getMessagePreview = () => {
    if (!conversation.last_message_content && !conversation.last_message_type) {
      return 'No messages yet';
    }

    if (conversation.last_message_type === 'photo') {
      return '📸 Photo';
    }
    
    if (conversation.last_message_type === 'video') {
      return '🎥 Video';
    }
    
    if (conversation.last_message_type === 'mixed') {
      return '📎 Media + text';
    }

    // Text message
    const content = conversation.last_message_content || '';
    return content.length > 40 ? content.substring(0, 40) + '...' : content;
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    
    const now = new Date();
    const messageDate = new Date(dateString);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return messageDate.toLocaleDateString();
  };

  return (
    <Pressable onPress={onPress} className="mx-4 mb-3">
      <LinearGradient
        colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
        className="rounded-xl p-4"
      >
        <View className="flex-row items-center">
          {/* Avatar */}
          <View className="relative">
            <LinearGradient
              colors={gradients.primary}
              className="w-14 h-14 rounded-full items-center justify-center"
            >
              <View className="w-12 h-12 rounded-full overflow-hidden bg-gray-800">
                <Image
                  source={{ 
                    uri: conversation.friend_avatar_url || 'https://via.placeholder.com/48' 
                  }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
            </LinearGradient>
            
            {/* Unread indicator */}
            {conversation.unread_count > 0 && (
              <View className="absolute -top-1 -right-1">
                <LinearGradient
                  colors={['#EC4899', '#F472B6']}
                  className="w-6 h-6 rounded-full items-center justify-center"
                >
                  <Text className="text-white text-xs font-bold">
                    {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                  </Text>
                </LinearGradient>
              </View>
            )}
          </View>
          
          {/* Conversation info */}
          <View className="flex-1 ml-4">
            <View className="flex-row justify-between items-start">
              <Text className="text-white font-semibold text-base">
                {conversation.friend_full_name || conversation.friend_username}
              </Text>
              <Text className="text-gray-400 text-sm">
                {formatTime(conversation.last_message_sent_at)}
              </Text>
            </View>
            
            <View className="flex-row items-center mt-1">
              <Text className="text-gray-400 text-sm">
                @{conversation.friend_username}
              </Text>
            </View>
            
            <Text 
              className={`text-sm mt-2 ${
                conversation.unread_count > 0 ? 'text-white font-medium' : 'text-gray-400'
              }`}
            >
              {conversation.is_sender ? 'You: ' : ''}{getMessagePreview()}
            </Text>
          </View>
          
          {/* Message type indicator */}
          <View className="ml-2">
            <Text className="text-gray-500 text-lg">
              💬
            </Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
};

export default function MessagesScreen() {
  const { 
    conversations,
    totalUnreadCount,
    isLoading,
    isRefreshing,
    fetchConversations,
    refreshConversations,
    setupRealTimeSubscriptions,
    teardownRealTimeSubscriptions
  } = useMessagesStore();
  
  const { user } = useAuthStore();
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize on mount
  useEffect(() => {
    if (user && !hasInitialized) {
      console.log('📱 Initializing messages screen for user:', user.id);
      initializeMessages();
      setHasInitialized(true);
    }
    
    return () => {
      if (hasInitialized) {
        teardownRealTimeSubscriptions();
      }
    };
  }, [user, hasInitialized]);

  const initializeMessages = async () => {
    try {
      // Setup real-time subscriptions
      if (user) {
        setupRealTimeSubscriptions(user.id);
      }
      
      // Fetch initial conversations
      await fetchConversations();
    } catch (error) {
      console.error('Failed to initialize messages:', error);
      Alert.alert('Error', 'Failed to load conversations');
    }
  };

  const handleConversationPress = (conversation: Conversation) => {
    console.log('Opening chat with:', conversation.friend_username);
    router.push(`/chat/${conversation.friend_id}`);
  };

  const handleRefresh = async () => {
    try {
      await refreshConversations();
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh conversations');
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <ConversationItem
      conversation={item}
      onPress={() => handleConversationPress(item)}
    />
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-6xl mb-4">💬</Text>
      <Text className="text-2xl font-bold text-white mb-2">No Messages Yet</Text>
      <Text className="text-gray-400 text-center">
        Start chatting with your friends! Messages disappear 10 seconds after being viewed.
      </Text>
      <Pressable 
        onPress={() => router.push('/discover')}
        className="mt-6"
      >
        <LinearGradient
          colors={gradients.primary}
          className="px-6 py-3 rounded-full"
        >
          <Text className="text-white font-semibold">Find Friends</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F1F1F']}
      className="flex-1"
    >
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="px-4 py-4 border-b border-gray-800">
          <View className="flex-row justify-between items-center">
            <Text className="text-2xl font-bold text-white">Messages</Text>
            {totalUnreadCount > 0 && (
              <View className="bg-pink-500 rounded-full px-3 py-1">
                <Text className="text-white text-sm font-bold">
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Conversations List */}
        {conversations.length === 0 && !isLoading ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={(item) => item.friend_id}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#EC4899"
                colors={['#EC4899']}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Loading indicator */}
        {isLoading && conversations.length === 0 && (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-400">Loading conversations...</Text>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}