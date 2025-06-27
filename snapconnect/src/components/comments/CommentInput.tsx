import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Pressable, 
  Text, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { commentService } from '../../services/commentService';

interface CommentInputProps {
  postId: string;
  onCommentAdded?: () => void;
  placeholder?: string;
}

export const CommentInput: React.FC<CommentInputProps> = ({
  postId,
  onCommentAdded,
  placeholder = "Add a comment...",
}) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      
      await commentService.createComment(postId, {
        content: content.trim(),
      });

      setContent('');
      onCommentAdded?.();
    } catch (error) {
      console.error('Failed to post comment:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to post comment'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = content.trim().length > 0 && !isSubmitting;

  return (
    <View className="flex-row items-end p-4 bg-gray-900 border-t border-gray-800">
      <View className="flex-1 mr-3">
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
          className="bg-gray-800 text-white px-4 py-3 rounded-2xl min-h-[44px] max-h-[120px]"
          style={{ 
            textAlignVertical: 'top',
            fontSize: 16,
            lineHeight: 20,
          }}
          returnKeyType="default"
          blurOnSubmit={false}
          enablesReturnKeyAutomatically={true}
        />
        {content.length > 400 && (
          <Text className="text-gray-400 text-xs mt-1 text-right">
            {500 - content.length} characters remaining
          </Text>
        )}
      </View>
      
      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        className={`${canSubmit ? '' : 'opacity-50'}`}
      >
        <LinearGradient
          colors={canSubmit ? ['#7C3AED', '#EC4899'] : ['#4B5563', '#6B7280']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="w-11 h-11 rounded-full items-center justify-center"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white text-lg">↗</Text>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
};