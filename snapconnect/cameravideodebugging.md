# Camera Video Recording Debugging Log

## Issue Summary
The SnapConnect app crashes when recording videos due to React Native Reanimated warnings. The app works fine for photo capture, but video recording consistently causes crashes with Reanimated warnings appearing during the recording process.

## Error Symptoms
- App crashes during video recording (not immediately, but during the recording process)
- Continuous Reanimated warnings in logs during recording
- Warnings appear right after "startRecording call completed successfully"
- The warnings continue throughout the recording process until crash

## Root Cause Analysis
The issue stems from React Native Reanimated shared value updates happening during React render cycles, particularly:
1. Recording progress updates in the timer effect
2. Button scale animations triggered during recording state changes
3. Shared value updates in cleanup functions and callbacks

## Failed Fixes Attempted

### Fix #1: setTimeout Delays
**Approach**: Used setTimeout with various delays (200ms, 300ms, 500ms) to defer shared value updates
**Location**: Recording timer effect and onRecordingFinished callback
**Result**: FAILED - Still caused Reanimated warnings
**Code Example**:
```typescript
setTimeout(() => {
  recordingProgress.value = withTiming(newDuration / 10, { duration: 100 });
}, 200);
```

### Fix #2: requestAnimationFrame
**Approach**: Wrapped shared value updates in requestAnimationFrame to defer to next frame
**Location**: Recording timer, handleStartRecording, reset functions
**Result**: FAILED - Still caused Reanimated warnings during recording
**Code Example**:
```typescript
requestAnimationFrame(() => {
  recordingProgress.value = withTiming(newDuration / 10, { duration: 100 });
});
```

### Fix #3: Longer Timeout Delays
**Approach**: Increased setTimeout delays to 500ms+ in resetRecordingState function
**Location**: resetRecordingState function
**Result**: FAILED - Still caused warnings, just delayed them
**Code Example**:
```typescript
setTimeout(() => {
  try {
    recordingProgress.value = withTiming(0);
    recordButtonScale.value = withSpring(1, springConfigs.gentle);
  } catch (animationError) {
    console.error('Error updating shared values:', animationError);
  }
}, 500);
```

## Current Problem Areas Identified

### 1. Recording Timer Effect (Lines 234-276)
```typescript
useEffect(() => {
  if (isRecording) {
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration((prev) => {
        const newDuration = prev + 0.1;
        
        // This is causing Reanimated warnings
        requestAnimationFrame(() => {
          recordingProgress.value = withTiming(newDuration / 10, { duration: 100 });
        });
        
        if (newDuration >= 10) {
          handleStopRecording();
          return 10;
        }
        return newDuration;
      });
    }, 100);
  }
  // ...cleanup
}, [isRecording]);
```

### 2. Start Recording Function (Lines 426-566)
```typescript
const handleStartRecording = async () => {
  // This animation update might be problematic
  requestAnimationFrame(() => {
    recordButtonScale.value = withSpring(0.8, springConfigs.gentle);
  });
  
  // VisionCamera startRecording call...
};
```

### 3. Recording Finished Callback (Lines 457-540)
```typescript
onRecordingFinished: (video) => {
  // Immediate state updates followed by delayed shared value updates
  setIsRecording(false);
  setRecordingDuration(0);
  
  // These delayed updates still cause warnings
  setTimeout(() => {
    recordingProgress.value = withTiming(0);
    recordButtonScale.value = withSpring(1, springConfigs.gentle);
  }, 200);
}
```

## Next Fix Strategy (Not Yet Implemented)

### Proposed Solution: Separate Animation from State
1. **Remove shared value updates from timer effect completely**
2. **Use separate useEffect for animation updates based on state**
3. **Use runOnJS for any shared value updates in callbacks**
4. **Consider disabling animations entirely during video recording**

### Key Implementation Points:
- Move recording progress animation to separate effect that only responds to recordingDuration state changes
- Remove all shared value updates from timer callbacks
- Use runOnJS wrapper for any animations triggered from VisionCamera callbacks
- Consider using a "recording animation disabled" mode

## Files Involved
- `/Users/damonbodine/Boostme/snapconnect/src/components/camera/CameraInterface.tsx` (primary)
- `/Users/damonbodine/Boostme/snapconnect/app/(tabs)/camera.tsx` (handles media capture)
- `/Users/damonbodine/Boostme/snapconnect/src/components/camera/MediaPreviewModal.tsx` (video preview)

## Testing Notes
- Photo capture works perfectly without any Reanimated warnings
- Video recording crashes consistently during the recording process
- The crash happens after recording starts successfully (VisionCamera API works)
- Issue is specifically with the React Native Reanimated shared value updates during recording

## Latest Fix Attempt: Separate Effects Pattern

### Fix #4: Separate Effects for Animation Updates (IMPLEMENTED)
**Approach**: Completely separate shared value updates from timer callbacks and use dedicated useEffect hooks
**Date**: Current implementation
**Strategy**:
1. Remove ALL shared value updates from the recording timer setInterval callback
2. Create separate useEffect hooks for each animation concern:
   - Recording progress animation (responds to recordingDuration changes)
   - Record button scale animation (responds to isRecording state)
3. Remove shared value updates from onRecordingFinished callback
4. Remove shared value updates from resetRecordingState function

**Code Changes**:
```typescript
// OLD: Mixed state and animation updates in timer
useEffect(() => {
  if (isRecording) {
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration((prev) => {
        const newDuration = prev + 0.1;
        // PROBLEMATIC: Shared value update in timer callback
        requestAnimationFrame(() => {
          recordingProgress.value = withTiming(newDuration / 10, { duration: 100 });
        });
        return newDuration;
      });
    }, 100);
  }
}, [isRecording]);

// NEW: Separate concerns
// Timer only handles state
useEffect(() => {
  if (isRecording) {
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration((prev) => {
        const newDuration = prev + 0.1;
        if (newDuration >= 10) {
          handleStopRecording();
          return 10;
        }
        return newDuration;
      });
    }, 100);
  }
}, [isRecording]);

// Animation responds to state changes
useEffect(() => {
  if (isRecording) {
    recordingProgress.value = withTiming(recordingDuration / 10, { duration: 100 });
  } else {
    recordingProgress.value = withTiming(0, { duration: 200 });
  }
}, [recordingDuration, isRecording]);

// Button animation responds to recording state
useEffect(() => {
  if (isRecording) {
    recordButtonScale.value = withSpring(0.8, springConfigs.gentle);
  } else {
    recordButtonScale.value = withSpring(1, springConfigs.gentle);
  }
}, [isRecording]);
```

**Expected Result**: This should eliminate all Reanimated warnings by ensuring shared value updates only happen in response to state changes in proper useEffect hooks, not in timer callbacks or async handlers.

## Current Status
Fix #4 implemented and ready for testing. This approach follows React and Reanimated best practices by:
- Keeping timers for pure state management only
- Using separate effects for animation that respond to state changes
- Eliminating all shared value updates from async callbacks
- Following the principle of separation of concerns