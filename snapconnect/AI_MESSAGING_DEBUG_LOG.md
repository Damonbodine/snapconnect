# AI Messaging Debug Log

## Issue Summary
**Problem**: AI users not responding to human messages due to `Cannot read property 'map' of undefined` error in health coaching message generation.

**Error Pattern**: 
```
❌ Health coaching message generation failed: [TypeError: Cannot read property 'map' of undefined]
❌ Failed to generate AI response: [Error: Health coaching failed: Cannot read property 'map' of undefined]
```

## Investigation Timeline

### 2024-06-29 - Initial Error Analysis

**Observed Logs**:
```
LOG  🤖 Generating AI response for user dd6ad0c0-d95a-436d-ba38-20208663db6c
LOG  🤖 Fetching available AI users for chat
LOG  ✅ Found 70 AI users available for chat
LOG  🏃‍♂️ Generating advice health coaching message
ERROR ❌ Health coaching message generation failed: [TypeError: Cannot read property 'map' of undefined]
```

**Key Findings**:
- AI users are found successfully (70 AI users available)
- AI response generation starts correctly
- Error occurs specifically in `healthAIService.generateHealthCoachingMessage()`
- Multiple message types affected: `motivation`, `advice`, `celebration`

### Root Cause Analysis

**Service Flow**:
1. `aiMessageHandler` detects new message → ✅ Working
2. `aiChatService.generateAIResponse()` called → ✅ Working
3. User profile fetched from database → ✅ Working
4. `healthContext` created → ⚠️ **Incomplete structure**
5. `healthAIService.generateHealthCoachingMessage()` called → ❌ **Fails here**

**Problem Location**: 
- File: `src/services/healthAIService.ts`
- Function: `buildHealthCoachingPrompt()`
- Lines: 219, 224, 311

**Problematic Code**:
```typescript
// Line 219
- Recent workouts: ${healthContext.recentWorkouts.map(w => w.type).join(', ') || 'None'}

// Line 224  
- Preferred workouts: ${healthContext.preferredWorkoutTypes.join(', ')}

// Line 311
- Recent workouts: ${healthContext.recentWorkouts.slice(0, 3).map(w => 
    `${w.type} (${w.duration}min, ${w.intensity || 'unknown'} intensity)`
  ).join(', ') || 'None this week'}
```

**Issue**: The `healthContext` object created by `aiChatService` doesn't include the properties that `healthAIService` expects.

## Data Structure Mismatch

### aiChatService creates (lines 152-185):
```typescript
const healthContext = {
  profile: { fitness_level, goals, ... },
  currentStats: { energy_level, stress_level, ... },
  preferences: { coaching_style, ... }
}
```

### healthAIService expects:
```typescript
const healthContext = {
  // Missing properties causing .map() errors:
  recentWorkouts: [],           // ❌ undefined → .map() fails
  preferredWorkoutTypes: [],    // ❌ undefined → .join() fails
  todaysSteps: number,         // ❌ undefined
  stepGoalProgress: number,    // ❌ undefined
  currentStreak: number,       // ❌ undefined
  fitnessLevel: string,        // ❌ undefined
  userGoals: { primary: string }, // ❌ undefined
  // ... and many more
}
```

## Debug Scripts Created

### 1. `debug-health-ai-service.js`
- **Purpose**: Test health AI service with mock data
- **Result**: ✅ Works with complete mock data
- **Conclusion**: Confirms the issue is missing properties in real data

### 2. `debug-real-ai-flow.js` 
- **Purpose**: Simulate the exact flow from aiChatService → healthAIService
- **Goal**: Identify which specific properties are missing

## Solutions Identified

### Option 1: Fix aiChatService (Recommended)
**File**: `src/services/aiChatService.ts`
**Action**: Extend `healthContext` creation to include all required properties

```typescript
const healthContext = {
  // Existing structure
  profile: { ... },
  currentStats: { ... },
  preferences: { ... },
  
  // Add missing properties for healthAIService compatibility
  recentWorkouts: [],
  preferredWorkoutTypes: userProfile.exercise_preferences || ['walking'],
  todaysSteps: 5000, // Could fetch from health data
  stepGoalProgress: 75,
  currentStreak: 3,
  bestStreak: 7,
  averageSleepHours: 7.5,
  sleepQuality: 8,
  energyLevel: userProfile.energy_level || 5,
  activityLevel: userProfile.current_activity_level || 'moderate',
  recoveryScore: 7,
  daysSinceRest: 1,
  fitnessLevel: userProfile.fitness_level || 'intermediate',
  userGoals: {
    primary: Array.isArray(userProfile.goals) ? userProfile.goals[0] : 'general_fitness'
  },
  availableTime: userProfile.preferred_workout_duration || 30
}
```

