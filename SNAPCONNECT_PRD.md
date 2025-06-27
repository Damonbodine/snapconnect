# SnapConnect - Product Requirements Document (PRD)

## Executive Summary

SnapConnect is a RAG-enhanced social fitness platform that combines Snapchat's ephemeral messaging features with AI-powered content generation specifically designed for health tech and fitness enthusiasts. The app leverages Retrieval-Augmented Generation (RAG) to provide personalized workout content, intelligent caption generation, and community-driven fitness challenges.

## Project Overview

### Vision
Create a better version of Snapchat built with RAG-first principles, demonstrating how retrieval-augmented generation can revolutionize content creation and personalization for the fitness community.

### Target Audience
- **Primary User Type**: Interest Enthusiasts
- **Niche**: Health tech and fitness enthusiasts
- **Demographics**: 18-35 year olds passionate about fitness, nutrition, wellness, and health technology

### Key Differentiators
1. AI-powered content generation for fitness posts
2. Personalized workout and nutrition suggestions
3. Progress tracking with AI analysis
4. Event-based fitness community features
5. RAG-enhanced social interactions

## Assignment Requirements

### Timeline
- **Start Date**: June 23, 2025
- **Phase 1 Deadline**: June 27 (Core Clone)
- **Final Submission**: June 29 (RAG-Enhanced Version)

### Deliverables
1. GitHub Repository with complete source code
2. 5-minute video demo showcasing RAG features
3. Deployed application link
4. BrainLift document link
5. Social media post about the development process

## Technical Architecture

### Tech Stack
- **Frontend**: React Native + Expo SDK 51
- **State Management**: Zustand
- **Backend**: Supabase (PostgreSQL + Vector Extensions)
- **AI/ML**: OpenAI GPT-4 API
- **UI Library**: TBD after evaluation (NativeWind, Tamagui, or Gluestack)
- **Navigation**: Expo Router
- **Styling**: Gradient-based design system
- **Real-time**: Supabase Realtime
- **Storage**: Supabase Storage

### System Architecture
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│    Supabase      │────▶│   OpenAI API    │
│  (React Native) │     │   (Backend)      │     │    (GPT-4)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │                       │                         │
         ▼                       ▼                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Zustand      │     │   PostgreSQL     │     │  Vector Store   │
│  (State Mgmt)   │     │   (Database)     │     │  (Embeddings)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Core Features

### 1. Authentication & Onboarding
- Email/phone signup with verification
- Fitness profile creation
  - Fitness level (Beginner/Intermediate/Advanced)
  - Goals (Weight Loss/Muscle Gain/Endurance/Wellness)
  - Dietary preferences
  - Workout frequency
- Gradient-based UI with smooth animations

### 2. Camera Module
- Full-screen camera as default landing
- Fitness-specific features:
  - Workout timer overlay
  - Form check guidelines
  - Progress photo mode (before/after)
  - Exercise video recording (up to 60 seconds)
- Quick capture with ephemeral timers

### 3. RAG-Powered Content Generation
- **Smart Caption Generation**: AI creates personalized captions based on workout type and user history
- **Content Suggestions**: Proactive post ideas based on fitness journey
- **Hashtag Recommendations**: Trending and personalized hashtags
- **Optimal Posting Times**: AI suggests when to share content
- **Progress Analysis**: AI feedback on transformation photos

### 4. Social Features
- **Ephemeral Messaging**: Disappearing photos/videos with timers
- **Stories**: 24-hour fitness stories with progress milestones
- **Clique (Groups)**: Workout buddy groups and challenges
- **Events**: Local fitness events with AI recommendations
- **FitMap**: Location-based features for gyms and running routes

### 5. Events Platform
- Browse local fitness events
- AI-powered event recommendations
- RSVP and check-in system
- Event-specific challenges
- Integration with calendar

### 6. Progress Tracking
- Transformation timelines
- Measurement tracking
- Achievement system
- Streak monitoring
- AI-generated progress insights

## 6 Core RAG-Powered User Stories

1. **"As a fitness enthusiast, I want AI to generate personalized workout captions based on my exercise history and fitness goals"**
   - Acceptance Criteria: AI generates relevant captions within 2 seconds
   - RAG Integration: User history + Exercise database → Personalized captions

2. **"As a fitness enthusiast, I want AI-suggested post ideas for my progress photos that resonate with my fitness community"**
   - Acceptance Criteria: 3-5 relevant suggestions per photo
   - RAG Integration: Image analysis + Community trends → Content ideas

3. **"As a fitness enthusiast, I want intelligent meal prep content suggestions based on my dietary preferences and workout routine"**
   - Acceptance Criteria: Daily meal suggestions aligned with fitness goals
   - RAG Integration: Nutrition database + User preferences → Meal plans

4. **"As a fitness enthusiast, I want AI to create motivational messages that match my fitness journey stage and personal challenges"**
   - Acceptance Criteria: Contextually relevant motivation
   - RAG Integration: Progress data + Motivational content → Personalized messages

5. **"As a fitness enthusiast, I want context-aware recovery tips and rest day content based on my workout intensity patterns"**
   - Acceptance Criteria: Timely recovery suggestions
   - RAG Integration: Workout history + Recovery knowledge → Rest day content

6. **"As a fitness enthusiast, I want AI-generated challenge ideas to share with my workout buddies based on our collective fitness levels"**
   - Acceptance Criteria: Group-appropriate challenges
   - RAG Integration: Group profiles + Challenge database → Custom challenges

