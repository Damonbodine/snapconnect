/**
 * User Types with AI Extensions
 * Extends existing UserProfile interface to support AI user functionality
 */

import { PersonalityTraits, AIResponseStyle, PostingSchedule, ConversationContext } from './aiPersonality';

// Base user profile interface (matches authStore.ts)
export interface BaseUserProfile {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  fitness_level: 'beginner' | 'intermediate' | 'advanced';
  workout_intensity: 'chill' | 'moderate' | 'intense';
  goals: string[];
  dietary_preferences: string[];
  workout_frequency: number;
  
  // Enhanced health baseline fields
  current_weight_kg?: number;
  target_weight_kg?: number;
  height_cm?: number;
  daily_step_goal?: number;
  weekly_workout_goal?: number;
  
  // Lifestyle and schedule fields
  preferred_workout_times?: string[];
  available_equipment?: string[];
  injuries_limitations?: string;
  sleep_schedule?: {
    bedtime?: string;
    wakeup?: string;
    sleep_goal_hours?: number;
  };
  motivation_style?: 'competitive' | 'supportive' | 'analytical' | 'fun';
  
  // Activity and experience fields
  current_activity_level?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
  fitness_experience_years?: number;
  preferred_workout_duration?: number;
  
  // Enhanced nutrition fields
  meal_prep_preference?: 'none' | 'simple' | 'moderate' | 'advanced';
  cooking_skill_level?: 'beginner' | 'intermediate' | 'advanced';
  food_allergies?: string[];
  nutrition_goals?: string[];
  
  // Wellness and mental health
  stress_level?: number;
  energy_level?: number;
  wellness_goals?: string[];
  
  // Social and accountability
  accountability_preference?: 'none' | 'app_only' | 'friends' | 'coach' | 'community';
  social_sharing_comfort?: 'private' | 'friends_only' | 'selective' | 'public';
  
  // Time and constraints
  available_workout_days?: string[];
  workout_time_constraints?: {
    max_session_minutes?: number;
    prefer_short_sessions?: boolean;
  };
  
  // Coaching preferences
  coaching_style?: 'gentle' | 'firm' | 'motivational' | 'educational';
  feedback_frequency?: 'real_time' | 'daily' | 'weekly' | 'minimal';
  progress_tracking_detail?: 'basic' | 'detailed' | 'comprehensive';
  
  // Motivational context
  primary_motivation?: string;
  biggest_fitness_challenge?: string;
  previous_fitness_successes?: string;
  location_type?: 'urban' | 'suburban' | 'rural';
  
  // Onboarding tracking
  onboarding_completed_steps?: string[];
  onboarding_completion_date?: string;
  profile_setup_phase?: 'basic' | 'enhanced' | 'complete';
}

// Extended user profile with AI capabilities
export interface UserProfile extends BaseUserProfile {
  // AI system fields
  is_mock_user?: boolean;
  personality_traits?: PersonalityTraits;
  ai_response_style?: AIResponseStyle;
  posting_schedule?: PostingSchedule;
  conversation_context?: ConversationContext;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

// AI-specific user profile (guaranteed to have AI fields)
export interface AIUserProfile extends UserProfile {
  is_mock_user: true;
  personality_traits: PersonalityTraits;
  ai_response_style: AIResponseStyle;
  posting_schedule: PostingSchedule;
  conversation_context: ConversationContext;
}

// Real user profile (no AI fields)
export interface RealUserProfile extends UserProfile {
  is_mock_user?: false;
  personality_traits?: never;
  ai_response_style?: never;
  posting_schedule?: never;
  conversation_context?: never;
}

// User creation interfaces
export interface CreateUserProfileData {
  username: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  fitness_level: 'beginner' | 'intermediate' | 'advanced';
  workout_intensity?: 'chill' | 'moderate' | 'intense';
  goals: string[];
  dietary_preferences?: string[];
  workout_frequency?: number;
  
