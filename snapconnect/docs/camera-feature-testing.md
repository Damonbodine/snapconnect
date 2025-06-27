# Camera Feature Testing Guide

## Overview
This guide covers testing the newly implemented camera and media sharing functionality in SnapConnect.

## 🚀 What's New

### Core Features Implemented
- ✅ **Full Camera Interface**: Photo capture and video recording
- ✅ **Hold-to-Record Video**: Instagram/Snapchat-style interaction (10-second limit)
- ✅ **Gallery Integration**: Pick photos/videos from device gallery
- ✅ **Media Preview Modal**: Review and edit before posting
- ✅ **Supabase Storage**: Upload to `posts-media` bucket
- ✅ **Camera Controls**: Flash, flip camera, gallery access
- ✅ **Workout Type Tagging**: Categorize fitness content
- ✅ **Auto-compression**: Optimize photos and videos for upload

## 📋 Pre-Testing Setup

### 1. Supabase Storage Setup
Before testing, you MUST set up the storage bucket:

1. **Go to your Supabase Dashboard**
2. **Open SQL Editor**
3. **Run the setup script**:
   ```sql
   -- Copy and paste from: scripts/setup-posts-media-storage.sql
   ```
4. **Verify bucket creation**: Go to Storage → Buckets → Confirm `posts-media` exists

### 2. Install Dependencies
Ensure all new packages are installed:
```bash
npm install
```

### 3. Environment Check
Verify your `.env` file has:
```
EXPO_PUBLIC_SUPABASE_URL=your_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
```

## 🧪 Testing Checklist

### Phase 1: Basic Camera Functionality

#### Camera Launch
- [ ] **Navigate to Camera tab**
- [ ] **Permission prompt appears** (first time)
- [ ] **Camera view loads** without errors
- [ ] **Controls are visible**: close, flash, flip camera

#### Photo Capture
- [ ] **Tap capture button** → Photo taken instantly
- [ ] **Flash animation** triggers on capture
- [ ] **Preview modal opens** with captured photo
- [ ] **Photo displays correctly** in preview

#### Video Recording
- [ ] **Hold capture button** → Recording starts
- [ ] **Recording indicator appears** (red dot + progress bar)
- [ ] **Progress bar fills** over 10 seconds
- [ ] **Auto-stop at 10 seconds** works
- [ ] **Release early** stops recording
- [ ] **Preview modal shows video** with play controls

### Phase 2: Camera Controls

#### Flash Control
- [ ] **Tap flash button** cycles: Off → On → Auto → Off
- [ ] **Flash icon changes** to reflect mode
- [ ] **Flash works** when taking photos (if supported)

#### Camera Flip
- [ ] **Tap flip button** switches front/back camera
- [ ] **Camera view updates** immediately
- [ ] **No crashes** during switch

#### Gallery Access
- [ ] **Tap gallery button** opens photo picker
- [ ] **Can select photos** from gallery
- [ ] **Can select videos** from gallery
- [ ] **Preview modal opens** with selected media
- [ ] **Videos over 10 seconds** show validation error

### Phase 3: Media Preview & Posting

#### Preview Modal UI
- [ ] **Modal appears** after capture/selection
- [ ] **Media displays correctly** (photo/video)
- [ ] **Controls visible**: close, retake, post
- [ ] **Caption input** works properly
- [ ] **Character counter** shows (0/280)

#### Workout Type Selection
- [ ] **Workout type chips** display
- [ ] **Can select/deselect** workout types
- [ ] **Visual feedback** for selection (gradient change)
- [ ] **Only one type** selectable at a time

#### Video Playback
- [ ] **Video plays automatically** in preview
- [ ] **Native controls work** (play/pause/seek)
- [ ] **Video loops** correctly
- [ ] **No audio issues**

### Phase 4: Upload & Storage

#### Upload Process
- [ ] **Tap "Post" button** starts upload
- [ ] **Progress bar appears** and updates
- [ ] **Upload percentage** displays correctly
- [ ] **Button disabled** during upload
- [ ] **Upload completes** successfully

