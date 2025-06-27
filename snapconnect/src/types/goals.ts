/**
 * Goal tracking types for SMART goal management and AI coaching integration
 */

// Goal status types
export type GoalStatus = 'active' | 'paused' | 'completed' | 'cancelled' | 'overdue';
export type GoalPriority = 'high' | 'medium' | 'low';
export type GoalCategory = 'fitness' | 'weight' | 'strength' | 'endurance' | 'flexibility' | 'nutrition' | 'wellness' | 'habit' | 'custom';
export type GoalType = 'outcome' | 'process' | 'performance';
export type DifficultyLevel = 'easy' | 'moderate' | 'challenging' | 'ambitious';

// Coaching types
export type CoachingFrequency = 'daily' | 'weekly' | 'biweekly' | 'milestone_based';
export type CoachingStyleOverride = 'gentle' | 'motivational' | 'data_driven' | 'holistic';
export type CelebrationPreference = 'private' | 'friends' | 'public' | 'none';

// Progress tracking types
export type ProgressLogType = 'manual' | 'auto_sync' | 'milestone' | 'correction';
export type DataSource = 'user_input' | 'healthkit' | 'app_tracking' | 'ai_estimate' | 'external_sync';

// Coaching message types
export type GoalMessageType = 'encouragement' | 'milestone_celebration' | 'course_correction' | 'strategy_suggestion' | 'obstacle_help' | 'check_in';
export type CoachingTone = 'motivational' | 'analytical' | 'supportive' | 'challenging';
export type MessageTrigger = 'progress_update' | 'missed_checkin' | 'milestone_reached' | 'goal_stalled' | 'user_request' | 'scheduled';
export type UserResponse = 'helpful' | 'not_helpful' | 'motivating' | 'overwhelming' | 'ignored';

// Main goal interface
export interface UserGoal {
  id: string;
  user_id: string;
  
  // Goal definition
  title: string;
  description?: string;
  category: GoalCategory;
  goal_type: GoalType;
  
  // SMART criteria
  specific_target: string;
  measurable_metric: string;
  target_value: number;
  target_unit?: string;
  
  // Timeline
  start_date: string; // ISO date string
  target_date: string; // ISO date string
  estimated_duration_days: number;
  
  // Progress
  current_value: number;
  progress_percentage: number;
  
  // Status and metadata
  status: GoalStatus;
  priority: GoalPriority;
  difficulty_level: DifficultyLevel;
  
  // Motivation and context
  why_important?: string;
  success_criteria?: string[];
  obstacles_anticipated?: string[];
  support_needed?: string[];
  
  // Coaching integration
  ai_coaching_enabled: boolean;
  coaching_frequency: CoachingFrequency;
  coaching_style_override?: CoachingStyleOverride;
  
  // Social features
  share_progress_publicly: boolean;
  accountability_buddy_id?: string;
  celebration_preference: CelebrationPreference;
  
  // Advanced features
  milestones: GoalMilestone[];
  rewards_system: GoalRewardsSystem;
  ai_context: Record<string, any>;
  related_goals?: string[];
  parent_goal_id?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  completed_at?: string;
  last_progress_update?: string;
}

// Goal milestone interface
export interface GoalMilestone {
  id: string;
  value: number;
  percentage: number;
  target_date?: string;
  title: string;
  description?: string;
  reward?: string;
  completed: boolean;
  completed_at?: string;
}

// Goal rewards system interface
export interface GoalRewardsSystem {
  enabled: boolean;
  milestone_rewards?: {
    [percentage: string]: string; // e.g., "25": "Buy new workout gear"
  };
  completion_reward?: string;
  point_system?: {
    points_per_update: number;
    bonus_points: Record<string, number>;
  };
}

// Goal progress log interface
export interface GoalProgressLog {
  id: string;
  goal_id: string;
  user_id: string;
  
  // Progress data
  recorded_value: number;
  previous_value?: number;
  change_amount: number;
  progress_percentage: number;
  
  // Context
  log_type: ProgressLogType;
  data_source: DataSource;
  notes?: string;
  mood_rating?: number; // 1-5 scale
  confidence_level?: number; // 1-5 scale
  
  // AI insights
  ai_generated_insights?: string[];
  coaching_triggered: boolean;
  
  // Media
  photo_urls?: string[];
  
  // Timestamps
  recorded_at: string;
  created_at: string;
}

// Goal coaching message interface
export interface GoalCoachingMessage {
  id: string;
  goal_id: string;
  user_id: string;
  
  // Message content
  message_text: string;
  message_type: GoalMessageType;
  coaching_tone?: CoachingTone;
  
  // Context and triggers
  triggered_by: MessageTrigger;
  goal_context: Record<string, any>;
  user_context: Record<string, any>;
  
  // User interaction
  user_response?: UserResponse;
  user_feedback?: string;
  led_to_action: boolean;
  
  // AI learning
  effectiveness_score?: number; // 0-1 scale
  
  // Timestamps
  created_at: string;
  responded_at?: string;
}

// Goal creation interface
export interface CreateGoalData {
  title: string;
  description?: string;
  category: GoalCategory;
  goal_type?: GoalType;
  
