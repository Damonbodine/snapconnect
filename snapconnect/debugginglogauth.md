# Authentication & Onboarding Debugging Log

## Overview
This document tracks all errors, solutions, and learnings encountered while implementing the authentication and onboarding system for SnapConnect. This serves as a reference to avoid repeating mistakes and to understand the root causes of issues.

---

## 🚨 Current Active Issues

None! Avatar upload is working correctly.

---

## ✅ Recently Resolved Issues

### Issue #6: Avatar Upload - 0KB File Issue
**Date:** June 24, 2025  
**Status:** ✅ Resolved

Avatar uploads were creating 0KB files due to incorrect data format for Supabase Storage.

**Root Cause:**
- Supabase Storage expects a Blob, not raw ArrayBuffer
- Missing conversion step from ArrayBuffer to Blob

**Solution Applied:**
1. ✅ Use FileSystem.readAsStringAsync to read as base64
2. ✅ Decode base64 to ArrayBuffer using base64-arraybuffer library
3. ✅ **Convert ArrayBuffer to Blob** (critical step!)
4. ✅ Upload Blob using supabase.storage.from().upload()
5. ✅ Fixed ImagePicker deprecation warning
6. ✅ Added cache buster to URLs for fresh images

**Final Working Code:**
```javascript
const base64 = await FileSystem.readAsStringAsync(uri, { 
  encoding: FileSystem.EncodingType.Base64 
});
const arrayBuffer = decode(base64);
const blob = new Blob([arrayBuffer], { type: `image/${fileExt}` });
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(fileName, blob, {
    contentType: `image/${fileExt}`,
    upsert: true
  });
```

**Implementation:**
- Updated both onboarding/complete.tsx and profile.tsx
- Storage policies fixed with simplified approach
- Profile photos now display correctly

---

## ✅ Recently Resolved Issues

### Issue #5: Sign Out Button Not Working
**Date:** June 23, 2025  
**Error:** Sign out button cleared state but didn't navigate
**Status:** ✅ Resolved

#### Root Cause
- signOut function cleared auth state correctly
- Missing navigation after sign out
- User remained on profile screen with cleared state

#### Solution Applied
- Added `router.replace('/')` after successful sign out
- Root route checks auth and redirects to login

---

### Issue #4: Navigation - Unmatched Route Error
**Date:** June 23, 2025  
**Error:** "unmatched route - page could not be found" after profile creation
**Status:** ✅ Resolved

#### Root Cause
- Trying to navigate to `/(tabs)` which doesn't have an index.tsx file
- Expo Router needs a specific route within the tabs folder

#### Solution Applied
- Changed navigation from `/(tabs)` to `/(tabs)/discover`
- Updated both `onboarding/complete.tsx` and `app/index.tsx`

### Issue #3: Broken Auth State - User Deleted from Supabase
**Date:** June 23, 2025  
**Error:** Sign in errors after user record deleted from Supabase table
**Status:** ✅ Resolved

#### Issue Description
- User was created in Supabase Auth but user profile was deleted from users table
- This creates a mismatch: auth record exists but profile doesn't
- Auth succeeds but profile creation fails at onboarding completion

#### Logs Observed
```
LOG  Profile not found, redirecting to onboarding
LOG  Onboarding params: {"dietaryPreferences": "", "fitnessLevel": "beginner", "goals": "endurance", "workoutFrequency": "3"}
[Multiple repeated logs - component re-rendering issue]
```

#### Solutions Applied
1. ✅ Added error handling for missing profile (PGRST116 error)
2. ✅ Auth redirects to onboarding when profile missing
3. ✅ Added detailed logging to createProfile function
4. 🔄 Need to see actual error from profile creation

#### Root Cause Found
**Error**: `duplicate key value violates unique constraint "users_pkey"`
- User profile wasn't fully deleted, just had fields cleared
- Auth user ID still existed in users table
- Insert failed because primary key already existed

#### Solution Applied
1. ✅ Updated createProfile to handle duplicate key error
2. ✅ If profile exists, update instead of insert
3. ✅ Added proper error handling for both cases

#### Resolution
- For testing: Delete both auth user and profile record for clean slate
- For production: Code now handles existing profiles gracefully

---

### Issue #2: Onboarding Complete Screen Parameter Error
**Date:** June 23, 2025  
**Error:** `TypeError: Cannot read property 'split' of undefined`  
**Location:** `app/onboarding/complete.tsx:9`  
**Status:** ✅ Resolved

#### Error Details
```
ERROR Warning: TypeError: Cannot read property 'split' of undefined
at CompleteOnboardingScreen (app/onboarding/complete.tsx:9:93)
```

#### Root Cause
The `useLocalSearchParams()` is returning undefined values for some parameters, and we're trying to call `.split()` on them without checking if they exist first.

#### Location
Line 9: `const { fitnessLevel, goals, dietaryPreferences, workoutFrequency } = useLocalSearchParams();`

