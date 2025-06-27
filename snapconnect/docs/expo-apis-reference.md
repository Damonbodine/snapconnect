# Expo APIs Reference for Media Capture & Playback

## 📸 expo-camera (Latest SDK)

### Core Component: `CameraView`

```typescript
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';

// Basic setup
const [facing, setFacing] = useState<CameraType>('back');
const [permission, requestPermission] = useCameraPermissions();
```

### Photo Capture API
```typescript
// Method: takePictureAsync(options)
const photo = await cameraRef.current?.takePictureAsync({
  quality: 0.8,           // 0-1, image quality
  base64: false,          // Include base64 string
  exif: true,             // Include EXIF data
  skipProcessing: false,  // Skip automatic processing
});

// Returns:
{
  uri: string,
  width: number,
  height: number,
  exif?: object,
  base64?: string
}
```

### Video Recording API
```typescript
// Start recording
const video = await cameraRef.current?.recordAsync({
  maxDuration: 30,        // Max duration in seconds
  maxFileSize: 10000000,  // Max file size in bytes
  codec: 'mp4v',          // iOS only: 'mp4v' | 'avc1'
});

// Stop recording
await cameraRef.current?.stopRecording();

// Returns:
{
  uri: string
}
```

### Camera Props
```typescript
<CameraView
  facing={facing}                    // 'front' | 'back'
  flash={'off' | 'on' | 'auto'}     // Flash mode
  mode={'picture' | 'video'}        // Capture mode
  zoom={0.5}                        // 0-1 zoom level
  style={styles.camera}
  ref={cameraRef}
>
  {/* Camera overlay content */}
</CameraView>
```

### Permission Hook
```typescript
const [permission, requestPermission] = useCameraPermissions();

// Permission object structure:
{
  granted: boolean,
  canAskAgain: boolean,
  status: 'granted' | 'denied' | 'undetermined'
}
```

## 🎥 expo-video (Replaces expo-av)

### Core Components
```typescript
import { VideoView, useVideoPlayer } from 'expo-video';

// Player setup
const player = useVideoPlayer(videoSource, (player) => {
  player.loop = true;
  player.play();
});
```

### Video Playback
```typescript
// Basic video component
<VideoView
  style={styles.video}
  player={player}
  allowsFullscreen
  allowsPictureInPicture
/>
```

### Player Methods
```typescript
player.play()                    // Start playback
player.pause()                   // Pause video
player.seekBy(10)               // Seek by seconds
player.replace(newSource)        // Change video source
player.remove()                  // Clean up player

// Thumbnail generation
const thumbnail = await player.generateThumbnailsAsync([
  { time: 5 }  // Generate at 5 seconds
]);
```

### Video Source Types
```typescript
// Local file
const localSource = require('./video.mp4');

// Remote URL
const remoteSource = { uri: 'https://example.com/video.mp4' };

// Cache control
const cachedSource = { 
  uri: 'https://example.com/video.mp4',
  metadata: { title: 'My Video' }
};
```

## 📷 expo-image-picker

### Gallery Access
```typescript
import * as ImagePicker from 'expo-image-picker';

// Launch image library
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.All,
  allowsEditing: true,
  aspect: [4, 3],
  quality: 1,
  videoQuality: ImagePicker.VideoQuality.High,
  videoMaxDuration: 30,
});

// Permission check
const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
```

## 🖼️ expo-image-manipulator

### Image Processing
```typescript
import * as ImageManipulator from 'expo-image-manipulator';

// Resize and compress
const result = await ImageManipulator.manipulateAsync(
  imageUri,
  [
    { resize: { width: 1080, height: 1080 } },
    { rotate: 90 }
  ],
  {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: false
  }
);
```

## 🏗️ Architecture Implications

### What We Can Do:
1. ✅ Photo capture with CameraView.takePictureAsync()
2. ✅ Video recording with CameraView.recordAsync()
3. ✅ Video playback with VideoView + useVideoPlayer
4. ✅ Gallery selection with ImagePicker
5. ✅ Image compression with ImageManipulator
6. ✅ Permission handling with useCameraPermissions

### What We Need to Change:
1. 🔄 Replace expo-av with expo-video for playback
2. 🔄 Update CameraInterface to use CameraView API
3. 🔄 Simplify permission handling using hooks
4. 🔄 Use VideoView in MediaPreviewModal

### Platform Support:
- **iOS**: Full support for all features
- **Android**: Full support for all features  
- **Web**: Limited camera and video support
- **Expo Go**: Limited media library access (warning in logs)

## 📝 Best Practices

### Performance:
- Use VideoView for playback, not web video elements
- Generate thumbnails for video previews
- Compress images before upload
- Cache video content when possible

### User Experience:
- Request permissions before showing camera
- Provide fallbacks for denied permissions
- Show recording indicators during video capture
- Handle platform-specific limitations gracefully

### File Management:
- Videos/photos saved to app cache directory
- Clean up temporary files after upload
- Validate file sizes before processing
- Support common formats (MP4, JPEG, PNG)