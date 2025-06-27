import { supabase } from './supabase';
import { PostWithUser } from './postService';
import { UserProfile } from '../types/user';
import { personalizationService, PersonalizationInsights } from './personalizationService';

export interface RankingFactors {
  // User compatibility
  fitnessLevelMatch: number;      // 0-1: how well fitness levels align
  workoutTypePreference: number;  // 0-1: user's interest in this workout type
  
  // Engagement signals
  likesScore: number;             // 0-1: normalized like count
  commentsScore: number;          // 0-1: normalized comment count
  viewDurationScore: number;      // 0-1: average view duration score
  
  // Social signals
  friendshipBoost: number;        // 0-1: boost for friends' posts
  mutualConnectionsScore: number; // 0-1: mutual connections with post author
  
  // Temporal factors
  recencyScore: number;           // 0-1: how recent the post is
  timeOfDayMatch: number;         // 0-1: match with user's activity patterns
  
  // Content quality
  mediaQualityScore: number;      // 0-1: has media, good thumbnail, etc.
  contentLengthScore: number;     // 0-1: optimal content length
  
  // Diversity
  diversityBoost: number;         // 0-1: boost for content type diversity
  
  // ML-powered personalization
  personalizationScore: number;  // 0-1: advanced ML-based personalization
  timeBasedRelevance: number;     // 0-1: time-of-day relevance boost
}

export interface ScoredPost extends PostWithUser {
  rankingScore: number;
  rankingFactors: RankingFactors;
}

export interface UserPreferences {
  workoutTypes: { [key: string]: number };  // workout type preference scores
  timeOfDayActivity: { [hour: number]: number }; // activity by hour
  fitnessLevelTolerance: number; // how much fitness level difference is okay
  contentTypePreference: 'photo' | 'video' | 'both';
}

class FeedRankingService {
  private static instance: FeedRankingService;
  
  // Ranking weights (sum should be 1.0)
  private readonly WEIGHTS = {
    fitnessLevelMatch: 0.12,
    workoutTypePreference: 0.10,
    likesScore: 0.08,
    commentsScore: 0.06,
    viewDurationScore: 0.06,
    friendshipBoost: 0.12,
    mutualConnectionsScore: 0.04,
    recencyScore: 0.10,
    timeOfDayMatch: 0.04,
    mediaQualityScore: 0.04,
    contentLengthScore: 0.02,
    diversityBoost: 0.02,
    personalizationScore: 0.15, // High weight for ML-powered insights
    timeBasedRelevance: 0.05,
  };

  public static getInstance(): FeedRankingService {
    if (!FeedRankingService.instance) {
      FeedRankingService.instance = new FeedRankingService();
    }
    return FeedRankingService.instance;
  }

  /**
   * Rank posts for a specific user using algorithmic scoring
   */
  async rankPosts(posts: PostWithUser[], userId: string): Promise<ScoredPost[]> {
    if (posts.length === 0) return [];

    try {
      console.log(`🧮 Ranking ${posts.length} posts for user ${userId}`);

      // Get user profile, preferences, and personalization insights
      const [userProfile, userPreferences, engagementData, socialData, personalizationInsights] = await Promise.all([
        this.getUserProfile(userId),
        this.getUserPreferences(userId),
        this.getEngagementData(posts.map(p => p.id)),
        this.getSocialData(userId, posts.map(p => p.user_id)),
        personalizationService.getUserInsights(userId)
      ]);

      if (!userProfile) {
        console.warn('No user profile found, using fallback ranking');
        return this.fallbackRanking(posts);
      }

      // Score each post
      const scoredPosts: ScoredPost[] = posts.map(post => {
        const factors = this.calculateRankingFactors(
          post,
          userProfile,
          userPreferences,
          engagementData,
          socialData,
          personalizationInsights
        );

        const rankingScore = this.calculateWeightedScore(factors);

        return {
          ...post,
          rankingScore,
          rankingFactors: factors,
        };
      });

      // Sort by ranking score (highest first)
      scoredPosts.sort((a, b) => b.rankingScore - a.rankingScore);

      console.log(`🧮 Ranking complete. Top post score: ${scoredPosts[0]?.rankingScore.toFixed(3)}`);
      
      // Log top 3 posts for debugging
      scoredPosts.slice(0, 3).forEach((post, index) => {
        console.log(`🏆 #${index + 1}: Score ${post.rankingScore.toFixed(3)} - ${post.users.username} (${post.workout_type || 'general'})`);
      });

      return scoredPosts;
    } catch (error) {
      console.error('❌ Error ranking posts:', error);
      return this.fallbackRanking(posts);
    }
  }

