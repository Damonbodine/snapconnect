# Profile User Flows Documentation

This document outlines the key user interaction flows within the profile system.

## 🎯 Primary User Flows

### 1. Profile Creation Flow
New user completing their initial profile setup.

```
📱 Onboarding Start
    ↓
📝 Username Selection
    ↓
🏋️ Fitness Level Selection
    ↓
🎯 Goals Selection
    ↓
🍽️ Dietary Preferences
    ↓
📅 Workout Frequency
    ↓
✅ Profile Created
    ↓
🏠 Main App (Profile Tab)
```

#### Implementation Details
- Uses `createProfile()` from authStore
- Validates username uniqueness
- Sets default workout intensity to 'moderate'
- Redirects to main app on completion

### 2. Profile Viewing Flow
User exploring their own or others' profiles.

```
👤 Profile Tab Tap
    ↓
📄 Profile Screen Loads
    ├─→ 👥 Friends Preview → Friends Page
    ├─→ ✏️ Edit Button → Edit Profile
    ├─→ 🖼️ Avatar Tap → Image Picker
    └─→ 🚪 Sign Out → Authentication
```

#### Key Interactions
- **Friends Preview**: Shows 3 overlapping avatars + count
- **Bio Display**: Only shown if user has entered bio
- **City Display**: Shows with 📍 emoji if present
- **Intensity Display**: Shows emoji + descriptive label

### 3. Profile Editing Flow
User updating their profile information.

```
✏️ Edit Profile Button
    ↓
📝 Edit Profile Screen
    ├─→ 📝 Full Name Field
    ├─→ ✨ Bio Field (150 char limit)
    ├─→ 📍 City Field
    └─→ ⚡ Workout Intensity Selection
    ↓
💾 Save Button
    ├─→ ✅ Success → Back to Profile
    └─→ ❌ Error → Show Alert
```

#### Validation Rules
- **Bio**: Maximum 150 characters with real-time counter
- **Workout Intensity**: Must select one of three options
- **Save**: Only updates changed fields for efficiency

### 4. Friends Management Flow
User viewing and managing their friends list.

```
👥 Friends Preview Tap
    ↓
📋 Friends Page Loads
    ├─→ 🔔 Pending Requests (if any)
    │   ├─→ ✅ Accept Request
    │   └─→ ❌ Decline Request
    └─→ 👫 Friends List
        └─→ 👤 Friend Tap → User Profile
```

#### Friend Request Handling
```
🔔 Pending Request Appears
    ↓
👀 User Reviews Request
    ├─→ ✅ Accept
    │   ├─→ 🎉 Success Alert
    │   └─→ 📝 Friend Added to List
    └─→ ❌ Decline
        ├─→ 📝 Request Removed
        └─→ 💬 Decline Confirmation
```

### 5. Avatar Update Flow
User changing their profile picture.

```
🖼️ Avatar Tap
    ↓
📱 Image Picker Opens
    ├─→ 📷 Camera
    └─→ 📁 Photo Library
    ↓
✂️ Image Cropping (1:1 aspect)
    ↓
⬆️ Upload Process
    ├─→ 🔄 Loading State
    ├─→ ✅ Success → Update UI
    └─→ ❌ Error → Show Alert
```

#### Technical Implementation
```typescript
const uploadAvatar = async (uri: string) => {
  setUploading(true);
  try {
    // Optimize image
    const optimized = await ImageManipulator.manipulateAsync(uri, 
      [{ resize: { width: 1080 } }], 
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    // Upload to Supabase Storage
    const fileName = `${user.id}-${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, blob, { upsert: true });
    
    // Update profile with new URL
    const publicUrl = supabase.storage.from('avatars').getPublicUrl(fileName);
    await updateProfile({ avatar_url: `${publicUrl.data.publicUrl}?t=${Date.now()}` });
    
    Alert.alert('Success', 'Profile photo updated!');
  } catch (error) {
    Alert.alert('Error', 'Failed to update profile photo');
  } finally {
    setUploading(false);
  }
};
```

## 🔄 State Transitions

### Profile Data States
```
📊 Profile States
├─→ 🔄 Loading (initial fetch)
├─→ ✅ Loaded (data available)
├─→ 📝 Editing (form active)
├─→ 💾 Saving (update in progress)
├─→ ❌ Error (failed operation)
└─→ 🔄 Refreshing (manual refresh)
```

### Friends Data States
```
👥 Friends States
├─→ 🔄 Loading Friends
├─→ 🔔 Loading Requests
├─→ ✅ Data Loaded
├─→ 📝 Processing Request (accept/decline)
├─→ ❌ Error State
└─→ 📭 Empty State (no friends)
```

## 📱 Screen Navigation Patterns

### Tab-Based Navigation
```
🏠 Main Tabs
├─→ 🔍 Discover
├─→ 👥 Clique
├─→ 📸 Camera
├─→ 📅 Events
├─→ 👤 Profile (current)
└─→ 💬 Messages
```

### Profile Stack Navigation
```
👤 Profile Tab
├─→ ✏️ Edit Profile (modal)
├─→ 👥 Friends Page (push)
│   └─→ 👤 Individual Friend (push)
├─→ ⚙️ Settings (future)
└─→ 🚪 Sign Out (replace with auth)
```

### Navigation Implementation
```typescript
// Tab navigation (bottom tabs)
router.push('/(tabs)/profile');

