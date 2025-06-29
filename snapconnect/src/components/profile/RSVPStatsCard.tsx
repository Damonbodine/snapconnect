import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { GradientCard } from '../ui/GradientCard';
import { GlassCard } from '../ui/GlassCard';
import { useEventStore, RSVPStats } from '../../stores/eventStore';

interface RSVPStatsCardProps {
  userId: string;
  className?: string;
}

export const RSVPStatsCard: React.FC<RSVPStatsCardProps> = ({ 
  userId, 
  className = '' 
}) => {
  const { getUserRSVPStats } = useEventStore();
  const [stats, setStats] = useState<RSVPStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadStats();
  }, [userId]);

  const loadStats = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const userStats = await getUserRSVPStats(userId);
      setStats(userStats);
    } catch (err) {
      console.error('Failed to load RSVP stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <GlassCard className={className}>
        <View className="flex-row items-center justify-center py-6">
          <ActivityIndicator size="small" color="#EC4899" />
          <Text className="text-white/70 text-sm ml-2">Loading activity stats...</Text>
        </View>
      </GlassCard>
    );
  }

  if (error || !stats) {
    return (
      <GlassCard className={`border-red-500/30 ${className}`}>
        <View className="py-4">
          <Text className="text-red-400 text-sm text-center">
            {error || 'Failed to load activity stats'}
          </Text>
          <Pressable onPress={loadStats} className="mt-2">
            <Text className="text-white/60 text-xs text-center">Tap to retry</Text>
          </Pressable>
        </View>
      </GlassCard>
    );
  }

  return (
    <View className={className}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <GradientCard gradient="primary">
          <View className="space-y-4">
            {/* Header */}
            <View className="flex-row justify-between items-center">
              <Text className="text-white text-lg font-semibold">
                🎯 Your Activity
              </Text>
              <Text className="text-white/60 text-xs">
                {expanded ? 'Tap to collapse' : 'Tap for details'} {expanded ? '▲' : '▼'}
              </Text>
            </View>

            {/* Main Stats Grid */}
            <View className="flex-row space-x-3">
              <View className="flex-1 bg-white/10 rounded-lg p-3">
                <Text className="text-white/80 text-xs text-center">Workouts Joined</Text>
                <Text className="text-white text-xl font-bold text-center">
                  {stats.totalEventsRSVP}
                </Text>
              </View>
              
              <View className="flex-1 bg-white/10 rounded-lg p-3">
                <Text className="text-white/80 text-xs text-center">Workouts Created</Text>
                <Text className="text-white text-xl font-bold text-center">
                  {stats.totalEventsCreated}
                </Text>
              </View>
              
              <View className="flex-1 bg-white/10 rounded-lg p-3">
                <Text className="text-white/80 text-xs text-center">Upcoming</Text>
                <Text className="text-white text-xl font-bold text-center">
                  {stats.upcomingEventsCount}
                </Text>
              </View>
            </View>

            {/* Streak and Attendance */}
            <View className="flex-row space-x-3">
              <View className="flex-1 bg-white/5 rounded-lg p-3">
                <View className="flex-row items-center justify-center">
                  <Text className="text-orange-400 text-lg mr-1">🔥</Text>
                  <Text className="text-white font-medium">
                    {stats.currentStreak} day streak
                  </Text>
                </View>
                {stats.bestStreak > stats.currentStreak && (
                  <Text className="text-white/60 text-xs text-center mt-1">
                    Best: {stats.bestStreak} days
                  </Text>
                )}
              </View>
              
              <View className="flex-1 bg-white/5 rounded-lg p-3">
                <View className="flex-row items-center justify-center">
                  <Text className="text-green-400 text-lg mr-1">✅</Text>
                  <Text className="text-white font-medium">
                    {Math.round(stats.attendanceRate)}% attendance
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </GradientCard>
      </Pressable>

      {/* Expanded Details */}
      {expanded && (
        <View className="mt-4 space-y-3">
          {/* Favorite Categories */}
          {stats.favoriteEventCategories.length > 0 && (
            <GlassCard>
              <Text className="text-white font-medium mb-3">
                💪 Favorite Event Types
              </Text>
              <View className="space-y-2">
                {stats.favoriteEventCategories.slice(0, 3).map((category, index) => (
                  <View key={category.category} className="flex-row justify-between items-center">
                    <Text className="text-white/80 text-sm">
                      {index + 1}. {category.category}
                    </Text>
                    <Text className="text-white/60 text-sm">
                      {category.count} events
                    </Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          )}

          {/* Recent Activity */}
          {stats.recentActivity.length > 0 && (
            <GlassCard>
              <Text className="text-white font-medium mb-3">
                📅 Recent Activity
              </Text>
              <View className="space-y-2">
                {stats.recentActivity.slice(0, 4).map((activity, index) => (
                  <View key={index} className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <Text className="text-xs mr-2">
                          {activity.type === 'rsvp' ? '✅' : activity.type === 'created' ? '🎯' : '🎉'}
                        </Text>
                        <Text className="text-white/80 text-sm flex-1" numberOfLines={1}>
                          {activity.eventTitle}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-white/50 text-xs">
                      {formatActivityDate(activity.date)}
                    </Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          )}

          {/* Achievements */}
          <GlassCard>
            <Text className="text-white font-medium mb-3">
              🏆 Achievements
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {getAchievements(stats).map((achievement, index) => (
                <View key={index} className="bg-white/10 px-3 py-1 rounded-full">
                  <Text className="text-white text-xs">
                    {achievement.icon} {achievement.name}
                  </Text>
                </View>
              ))}
            </View>
          </GlassCard>
        </View>
      )}
    </View>
  );
};

// Helper function to format activity dates
const formatActivityDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
};

// Helper function to generate achievements based on stats
const getAchievements = (stats: RSVPStats) => {
  const achievements = [];

  if (stats.totalEventsRSVP >= 1) {
    achievements.push({ icon: '🎉', name: 'First Event' });
  }
  
  if (stats.totalEventsRSVP >= 5) {
    achievements.push({ icon: '🏃‍♀️', name: 'Active Member' });
  }
  
  if (stats.totalEventsRSVP >= 10) {
    achievements.push({ icon: '⭐', name: 'Event Enthusiast' });
  }
  
  if (stats.totalEventsCreated >= 1) {
    achievements.push({ icon: '👑', name: 'Event Creator' });
  }
  
  if (stats.totalEventsCreated >= 5) {
    achievements.push({ icon: '🎯', name: 'Community Builder' });
  }
  
  if (stats.currentStreak >= 7) {
    achievements.push({ icon: '🔥', name: 'Week Warrior' });
  }
  
  if (stats.attendanceRate >= 80) {
    achievements.push({ icon: '✅', name: 'Reliable' });
  }
  
  if (stats.attendanceRate >= 95) {
    achievements.push({ icon: '💎', name: 'Committed' });
  }

  // If no achievements yet, show encouragement
  if (achievements.length === 0) {
    achievements.push({ icon: '🌟', name: 'Getting Started' });
  }

  return achievements;
};