  /**
   * Calculate all ranking factors for a post
   */
  private calculateRankingFactors(
    post: PostWithUser,
    userProfile: UserProfile,
    userPreferences: UserPreferences,
    engagementData: EngagementData,
    socialData: SocialData,
    personalizationInsights: PersonalizationInsights
  ): RankingFactors {
    return {
      fitnessLevelMatch: this.calculateFitnessLevelMatch(post, userProfile),
      workoutTypePreference: this.calculateWorkoutTypePreference(post, userPreferences),
      likesScore: this.calculateLikesScore(post, engagementData),
      commentsScore: this.calculateCommentsScore(post, engagementData),
      viewDurationScore: this.calculateViewDurationScore(post, engagementData),
      friendshipBoost: this.calculateFriendshipBoost(post, socialData),
      mutualConnectionsScore: this.calculateMutualConnectionsScore(post, socialData),
      recencyScore: this.calculateRecencyScore(post),
      timeOfDayMatch: this.calculateTimeOfDayMatch(post, userPreferences),
      mediaQualityScore: this.calculateMediaQualityScore(post),
      contentLengthScore: this.calculateContentLengthScore(post),
      diversityBoost: 0, // Will be calculated later based on feed diversity
      personalizationScore: this.calculatePersonalizationScore(post, personalizationInsights),
      timeBasedRelevance: this.calculateTimeBasedRelevance(post, personalizationInsights),
    };
  }

  /**
   * Calculate weighted final score
   */
  private calculateWeightedScore(factors: RankingFactors): number {
    return Object.entries(this.WEIGHTS).reduce((score, [factor, weight]) => {
      return score + (factors[factor as keyof RankingFactors] * weight);
    }, 0);
  }

  /**
   * Fitness level compatibility scoring
   */
  private calculateFitnessLevelMatch(post: PostWithUser, userProfile: UserProfile): number {
    const levels = ['beginner', 'intermediate', 'advanced'];
    const userLevelIndex = levels.indexOf(userProfile.fitness_level);
    const postLevelIndex = levels.indexOf(post.users.fitness_level);
    
    const difference = Math.abs(userLevelIndex - postLevelIndex);
    
    // Perfect match = 1.0, 1 level diff = 0.7, 2 level diff = 0.3
    switch (difference) {
      case 0: return 1.0;
      case 1: return 0.7;
      case 2: return 0.3;
      default: return 0.1;
    }
  }

  /**
   * Workout type preference scoring
   */
  private calculateWorkoutTypePreference(post: PostWithUser, preferences: UserPreferences): number {
    if (!post.workout_type) return 0.5; // Neutral for posts without workout type
    
    const preference = preferences.workoutTypes[post.workout_type] || 0.5;
    return Math.min(1.0, Math.max(0.0, preference));
  }

  /**
   * Like count scoring (normalized)
   */
  private calculateLikesScore(post: PostWithUser, engagementData: EngagementData): number {
    const likes = engagementData.likes[post.id] || 0;
    const maxLikes = Math.max(...Object.values(engagementData.likes), 1);
    
    // Use log scale for likes to prevent viral posts from dominating
    return Math.min(1.0, Math.log(likes + 1) / Math.log(maxLikes + 1));
  }

