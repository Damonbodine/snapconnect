# Camera Feature - Errors & Debugging Guide

## 🚨 Current Critical Issues

### 1. Video Recording Promise Never Resolves (PARTIALLY SOLVED)
**Status**: ✅ WORKING - Videos now upload and save successfully
**Symptom**: Video recording starts and stops but `recordAsync()` promise never resolves
**Impact**: ✅ FIXED - Videos now save to database and show preview modal

**Debugging Logs**:
```
LOG  🔼 Press out detected
LOG  ⏹️ Stopping recording due to press out
LOG  ⏹️ Stopping video recording...
LOG  ✅ Stop recording call completed
LOG  ⏰ Recording timeout - forcing state reset
// ❌ Missing: "Video recording completed" log
```

**Root Cause**: Race condition between state management and camera promise
- `recordAsync()` promise doesn't resolve when `stopRecording()` is called
- State gets confused: shows `isRecording: false` but then `isRecording: true` in subsequent calls
- Promise timeout (3-5 seconds) is the only thing that resets state

**Failed Debugging Attempts**:
1. ❌ **Immediate state reset**: Setting `isRecording = false` immediately in `handleStopRecording` created race conditions
2. ❌ **Complex timeout logic**: Multiple timers caused state conflicts
3. ❌ **Promise ref management**: Storing `recordingPromiseRef.current` didn't help promise resolution

**✅ SUCCESSFUL SOLUTION**:
**Don't modify `isRecording` state in `handleStopRecording`** - let the natural flow handle it
```typescript
// ✅ WORKING APPROACH:
const handleStopRecording = async () => {
  // Just call stopRecording, don't modify state immediately
  cameraRef.current.stopRecording();
  
  // Set timeout only as backup cleanup (5 seconds)
  setTimeout(() => {
    if (isRecording) resetRecordingState();
  }, 5000);
};
```

**Key Insight**: The race condition was caused by premature state modification. Video upload and database save work fine even if the promise doesn't resolve - the timeout cleanup handles the UI state.

### 2. React Native Blob Incompatibility with Supabase (SOLVED)
**Status**: ✅ FIXED
**Problem**: Supabase uploads showed 0 bytes for both photos and videos
**Root Cause**: React Native's Blob polyfill lacks `arrayBuffer()` method that Supabase client expects

**Solution Applied**:
```typescript
// ❌ BROKEN: Using Supabase client with React Native Blob
const { data, error } = await supabase.storage
  .from('posts-media')
  .upload(filePath, blob, options);

// ✅ FIXED: Using Expo FileSystem.uploadAsync
const uploadResult = await FileSystem.uploadAsync(uploadUrl, fileUri, {
  httpMethod: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
```

**Status**: Photos now upload correctly (✅), Videos still fail due to Promise issue above

### 3. TypeError: Cannot read property 'back' of undefined (SOLVED)
**Location**: `src/components/camera/CameraInterface.tsx:34:18`

**Root Cause**: Using old Camera API instead of new CameraView API
```typescript
// ❌ OLD API (causing error)
import { Camera, CameraType, FlashMode } from 'expo-camera';
const [type, setType] = useState(CameraType.back);

// ✅ NEW API (correct)
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
const [facing, setFacing] = useState<CameraType>('back');
```

**Fix Required**: Complete rewrite of camera capture methods

### 2. expo-av Deprecation Warning
**Warning**: `Expo AV has been deprecated and will be removed in SDK 54`

**Impact**: MediaPreviewModal won't work properly for video playback
```typescript
// ❌ OLD (deprecated)
import { Video } from 'expo-av';

// ✅ NEW (correct)
import { VideoView, useVideoPlayer } from 'expo-video';
```

### 3. Expo Go Media Library Warning
**Warning**: `Expo Go can no longer provide full access to the media library`

**Impact**: Gallery picker won't work fully in Expo Go
**Solution**: Need development build for full testing

## 🔧 Architecture Issues to Fix

### Over-engineered Services
Current implementation has unnecessary complexity:

```typescript
// ❌ CURRENT: Custom service with manual permission handling
export class CameraService {
  async requestPermissions(): Promise<CameraPermissions> {
    // Complex manual permission logic
  }
}

// ✅ SHOULD BE: Simple hook usage
const [permission, requestPermission] = useCameraPermissions();
```

### Wrong Recording Methods
```typescript
// ❌ CURRENT: Non-existent methods
await cameraRef.current.recordAsync({
  quality: Camera.Constants.VideoQuality['720p'], // This doesn't exist
});

// ✅ SHOULD BE: Actual CameraView methods  
await cameraRef.current?.recordAsync({
  maxDuration: 10,
  maxFileSize: 50000000,
});
```

### Outdated Video Playback
```typescript
// ❌ CURRENT: Deprecated expo-av
<Video
  source={{ uri: media.uri }}
  useNativeControls
  resizeMode={ResizeMode.CONTAIN}
/>

// ✅ SHOULD BE: New expo-video
const player = useVideoPlayer(media.uri);
<VideoView player={player} />
```

## 🐛 Common Debug Scenarios

### Permission Issues
```bash
# Debug permissions
console.log('Camera permission:', permission?.granted);

# Common failures:
- permission is null (still loading)
- permission.granted is false (denied)
- canAskAgain is false (permanently denied)
```

