import { supabase } from './supabase';
import { PostWithUser } from './postService';
import { UserProfile } from '../types/user';

export interface UserBehaviorProfile {
  // Engagement patterns
  likedWorkoutTypes: { [type: string]: number };
  viewDurationByType: { [type: string]: number };
  engagementByTime: { [hour: number]: number };
  
  // Content preferences
  preferredContentLength: number;
  mediaTypePreference: 'photo' | 'video' | 'mixed';
  fitnessLevelInteraction: { [level: string]: number };
  
  // Social patterns
  friendInteractionRate: number;
  commentToLikeRatio: number;
  
  // Temporal patterns
  peakActivityHours: number[];
  weekdayVsWeekendPreference: 'weekday' | 'weekend' | 'mixed';
  
  // Learning metrics
  profileAccuracy: number;
  lastUpdated: number;
  totalInteractions: number;
}

export interface PersonalizationInsights {
  topWorkoutTypes: string[];
  preferredTimeOfDay: string;
  fitnessCompatibility: 'similar' | 'diverse' | 'challenging';
  contentStyle: 'visual' | 'detailed' | 'concise';
  socialEngagement: 'high' | 'medium' | 'low';
  discoveryPattern: 'explorative' | 'focused' | 'social';
}

export interface ContentRecommendation {
  postId: string;
  score: number;
  reason: string;
  confidence: number;
  factors: {
    workoutTypeMatch: number;
    timeRelevance: number;
    socialConnection: number;
    contentQuality: number;
    novelty: number;
  };
}

class PersonalizationService {
  private static instance: PersonalizationService;
  private behaviorCache: Map<string, UserBehaviorProfile> = new Map();
  private cacheExpiry = 30 * 60 * 1000; // 30 minutes

  public static getInstance(): PersonalizationService {
    if (!PersonalizationService.instance) {
      PersonalizationService.instance = new PersonalizationService();
    }
    return PersonalizationService.instance;
  }

  /**
   * Build comprehensive user behavior profile
   */
  async buildUserProfile(userId: string): Promise<UserBehaviorProfile> {
    // Check cache first
    const cached = this.behaviorCache.get(userId);
    if (cached && (Date.now() - cached.lastUpdated) < this.cacheExpiry) {
      return cached;
    }

    try {
      console.log('🧠 Building user behavior profile for:', userId);

      const [
        interactions,
        viewData,
        friendData,
        timePatterns
      ] = await Promise.all([
        this.getUserInteractions(userId),
        this.getUserViewData(userId),
        this.getUserSocialData(userId),
        this.getUserTimePatterns(userId)
      ]);

      const profile: UserBehaviorProfile = {
        likedWorkoutTypes: this.analyzeLikedWorkoutTypes(interactions),
        viewDurationByType: this.analyzeViewDurations(viewData),
        engagementByTime: this.analyzeTimeEngagement(timePatterns),
        preferredContentLength: this.analyzeContentPreferences(interactions),
        mediaTypePreference: this.analyzeMediaPreferences(interactions),
        fitnessLevelInteraction: this.analyzeFitnessLevelInteractions(interactions),
        friendInteractionRate: this.analyzeFriendInteractions(friendData),
        commentToLikeRatio: this.analyzeEngagementRatios(interactions),
        peakActivityHours: this.findPeakActivityHours(timePatterns),
        weekdayVsWeekendPreference: this.analyzeWeekdayPreference(timePatterns),
        profileAccuracy: this.calculateProfileAccuracy(interactions),
        lastUpdated: Date.now(),
        totalInteractions: interactions.length,
      };

      // Cache the profile
      this.behaviorCache.set(userId, profile);

      console.log('🧠 User profile built:', {
        topWorkouts: Object.keys(profile.likedWorkoutTypes).slice(0, 3),
        peakHours: profile.peakActivityHours,
        mediaPreference: profile.mediaTypePreference,
        totalInteractions: profile.totalInteractions
      });

      return profile;
    } catch (error) {
      console.error('🧠 Error building user profile:', error);
      return this.getDefaultProfile();
    }
  }