  /**
   * Comment count scoring (normalized)
   */
  private calculateCommentsScore(post: PostWithUser, engagementData: EngagementData): number {
    const comments = engagementData.comments[post.id] || 0;
    const maxComments = Math.max(...Object.values(engagementData.comments), 1);
    
    return Math.min(1.0, comments / maxComments);
  }

  /**
   * Average view duration scoring
   */
  private calculateViewDurationScore(post: PostWithUser, engagementData: EngagementData): number {
    const avgDuration = engagementData.viewDurations[post.id] || 0;
    
    // Target: 10+ seconds is good engagement
    return Math.min(1.0, avgDuration / 10000);
  }

  /**
   * Friendship boost scoring
   */
  private calculateFriendshipBoost(post: PostWithUser, socialData: SocialData): number {
    return socialData.friends.has(post.user_id) ? 1.0 : 0.0;
  }

  /**
   * Mutual connections scoring
   */
  private calculateMutualConnectionsScore(post: PostWithUser, socialData: SocialData): number {
    const mutuals = socialData.mutualConnections[post.user_id] || 0;
    const maxMutuals = Math.max(...Object.values(socialData.mutualConnections), 1);
    
    return Math.min(1.0, mutuals / maxMutuals);
  }

  /**
   * Recency scoring (exponential decay)
   */
  private calculateRecencyScore(post: PostWithUser): number {
    const now = Date.now();
    const postTime = new Date(post.created_at).getTime();
    const ageHours = (now - postTime) / (1000 * 60 * 60);
    
    // Exponential decay: fresh posts score higher
    // Half-life of 6 hours
    return Math.exp(-ageHours / 6);
  }

  /**
   * Time of day match scoring
   */
  private calculateTimeOfDayMatch(post: PostWithUser, preferences: UserPreferences): number {
    const postHour = new Date(post.created_at).getHours();
    const currentHour = new Date().getHours();
    
    // Give bonus to posts from times when user is typically active
    const postTimeActivity = preferences.timeOfDayActivity[postHour] || 0.5;
    const currentTimeBonus = Math.abs(currentHour - postHour) <= 2 ? 0.2 : 0;
    
    return Math.min(1.0, postTimeActivity + currentTimeBonus);
  }

  /**
   * Media quality scoring
   */
  private calculateMediaQualityScore(post: PostWithUser): number {
    let score = 0;
    
    // Has media
    if (post.media_url) score += 0.5;
    
    // Has thumbnail (optimized)
    if (post.thumbnail_url) score += 0.3;
    
    // Video content (generally higher engagement)
    if (post.media_type === 'video') score += 0.2;
    
    return Math.min(1.0, score);
  }

  /**
   * Content length scoring
   */
  private calculateContentLengthScore(post: PostWithUser): number {
    if (!post.content) return 0.3;
    
    const length = post.content.length;
    
    // Optimal range: 50-200 characters
    if (length >= 50 && length <= 200) return 1.0;
    if (length >= 20 && length <= 300) return 0.8;
    if (length >= 10 && length <= 400) return 0.6;
    
    return 0.3;
  }