### File System Issues
```bash
# Debug file paths
console.log('Photo URI:', photo.uri);
console.log('Video URI:', video.uri);

# Common failures:
- Files saved to cache, not permanent storage
- URIs not accessible across app restarts
- File size too large for upload
```

### Recording Failures
```bash
# Debug recording state
console.log('Is recording:', isRecording);
console.log('Camera ref exists:', !!cameraRef.current);

# Common failures:
- recordAsync called without permission
- stopRecording called when not recording
- Multiple recordings started simultaneously
```

### Video Promise Never Resolving (Current Issue)
**Debug Pattern**:
```typescript
// Add these logs to identify promise resolution issues:
console.log('🎥 Starting recordAsync...');
const recordingPromise = cameraRef.current.recordAsync({ maxDuration: 10000 });

recordingPromise
  .then((video) => {
    console.log('✅ Promise RESOLVED:', video?.uri); // This never appears
  })
  .catch((error) => {
    console.log('❌ Promise REJECTED:', error); // This might appear
  });

// When stopping:
console.log('⏹️ Calling stopRecording...');
cameraRef.current.stopRecording();
console.log('⏹️ stopRecording call completed');
// Promise should resolve here but doesn't
```

**Symptoms**:
- `stopRecording()` completes successfully
- No promise resolution (no "Promise RESOLVED" log)
- State gets stuck until timeout
- Video file IS created on device (can see in logs)
- But `onMediaCaptured` never called

**Investigation Areas**:
1. **Camera Mode**: Does switching between 'picture'/'video' modes affect promises?
2. **Permission Timing**: Is camera ready when recordAsync is called?
3. **Platform Differences**: iOS vs Android promise behavior
4. **Expo SDK Version**: Known issues with expo-camera 15.0.14?

## 🔍 Debugging Tools

### Console Debugging
```typescript
// Add debug logging to camera operations
const handleTakePhoto = async () => {
  console.log('🔍 Starting photo capture...');
  console.log('Camera ref:', !!cameraRef.current);
  console.log('Permission granted:', permission?.granted);
  
  try {
    const result = await cameraRef.current?.takePictureAsync();
    console.log('✅ Photo captured:', result?.uri);
  } catch (error) {
    console.error('❌ Photo capture failed:', error);
  }
};
```

### Platform-Specific Issues
```typescript
// Debug platform differences
import { Platform } from 'react-native';

console.log('Platform:', Platform.OS);
console.log('Platform version:', Platform.Version);

// iOS-specific issues:
- Camera permission requires Info.plist entries
- Video codec options only work on iOS

// Android-specific issues:
- Different permission model
- File system access variations
```

### Network Upload Debugging
```typescript
// Debug upload process
const uploadMedia = async (media: MediaFile) => {
  console.log('📤 Starting upload:', media.uri);
  console.log('File type:', media.type);
  console.log('User ID:', userId);
  
  try {
    const result = await mediaUploadService.uploadMedia(media, userId);
    console.log('✅ Upload successful:', result.url);
  } catch (error) {
    console.error('❌ Upload failed:', error);
    console.log('Network status:', navigator.onLine);
  }
};
```

## 🧪 Testing Checklist for Fixes

### 1. Basic Camera Functionality
- [ ] Camera view loads without errors
- [ ] Permission prompt appears correctly
- [ ] Photo capture works (takePictureAsync)
- [ ] Video recording works (recordAsync/stopRecording)

### 2. Video Playback  
- [ ] Videos play in preview modal
- [ ] Native controls work
- [ ] No expo-av deprecation warnings
- [ ] Thumbnail generation works

### 3. File Handling
- [ ] Images save to correct location
- [ ] Videos save to correct location  
- [ ] File URIs are accessible
- [ ] Upload to Supabase succeeds

### 4. Permissions
- [ ] Camera permission requested properly
- [ ] Denied permissions handled gracefully
- [ ] Media library access works (in dev build)
- [ ] Location permission optional

## 🚫 What NOT to Do

### Don't Use These Deprecated APIs:
```typescript
// ❌ Avoid these completely
import { Camera } from 'expo-camera';           // Old camera API
import { Video } from 'expo-av';                // Deprecated video
import { Audio } from 'expo-av';                // Use expo-audio instead
```

### Don't Over-Engineer:
```typescript
// ❌ Don't create unnecessary abstractions
class MediaManager extends EventEmitter {
  // Complex state management that expo hooks handle
}

// ✅ Use built-in hooks instead
const [permission, requestPermission] = useCameraPermissions();
const player = useVideoPlayer(videoSource);
```

### Don't Ignore Platform Differences:
```typescript
// ❌ Don't assume all features work everywhere
if (Platform.OS === 'web') {
  // Camera might not work on web
  return <WebCameraFallback />;
}
```

## 🎯 Priority Fix List

1. **CRITICAL**: Fix CameraView imports and methods
2. **HIGH**: Replace expo-av with expo-video  
3. **HIGH**: Simplify permission handling
4. **MEDIUM**: Update MediaUploadService error handling
5. **MEDIUM**: Add platform-specific fallbacks
6. **LOW**: Optimize file compression settings

## 📱 Device Testing Requirements

### Expo Go Limitations:
- Media library access limited
- Some camera features may not work
- Push notifications don't work

### Development Build Required For:
- Full media library access
- Complete camera functionality
- Production-like testing
- Platform-specific features

### Physical Device Required For:
- Camera testing (simulators limited)
- Video recording
- Performance testing
- Real-world network conditions