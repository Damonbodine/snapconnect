# Profile TypeScript Types Reference

This document provides a comprehensive reference for all TypeScript types and interfaces related to the profile system.

## 🏗️ Core Profile Interfaces

### BaseUserProfile
The foundational interface containing essential user information.

```typescript
export interface BaseUserProfile {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;                    // 150 character limit
  city?: string;                   // Location for local connections
  fitness_level: 'beginner' | 'intermediate' | 'advanced';
  workout_intensity: 'chill' | 'moderate' | 'intense';
  goals: string[];                 // Fitness objectives
  dietary_preferences: string[];   // Dietary restrictions/preferences
  workout_frequency: number;       // Times per week
}
```

### UserProfile
Extended interface supporting AI functionality and metadata.

```typescript
export interface UserProfile extends BaseUserProfile {
  // AI system fields (for AI-generated users)
  is_mock_user?: boolean;
  personality_traits?: PersonalityTraits;
  ai_response_style?: AIResponseStyle;
  posting_schedule?: PostingSchedule;
  conversation_context?: ConversationContext;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}
```

## 🎯 Specialized Profile Types

### AIUserProfile
Type for AI-generated users with guaranteed AI fields.

```typescript
export interface AIUserProfile extends UserProfile {
  is_mock_user: true;
  personality_traits: PersonalityTraits;
  ai_response_style: AIResponseStyle;
  posting_schedule: PostingSchedule;
  conversation_context: ConversationContext;
}
```

### RealUserProfile
Type for real users without AI fields.

```typescript
export interface RealUserProfile extends UserProfile {
  is_mock_user?: false;
  personality_traits?: never;
  ai_response_style?: never;
  posting_schedule?: never;
  conversation_context?: never;
}
```

## 🔧 Creation & Update Interfaces

### CreateUserProfileData
Interface for creating new user profiles.

```typescript
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
  workout_frequency: number;
}
```

### CreateAIUserData
Extended creation interface for AI users.

```typescript
export interface CreateAIUserData extends CreateUserProfileData {
  personality_traits: PersonalityTraits;
  ai_response_style: AIResponseStyle;
  posting_schedule: PostingSchedule;
  conversation_context?: ConversationContext;
}
```

## 🗄️ Database Types

### DatabaseUserRecord
Direct representation of database user record.

```typescript
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
  is_mock_user: boolean;
  personality_traits: Record<string, any> | null; // JSONB field
  ai_response_style: Record<string, any> | null;   // JSONB field
  posting_schedule: Record<string, any> | null;    // JSONB field
  conversation_context: Record<string, any> | null; // JSONB field
  created_at: string;
  updated_at: string;
}
```

## 🤝 Social Features Types

### UserWithPostInfo
User profile enhanced with post-related information for feeds.

```typescript
export interface UserWithPostInfo extends UserProfile {
  total_posts?: number;
  last_post_date?: string;
  is_friend?: boolean;
  friend_status?: 'pending' | 'accepted' | 'blocked';
}
```

### FriendshipInfo
Information about friend relationships.

```typescript
export interface FriendshipInfo {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
}
```

### UserWithFriendship
User profile with friendship context.

```typescript
export interface UserWithFriendship extends UserProfile {
  friendship?: FriendshipInfo;
}
```

## 🔍 Type Guards

Utility functions for runtime type checking.

```typescript
// Check if user is AI-generated
export const isAIUser = (user: UserProfile | null | undefined): user is AIUserProfile => {
  return user?.is_mock_user === true;
};

// Check if user is real person
export const isRealUser = (user: UserProfile | null | undefined): user is RealUserProfile => {
  return user?.is_mock_user !== true;
};

// Check if user has personality traits
export const hasPersonalityTraits = (user: UserProfile | null | undefined): boolean => {
  return !!(user?.personality_traits && typeof user.personality_traits === 'object');
};

// Check if user has AI response style
export const hasAIResponseStyle = (user: UserProfile | null | undefined): boolean => {
  return !!(user?.ai_response_style && typeof user.ai_response_style === 'object');
};
```

## 🎨 Utility Functions

### Display Helpers
```typescript
// Get user's display name
export const getUserDisplayName = (user: UserProfile | null | undefined): string => {
  if (!user) return 'Unknown User';
  return user.full_name || user.username || 'Unknown User';
};

// Get user initials for avatar fallback
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

// Format goals list for display
export const formatUserGoals = (goals: string[]): string => {
  if (!goals || goals.length === 0) return 'No goals set';
  if (goals.length === 1) return goals[0];
  if (goals.length === 2) return `${goals[0]} and ${goals[1]}`;
  return `${goals[0]}, ${goals[1]} and ${goals.length - 2} more`;
};
```