Later in the code, we use:
- `(goals as string).split(',')`  
- `(dietaryPreferences as string).split(',')`

If these parameters are undefined, `.split()` will fail.

#### Solution Applied
1. ✅ Added optional chaining and fallback values:
   - `goals: (goals as string)?.split(',') || []`
   - `dietary_preferences: (dietaryPreferences as string)?.split(',').filter(Boolean) || []`
   - `workout_frequency: parseInt(workoutFrequency as string) || 3`
2. ✅ Added console.log to debug parameter passing between onboarding screens

---

### Issue #1: NativeWind CSS Processing Error
**Date:** June 23, 2025  
**Error:** `Use process(css).then(cb) to work with async plugins`  
**Location:** `src/stores/authStore.ts`  
**Status:** 🔄 In Progress

#### Error Details
```
iOS Bundling failed 740ms index.ts (992 modules)
ERROR src/stores/authStore.ts: /Users/damonbodine/Boostme/snapconnect/src/stores/authStore.ts: Use process(css).then(cb) to work with async plugins
```

#### Root Cause Analysis
1. **Conflicting Entry Points**: Project had both legacy App.tsx and Expo Router structure
2. **Missing Expo Router Configuration**: `app.json` lacked `"entryPoint": "expo-router/entry"`
3. **CSS Import Chain Conflict**: `global.css` imported in legacy App.tsx while bundler processed authStore.ts
4. **Metro Configuration**: NativeWind v2 metro transformer path issues

#### Attempted Solutions
1. ✅ Updated `app.json` to include `"entryPoint": "expo-router/entry"`
2. ✅ Moved CSS import from App.tsx to app/_layout.tsx
3. ✅ Renamed App.tsx to App.tsx.backup to avoid conflicts
4. ✅ Updated index.ts to use `import 'expo-router/entry'`
5. ❌ Tried `require.resolve('nativewind/dist/transformer')` - module not found
6. ❌ Tried `withNativeWind(config, { input: './global.css' })` - module not found  
7. ✅ Simplified metro.config.js to basic Expo default
8. ✅ Removed Google OAuth imports from authStore to simplify
9. ✅ Removed Google auth UI from login/signup screens
10. ✅ **FIXED TAILWIND VERSION**: Downgraded from ^3.3.0 to 3.3.2 (exact version)
11. ❌ Tried `withNativeWind` from 'nativewind/metro' - module doesn't exist in v2
12. 🔄 Testing with TailwindCSS 3.3.2 + basic metro config

#### Additional Actions Taken
- **Scope Reduction**: Focused on email authentication only per user request
- **Code Cleanup**: Removed all Google OAuth related code and dependencies
- **Metro Simplification**: Using basic expo metro config without NativeWind specific transformers

