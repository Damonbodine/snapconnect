import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  FlatList, 
  Text, 
  ActivityIndicator,
  RefreshControl,
  Keyboard,
  Dimensions 
} from 'react-native';
import { CommentWithUser, commentService } from '../../services/commentService';
import { CommentItem } from './CommentItem';
import { CommentInput } from './CommentInput';

interface CommentsListProps {
  postId: string;
  isVisible: boolean;
}

export const CommentsList: React.FC<CommentsListProps> = ({
  postId,
  isVisible,
}) => {
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Load comments
  const loadComments = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true);
      setError(null);

      const fetchedComments = await commentService.getPostComments(postId);
      setComments(fetchedComments);
    } catch (err) {
      console.error('Failed to load comments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      if (showLoader) setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [postId]);

  // Handle keyboard events
  useEffect(() => {
    const keyboardWillShow = (event: any) => {
      setKeyboardHeight(event.endCoordinates.height);
    };

    const keyboardWillHide = () => {
      setKeyboardHeight(0);
    };

    const showListener = Keyboard.addListener('keyboardWillShow', keyboardWillShow);
    const hideListener = Keyboard.addListener('keyboardWillHide', keyboardWillHide);

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // Load comments when component becomes visible
  useEffect(() => {
    if (isVisible) {
      loadComments();
    }
  }, [isVisible, loadComments]);

  // Set up real-time subscriptions when visible
  useEffect(() => {
    if (!isVisible) return;

    console.log('💬 Setting up comment subscription for post:', postId);
    
    const subscription = commentService.subscribeToPostComments(
      postId,
      (newComment) => {
        console.log('💬 New comment received:', newComment);
        // Reload comments to get user info
        loadComments(false);
      },
      (updatedComment) => {
        console.log('💬 Comment updated:', updatedComment);
        // Reload comments to get updated data
        loadComments(false);
      },
      (deletedCommentId) => {
        console.log('💬 Comment deleted:', deletedCommentId);
        setComments(prev => prev.filter(c => c.id !== deletedCommentId));
      }
    );

    return () => {
      console.log('💬 Cleaning up comment subscription');
      subscription.unsubscribe();
    };
  }, [isVisible, postId, loadComments]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadComments(false);
  }, [loadComments]);

  const handleCommentAdded = useCallback(() => {
    loadComments(false);
  }, [loadComments]);

  const handleCommentUpdated = useCallback(() => {
    loadComments(false);
  }, [loadComments]);

  const handleCommentDeleted = useCallback(() => {
    loadComments(false);
  }, [loadComments]);

  const renderComment = useCallback(({ item }: { item: CommentWithUser }) => (
    <CommentItem
      comment={item}
      onCommentUpdated={handleCommentUpdated}
      onCommentDeleted={handleCommentDeleted}
    />
  ), [handleCommentUpdated, handleCommentDeleted]);

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View className="items-center justify-center py-8">
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text className="text-gray-400 mt-2">Loading comments...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="items-center justify-center py-8">
          <Text className="text-red-400 text-center mb-2">
            Failed to load comments
          </Text>
          <Text className="text-gray-500 text-sm text-center">
            {error}
          </Text>
        </View>
      );
    }

    return (
      <View className="items-center justify-center py-8">
        <Text className="text-gray-400 text-center">
          No comments yet
        </Text>
        <Text className="text-gray-500 text-sm text-center mt-1">
          Be the first to comment!
        </Text>
      </View>
    );
  };

  if (!isVisible) {
    return null;
  }

  return (
    <View className="flex-1" style={{ paddingBottom: keyboardHeight }}>
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-800">
        <Text className="text-white font-semibold text-lg">
          Comments ({comments.length})
        </Text>
      </View>

      {/* Comments List */}
      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#7C3AED']}
            tintColor="#7C3AED"
          />
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: keyboardHeight > 0 ? 20 : 0,
        }}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      />

      {/* Comment Input - positioned above keyboard */}
      <View style={{ 
        position: 'absolute',
        bottom: keyboardHeight,
        left: 0,
        right: 0,
        backgroundColor: '#111827',
      }}>
        <CommentInput
          postId={postId}
          onCommentAdded={handleCommentAdded}
        />
      </View>
    </View>
  );
};