  // Enhanced profile data (optional during creation)
  current_weight_kg?: number;
  target_weight_kg?: number;
  height_cm?: number;
  daily_step_goal?: number;
  weekly_workout_goal?: number;
  preferred_workout_times?: string[];
  available_equipment?: string[];
  injuries_limitations?: string;
  sleep_schedule?: {
    bedtime?: string;
    wakeup?: string;
    sleep_goal_hours?: number;
  };
  motivation_style?: 'competitive' | 'supportive' | 'analytical' | 'fun';
  current_activity_level?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
  fitness_experience_years?: number;
  preferred_workout_duration?: number;
  meal_prep_preference?: 'none' | 'simple' | 'moderate' | 'advanced';
  cooking_skill_level?: 'beginner' | 'intermediate' | 'advanced';
  food_allergies?: string[];
  nutrition_goals?: string[];
  stress_level?: number;
  energy_level?: number;
  wellness_goals?: string[];
  accountability_preference?: 'none' | 'app_only' | 'friends' | 'coach' | 'community';
  social_sharing_comfort?: 'private' | 'friends_only' | 'selective' | 'public';
  available_workout_days?: string[];
  workout_time_constraints?: {
    max_session_minutes?: number;
    prefer_short_sessions?: boolean;
  };
  coaching_style?: 'gentle' | 'firm' | 'motivational' | 'educational';
  feedback_frequency?: 'real_time' | 'daily' | 'weekly' | 'minimal';
  progress_tracking_detail?: 'basic' | 'detailed' | 'comprehensive';
  primary_motivation?: string;
  biggest_fitness_challenge?: string;
  previous_fitness_successes?: string;
  location_type?: 'urban' | 'suburban' | 'rural';
  onboarding_completed_steps?: string[];
  profile_setup_phase?: 'basic' | 'enhanced' | 'complete';
  
  // Enhanced onboarding fields
  primary_goal?: string;
  smart_goal_target?: string;
  smart_goal_value?: string;
  smart_goal_unit?: string;
  smart_goal_timeframe?: string;
  smart_goal_why?: string;
  smart_goal_target_date?: string;
  exercise_preferences?: string[];
  has_equipment?: boolean;
  equipment_list?: string;
  privacy_level?: 'private' | 'friends' | 'public';
  measurement_system?: 'metric' | 'imperial';
  timezone?: string;
}

export interface CreateAIUserData extends CreateUserProfileData {
  personality_traits: PersonalityTraits;
  ai_response_style: AIResponseStyle;
  posting_schedule: PostingSchedule;
  conversation_context?: ConversationContext;
}

// Database user record (includes all possible fields)
export interface DatabaseUserRecord {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  fitness_level: 'beginner' | 'intermediate' | 'advanced';
  workout_intensity: 'chill' | 'moderate' | 'intense';
  goals: string[];
  dietary_preferences: string[];
  workout_frequency: number;
  
  // Enhanced health and lifestyle fields
  current_weight_kg?: number | null;
  target_weight_kg?: number | null;
  height_cm?: number | null;
  daily_step_goal?: number | null;
  weekly_workout_goal?: number | null;
  preferred_workout_times?: string[] | null;
  available_equipment?: string[] | null;
  injuries_limitations?: string | null;
  sleep_schedule?: Record<string, any> | null;
  motivation_style?: string | null;
  current_activity_level?: string | null;
  fitness_experience_years?: number | null;
  preferred_workout_duration?: number | null;
  meal_prep_preference?: string | null;
  cooking_skill_level?: string | null;
  food_allergies?: string[] | null;
  nutrition_goals?: string[] | null;
  stress_level?: number | null;
  energy_level?: number | null;
  wellness_goals?: string[] | null;
  accountability_preference?: string | null;
  social_sharing_comfort?: string | null;
  available_workout_days?: string[] | null;
  workout_time_constraints?: Record<string, any> | null;
  coaching_style?: string | null;
  feedback_frequency?: string | null;
  progress_tracking_detail?: string | null;
  primary_motivation?: string | null;
  biggest_fitness_challenge?: string | null;
  previous_fitness_successes?: string | null;
  location_type?: string | null;
  onboarding_completed_steps?: string[] | null;
  onboarding_completion_date?: string | null;
  profile_setup_phase?: string | null;
  
