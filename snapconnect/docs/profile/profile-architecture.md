# Profile System Architecture

## 🏗️ System Overview

The SnapConnect profile system is built using a modern React Native architecture with TypeScript, Zustand for state management, and Supabase for backend services.

## 📊 Data Flow Architecture

```
Database (Supabase)
       ↓
   authStore (Zustand)
       ↓
   React Components
       ↓
   User Interface
```

## 🗄️ Database Schema

### Users Table Structure

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT CHECK (char_length(bio) <= 150),
  city TEXT,
  fitness_level TEXT CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')) NOT NULL,
  workout_intensity TEXT CHECK (workout_intensity IN ('chill', 'moderate', 'intense')) DEFAULT 'moderate',
  goals TEXT[] DEFAULT '{}',
  dietary_preferences TEXT[] DEFAULT '{}',
  workout_frequency INTEGER DEFAULT 3,
  is_mock_user BOOLEAN DEFAULT FALSE,
  personality_traits JSONB,
  ai_response_style JSONB,
  posting_schedule JSONB,
  conversation_context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Key Indexes
- `idx_users_city` - For location-based queries
- `idx_users_bio` - GIN index for text search
- `idx_users_workout_intensity` - For workout partner matching

## 🔄 State Management

### AuthStore Structure
```typescript
interface AuthStore {
  // Core state
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isOnboardingComplete: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  createProfile: (profileData: CreateUserProfileData) => Promise<void>;
}
```

### Data Transformation Layer
- `transformDatabaseUserToProfile()` - Converts DB records to app types
- `transformProfileToDatabaseUser()` - Converts app types to DB format
- Type guards: `isAIUser()`, `isRealUser()`, etc.

## 🎨 Component Architecture

### Profile Screen Hierarchy
```
ProfileScreen
├── Avatar Section
│   ├── Image/Placeholder
│   ├── Username
│   ├── Bio (if exists)
│   └── Edit Profile Button
├── Profile Info Card
│   ├── Full Name
│   ├── Email
│   ├── City (if exists)
│   ├── Fitness Level
│   ├── Workout Intensity
│   └── Goals
├── Friends Preview Section
│   ├── Friend Avatars (overlapping)
│   ├── Friend Count
│   └── View All Button
├── Friend Requests (if any)
└── Sign Out Button
```

### Friends Screen Architecture
```
FriendsScreen
├── Header
│   ├── Back Button
│   ├── Title + Count
│   └── Spacer
├── Pending Requests Section (if any)
│   └── Request Cards
│       ├── Avatar
│       ├── User Info
│       └── Accept/Decline Buttons
└── Friends List
    └── Friend Cards
        ├── Avatar
        ├── User Info (name, bio, stats)
        └── Chevron
```

## 🔐 Authentication Flow

1. **Sign In/Up** → Sets user in authStore
2. **Profile Fetch** → Fetches and transforms profile data
3. **Session Management** → Handles token refresh automatically
4. **Profile Updates** → Optimistic updates with rollback on error

## 🎯 Profile Editing Flow

1. **Edit Button Pressed** → Navigate to `/edit-profile`
2. **Form Initialization** → Pre-populate with current profile data
3. **User Input** → Real-time validation (character limits, etc.)
4. **Save Action** → 
   - Validate all fields
   - Create update object (only changed fields)
   - Call `updateProfile()` in authStore
   - Show success/error feedback
   - Navigate back to profile

## 🤝 Friends System Integration

### Friends Store Integration
```typescript
// Friends data flows through separate store
const { friends, fetchFriends } = useFriendsStore();

// Profile screen shows preview
<FriendsPreview friends={friends.slice(0, 3)} total={friends.length} />

// Friends screen shows full list
<FriendsList friends={friends} />
```

## 🔍 Search & Discovery

### Profile Matching Capabilities
- **Fitness Level Matching**: Find users at similar skill levels
- **Workout Intensity Matching**: Connect with compatible energy levels
- **Location-Based Discovery**: Find local workout partners
- **Interest Alignment**: Match based on goals and preferences

### Indexing Strategy
- City index for location queries
- Bio GIN index for text search
- Workout intensity index for partner matching
- Composite indexes for complex queries

## 🛡️ Security & Privacy

### Data Protection
- Row Level Security (RLS) policies on users table
- Avatar uploads through Supabase Storage with authentication
- Profile updates require user ownership verification
- No sensitive data exposure in public APIs

### Input Validation
- Bio character limit (150 chars) enforced at DB and app level
- Enum constraints for fitness_level and workout_intensity
- Username uniqueness enforced at DB level
- XSS protection through proper text handling

## 🚀 Performance Considerations

### Optimization Strategies
- **Lazy Loading**: Friends list loads on demand
- **Memoization**: Profile cards memoized to prevent re-renders
- **Image Optimization**: Avatar images resized and compressed
- **Efficient Queries**: Only fetch necessary profile fields
- **Caching**: Profile data cached in Zustand store

### Monitoring Points
- Profile update latency
- Friends list load time
- Avatar upload success rate
- Search query performance

## 🔧 Development Guidelines

### Adding New Profile Fields
1. Create database migration with proper constraints
2. Update TypeScript interfaces in `/src/types/user.ts`
3. Add to transformation functions
4. Update UI components
5. Add to edit profile form
6. Test validation and edge cases

### Component Development
- Use functional components with TypeScript
- Leverage custom hooks for reusable logic
- Follow gradient-based design system
- Handle loading and error states
- Implement proper accessibility

### State Updates
- Use optimistic updates for better UX
- Implement proper error handling and rollback
- Validate data before state updates
- Use TypeScript for type safety

---

*This architecture supports the current feature set and is designed to scale with future profile enhancements.*