import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  Image, 
  Pressable, 
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CommentWithUser, commentService } from '../../services/commentService';
import { useAuthStore } from '../../stores/authStore';
import { gradients } from '../../styles/gradients';

interface CommentItemProps {
  comment: CommentWithUser;
  onCommentUpdated?: () => void;
  onCommentDeleted?: () => void;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onCommentUpdated,
  onCommentDeleted,
}) => {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Determine gradient based on fitness level
  const userGradient = useMemo(() => {
    const gradientMap: Record<string, keyof typeof gradients> = {
      beginner: 'beginner',
      intermediate: 'intermediate', 
      advanced: 'advanced',
    };
    
    return gradientMap[comment.fitness_level] || 'primary';
  }, [comment.fitness_level]);

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const commentDate = new Date(dateString);
    const diffMs = now.getTime() - commentDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  const isOwner = user?.id === comment.user_id;

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || isUpdating) return;

    try {
      setIsUpdating(true);
      
      await commentService.updateComment(comment.id, {
        content: editContent.trim(),
      });

      setIsEditing(false);
      onCommentUpdated?.();
    } catch (error) {
      console.error('Failed to update comment:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update comment'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(comment.content);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: confirmDelete 
        },
      ]
    );
  };

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);
      
      await commentService.deleteComment(comment.id);
      
      onCommentDeleted?.();
    } catch (error) {
      console.error('Failed to delete comment:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to delete comment'
      );
      setIsDeleting(false);
    }
  };

  if (isDeleting) {
    return (
      <View className="flex-row items-center p-4 opacity-50">
        <ActivityIndicator size="small" color="#9CA3AF" />
        <Text className="text-gray-400 ml-2">Deleting comment...</Text>
      </View>
    );
  }

  return (
    <View className="flex-row p-4 border-b border-gray-800/50">
      {/* Avatar */}
      <View className="mr-3">
        <LinearGradient
          colors={gradients[userGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="w-8 h-8 rounded-full items-center justify-center"
        >
          <View className="w-7 h-7 rounded-full overflow-hidden bg-gray-800">
            <Image
              source={{ uri: comment.avatar_url || 'https://via.placeholder.com/32' }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
        </LinearGradient>
      </View>

      {/* Comment Content */}
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center mb-1">
          <Text className="text-white font-semibold text-sm">
            {comment.username}
          </Text>
          <Text className="text-gray-500 text-xs ml-2">
            {formatRelativeTime(comment.created_at)}
          </Text>
          {comment.is_edited && (
            <Text className="text-gray-500 text-xs ml-1">(edited)</Text>
          )}
        </View>

        {/* Comment Content */}
        {isEditing ? (
          <View>
            <TextInput
              value={editContent}
              onChangeText={setEditContent}
              multiline
              maxLength={500}
              className="bg-gray-800 text-white p-3 rounded-lg mb-2 min-h-[44px]"
              style={{ textAlignVertical: 'top' }}
              autoFocus
            />
            <View className="flex-row items-center">
              <Pressable
                onPress={handleSaveEdit}
                disabled={!editContent.trim() || isUpdating}
                className={`mr-3 ${!editContent.trim() || isUpdating ? 'opacity-50' : ''}`}
              >
                <LinearGradient
                  colors={['#10B981', '#34D399']}
                  className="px-4 py-2 rounded-full"
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white text-sm font-semibold">Save</Text>
                  )}
                </LinearGradient>
              </Pressable>
              <Pressable onPress={handleCancelEdit}>
                <Text className="text-gray-400 text-sm">Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Text className="text-gray-200 text-sm leading-5 mb-2">
              {comment.content}
            </Text>
            
            {/* Actions */}
            {isOwner && (
              <View className="flex-row items-center">
                <Pressable onPress={handleEdit} className="mr-4">
                  <Text className="text-gray-400 text-xs">Edit</Text>
                </Pressable>
                <Pressable onPress={handleDelete}>
                  <Text className="text-red-400 text-xs">Delete</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
};