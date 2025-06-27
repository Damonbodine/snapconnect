# Profile System Documentation

This directory contains all documentation related to the user profile system in SnapConnect.

## 📁 Directory Structure

```
docs/profile/
├── README.md                    # This overview file
├── PROFILE_ENHANCEMENTS.md      # Recent enhancement sprint documentation
├── profile-architecture.md     # Technical architecture overview
├── profile-components.md        # UI components documentation
├── profile-types.md            # TypeScript types reference
└── profile-flows.md            # User flows and interactions
```

## 🎯 Profile System Overview

The SnapConnect profile system enables users to create rich, fitness-focused profiles that facilitate connections and workout partnerships. The system includes:

### Core Profile Data
- **Basic Info**: Username, full name, email, avatar
- **Location**: City for local connections
- **Bio**: 150-character fitness motto/tagline
- **Fitness Details**: Level (beginner/intermediate/advanced), workout intensity preference
- **Goals**: Fitness objectives and dietary preferences
- **Social**: Friends list, workout frequency

### Key Features
- **Friends Management**: Dedicated friends page with Instagram-style UI
- **Profile Editing**: Clean interface for updating profile information
- **Workout Matching**: Intensity preferences for finding compatible partners
- **Local Discovery**: City-based connections for events and meetups

## 🔗 Related Code Files

### Core Files
- `/src/types/user.ts` - TypeScript definitions and utilities
- `/src/stores/authStore.ts` - Profile state management
- `/src/stores/friendsStore.ts` - Friends functionality

### UI Components
- `/app/(tabs)/profile.tsx` - Main profile screen
- `/app/friends.tsx` - Dedicated friends page
- `/app/edit-profile.tsx` - Profile editing interface
- `/app/user/[userId].tsx` - Individual user profile view

### Database
- `/supabase/migrations/001_initial_schema.sql` - Initial users table
- `/supabase/migrations/012_add_user_city_field.sql` - City functionality
- `/supabase/migrations/013_add_user_bio_field.sql` - Bio system
- `/supabase/migrations/014_add_workout_intensity_field.sql` - Intensity preferences

## 📚 Documentation Index

1. **[Profile Enhancements](./PROFILE_ENHANCEMENTS.md)** - Recent sprint adding friends page, city, bio, and workout intensity
2. **[Architecture](./profile-architecture.md)** - Technical implementation details
3. **[Components](./profile-components.md)** - UI component documentation
4. **[Types](./profile-types.md)** - TypeScript types and interfaces reference
5. **[User Flows](./profile-flows.md)** - User interaction patterns and flows

## 🚀 Quick Start for Developers

1. **Understanding Types**: Start with `profile-types.md` to understand the data structure
2. **UI Components**: Review `profile-components.md` for component usage
3. **Architecture**: Read `profile-architecture.md` for technical implementation
4. **Recent Changes**: Check `PROFILE_ENHANCEMENTS.md` for latest features

## 🔧 Development Guidelines

- All profile-related types should be defined in `/src/types/user.ts`
- Profile state management goes through `authStore.ts`
- UI components should follow the gradient-based design system
- Database changes require migrations in `/supabase/migrations/`
- Always validate user input and handle edge cases (empty states, loading states)

## 📋 TODO for Future Enhancement

See the "Future Enhancement Opportunities" section in `PROFILE_ENHANCEMENTS.md` for a roadmap of potential improvements.

---

*Last updated: December 2024*