## UI/UX Design

### Design Inspiration
Based on provided screenshots featuring:
- Purple/pink gradient themes
- Card-based layouts with rounded corners
- Glass morphism effects
- Bottom navigation with centered camera button
- Full-screen immersive content
- Minimal text, maximum visual impact

### Design System
```
Colors:
- Primary Gradient: #7C3AED → #EC4899 (Purple to Pink)
- Secondary Gradient: #F472B6 → #FBBF24 (Pink to Yellow)
- Background: #0F0F0F (Near black)
- Surface: rgba(255, 255, 255, 0.1) (Glass effect)
- Text Primary: #FFFFFF
- Text Secondary: #9CA3AF

Typography:
- Headlines: Bold, 24-32px
- Body: Regular, 14-16px
- Captions: Light, 12px

Spacing:
- Card Radius: 20px
- Padding: 16px standard
- Avatar Size: 40px default
```

### Navigation Structure
```
Bottom Tabs:
1. Discover (Home feed)
2. Clique (Groups)
3. Camera (Center FAB)
4. Events
5. Profile
```

## Development Plan

### Phase 0: Pre-Development (Day 0)
1. UI Library Evaluation
   - Compare NativeWind, Tamagui, Gluestack
   - Performance benchmarks
   - Gradient rendering tests
   - Final selection

2. Documentation Creation
   - CLAUDE.md (AI assistant guide)
   - APP_FLOW.md (User flows)
   - UI_DESIGN_SYSTEM.md

### Phase 1: Core Clone (Days 1-3)

#### Day 1: Foundation (8-10 hours)
- Project initialization
- Supabase setup
- Design system implementation
- Navigation structure
- Authentication flow

#### Day 2: Core Features (8-10 hours)
- Camera module
- Discover feed
- Clique (groups) page
- Events page foundation

#### Day 3: Social Features (8-10 hours)
- Stories implementation
- Ephemeral messaging
- Progress features
- Basic social interactions

### Phase 2: RAG Enhancement (Days 4-7)

#### Day 4: RAG Foundation (8-10 hours)
- OpenAI integration
- Vector database setup
- Fitness knowledge base
- RAG pipeline setup

#### Day 5: Content Generation (8-10 hours)
- Caption generation
- Content suggestions
- Event recommendations
- Challenge generation

#### Day 6: Advanced Features (8-10 hours)
- Personalization engine
- Analytics dashboard
- Advanced UI features
- Performance optimization

#### Day 7: Polish & Deploy (8-10 hours)
- Testing & bug fixes
- Final UI polish
- Deployment setup
- User acquisition

## Database Schema

```sql
-- Users table with fitness profile
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  fitness_level TEXT CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
  goals TEXT[],
  dietary_preferences TEXT[],
  workout_frequency INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Posts with vector embeddings
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('photo', 'video')),
  expires_at TIMESTAMP,
  content_embedding VECTOR(1536),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location JSONB,
  date_time TIMESTAMP,
  max_participants INTEGER,
  fitness_level TEXT[],
  event_type TEXT,
  creator_id UUID REFERENCES users(id),
  cover_image TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Fitness knowledge base
CREATE TABLE fitness_knowledge (
  id UUID PRIMARY KEY,
  category TEXT,
  content TEXT,
  embedding VECTOR(1536),
  tags TEXT[],
  difficulty_level TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Success Metrics

### Core Functionality
- [ ] All 6 user stories fully implemented
- [ ] Sub-3 second response time for RAG content
- [ ] Smooth 60fps UI animations
- [ ] Zero critical bugs in production

### RAG Quality
- [ ] 90%+ user satisfaction with generated content
- [ ] Demonstrable personalization improvement
- [ ] Effective knowledge integration
- [ ] Learning from user feedback

### User Acquisition (Bonus)
- 5 bonus points per 10 users (max 50 points)
- Track active usage and retention
- Monitor feature engagement rates

## Risk Mitigation

### Technical Risks
1. **API Rate Limits**: Implement caching and request queuing
2. **Performance Issues**: Use lazy loading and optimization
3. **Cross-platform Bugs**: Extensive testing on both platforms

### Timeline Risks
1. **Scope Creep**: Stick to MVP features for Phase 1
2. **Integration Issues**: Test integrations early
3. **Deployment Delays**: Prepare deployment pipeline early

## Appendices

### A. File Structure
```
snapconnect/
├── docs/
│   ├── CLAUDE.md
│   ├── APP_FLOW.md
│   ├── UI_DESIGN_SYSTEM.md
│   └── RAG_ARCHITECTURE.md
├── src/
│   ├── components/
│   ├── screens/
│   ├── navigation/
│   ├── stores/
│   ├── services/
│   ├── utils/
│   └── types/
├── assets/
├── __tests__/
└── [config files]
```

### B. API Endpoints (Supabase Edge Functions)
- `/api/generate-caption` - AI caption generation
- `/api/suggest-content` - Content recommendations
- `/api/analyze-progress` - Progress photo analysis
- `/api/create-challenge` - Challenge generation
- `/api/get-recommendations` - Event recommendations

### C. Third-party Services
- OpenAI API (GPT-4)
- Supabase (Backend)
- Expo EAS (Build service)
- Sentry (Error tracking)
- Analytics (TBD)

---

**Document Version**: 1.0
**Last Updated**: June 23, 2025
**Author**: SnapConnect Team