  // AI system fields
  is_mock_user: boolean;
  personality_traits: Record<string, any> | null; // JSONB field
  ai_response_style: Record<string, any> | null;   // JSONB field
  posting_schedule: Record<string, any> | null;    // JSONB field
  conversation_context: Record<string, any> | null; // JSONB field
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// User with post information (for feed displays)
export interface UserWithPostInfo extends UserProfile {
  // Post-related fields for discover feed
  total_posts?: number;
  last_post_date?: string;
  is_friend?: boolean;
  friend_status?: 'pending' | 'accepted' | 'blocked';
}

// Friend relationship information
export interface FriendshipInfo {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
}

export interface UserWithFriendship extends UserProfile {
  friendship?: FriendshipInfo;
}

// Type guards
export const isAIUser = (user: UserProfile | null | undefined): user is AIUserProfile => {
  return user?.is_mock_user === true;
};

export const isRealUser = (user: UserProfile | null | undefined): user is RealUserProfile => {
  return user?.is_mock_user !== true;
};

export const hasPersonalityTraits = (user: UserProfile | null | undefined): boolean => {
  return !!(user?.personality_traits && typeof user.personality_traits === 'object');
};

export const hasAIResponseStyle = (user: UserProfile | null | undefined): boolean => {
  return !!(user?.ai_response_style && typeof user.ai_response_style === 'object');
};

// Utility functions
export const getUserDisplayName = (user: UserProfile | null | undefined): string => {
  if (!user) return 'Unknown User';
  return user.full_name || user.username || 'Unknown User';
};

export const getUserInitials = (user: UserProfile | null | undefined): string => {
  if (!user) return 'U';
  
  const name = user.full_name || user.username;
  if (!name) return 'U';
  
  const words = name.split(' ');
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  
  return (words[0].charAt(0) + (words[1]?.charAt(0) || '')).toUpperCase();
};

export const formatUserGoals = (goals: string[]): string => {
  if (!goals || goals.length === 0) return 'No goals set';
  if (goals.length === 1) return goals[0];
  if (goals.length === 2) return `${goals[0]} and ${goals[1]}`;
  return `${goals[0]}, ${goals[1]} and ${goals.length - 2} more`;
};

export const getFitnessLevelColor = (level: 'beginner' | 'intermediate' | 'advanced'): string => {
  switch (level) {
    case 'beginner': return '#10B981'; // green
    case 'intermediate': return '#F59E0B'; // orange  
    case 'advanced': return '#EF4444'; // red
    default: return '#6B7280'; // gray
  }
};

export const getFitnessLevelEmoji = (level: 'beginner' | 'intermediate' | 'advanced'): string => {
  switch (level) {
    case 'beginner': return '🌱';
    case 'intermediate': return '🔥';
    case 'advanced': return '⚡';
    default: return '💪';
  }
};

export const getWorkoutIntensityColor = (intensity: 'chill' | 'moderate' | 'intense'): string => {
  switch (intensity) {
    case 'chill': return '#10B981'; // green
    case 'moderate': return '#F59E0B'; // orange
    case 'intense': return '#EF4444'; // red
    default: return '#6B7280'; // gray
  }
};

export const getWorkoutIntensityEmoji = (intensity: 'chill' | 'moderate' | 'intense'): string => {
  switch (intensity) {
    case 'chill': return '🧘';
    case 'moderate': return '🔥';
    case 'intense': return '⚡';
    default: return '💪';
  }
};

export const getWorkoutIntensityLabel = (intensity: 'chill' | 'moderate' | 'intense'): string => {
  switch (intensity) {
    case 'chill': return 'Chill vibes';
    case 'moderate': return 'Moderate intensity';
    case 'intense': return 'High intensity';
    default: return 'Moderate intensity';
  }
};

// Database transformation utilities
export const transformDatabaseUserToProfile = (dbUser: DatabaseUserRecord): UserProfile => {
  return {
    id: dbUser.id,
    email: dbUser.email,
    username: dbUser.username,
    full_name: dbUser.full_name,
    avatar_url: dbUser.avatar_url,
    bio: dbUser.bio,
    city: dbUser.city,
    fitness_level: dbUser.fitness_level,
    workout_intensity: dbUser.workout_intensity,
    goals: dbUser.goals,
    dietary_preferences: dbUser.dietary_preferences,
    workout_frequency: dbUser.workout_frequency,
    
    // Enhanced health and lifestyle fields
    current_weight_kg: dbUser.current_weight_kg || undefined,
    target_weight_kg: dbUser.target_weight_kg || undefined,
    height_cm: dbUser.height_cm || undefined,
    daily_step_goal: dbUser.daily_step_goal || undefined,
    weekly_workout_goal: dbUser.weekly_workout_goal || undefined,
    preferred_workout_times: dbUser.preferred_workout_times || undefined,
    available_equipment: dbUser.available_equipment || undefined,
    injuries_limitations: dbUser.injuries_limitations || undefined,
    sleep_schedule: dbUser.sleep_schedule as UserProfile['sleep_schedule'] || undefined,
    motivation_style: dbUser.motivation_style as UserProfile['motivation_style'] || undefined,
    current_activity_level: dbUser.current_activity_level as UserProfile['current_activity_level'] || undefined,
    fitness_experience_years: dbUser.fitness_experience_years || undefined,
    preferred_workout_duration: dbUser.preferred_workout_duration || undefined,
    meal_prep_preference: dbUser.meal_prep_preference as UserProfile['meal_prep_preference'] || undefined,
    cooking_skill_level: dbUser.cooking_skill_level as UserProfile['cooking_skill_level'] || undefined,
    food_allergies: dbUser.food_allergies || undefined,
    nutrition_goals: dbUser.nutrition_goals || undefined,
    stress_level: dbUser.stress_level || undefined,
    energy_level: dbUser.energy_level || undefined,
    wellness_goals: dbUser.wellness_goals || undefined,
    accountability_preference: dbUser.accountability_preference as UserProfile['accountability_preference'] || undefined,
    social_sharing_comfort: dbUser.social_sharing_comfort as UserProfile['social_sharing_comfort'] || undefined,
    available_workout_days: dbUser.available_workout_days || undefined,
    workout_time_constraints: dbUser.workout_time_constraints as UserProfile['workout_time_constraints'] || undefined,
    coaching_style: dbUser.coaching_style as UserProfile['coaching_style'] || undefined,
    feedback_frequency: dbUser.feedback_frequency as UserProfile['feedback_frequency'] || undefined,
    progress_tracking_detail: dbUser.progress_tracking_detail as UserProfile['progress_tracking_detail'] || undefined,
    primary_motivation: dbUser.primary_motivation || undefined,
    biggest_fitness_challenge: dbUser.biggest_fitness_challenge || undefined,
    previous_fitness_successes: dbUser.previous_fitness_successes || undefined,
    location_type: dbUser.location_type as UserProfile['location_type'] || undefined,
    onboarding_completed_steps: dbUser.onboarding_completed_steps || undefined,
    onboarding_completion_date: dbUser.onboarding_completion_date || undefined,
    profile_setup_phase: dbUser.profile_setup_phase as UserProfile['profile_setup_phase'] || undefined,
    
    // AI system fields
    is_mock_user: dbUser.is_mock_user,
    personality_traits: dbUser.personality_traits as PersonalityTraits || undefined,
    ai_response_style: dbUser.ai_response_style as AIResponseStyle || undefined,
    posting_schedule: dbUser.posting_schedule as PostingSchedule || undefined,
    conversation_context: dbUser.conversation_context as ConversationContext || undefined,
    
    // Timestamps
    created_at: dbUser.created_at,
    updated_at: dbUser.updated_at,
  };
};

export const transformProfileToDatabaseUser = (profile: UserProfile): Omit<DatabaseUserRecord, 'created_at' | 'updated_at'> => {
  return {
    id: profile.id,
    email: profile.email,
    username: profile.username,
    full_name: profile.full_name || null,
    avatar_url: profile.avatar_url || null,
    bio: profile.bio || null,
    city: profile.city || null,
    fitness_level: profile.fitness_level,
    workout_intensity: profile.workout_intensity,
    goals: profile.goals,
    dietary_preferences: profile.dietary_preferences,
    workout_frequency: profile.workout_frequency,
    is_mock_user: profile.is_mock_user || false,
    personality_traits: profile.personality_traits || null,
    ai_response_style: profile.ai_response_style || null,
    posting_schedule: profile.posting_schedule || null,
    conversation_context: profile.conversation_context || null,
  };
};