// Stack navigation (new screen)
router.push('/friends');
router.push('/edit-profile');
router.push(`/user/${userId}`);

// Replace navigation (sign out)
router.replace('/');

// Back navigation
router.back();
```

## 🎨 UI State Patterns

### Loading States
```typescript
// Button loading state
<Pressable disabled={isLoading}>
  <Text>{isLoading ? 'Saving...' : 'Save'}</Text>
</Pressable>

// Avatar loading state
{uploading ? (
  <View className="w-32 h-32 rounded-full bg-gray-800 items-center justify-center">
    <Text className="text-[#EC4899]">Uploading...</Text>
  </View>
) : (
  <Image source={{ uri: avatar_url }} className="w-32 h-32 rounded-full" />
)}
```

### Empty States
```typescript
// No friends empty state
{friends.length === 0 ? (
  <View className="flex-1 items-center justify-center mt-20">
    <Text className="text-6xl mb-4">👥</Text>
    <Text className="text-white text-xl font-semibold mb-2">No Friends Yet</Text>
    <Text className="text-gray-400 text-center text-sm">
      Start connecting with other fitness enthusiasts!
    </Text>
  </View>
) : (
  <FriendsList friends={friends} />
)}
```

### Error States
```typescript
// Form validation error
if (bio.length > BIO_MAX_LENGTH) {
  Alert.alert('Error', `Bio must be ${BIO_MAX_LENGTH} characters or less`);
  return;
}

// Network error handling
try {
  await updateProfile(updates);
  Alert.alert('Success', 'Profile updated successfully!');
} catch (error) {
  Alert.alert('Error', error.message || 'Failed to update profile');
}
```

## 🔄 Data Synchronization Flows

### Optimistic Updates
```typescript
const handleOptimisticUpdate = async (updates: Partial<UserProfile>) => {
  const previousProfile = profile;
  
  // 1. Update UI immediately
  setProfile({ ...profile, ...updates });
  
  try {
    // 2. Sync with server
    await updateProfile(updates);
  } catch (error) {
    // 3. Rollback on failure
    setProfile(previousProfile);
    showError(error);
  }
};
```

### Real-time Sync
```typescript
// Friends data sync
useEffect(() => {
  if (user) {
    fetchFriends();
    fetchPendingRequests();
    
    // Set up real-time listeners
    const subscription = supabase
      .channel('friendships')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `user_id=eq.${user.id}`
      }, handleFriendshipChange)
      .subscribe();
      
    return () => subscription.unsubscribe();
  }
}, [user]);
```

## 💡 User Experience Considerations

### Performance Optimizations
- **Image compression**: Reduce avatar file sizes before upload
- **Lazy loading**: Load friends list on demand
- **Memoization**: Prevent unnecessary re-renders
- **Debounced inputs**: Reduce validation frequency

### Accessibility Features
- **Screen reader support**: Proper labels and descriptions
- **Keyboard navigation**: Tab order and focus management
- **High contrast**: WCAG AA compliant colors
- **Touch targets**: Minimum 44px interactive areas

### Error Recovery
- **Retry mechanisms**: Allow users to retry failed operations
- **Offline support**: Cache profile data for offline viewing
- **Graceful degradation**: Show partial data when possible
- **Clear messaging**: Explain what went wrong and how to fix it

## 🧪 Testing Scenarios

### Happy Path Testing
1. **Profile Creation**: Complete onboarding successfully
2. **Profile Update**: Edit and save profile changes
3. **Friends Management**: Accept/decline friend requests
4. **Avatar Upload**: Successfully update profile picture

### Edge Case Testing
1. **Network Failures**: Handle offline scenarios gracefully
2. **Large Files**: Test avatar upload limits
3. **Character Limits**: Validate bio length constraints
4. **Concurrent Updates**: Handle simultaneous profile edits

### Error Scenarios
1. **Invalid Data**: Test form validation edge cases
2. **Server Errors**: Handle API failures appropriately
3. **Permission Issues**: Handle storage upload failures
4. **Rate Limiting**: Handle API rate limit responses

---

*These flows ensure a smooth, intuitive user experience while maintaining data consistency and providing appropriate feedback at every step.*