#### Current Status  
- Entry point conflicts resolved
- Google OAuth removed, focusing on email auth only
- All dev servers cleared for clean start
- **ERROR LOCATION**: `app/(auth)/forgot-password.tsx` (confirms not file-specific)
- **ROOT CAUSE IDENTIFIED**: TailwindCSS version compatibility issue with NativeWind v2
- **TAILWIND FIXED**: Downgraded to exact version 3.3.2
- **METRO SIMPLIFIED**: Using basic expo config (NativeWind v2 metro wrapper doesn't exist)
- **✅ SUCCESS**: App started successfully, sign-in screen visible!

#### New Discovery
Error moved from `authStore.ts` to `forgot-password.tsx`, confirming this is a **TailwindCSS + NativeWind v2 compatibility issue**, not specific file problems.

#### Research Findings (from NativeWind GitHub issues)
- Common issue with TailwindCSS ^3.3.0+ and NativeWind v2
- Affects React Native 0.72.X+ versions  
- Solution: Downgrade TailwindCSS to exactly 3.3.2 (no caret)
- Alternative: Proper metro.config.js with `withNativeWind` wrapper

---

## 📚 Resolved Issues

### Issue #R1: TypeScript Errors with NativeWind className Props
**Date:** June 23, 2025  
**Error:** `Property 'className' does not exist on type...`  
**Status:** ✅ Resolved

#### Solution Applied
Created type declarations in `src/types/nativewind.d.ts`:
```typescript
declare module "react-native" {
  namespace ReactNative {
    interface ViewProps {
      className?: string;
    }
    interface TextProps {
      className?: string;
    }
    // ... other interfaces
  }
}
```

#### Lessons Learned
- NativeWind requires explicit TypeScript declarations for className props
- TypeScript configuration needs to include custom type directories

---

## 🏗️ Implementation Architecture

### Authentication Flow
```
Index → Check Auth State → Route Decision
├── Not Authenticated → (auth)/login
├── Authenticated + No Profile → /onboarding
└── Authenticated + Profile → (tabs)
```

### File Structure
```
app/
├── _layout.tsx (Root layout with auth listener)
├── index.tsx (Routing logic)
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   ├── signup.tsx
│   └── forgot-password.tsx
├── (tabs)/ (Main app screens)
└── onboarding/ (4-step profile setup)
```

### Key Dependencies
- `@supabase/supabase-js`: ^2.50.0
- `zustand`: ^5.0.5
- `expo-router`: ~5.1.0
- `nativewind`: ^2.0.11
- `expo-auth-session`: ^6.2.0
- `expo-web-browser`: ^14.2.0

---

## ⚙️ Configuration Files

### app.json Key Settings
```json
{
  "expo": {
    "entryPoint": "expo-router/entry",
    "scheme": "snapconnect",
    "newArchEnabled": true
  }
}
```

### babel.config.js
```javascript
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    'nativewind/babel',
    'react-native-reanimated/plugin',
  ],
};
```

### Current metro.config.js (Simplified)
```javascript
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
module.exports = config;
```

### Failed Metro Configurations
```javascript
// FAILED: Module 'nativewind/dist/transformer' not found
config.transformer.babelTransformerPath = require.resolve('nativewind/dist/transformer');

// FAILED: Module 'nativewind/metro' not found  
const { withNativeWind } = require('nativewind/metro');
module.exports = withNativeWind(config, { input: './global.css' });
```

---

## 🔧 Version Compatibility Matrix

### Current Versions
- React: 19.0.0 (⚠️ Very new, potential compatibility issues)
- React Native: 0.79.4 (⚠️ Recent version)
- Expo: ~53.0.12
- NativeWind: ^2.0.11

### Known Compatibility Issues
- React 19.0.0 may not be fully supported by NativeWind 2.x
- React Native 0.79.4 is quite recent and may have compatibility issues
- Consider downgrading to React 18.x LTS if issues persist

---

## 🧪 Testing Checklist

### Authentication Flow Tests
- [ ] Email signup with verification
- [ ] Email login
- [ ] Google OAuth login
- [ ] Password reset
- [ ] Session persistence
- [ ] Auto-logout on token expiry

### Onboarding Flow Tests
- [ ] Welcome screen navigation
- [ ] Fitness level selection
- [ ] Goals multi-selection
- [ ] Dietary preferences
- [ ] Workout frequency
- [ ] Profile creation
- [ ] Navigation to main app

### UI/Styling Tests
- [ ] Gradient backgrounds render correctly
- [ ] NativeWind classes apply properly
- [ ] Animations work smoothly
- [ ] Dark theme consistency
- [ ] Responsive design on different screen sizes

---

## 📋 Common Commands

### Development
```bash
# Start with cache clear
npm start -- --port 8085 --clear

# Type checking
npx tsc --noEmit

# Reset everything
rm -rf node_modules package-lock.json
npm install
npm start -- --clear
```

### Debugging
```bash
# Check NativeWind version
npm list nativewind

# Check for conflicting entry points
ls -la App.tsx index.ts app/_layout.tsx

# Metro cache clear
npx expo start --clear
```

---

## 🎯 Success Criteria

### Phase 1: Basic Authentication ✅
- [x] Email signup/login functional
- [x] Google OAuth integration
- [x] Supabase connection established
- [x] Zustand state management
- [x] Route-based authentication

### Phase 2: Onboarding Flow ✅
- [x] 4-step onboarding process
- [x] Fitness profile creation
- [x] Database schema implemented
- [x] UI components with gradient design

### Phase 3: Technical Issues ✅
- [x] Expo Router configuration
- [x] TypeScript declarations
- [x] Entry point conflicts resolved
- [x] Google OAuth removed (simplified scope)
- [x] NativeWind CSS processing (TailwindCSS 3.3.2 fix)
- [x] Bundle and run successfully
- [x] Authentication flow testing (Complete!)
- [x] Profile creation successful
- [x] Navigation to main app working

---

## 💡 Key Learnings

1. **Entry Point Conflicts**: Always ensure only one entry point is active (either legacy App.tsx OR Expo Router)
2. **CSS Import Location**: Global CSS should be imported in the root layout, not legacy entry files
3. **Version Compatibility**: Bleeding edge versions can cause unexpected issues - consider stable LTS versions
4. **Metro Configuration**: NativeWind v2 metro paths are inconsistent - modules may not exist as documented
5. **Type Declarations**: Custom TypeScript declarations are needed for NativeWind className props
6. **Scope Management**: When debugging, reduce complexity by removing non-essential features (like Google OAuth)
7. **Metro Transformer Issues**: Standard expo metro config may work better than custom NativeWind transformers
8. **Bundle Time**: First build after clearing cache takes significantly longer (1-2 minutes)

---

## 🔮 Next Steps

1. Test current metro configuration to resolve CSS processing error
2. If issues persist, consider React version downgrade
3. Implement comprehensive error handling
4. Add loading states and user feedback
5. Test on both iOS and Android platforms
6. Performance optimization and bundle size analysis

---

*Last Updated: June 23, 2025*  
*Status: CSS Processing Error Resolution in Progress*