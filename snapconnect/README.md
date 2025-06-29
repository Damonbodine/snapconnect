# SnapConnect - AI Enhanced Social Media Fitness Platform

A cutting-edge fitness social platform that combines Snapchat's ephemeral messaging with AI-powered content generation. Built with React Native, Expo, and Supabase, featuring ai coaching, real-time messaging, workout planners, suggestions, and real time context aware AI based coach.

## 🚀 Quick Start - Testing the App

### Option 1: Quick Demo with Expo Go (Recommended for Professors)

**The fastest way to test the app without complex setup:**

+ Important:** This is a **React Native mobile application** that requires either:   │ │
│ │    8 +  - **Mobile device** with Expo Go app (for quick testing)                             │ │
│ │    9 +  - **iOS Simulator** via Xcode (macOS only)                                           │ │
│ │   10 +                                         │ │
│ │   11 +  - **Physical iOS/Android device** (recommended for full feature testing)  

1. **Get the app running:**
   ```bash
   # Clone the repository
   git clone https://github.com/Damonbodine/snapconnect.git
   cd snapconnect
   
   # Install dependencies
   npm install
   
   # Start the development server
   npm start
   ```

**⚠️ Note:** Some advanced features may be limited if you test the app through Expo Go

### Option 2: Full Development Build (Complete Experience)

**For full feature access including AR and native capabilities:**

#### Prerequisites
damonbodine@Damons-Air Boostme % cd /Users/damonbodine/Boostme/snapconnect/voice-service 
damonbodine@Damons-Air voice-service % source venv/bin/activate
(venv) damonbodine@Damons-Air voice-service % python main.py



- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Expo CLI**: `npm install -g @expo/cli`

**For iOS Testing (macOS only):**
- **Xcode 14+** (Available from Mac App Store)
- **iOS Simulator** (included with Xcode)
- **Physical iOS device** (recommended for camera/AR features)
- **Apple Developer Account** (free tier sufficient for development)


**Note:** This is a **React Native app built with Expo**, which requires native development environments (Xcode for iOS, Android Studio for Android) for full functionality testing.

#### Setup Steps
1. **Clone and install:**
   ```bash
   git clone https://github.com/Damonbodine/snapconnect.git
   cd snapconnect
   npm install
   ```

2. **Environment configuration:**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env with your credentials (see Configuration section below)
   ```

3. **Run on your preferred platform:**
   ```bash
   # iOS (requires macOS and Xcode)
   npm run ios
   
   # Android (requires Android Studio setup)
   npm run android
   
   # Web (limited features)
   npm run web
   ```

## ⚙️ Configuration

###  I will send .ENV and Api Key's. 
```


## 📱 App Features & Testing Guide

### Core Features to Test

1. **Authentication System**
   - Sign up with email/password
   - Login/logout functionality
   - Profile creation with fitness levels

2. **Camera & AR Features**
   - Photo/video capture
   - Real-time face detection overlays
   - AR filters and effects
   - Media preview and editing

3. **Discover Feed**
   - Ephemeral fitness posts
   - AI-generated captions and content
   - Post engagement (likes, views)
   - Infinite scroll with performance optimization

4. **Social Features**
   - Friend requests and management
   - Real-time messaging
   - User profiles and fitness goals
   - Enhanced profile system with bio, location, and workout intensity preferences
   - Dedicated friends page with Instagram-style UI

5. **Events System**
   - AI Powered Walking Recommendation based on your location
   - AI Powered Workout Recommendations based on your fitness goals
   - Event participation

6.  **AI Coaching System**
7.  -Coach Alex who takes your entire personal context to offer real time valuable insights
8.  -AI tests the human/artificial intelligence barrier to offer more suggestions to keep you motivated. 
9.  -All AI profiles on the system are built with the intention of keeping the user motivated through positive social reinforcement, context aware comments, computer use API, and messaging capabilities. 



### Testing Accounts

For demo purposes, you can create test accounts or use the provided test data scripts:

```bash
# Create test users and data
npm run create-test-data
```

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

```
snapconnect/
├── app/                     # Expo Router screens
│   ├── (auth)/             # Authentication screens (login, signup)
│   ├── (tabs)/             # Main app tabs (camera, discover, etc.)
│   └── _layout.tsx         # Root navigation layout
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── camera/         # Camera and AR components
│   │   ├── discover/       # Feed and post components
│   │   └── ...
│   ├── stores/            # Zustand state management stores
│   ├── services/          # API services and external integrations
│   ├── utils/             # Helper functions and utilities
│   └── types/             # TypeScript type definitions
├── assets/                # Images, fonts, and static assets
├── supabase/             # Database migrations and schemas
└── docs/                 # Additional documentation
    └── profile/          # Profile system documentation
```

## 🧪 Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on specific platforms
npm run ios       # iOS simulator
npm run android   # Android emulator
npm run web       # Web browser

# Testing and quality checks
npm test          # Run test suite
npm run lint      # Check code style
npm run typecheck # TypeScript type checking

# Production builds
eas build --platform ios     # iOS production build
eas build --platform android # Android production build
```

## 📋 Device Requirements

### iOS
- iOS 13.0 or later
- iPhone 13 or newer
- Camera, microphone, location, and health permissions



## 🚨 Troubleshooting

### Common Issues

1. **"Metro bundler failed to start"**
   ```bash
   npx expo install --fix
   npx expo start --clear
   ```

2. **"Unable to resolve module"**
   ```bash
   rm -rf node_modules
   npm install
   npx expo start --clear
   ```

3. **Camera/AR features not working**
   - Ensure you're using a development build, not Expo Go
   - Check device permissions for camera and microphone
   - Verify device supports ARKit (iOS) or ARCore (Android)

4. **Supabase connection issues**
   - Verify your `.env` file has correct Supabase credentials
   - Check that database migrations have been applied
   - Ensure Supabase project is not paused

5. **OpenAI API errors**
   - Verify API key is valid and has billing set up
   - Check API usage limits and quotas

### Getting Help

If you encounter issues while testing:

1. Check the console logs for error messages
2. Ensure all environment variables are properly set
3. Verify device permissions are granted
4. Try restarting the development server

## 📚 Documentation

### Profile System
The profile system documentation is available in `/docs/profile/`:

- **[Profile Overview](./docs/profile/README.md)** - System overview and developer guide
- **[Profile Enhancements](./docs/profile/PROFILE_ENHANCEMENTS.md)** - Recent feature additions
- **[Architecture](./docs/profile/profile-architecture.md)** - Technical implementation details
- **[Components](./docs/profile/profile-components.md)** - UI component documentation
- **[Types](./docs/profile/profile-types.md)** - TypeScript interfaces reference
- **[User Flows](./docs/profile/profile-flows.md)** - User interaction patterns

## 📄 License

This project is for educational purposes. All rights reserved.

## 👥 Authors

- **Damon Bodine** - Initial work and development
- **AI Assistant** - Code generation and optimization support

---

**For Professors/Evaluators**: If you need assistance setting up the app or encounter any issues, please don't hesitate to reach out. 