### Option 2: Fix healthAIService
**File**: `src/services/healthAIService.ts`  
**Action**: Add null safety to all `.map()` and `.join()` calls

```typescript
// Line 219 - Safe version
- Recent workouts: ${healthContext.recentWorkouts?.map(w => w.type).join(', ') || 'None'}

// Line 224 - Safe version  
- Preferred workouts: ${healthContext.preferredWorkoutTypes?.join(', ') || 'Not specified'}

// Line 311 - Safe version
- Recent workouts: ${healthContext.recentWorkouts?.slice(0, 3).map(w => 
    `${w.type} (${w.duration}min, ${w.intensity || 'unknown'} intensity)`
  ).join(', ') || 'None this week'}
```

### Option 3: Create Adapter Layer
**File**: `src/services/healthContextAdapter.ts`
**Action**: Create mapping between aiChatService format and healthAIService format

## Next Steps

1. **Run debug script**: `node debug-real-ai-flow.js` to confirm exact missing properties
2. **Choose solution approach** (Option 1 recommended for completeness)
3. **Implement fix** with proper null safety
4. **Test AI messaging** end-to-end
5. **Update this log** with results

## Test Cases to Verify Fix

1. **Human → AI message flow**:
   - Send message to Mike: "Hey Mike! I need motivation today"
   - Verify AI responds within 3 seconds
   - Check logs for successful health coaching generation

2. **Different message types**:
   - Motivation: "I'm feeling unmotivated"
   - Advice: "What workout should I do?"
   - Celebration: "I completed my workout!"

3. **Proactive messaging**:
   - Verify proactive AI messages work without errors
   - Check all trigger types: onboarding, motivation_boost, etc.

## Debug Results - 2024-06-29

### `debug-real-ai-flow.js` Results:
✅ **Confirmed**: All expected properties are missing from healthContext
- `recentWorkouts`: undefined → causes `.map()` error
- `preferredWorkoutTypes`: undefined → causes `.join()` error  
- `todaysSteps`, `stepGoalProgress`, `currentStreak`, etc.: all undefined

### aiChatService healthContext structure:
```
healthContext: {
  profile: { fitness_level, goals, current_activity_level, ... },
  currentStats: { energy_level, stress_level, ... },  
  preferences: { coaching_style, motivation_style, ... }
}
```

### healthAIService expects flat structure:
```
healthContext: {
  recentWorkouts: [],
  preferredWorkoutTypes: [],
  todaysSteps: number,
  fitnessLevel: string,
  // ... all at root level
}
```

## Final Root Cause Analysis

### healthContextService Investigation:
✅ **Found the real issue**: 
- `healthContextService.getEnhancedHealthContext()` method **DOES NOT EXIST**
- The healthContextService has methods like `generateHealthContext()`, `generateCoachingContext()`, but not the one being called
- This is why we're getting "Cannot read property 'map' of undefined" - the function call fails entirely

### Available healthContextService methods:
- `generateHealthContext()` - requires authentication and complex setup
- `generateCoachingContext()` - comprehensive coaching data
- `getQuickHealthSummary()` - simple health metrics
- Various private methods for social/event/conversation context

### The Fix:
**Option 1**: Remove healthContextService dependency entirely (RECOMMENDED)
- Remove problematic import from aiChatService and aiProactiveMessaging
- Use direct user profile data (already working)

**Option 2**: Fix the method calls to use existing methods
- Change to `healthContextService.getQuickHealthSummary()`
- Handle authentication requirements

## Status
- ✅ **Root cause confirmed**: Non-existent method calls to healthContextService
- 🔧 **Next**: Remove healthContextService dependencies completely
- 🎯 **Goal**: AI users respond automatically to human messages

---
*Last Updated: 2024-06-29*
*Debug Scripts: `debug-health-ai-service.js`, `debug-real-ai-flow.js`*