  /**
   * ML-powered personalization scoring
   */
  private calculatePersonalizationScore(post: PostWithUser, insights: PersonalizationInsights): number {
    let score = 0.5; // Base score
    
    // Boost for preferred workout types
    if (post.workout_type && insights.topWorkoutTypes.includes(post.workout_type)) {
      const rank = insights.topWorkoutTypes.indexOf(post.workout_type);
      score += (0.4 - (rank * 0.1)); // First choice gets 0.4, second gets 0.3, etc.
    }
    
    // Fitness compatibility boost
    if (insights.fitnessCompatibility === 'similar') {
      score += 0.2;
    } else if (insights.fitnessCompatibility === 'challenging') {
      score += 0.15;
    }
    
    // Content style preference
    if (insights.contentStyle === 'visual' && post.media_url) {
      score += 0.2;
    } else if (insights.contentStyle === 'detailed' && post.content && post.content.length > 150) {
      score += 0.2;
    } else if (insights.contentStyle === 'concise' && post.content && post.content.length <= 100) {
      score += 0.2;
    }
    
    // Social engagement preference
    if (insights.socialEngagement === 'high') {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Time-based relevance scoring
   */
  private calculateTimeBasedRelevance(post: PostWithUser, insights: PersonalizationInsights): number {
    const currentHour = new Date().getHours();
    
    let score = 0.5; // Base score
    
    // Time of day preference match
    const timeOfDay = insights.preferredTimeOfDay;
    
    if (timeOfDay === 'morning' && currentHour >= 6 && currentHour <= 11) {
      if (post.workout_type === 'cardio' || post.workout_type === 'running') {
        score += 0.3; // Morning cardio boost
      }
    } else if (timeOfDay === 'afternoon' && currentHour >= 12 && currentHour <= 17) {
      if (post.workout_type === 'strength' || post.workout_type === 'sports') {
        score += 0.3; // Afternoon strength/sports boost
      }
    } else if (timeOfDay === 'evening' && currentHour >= 18 && currentHour <= 22) {
      if (post.workout_type === 'yoga' || post.workout_type === 'stretching') {
        score += 0.3; // Evening yoga/stretching boost
      }
    }
    
    // Weekend vs weekday preference
    const isWeekend = [0, 6].includes(new Date().getDay());
    if (isWeekend && post.workout_type === 'hiking') {
      score += 0.2; // Weekend hiking boost
    } else if (!isWeekend && (post.workout_type === 'gym' || post.workout_type === 'strength')) {
      score += 0.1; // Weekday gym boost
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Get user profile
   */
  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data as UserProfile;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return null;
    }
  }

  /**
   * Get user preferences (with fallbacks)
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      // Get workout type preferences from user interactions
      const { data: interactions } = await supabase
        .from('user_interactions')
        .select('posts(workout_type)')
        .eq('user_id', userId)
        .eq('interaction_type', 'like')
        .limit(100);

      const workoutTypes: { [key: string]: number } = {};
      const totalLikes = interactions?.length || 0;

      if (interactions && totalLikes > 0) {
        interactions.forEach(interaction => {
          const workoutType = interaction.posts?.workout_type;
          if (workoutType) {
            workoutTypes[workoutType] = (workoutTypes[workoutType] || 0) + 1;
          }
        });

        // Normalize to 0-1 scores
        Object.keys(workoutTypes).forEach(type => {
          workoutTypes[type] = workoutTypes[type] / totalLikes;
        });
      }

      // Get time of day activity from post views
      const { data: views } = await supabase
        .from('post_views')
        .select('viewed_at')
        .eq('user_id', userId)
        .limit(200);

      const timeOfDayActivity: { [hour: number]: number } = {};
      const totalViews = views?.length || 0;

      if (views && totalViews > 0) {
        views.forEach(view => {
          const hour = new Date(view.viewed_at).getHours();
          timeOfDayActivity[hour] = (timeOfDayActivity[hour] || 0) + 1;
        });

        // Normalize
        Object.keys(timeOfDayActivity).forEach(hour => {
          timeOfDayActivity[parseInt(hour)] = timeOfDayActivity[parseInt(hour)] / totalViews;
        });
      }

      return {
        workoutTypes,
        timeOfDayActivity,
        fitnessLevelTolerance: 0.7, // Default: accept 1 level difference
        contentTypePreference: 'both',
      };
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return {
        workoutTypes: {},
        timeOfDayActivity: {},
        fitnessLevelTolerance: 0.7,
        contentTypePreference: 'both',
      };
    }
  }

  /**
   * Get engagement data for posts
   */
  private async getEngagementData(postIds: string[]): Promise<EngagementData> {
    if (postIds.length === 0) {
      return { likes: {}, comments: {}, viewDurations: {} };
    }

    try {
      const [likesData, commentsData, viewsData] = await Promise.all([
        // Get like counts
        supabase
          .from('user_interactions')
          .select('post_id')
          .in('post_id', postIds)
          .eq('interaction_type', 'like'),
        
        // Get comment counts (if you have comments)
        supabase
          .from('user_interactions')
          .select('post_id')
          .in('post_id', postIds)
          .eq('interaction_type', 'comment'),
        
        // Get average view durations
        supabase
          .from('post_views')
          .select('post_id, view_duration')
          .in('post_id', postIds)
      ]);

      // Process likes
      const likes: { [postId: string]: number } = {};
      postIds.forEach(id => likes[id] = 0);
      likesData.data?.forEach(like => {
        likes[like.post_id] = (likes[like.post_id] || 0) + 1;
      });

      // Process comments
      const comments: { [postId: string]: number } = {};
      postIds.forEach(id => comments[id] = 0);
      commentsData.data?.forEach(comment => {
        comments[comment.post_id] = (comments[comment.post_id] || 0) + 1;
      });

      // Process view durations
      const viewDurations: { [postId: string]: number } = {};
      postIds.forEach(id => viewDurations[id] = 0);
      
      if (viewsData.data) {
        const durationsMap: { [postId: string]: number[] } = {};
        viewsData.data.forEach(view => {
          if (!durationsMap[view.post_id]) durationsMap[view.post_id] = [];
          durationsMap[view.post_id].push(view.view_duration || 0);
        });

        Object.entries(durationsMap).forEach(([postId, durations]) => {
          viewDurations[postId] = durations.reduce((a, b) => a + b, 0) / durations.length;
        });
      }

      return { likes, comments, viewDurations };
    } catch (error) {
      console.error('Error getting engagement data:', error);
      return { likes: {}, comments: {}, viewDurations: {} };
    }
  }

  /**
   * Get social connection data
   */
  private async getSocialData(userId: string, authorIds: string[]): Promise<SocialData> {
    try {
      // Get friends
      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      const friends = new Set(friendships?.map(f => f.friend_id) || []);

      // Get mutual connections (simplified)
      const mutualConnections: { [userId: string]: number } = {};
      authorIds.forEach(id => mutualConnections[id] = 0);

      return { friends, mutualConnections };
    } catch (error) {
      console.error('Error getting social data:', error);
      return { friends: new Set(), mutualConnections: {} };
    }
  }

  /**
   * Fallback ranking when user data is not available
   */
  private fallbackRanking(posts: PostWithUser[]): ScoredPost[] {
    return posts
      .map(post => {
        const recencyScore = this.calculateRecencyScore(post);
        const mediaScore = this.calculateMediaQualityScore(post);
        const contentScore = this.calculateContentLengthScore(post);
        
        return {
          ...post,
          rankingScore: (recencyScore * 0.5) + (mediaScore * 0.3) + (contentScore * 0.2),
          rankingFactors: {
            fitnessLevelMatch: 0.5,
            workoutTypePreference: 0.5,
            likesScore: 0,
            commentsScore: 0,
            viewDurationScore: 0,
            friendshipBoost: 0,
            mutualConnectionsScore: 0,
            recencyScore,
            timeOfDayMatch: 0.5,
            mediaQualityScore: mediaScore,
            contentLengthScore: contentScore,
            diversityBoost: 0,
          },
        };
      })
      .sort((a, b) => b.rankingScore - a.rankingScore);
  }
}

// Type definitions
interface EngagementData {
  likes: { [postId: string]: number };
  comments: { [postId: string]: number };
  viewDurations: { [postId: string]: number };
}

interface SocialData {
  friends: Set<string>;
  mutualConnections: { [userId: string]: number };
}

export const feedRankingService = FeedRankingService.getInstance();