  /**
   * Generate personalized content recommendations
   */
  async generateRecommendations(
    userId: string,
    candidatePosts: PostWithUser[],
    limit: number = 10
  ): Promise<ContentRecommendation[]> {
    try {
      const userProfile = await this.buildUserProfile(userId);
      const currentHour = new Date().getHours();
      
      console.log(`🎯 Generating ${limit} recommendations from ${candidatePosts.length} candidates`);

      const recommendations: ContentRecommendation[] = candidatePosts.map(post => {
        const factors = this.calculateRecommendationFactors(post, userProfile, currentHour);
        const score = this.calculateRecommendationScore(factors);
        const reason = this.generateRecommendationReason(factors, post);
        const confidence = this.calculateConfidence(factors, userProfile);

        return {
          postId: post.id,
          score,
          reason,
          confidence,
          factors,
        };
      });

      // Sort by score and return top recommendations
      const topRecommendations = recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      console.log('🎯 Top recommendations generated:', {
        avgScore: topRecommendations.reduce((sum, r) => sum + r.score, 0) / topRecommendations.length,
        avgConfidence: topRecommendations.reduce((sum, r) => sum + r.confidence, 0) / topRecommendations.length,
        topReasons: topRecommendations.slice(0, 3).map(r => r.reason)
      });

      return topRecommendations;
    } catch (error) {
      console.error('🎯 Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Get personalization insights for user
   */
  async getUserInsights(userId: string): Promise<PersonalizationInsights> {
    try {
      const profile = await this.buildUserProfile(userId);
      
      const topWorkoutTypes = Object.entries(profile.likedWorkoutTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([type]) => type);

      const preferredTimeOfDay = this.determinePreferredTimeOfDay(profile.peakActivityHours);
      const fitnessCompatibility = this.determineFitnessCompatibility(profile.fitnessLevelInteraction);
      const contentStyle = this.determineContentStyle(profile);
      const socialEngagement = this.determineSocialEngagement(profile);
      const discoveryPattern = this.determineDiscoveryPattern(profile);

      return {
        topWorkoutTypes,
        preferredTimeOfDay,
        fitnessCompatibility,
        contentStyle,
        socialEngagement,
        discoveryPattern,
      };
    } catch (error) {
      console.error('🧠 Error getting user insights:', error);
      return {
        topWorkoutTypes: [],
        preferredTimeOfDay: 'morning',
        fitnessCompatibility: 'similar',
        contentStyle: 'visual',
        socialEngagement: 'medium',
        discoveryPattern: 'focused',
      };
    }
  }

  /**
   * Learn from user interactions to improve recommendations
   */
  async learnFromInteraction(
    userId: string,
    postId: string,
    interactionType: 'like' | 'view' | 'comment' | 'skip',
    metadata: {
      viewDuration?: number;
      scrollSpeed?: number;
      timeOfDay?: number;
    } = {}
  ): Promise<void> {
    try {
      console.log(`📚 Learning from ${interactionType} interaction:`, { userId, postId, metadata });

      // Store learning data for future profile updates
      await supabase.from('user_learning_data').upsert({
        user_id: userId,
        post_id: postId,
        interaction_type: interactionType,
        metadata,
        created_at: new Date().toISOString(),
      });

      // Invalidate cached profile to force refresh
      this.behaviorCache.delete(userId);

      console.log('📚 Learning data stored successfully');
    } catch (error) {
      console.error('📚 Error storing learning data:', error);
    }
  }

  /**
   * Update personalization weights based on user feedback
   */
  async updatePersonalizationWeights(
    userId: string,
    feedback: {
      recommendationAccuracy: number; // 0-1
      contentSatisfaction: number;    // 0-1
      discoverySuccess: number;       // 0-1
    }
  ): Promise<void> {
    try {
      console.log('⚙️ Updating personalization weights:', { userId, feedback });

      await supabase.from('user_personalization_feedback').upsert({
        user_id: userId,
        accuracy: feedback.recommendationAccuracy,
        satisfaction: feedback.contentSatisfaction,
        discovery: feedback.discoverySuccess,
        updated_at: new Date().toISOString(),
      });

      // Clear cache to apply new weights
      this.behaviorCache.delete(userId);
    } catch (error) {
      console.error('⚙️ Error updating personalization weights:', error);
    }
  }

  // Private helper methods

  private async getUserInteractions(userId: string) {
    const { data } = await supabase
      .from('user_interactions')
      .select(`
        *,
        posts (
          workout_type,
          media_type,
          content,
          users (fitness_level)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500);

    return data || [];
  }

  private async getUserViewData(userId: string) {
    const { data } = await supabase
      .from('post_views')
      .select(`
        *,
        posts (
          workout_type,
          media_type
        )
      `)
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .limit(200);

    return data || [];
  }

  private async getUserSocialData(userId: string) {
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    return data || [];
  }

  private async getUserTimePatterns(userId: string) {
    const { data } = await supabase
      .from('user_interactions')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(300);

    return data || [];
  }

  private analyzeLikedWorkoutTypes(interactions: any[]): { [type: string]: number } {
    const workoutTypes: { [type: string]: number } = {};
    const likes = interactions.filter(i => i.interaction_type === 'like');
    
    likes.forEach(like => {
      const workoutType = like.posts?.workout_type || 'general';
      workoutTypes[workoutType] = (workoutTypes[workoutType] || 0) + 1;
    });

    // Normalize to percentages
    const total = likes.length;
    Object.keys(workoutTypes).forEach(type => {
      workoutTypes[type] = workoutTypes[type] / total;
    });

    return workoutTypes;
  }

  private analyzeViewDurations(viewData: any[]): { [type: string]: number } {
    const durations: { [type: string]: number[] } = {};
    
    viewData.forEach(view => {
      const workoutType = view.posts?.workout_type || 'general';
      if (!durations[workoutType]) durations[workoutType] = [];
      durations[workoutType].push(view.view_duration || 0);
    });

    // Calculate average durations
    const avgDurations: { [type: string]: number } = {};
    Object.entries(durations).forEach(([type, durs]) => {
      avgDurations[type] = durs.reduce((a, b) => a + b, 0) / durs.length;
    });

    return avgDurations;
  }

  private analyzeTimeEngagement(timePatterns: any[]): { [hour: number]: number } {
    const hourCounts: { [hour: number]: number } = {};
    
    timePatterns.forEach(pattern => {
      const hour = new Date(pattern.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Normalize
    const total = timePatterns.length;
    Object.keys(hourCounts).forEach(hour => {
      hourCounts[parseInt(hour)] = hourCounts[parseInt(hour)] / total;
    });

    return hourCounts;
  }

  private analyzeContentPreferences(interactions: any[]): number {
    const contentLengths = interactions
      .filter(i => i.posts?.content)
      .map(i => i.posts.content.length);
    
    if (contentLengths.length === 0) return 150; // Default
    
    return contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length;
  }

  private analyzeMediaPreferences(interactions: any[]): 'photo' | 'video' | 'mixed' {
    const mediaTypes = interactions
      .filter(i => i.posts?.media_type)
      .map(i => i.posts.media_type);
    
    const photos = mediaTypes.filter(t => t === 'photo').length;
    const videos = mediaTypes.filter(t => t === 'video').length;
    
    if (photos > videos * 1.5) return 'photo';
    if (videos > photos * 1.5) return 'video';
    return 'mixed';
  }

  private analyzeFitnessLevelInteractions(interactions: any[]): { [level: string]: number } {
    const levels: { [level: string]: number } = {};
    
    interactions.forEach(interaction => {
      const level = interaction.posts?.users?.fitness_level || 'unknown';
      levels[level] = (levels[level] || 0) + 1;
    });

    return levels;
  }

  private analyzeFriendInteractions(friendData: any[]): number {
    return friendData.length > 0 ? Math.min(1, friendData.length / 20) : 0;
  }

  private analyzeEngagementRatios(interactions: any[]): number {
    const likes = interactions.filter(i => i.interaction_type === 'like').length;
    const comments = interactions.filter(i => i.interaction_type === 'comment').length;
    
    return likes > 0 ? comments / likes : 0;
  }

  private findPeakActivityHours(timePatterns: any[]): number[] {
    const hourCounts = this.analyzeTimeEngagement(timePatterns);
    
    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }

  private analyzeWeekdayPreference(timePatterns: any[]): 'weekday' | 'weekend' | 'mixed' {
    const weekdays = timePatterns.filter(p => {
      const day = new Date(p.created_at).getDay();
      return day >= 1 && day <= 5;
    }).length;
    
    const weekends = timePatterns.length - weekdays;
    
    if (weekdays > weekends * 1.5) return 'weekday';
    if (weekends > weekdays * 1.5) return 'weekend';
    return 'mixed';
  }

  private calculateProfileAccuracy(interactions: any[]): number {
    // Simple heuristic: more interactions = higher accuracy potential
    const minInteractions = 50;
    return Math.min(1, interactions.length / minInteractions);
  }

  private calculateRecommendationFactors(
    post: PostWithUser,
    profile: UserBehaviorProfile,
    currentHour: number
  ) {
    const workoutTypeMatch = profile.likedWorkoutTypes[post.workout_type || 'general'] || 0;
    const timeRelevance = profile.engagementByTime[currentHour] || 0;
    const contentQuality = this.assessContentQuality(post);
    const novelty = this.calculateNovelty(post, profile);
    const socialConnection = this.assessSocialConnection(post, profile);

    return {
      workoutTypeMatch,
      timeRelevance,
      socialConnection,
      contentQuality,
      novelty,
    };
  }

  private calculateRecommendationScore(factors: any): number {
    const weights = {
      workoutTypeMatch: 0.25,
      timeRelevance: 0.15,
      socialConnection: 0.20,
      contentQuality: 0.25,
      novelty: 0.15,
    };

    return Object.entries(weights).reduce((score, [factor, weight]) => {
      return score + (factors[factor] * weight);
    }, 0);
  }

  private generateRecommendationReason(factors: any, post: PostWithUser): string {
    const reasons = [];
    
    if (factors.workoutTypeMatch > 0.7) {
      reasons.push(`You enjoy ${post.workout_type} workouts`);
    }
    if (factors.timeRelevance > 0.5) {
      reasons.push('Perfect timing for you');
    }
    if (factors.socialConnection > 0.5) {
      reasons.push('From someone in your network');
    }
    if (factors.contentQuality > 0.8) {
      reasons.push('High-quality content');
    }

    return reasons.slice(0, 2).join(' • ') || 'Personalized for you';
  }

  private calculateConfidence(factors: any, profile: UserBehaviorProfile): number {
    const avgFactor = Object.values(factors).reduce((a: any, b: any) => a + b, 0) / Object.keys(factors).length;
    const profileMaturity = Math.min(1, profile.totalInteractions / 100);
    
    return (avgFactor * 0.7) + (profileMaturity * 0.3);
  }

  private assessContentQuality(post: PostWithUser): number {
    let score = 0.5; // Base score
    
    if (post.media_url) score += 0.3;
    if (post.thumbnail_url) score += 0.1;
    if (post.content && post.content.length > 20) score += 0.1;
    
    return Math.min(1, score);
  }

  private calculateNovelty(post: PostWithUser, profile: UserBehaviorProfile): number {
    // Higher novelty for workout types user hasn't explored much
    const typeFrequency = profile.likedWorkoutTypes[post.workout_type || 'general'] || 0;
    return Math.max(0.1, 1 - typeFrequency);
  }

  private assessSocialConnection(post: PostWithUser, profile: UserBehaviorProfile): number {
    // Simplified social connection scoring
    return profile.friendInteractionRate;
  }

  private getDefaultProfile(): UserBehaviorProfile {
    return {
      likedWorkoutTypes: {},
      viewDurationByType: {},
      engagementByTime: {},
      preferredContentLength: 150,
      mediaTypePreference: 'mixed',
      fitnessLevelInteraction: {},
      friendInteractionRate: 0,
      commentToLikeRatio: 0,
      peakActivityHours: [9, 12, 18],
      weekdayVsWeekendPreference: 'mixed',
      profileAccuracy: 0.1,
      lastUpdated: Date.now(),
      totalInteractions: 0,
    };
  }

  private determinePreferredTimeOfDay(peakHours: number[]): string {
    const avgHour = peakHours.reduce((a, b) => a + b, 0) / peakHours.length;
    
    if (avgHour < 12) return 'morning';
    if (avgHour < 17) return 'afternoon';
    return 'evening';
  }

  private determineFitnessCompatibility(levelInteractions: { [level: string]: number }): 'similar' | 'diverse' | 'challenging' {
    const interactions = Object.values(levelInteractions);
    const maxInteraction = Math.max(...interactions);
    const diversity = interactions.filter(i => i > maxInteraction * 0.3).length;
    
    if (diversity >= 3) return 'diverse';
    if (maxInteraction > 0.7) return 'similar';
    return 'challenging';
  }

  private determineContentStyle(profile: UserBehaviorProfile): 'visual' | 'detailed' | 'concise' {
    if (profile.mediaTypePreference === 'photo') return 'visual';
    if (profile.preferredContentLength > 200) return 'detailed';
    return 'concise';
  }

  private determineSocialEngagement(profile: UserBehaviorProfile): 'high' | 'medium' | 'low' {
    const social = profile.friendInteractionRate + profile.commentToLikeRatio;
    
    if (social > 0.7) return 'high';
    if (social > 0.3) return 'medium';
    return 'low';
  }

  private determineDiscoveryPattern(profile: UserBehaviorProfile): 'explorative' | 'focused' | 'social' {
    const typeCount = Object.keys(profile.likedWorkoutTypes).length;
    const socialScore = profile.friendInteractionRate;
    
    if (socialScore > 0.6) return 'social';
    if (typeCount >= 5) return 'explorative';
    return 'focused';
  }
}

export const personalizationService = PersonalizationService.getInstance();