  // SMART criteria
  specific_target: string;
  measurable_metric: string;
  target_value: number;
  target_unit?: string;
  target_date: string;
  
  // Optional settings
  priority?: GoalPriority;
  difficulty_level?: DifficultyLevel;
  why_important?: string;
  success_criteria?: string[];
  obstacles_anticipated?: string[];
  support_needed?: string[];
  
  // Coaching preferences
  ai_coaching_enabled?: boolean;
  coaching_frequency?: CoachingFrequency;
  coaching_style_override?: CoachingStyleOverride;
  
  // Social settings
  share_progress_publicly?: boolean;
  celebration_preference?: CelebrationPreference;
  
  // Advanced features
  milestones?: Omit<GoalMilestone, 'id' | 'completed' | 'completed_at'>[];
  rewards_system?: GoalRewardsSystem;
  parent_goal_id?: string;
}

// Goal update interface
export interface UpdateGoalData {
  title?: string;
  description?: string;
  target_value?: number;
  target_date?: string;
  current_value?: number;
  status?: GoalStatus;
  priority?: GoalPriority;
  why_important?: string;
  success_criteria?: string[];
  obstacles_anticipated?: string[];
  support_needed?: string[];
  ai_coaching_enabled?: boolean;
  coaching_frequency?: CoachingFrequency;
  coaching_style_override?: CoachingStyleOverride;
  share_progress_publicly?: boolean;
  celebration_preference?: CelebrationPreference;
  milestones?: GoalMilestone[];
  rewards_system?: GoalRewardsSystem;
}

// Goal summary for dashboard
export interface GoalSummary {
  id: string;
  title: string;
  category: GoalCategory;
  target_date: string;
  days_remaining: number;
  progress_percentage: number;
  current_value: number;
  target_value: number;
  target_unit?: string;
  priority: GoalPriority;
  last_progress_date?: string;
  coaching_needed: boolean;
  status: GoalStatus;
}

// Goal insights for AI coaching
export interface GoalInsights {
  active_goals_count: number;
  overdue_goals_count: number;
  goals_needing_attention: number;
  average_progress: number;
  recent_progress: Array<{
    goal_title: string;
    category: GoalCategory;
    progress_percentage: number;
    days_remaining: number;
    last_update?: string;
  }>;
  goal_categories: GoalCategory[];
  upcoming_deadlines: Array<{
    goal_title: string;
    target_date: string;
    days_remaining: number;
    progress_percentage: number;
  }>;
}

// Goal analytics for user insights
export interface GoalAnalytics {
  completion_rate: number;
  average_time_to_complete: number; // in days
  most_successful_category: GoalCategory;
  streak_data: {
    current_streak: number;
    longest_streak: number;
    last_achievement_date?: string;
  };
  progress_trends: {
    weekly_average_progress: number;
    monthly_goals_created: number;
    monthly_goals_completed: number;
  };
  coaching_effectiveness: {
    messages_sent: number;
    messages_helpful: number;
    actions_taken: number;
  };
}

// Utility functions
export const getGoalStatusColor = (status: GoalStatus): string => {
  switch (status) {
    case 'active': return '#10B981'; // green
    case 'paused': return '#F59E0B'; // orange
    case 'completed': return '#059669'; // dark green
    case 'cancelled': return '#6B7280'; // gray
    case 'overdue': return '#EF4444'; // red
    default: return '#6B7280';
  }
};

export const getGoalStatusEmoji = (status: GoalStatus): string => {
  switch (status) {
    case 'active': return '🎯';
    case 'paused': return '⏸️';
    case 'completed': return '✅';
    case 'cancelled': return '❌';
    case 'overdue': return '🚨';
    default: return '🎯';
  }
};

export const getCategoryEmoji = (category: GoalCategory): string => {
  switch (category) {
    case 'fitness': return '💪';
    case 'weight': return '⚖️';
    case 'strength': return '🏋️';
    case 'endurance': return '🏃';
    case 'flexibility': return '🧘';
    case 'nutrition': return '🥗';
    case 'wellness': return '✨';
    case 'habit': return '📅';
    case 'custom': return '🎯';
    default: return '🎯';
  }
};

export const getDaysRemaining = (targetDate: string): number => {
  const target = new Date(targetDate);
  const today = new Date();
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const isGoalOverdue = (goal: UserGoal): boolean => {
  return goal.status === 'active' && getDaysRemaining(goal.target_date) < 0;
};

export const getProgressColor = (percentage: number): string => {
  if (percentage >= 90) return '#059669'; // dark green
  if (percentage >= 70) return '#10B981'; // green
  if (percentage >= 50) return '#F59E0B'; // orange
  if (percentage >= 25) return '#EF4444'; // red
  return '#6B7280'; // gray
};

export const calculateGoalStreak = (goals: UserGoal[]): number => {
  const completedGoals = goals
    .filter(goal => goal.status === 'completed')
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());
  
  let streak = 0;
  let currentDate = new Date();
  
  for (const goal of completedGoals) {
    const completedDate = new Date(goal.completed_at!);
    const daysDiff = Math.floor((currentDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 7) { // Within a week
      streak++;
      currentDate = completedDate;
    } else {
      break;
    }
  }
  
  return streak;
};