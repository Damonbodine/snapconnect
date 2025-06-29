import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { GlassCard } from '../ui/GlassCard';
import { groupService, GroupMember } from '../../services/groupService';

interface GroupMembersModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

export const GroupMembersModal: React.FC<GroupMembersModalProps> = ({
  visible,
  onClose,
  groupId,
  groupName,
}) => {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && groupId) {
      fetchMembers();
    }
  }, [visible, groupId]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const membersData = await groupService.getGroupMembers(groupId);
      setMembers(membersData);
    } catch (error) {
      console.error('Failed to fetch group members:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleMemberPress = (member: GroupMember) => {
    console.log('Navigating to profile:', member.username);
    // Close the modal first, then navigate
    onClose();
    // Use setTimeout to ensure modal is fully dismissed before navigation
    setTimeout(() => {
      router.push(`/user/${member.id}`);
    }, 300);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#0F0F0F', '#1F2937']}
        className="flex-1"
      >
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between p-4 border-b border-white/10">
            <Text className="text-white text-lg font-semibold">
              {groupName} Members
            </Text>
            <Pressable onPress={onClose} className="p-2">
              <Text className="text-white/70 text-lg">✕</Text>
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            {loading && (
              <View className="items-center py-8">
                <ActivityIndicator size="large" color="#EC4899" />
                <Text className="text-white/70 text-sm mt-2">Loading members...</Text>
              </View>
            )}

            {!loading && members.length === 0 && (
              <GlassCard>
                <View className="items-center py-8">
                  <Text className="text-4xl mb-2">👥</Text>
                  <Text className="text-white font-semibold mb-2">No members yet</Text>
                  <Text className="text-white/70 text-center text-sm">
                    Be the first to join this group!
                  </Text>
                </View>
              </GlassCard>
            )}

            <View className="space-y-3">
              {members.map((member) => (
                <Pressable key={member.id} onPress={() => handleMemberPress(member)}>
                  <GlassCard>
                    <View className="flex-row items-center">
                      <View className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full items-center justify-center mr-3">
                        <Text className="text-white font-bold text-sm">
                          {member.full_name 
                            ? member.full_name.split(' ').map(n => n[0]).join('')
                            : member.username.slice(0, 2).toUpperCase()
                          }
                        </Text>
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text className="text-white font-semibold">
                            {member.full_name || member.username}
                          </Text>
                          <Text className="text-white/50 text-xs ml-2">
                            @{member.username}
                          </Text>
                          {member.is_ai_user && (
                            <View className="bg-blue-500/20 px-2 py-1 rounded-full ml-2">
                              <Text className="text-blue-300 text-xs font-medium">
                                AI
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-white/60 text-xs mt-1">
                          Joined {formatJoinDate(member.joined_at)}
                        </Text>
                      </View>
                      <View className="ml-2">
                        <Text className="text-white/40 text-lg">›</Text>
                      </View>
                    </View>
                  </GlassCard>
                </Pressable>
              ))}
            </View>
            
            {!loading && members.length > 0 && (
              <View className="mt-6 p-4">
                <Text className="text-white/70 text-center text-sm">
                  {members.length} member{members.length !== 1 ? 's' : ''} total
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
};