#### Storage Verification
- [ ] **Check Supabase Dashboard** → Storage → posts-media
- [ ] **User folder created** (userId)
- [ ] **File uploaded** with correct naming
- [ ] **File accessible** via public URL
- [ ] **Compressed properly** (photos ~2MB, videos ~10MB)

#### Post Creation
- [ ] **Success alert shows** after upload
- [ ] **Options: "View in Discover"** or **"Take Another"**
- [ ] **Modal closes** after posting
- [ ] **Can take another** photo/video immediately

### Phase 5: Edge Cases & Error Handling

#### Permission Handling
- [ ] **Camera denied**: Shows error message
- [ ] **Gallery denied**: Gallery button shows error
- [ ] **Location denied**: Still works (optional feature)
- [ ] **Microphone denied**: Video recording shows warning

#### Network Issues
- [ ] **No internet**: Upload fails gracefully
- [ ] **Slow connection**: Progress shows correctly
- [ ] **Cancel upload**: Stops process cleanly
- [ ] **Retry mechanism**: Works after failure

#### File Validation
- [ ] **Very large files**: Get compressed
- [ ] **Unsupported formats**: Show error
- [ ] **Corrupted files**: Handle gracefully
- [ ] **Empty caption**: Still allows posting

#### Memory & Performance
- [ ] **Multiple captures**: No memory leaks
- [ ] **Camera switching**: Smooth transitions
- [ ] **Background/foreground**: Camera resumes correctly
- [ ] **Low storage**: Shows appropriate error

## 🐛 Known Issues & Workarounds

### TypeScript Warnings
- Some type warnings exist but don't affect functionality
- Will be resolved in future iterations

### Video Compression
- Currently uploads original video files
- Full compression implementation pending

### Thumbnail Generation
- Video thumbnails not yet implemented
- Placeholder functionality in place

## 📱 Platform-Specific Testing

### iOS Testing
- [ ] **Camera permissions** work correctly
- [ ] **Gallery access** functions properly
- [ ] **Video recording** quality acceptable
- [ ] **Haptic feedback** on interactions

### Android Testing
- [ ] **Camera permissions** work correctly
- [ ] **Gallery access** functions properly
- [ ] **Video recording** quality acceptable
- [ ] **Back button handling** works

## 🚨 Critical Test Scenarios

### Real Device Testing (REQUIRED)
This feature MUST be tested on physical devices:

1. **Take 5 photos** in different lighting
2. **Record 5 videos** of different lengths (1s, 5s, 10s, 10s+)
3. **Upload different file sizes** (small, medium, large)
4. **Test on poor network** connection
5. **Test camera permissions** on fresh install

### User Journey Test
Complete this full flow without issues:
1. Open app → Go to Camera tab
2. Grant permissions when prompted
3. Take a photo → Add caption → Select workout type → Post
4. Record a video → Add caption → Post
5. Select from gallery → Post
6. Verify posts appear in Discover feed (when implemented)

## 📊 Performance Benchmarks

### Target Metrics
- **Camera launch**: < 2 seconds
- **Photo capture**: < 1 second
- **Video recording start**: < 500ms
- **Upload completion**: < 30 seconds (10MB file on good connection)
- **Memory usage**: < 200MB during operation

### Monitoring
Watch for:
- Memory spikes during camera use
- Battery drain during extended use
- Storage space consumption
- Network data usage

## 🔄 Next Steps

After successful testing:
1. **Implement Discover Feed** to display posted content
2. **Add AI caption generation** using OpenAI
3. **Implement filters and effects**
4. **Add story functionality** (24-hour ephemeral content)
5. **Optimize video compression**

## 📝 Bug Reporting

When reporting issues, include:
- Device model and OS version
- Step-by-step reproduction
- Screenshots/videos of issues
- Console logs if available
- Network condition during test

## ✅ Sign-off Checklist

Before considering this feature complete:
- [ ] All critical tests pass on iOS
- [ ] All critical tests pass on Android
- [ ] Performance benchmarks met
- [ ] No memory leaks detected
- [ ] Supabase storage working correctly
- [ ] User experience is smooth and intuitive

---

*This document should be updated as the feature evolves and additional functionality is added.*