### Fitness Level Utilities
```typescript
// Get color for fitness level
export const getFitnessLevelColor = (level: 'beginner' | 'intermediate' | 'advanced'): string => {
  switch (level) {
    case 'beginner': return '#10B981'; // green
    case 'intermediate': return '#F59E0B'; // orange  
    case 'advanced': return '#EF4444'; // red
    default: return '#6B7280'; // gray
  }
};

// Get emoji for fitness level
export const getFitnessLevelEmoji = (level: 'beginner' | 'intermediate' | 'advanced'): string => {
  switch (level) {
    case 'beginner': return '🌱';
    case 'intermediate': return '🔥';
    case 'advanced': return '⚡';
    default: return '💪';
  }
};
```

### Workout Intensity Utilities
```typescript
// Get color for workout intensity
export const getWorkoutIntensityColor = (intensity: 'chill' | 'moderate' | 'intense'): string => {
  switch (intensity) {
    case 'chill': return '#10B981'; // green
    case 'moderate': return '#F59E0B'; // orange
    case 'intense': return '#EF4444'; // red
    default: return '#6B7280'; // gray
  }
};

// Get emoji for workout intensity
export const getWorkoutIntensityEmoji = (intensity: 'chill' | 'moderate' | 'intense'): string => {
  switch (intensity) {
    case 'chill': return '🧘';
    case 'moderate': return '🔥';
    case 'intense': return '⚡';
    default: return '💪';
  }
};

// Get label for workout intensity
export const getWorkoutIntensityLabel = (intensity: 'chill' | 'moderate' | 'intense'): string => {
  switch (intensity) {
    case 'chill': return 'Chill vibes';
    case 'moderate': return 'Moderate intensity';
    case 'intense': return 'High intensity';
    default: return 'Moderate intensity';
  }
};
```

## 🔄 Data Transformation

### Database Transformation Functions
```typescript
// Convert database record to UserProfile
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
    is_mock_user: dbUser.is_mock_user,
    personality_traits: dbUser.personality_traits as PersonalityTraits || undefined,
    ai_response_style: dbUser.ai_response_style as AIResponseStyle || undefined,
    posting_schedule: dbUser.posting_schedule as PostingSchedule || undefined,
    conversation_context: dbUser.conversation_context as ConversationContext || undefined,
    created_at: dbUser.created_at,
    updated_at: dbUser.updated_at,
  };
};

// Convert UserProfile to database record format
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
```

## 📊 Enum Types

### Fitness Levels
```typescript
type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
```
- **beginner**: New to fitness, learning basics
- **intermediate**: Regular exerciser, some experience
- **advanced**: Experienced athlete, competitive level

### Workout Intensity
```typescript
type WorkoutIntensity = 'chill' | 'moderate' | 'intense';
```
- **chill**: Relaxed pace, focus on form and flexibility
- **moderate**: Balanced approach, steady progress
- **intense**: High energy, pushing limits, maximum effort

### Friendship Status
```typescript
type FriendshipStatus = 'pending' | 'accepted' | 'blocked';
```
- **pending**: Friend request sent, awaiting response
- **accepted**: Active friendship
- **blocked**: User blocked, no interaction allowed

## 🔧 Usage Examples

### Creating a New Profile
```typescript
const newProfile: CreateUserProfileData = {
  username: 'fitnessfan123',
  full_name: 'Jane Smith',
  bio: 'Morning runner, yoga enthusiast 🧘‍♀️',
  city: 'San Francisco',
  fitness_level: 'intermediate',
  workout_intensity: 'moderate',
  goals: ['Weight Loss', 'Marathon Training'],
  dietary_preferences: ['Vegetarian'],
  workout_frequency: 5
};
```

### Type-Safe Profile Updates
```typescript
const updates: Partial<UserProfile> = {
  bio: 'New fitness motto: consistency is key!',
  workout_intensity: 'intense',
  city: 'New York'
};

await updateProfile(updates);
```

### Using Type Guards
```typescript
const handleUser = (user: UserProfile) => {
  if (isAIUser(user)) {
    // TypeScript knows this is AIUserProfile
    console.log(user.personality_traits.motivation_level);
  } else {
    // TypeScript knows this is RealUserProfile
    console.log('Real user:', user.username);
  }
};
```

---

*This type system ensures type safety throughout the profile system while supporting both real users and AI-generated content.*