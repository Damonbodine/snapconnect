import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMessagesStore } from '../../src/stores/messagesStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useFriendsStore } from '../../src/stores/friendsStore';
import { TypingIndicator } from '../../src/components/chat/TypingIndicator';
import { MessageWithUser } from '../../src/services/messageService';
import { gradients } from '../../src/styles/gradients';

interface MessageBubbleProps {
  message: MessageWithUser;
  isOwn: boolean;
  onLongPress: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, onLongPress }) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpiring, setIsExpiring] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (message.is_viewed && message.expires_at) {
      const updateTimer = () => {
        const expirationTime = new Date(message.expires_at!).getTime();
        const currentTime = new Date().getTime();
        const remaining = Math.max(0, Math.floor((expirationTime - currentTime) / 1000));
        
        setTimeRemaining(remaining);
        
        if (remaining <= 3 && !isExpiring) {
          setIsExpiring(true);
          // Start fade animation
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 3000,
            useNativeDriver: true,
          }).start();
        }
        
        if (remaining === 0) {
          // Message expired - will be removed by store
          return;
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [message.is_viewed, message.expires_at, isExpiring, fadeAnim]);

  const formatTime = (sentAt: string) => {
    const date = new Date(sentAt);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderContent = () => {
    if (message.media_url) {
      return (
        <View className="rounded-lg overflow-hidden">
          <Image
            source={{ uri: message.media_url }}
            className="w-48 h-48"
            resizeMode="cover"
          />
          {message.content && (
            <Text className={`text-sm mt-2 ${isOwn ? 'text-white' : 'text-gray-900'}`}>
              {message.content}
            </Text>
          )}
        </View>
      );
    }

    return (
      <Text className={`text-base ${isOwn ? 'text-white' : 'text-gray-900'}`}>
        {message.content}
      </Text>
    );
  };

  return (
    <Animated.View 
      style={{ opacity: fadeAnim }}
      className={`flex-row mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      <Pressable onLongPress={onLongPress} className="max-w-[75%]">
        <LinearGradient
          colors={
            isOwn 
              ? gradients.primary
              : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.8)']
          }
          className="px-4 py-3 rounded-2xl"
        >
          {renderContent()}
          
          <View className="flex-row items-center justify-between mt-2">
            <Text className={`text-xs ${isOwn ? 'text-gray-200' : 'text-gray-600'}`}>
              {formatTime(message.sent_at)}
            </Text>
            
            {/* Expiration timer */}
            {message.is_viewed && timeRemaining > 0 && (
              <View className="flex-row items-center ml-2">
                <Ionicons 
                  name="timer-outline" 
                  size={12} 
                  color={isOwn ? '#E5E7EB' : '#6B7280'} 
                />
                <Text className={`text-xs ml-1 ${isOwn ? 'text-gray-200' : 'text-gray-600'}`}>
                  {timeRemaining}s
                </Text>
              </View>
            )}
            
            {/* Message status for own messages */}
            {isOwn && (
              <View className="ml-2">
                <Ionicons 
                  name={message.is_viewed ? "checkmark-done" : "checkmark"} 
                  size={12} 
                  color={message.is_viewed ? "#10B981" : "#E5E7EB"} 
                />
              </View>
            )}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

export default function ChatScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const { user } = useAuthStore();
  const { friends, fetchFriends } = useFriendsStore();
  const {
    currentConversation,
    activeFriendId,
    isLoadingMessages,
    isSendingMessage,
    fetchMessagesWithFriend,
    sendMessage,
    markMessageAsViewed,
    setActiveFriend,
    setupRealTimeSubscriptions,
    teardownRealTimeSubscriptions,
  } = useMessagesStore();

  const [messageText, setMessageText] = useState('');
  const [friend, setFriend] = useState<any>(null);
  const [isAITyping, setIsAITyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Find friend info
  useEffect(() => {
    console.log('🔍 Looking for friend:', friendId, 'in', friends.length, 'friends');
    if (friendId && friends.length > 0) {
      const foundFriend = friends.find(f => f.id === friendId);
      console.log('🔍 Found friend:', foundFriend ? `${foundFriend.full_name} (${foundFriend.username})` : 'NOT FOUND');
      
      if (!foundFriend) {
        // Debug why friend wasn't found
        console.log('🔍 Searching for friendId:', friendId);
        console.log('🔍 Available friend IDs and names:');
        friends.slice(0, 10).forEach((f, i) => {
          console.log(`  ${i + 1}. ID: ${f.id}, Name: ${f.full_name} (${f.username}), is_mock: ${f.is_mock_user}`);
        });
        
        // Check if it's an AI user by searching AI users specifically
        const aiUsers = friends.filter(f => f.is_mock_user === true);
        console.log('🤖 AI users in friends list:', aiUsers.length);
        aiUsers.forEach((ai, i) => {
          console.log(`  AI ${i + 1}. ID: ${ai.id}, Name: ${ai.full_name} (${ai.username})`);
        });
      }
      
      setFriend(foundFriend);
    } else {
      console.log('🔍 Friend search conditions not met:', { friendId: !!friendId, friendsLength: friends.length });
    }
  }, [friendId, friends]);

  // Load messages when screen opens and setup real-time subscriptions
  useEffect(() => {
    if (friendId && friendId !== activeFriendId && user?.id) {
      console.log('📱 Loading chat with friend:', friendId);
      
      // Refresh friends list to make sure we have AI users - WAIT for completion
      console.log('🔄 Force refreshing friends list to include AI users');
      const loadChat = async () => {
        try {
          // Wait for friends list to be refreshed before continuing
          await fetchFriends();
          
          setActiveFriend(friendId);
          // Force cache refresh for messages to get latest messages
          await fetchMessagesWithFriend(friendId, false);
          
          // 🔥 CRITICAL FIX: Setup real-time subscriptions for new messages
          console.log('🔔 Setting up real-time subscriptions for chat');
          setupRealTimeSubscriptions(user.id);
        } catch (error) {
          console.error('❌ Error loading chat:', error);
        }
      };
      
      loadChat();
    }

    return () => {
      // Clean up when leaving chat
      setActiveFriend(null);
      teardownRealTimeSubscriptions();
    };
  }, [friendId, user?.id]);

  // Auto-mark messages as viewed when they appear
  useEffect(() => {
    if (currentConversation.length > 0 && user) {
      currentConversation.forEach(message => {
        // Mark unviewed messages from friend as viewed
        if (message.sender_id === friendId && !message.is_viewed) {
          console.log('👁️ Auto-marking message as viewed:', message.id);
          markMessageAsViewed(message.id);
        }
        
        // Hide typing indicator when AI message arrives
        if (message.is_ai_sender && isAITyping) {
          console.log('✅ AI message received, hiding typing indicator');
          setIsAITyping(false);
        }
      });
    }
  }, [currentConversation, friendId, user, isAITyping]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !friendId || isSendingMessage) return;

    const content = messageText.trim();
    setMessageText(''); // Clear input immediately

    // Check if this is an AI user to show typing indicator
    const isAIUser = friend?.is_mock_user === true;

    try {
      await sendMessage({
        receiverId: friendId,
        content,
        senderId: user?.id, // Pass current user ID
      });
      
      // Show AI typing indicator if messaging an AI user
      if (isAIUser) {
        setIsAITyping(true);
        console.log('🤖 Message sent to AI user, showing typing indicator...');
        
        // Hide typing indicator after 8 seconds (AI should respond by then)
        setTimeout(() => {
          setIsAITyping(false);
        }, 8000);
      }
      
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
      setMessageText(content); // Restore message on error
      setIsAITyping(false); // Hide typing indicator on error
    }
  };

  const handleMessageLongPress = (message: MessageWithUser) => {
    if (message.sender_id === user?.id) {
      Alert.alert(
        'Message Info',
        `Sent: ${new Date(message.sent_at).toLocaleString()}\n` +
        `Status: ${message.is_viewed ? 'Viewed' : 'Delivered'}\n` +
        (message.expires_at ? `Expires: ${new Date(message.expires_at).toLocaleString()}` : '')
      );
    }
  };

  const renderMessage = ({ item }: { item: MessageWithUser }) => {
    // Fix message positioning logic for AI messages
    // Handle cases where sender_id might be empty/null
    const isOwn = item.is_ai_sender === true ? false : (item.sender_id === user?.id && item.sender_id !== '' && item.sender_id !== null);
    
    // 🔍 DIAGNOSTIC LOGGING - Track message positioning logic
    console.log('🔍 Message Positioning Debug:', {
      messageId: item.id,
      content: item.content?.substring(0, 30) + '...',
      sender_id: item.sender_id,
      receiver_id: item.receiver_id,
      is_ai_sender: item.is_ai_sender,
      current_user_id: user?.id,
      friend_id: friendId,
      isOwn_calculation: item.is_ai_sender 
        ? 'AI message = LEFT (their message)' 
        : `${item.sender_id} === ${user?.id} = ${isOwn}`,
      expected_position: isOwn ? 'RIGHT (my message)' : 'LEFT (their message)',
      sender_username: item.sender_username,
      receiver_username: item.receiver_username
    });
    
    // Additional validation checks
    if (item.is_ai_sender && item.sender_id !== friendId) {
      console.warn('⚠️ AI Message Issue: AI message sender_id does not match current friend:', {
        ai_sender_id: item.sender_id,
        expected_friend_id: friendId
      });
    }
    
    if (!item.is_ai_sender && item.sender_id === null) {
      console.warn('⚠️ Human Message Issue: Human message has null sender_id');
    }
    
    if (!user?.id) {
      console.warn('⚠️ Auth Issue: user.id is null/undefined, all messages will appear as "not own"');
    }
    
    return (
      <MessageBubble
        message={item}
        isOwn={isOwn}
        onLongPress={() => handleMessageLongPress(item)}
      />
    );
  };

  const renderHeader = () => (
    <View className="flex-row items-center p-4 border-b border-gray-800">
      <Pressable onPress={() => router.back()} className="mr-4">
        <Ionicons name="arrow-back" size={24} color="white" />
      </Pressable>
      
      <View className="flex-row items-center flex-1">
        <LinearGradient
          colors={gradients.primary}
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
        >
          <View className="w-8 h-8 rounded-full overflow-hidden bg-gray-800">
            <Image
              source={{ uri: friend?.avatar_url || 'https://via.placeholder.com/32' }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
        </LinearGradient>
        
        <View className="flex-1">
          <Text className="text-white font-semibold text-lg">
            {friend?.full_name || friend?.username || 'Loading...'}
          </Text>
          <Text className="text-gray-400 text-sm">
            @{friend?.username}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-4xl mb-4">💬</Text>
      <Text className="text-xl font-bold text-white mb-2">Start the conversation!</Text>
      <Text className="text-gray-400 text-center">
        {friend?.is_mock_user ? 
          'Chat with your AI fitness coach - messages are saved permanently' :
          'Send a message to start chatting'
        }
      </Text>
    </View>
  );

  return (
    <LinearGradient
      colors={['#0F0F0F', '#1F1F1F']}
      className="flex-1"
    >
      <SafeAreaView className="flex-1">
        {renderHeader()}
        
        <KeyboardAvoidingView 
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Messages */}
          {currentConversation.length === 0 && !isLoadingMessages ? (
            renderEmptyState()
          ) : (
            <FlatList
              ref={flatListRef}
              data={currentConversation}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              className="flex-1"
              contentContainerStyle={{ 
                paddingHorizontal: 16, 
                paddingVertical: 16,
                flexGrow: 1,
              }}
              inverted // Show newest messages at bottom
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* AI Typing Indicator */}
          <TypingIndicator 
            visible={isAITyping} 
            senderName={friend?.username || 'AI'} 
          />

          {/* Loading indicator */}
          {isLoadingMessages && (
            <View className="items-center py-4">
              <Text className="text-gray-400">Loading messages...</Text>
            </View>
          )}

          {/* Message input */}
          <View className="p-4 border-t border-gray-800">
            <View className="flex-row items-center">
              <View className="flex-1 bg-gray-800 rounded-full px-4 py-2 mr-3">
                <TextInput
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="Type a message..."
                  placeholderTextColor="#6B7280"
                  className="text-white text-base"
                  multiline
                  maxLength={1000}
                  returnKeyType="send"
                  onSubmitEditing={handleSendMessage}
                />
              </View>
              
              <Pressable
                onPress={handleSendMessage}
                disabled={!messageText.trim() || isSendingMessage}
                className={`w-12 h-12 rounded-full items-center justify-center ${
                  messageText.trim() && !isSendingMessage
                    ? 'opacity-100' 
                    : 'opacity-50'
                }`}
              >
                <LinearGradient
                  colors={gradients.primary}
                  className="w-full h-full rounded-full items-center justify-center"
                >
                  <Ionicons 
                    name={isSendingMessage ? "hourglass" : "send"} 
                    size={20} 
                    color="white" 
                  />
                </LinearGradient>
              </Pressable>
            </View>
            
            <Text className="text-gray-500 text-xs mt-2 text-center">
              Messages disappear 10 seconds after viewing
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}