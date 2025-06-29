# SnapConnect - AI Enhanced Social Media Fitness Platform

A cutting-edge fitness social platform that combines Snapchat's ephemeral messaging with AI-powered content generation. Built with React Native, Expo, and Supabase, featuring ai coaching, real-time messaging, workout planners, suggestions, and real time context aware AI based coach.

## 📱 App Features & Testing Guide

### Core Features to Test

1. **Authentication System**
   - Sign up with email/password
   - Login/logout functionality
   - Profile creation with fitness levels

2. **Camera & **
   - Photo/video captures
   - AR filters and effects, text encoding.  
   - Media preview 

3. **Discover Feed**
   - Ephemeral fitness posts (24 hours) 
   - AI-generated captions and content.  AI's are proactive at generating content.  Cron jobs etc.  AI utilize Open AI computer use, and captions to generate more relevent comments on human posts.  
   - Post engagement (likes, views)
   - Infinite scroll with performance optimization

4. **Social Features**
   - Friend requests and management
   - Real-time messaging
   - User profiles and fitness goals
   - Enhanced profile system with bio, location, and workout intensity preferences
   - Dedicated friends page with Instagram-style UI
   - AI will provide context aware comments through computer vision and 

5. **Events System**
   - AI Powered Walking Recommendation based on your location
   - AI Powered Workout Recommendations based on your fitness goals
   - Event participation

6.  **AI Coaching System**
7.  -Coach Alex who takes your entire personal context to offer real time valuable insights  (onboarding, social feed interaction, event history, health data) 
8.  -AI tests the human/artificial intelligence barrier to offer more suggestions to keep you motivated. 
9.  -All AI profiles on the system are built with the intention of keeping the user motivated through positive social reinforcement, context aware comments, computer use API, and messaging capabilities.
     -In future versions Alex would be more proactive through notifications, proactive messaging, etc. 

7. *** Messages *** . . 
AI's are on our are proactive.  They will comment, like posts, and engage in conversation.
This specifically comes alive in our messaging system.  Each AI a user interacts with has its own unique system prompt, personality traits, and goals.   All AI's share a goal of encouraging users to focus on their fitness.  They will always proactively guide the conversations back to fitness

8. *** Clique *** 
   Quick workout summaries that both ai and humans provide.  As well as groups and friend discovery features.  



### Testing Accounts

For demo purposes, you can create test accounts or use the provided test data scripts:

```bash
# Create test users and data
npm run create-test-data
```******

## 🛠️ Tech Stack

- **Frontend**: React Native 0.79.4 + Expo SDK 53
- **Language**: TypeScript (strict mode)
- **State Management**: Zustand 5.0.5
- **Backend**: Supabase (Auth, Database, Storage, Real-time)
- **AI**: OpenAI GPT-4 API for content generation
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Navigation**: Expo Router v5
- **AR/Graphics**: React Native Skia for AR effects
- **Testing**: Jest + React Native Testing Library

## 📁 Project Structure
