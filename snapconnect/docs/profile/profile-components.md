# Profile UI Components Documentation

This document provides detailed information about all UI components related to the profile system.

## 🏠 Main Profile Components

### ProfileScreen (`/app/(tabs)/profile.tsx`)
The main profile screen displaying user information and navigation options.

#### Props
- None (uses `useAuthStore` and `useFriendsStore` hooks)

#### Features
- **Avatar Section**: Profile photo with upload capability
- **Bio Display**: User's fitness motto (if set)
- **Profile Info Card**: All user details in organized format
- **Friends Preview**: Overlapping avatars with friend count
- **Edit Profile Access**: Direct navigation to edit screen
- **Sign Out**: Secure logout functionality

#### Key Interactions
```typescript
// Avatar upload
const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.5,
  });
  if (!result.canceled) {
    await uploadAvatar(result.assets[0].uri);
  }
};

// Navigate to friends page
onPress={() => router.push('/friends')}

// Navigate to edit profile
onPress={() => router.push('/edit-profile')}
```

#### Layout Structure
```jsx
<LinearGradient colors={['#0F0F0F', '#1F1F1F']}>
  <ScrollView>
    {/* Avatar Section */}
    <View className="items-center mb-8">
      <Avatar />
      <Username />
      <Bio />
      <EditButton />
    </View>
    
    {/* Profile Info */}
    <ProfileInfoCard />
    
    {/* Friends Preview */}
    <FriendsPreviewSection />
    
    {/* Friend Requests */}
    <FriendRequestsSection />
    
    {/* Sign Out */}
    <SignOutButton />
  </ScrollView>
</LinearGradient>
```

### FriendsScreen (`/app/friends.tsx`)
Dedicated page for viewing and managing friends list.

#### Props
- None (uses hooks for data)

#### Features
- **Header Navigation**: Back button, title with friend count
- **Pending Requests**: Accept/decline friend requests
- **Friends List**: Scrollable list of all friends
- **Empty States**: Helpful messaging when no friends
- **Profile Navigation**: Tap friend to view their profile

#### Component Structure
```jsx
<LinearGradient>
  {/* Header */}
  <View className="flex-row items-center justify-between">
    <BackButton />
    <Title />
    <Spacer />
  </View>

  {/* Content */}
  <ScrollView>
    {/* Pending Requests Section */}
    {pendingRequests.length > 0 && (
      <PendingRequestsSection />
    )}

    {/* Friends List */}
    <FriendsList />
  </ScrollView>
</LinearGradient>
```

### EditProfileScreen (`/app/edit-profile.tsx`)
Form interface for updating profile information.

#### Props
- None (uses `useAuthStore` for current profile data)

#### Form Fields
- **Full Name**: Text input with word capitalization
- **Bio**: Multi-line text area with character counter
- **City**: Text input for location
- **Workout Intensity**: Card-based selection interface

#### Validation Features
```typescript
// Bio character limit validation
const BIO_MAX_LENGTH = 150;
if (bio.length > BIO_MAX_LENGTH) {
  Alert.alert('Error', `Bio must be ${BIO_MAX_LENGTH} characters or less`);
  return;
}

// Real-time character counter with color coding
<Text className={`text-sm ${
  bio.length > BIO_MAX_LENGTH ? 'text-red-400' : 
  bio.length > BIO_MAX_LENGTH * 0.8 ? 'text-yellow-400' : 
  'text-gray-500'
}`}>
  {bio.length}/{BIO_MAX_LENGTH}
</Text>
```

#### Save Logic
```typescript
const handleSave = async () => {
  const updates: any = {};
  
  // Only include changed fields
  if (fullName !== profile?.full_name) updates.full_name = fullName || null;
  if (bio !== profile?.bio) updates.bio = bio || null;
  if (city !== profile?.city) updates.city = city || null;
  if (workoutIntensity !== profile?.workout_intensity) updates.workout_intensity = workoutIntensity;
  
  if (Object.keys(updates).length > 0) {
    await updateProfile(updates);
    Alert.alert('Success', 'Profile updated successfully!');
  }
  
  router.back();
};
```

## 🧩 Reusable Components

### FriendsPreviewSection
Compact preview of friends shown on profile page.

#### Usage
```tsx
<Pressable
  onPress={() => router.push('/friends')}
  className="bg-gray-800/30 rounded-2xl p-6 mb-8 active:bg-gray-800/50"
>
  <View className="flex-row items-center justify-between">
    <FriendInfo />
    <FriendAvatars />
    <ViewAllLink />
  </View>
</Pressable>
```

#### Features
- **Friend Count**: Shows total number of friends
- **Avatar Stack**: Up to 3 overlapping friend avatars
- **Overflow Indicator**: "+X" for additional friends
- **Tap to Navigate**: Opens full friends page

### FriendCard
Individual friend display component used in friends list.

#### Props
```typescript
interface FriendCardProps {
  friend: UserProfile & { friendship_created_at: string };
  onPress: () => void;
}
```

#### Layout
```jsx
<Pressable onPress={onPress} className="bg-gray-800/30 rounded-2xl p-4 mb-3">
  <View className="flex-row items-center">
    <Avatar size={64} user={friend} />
    <FriendInfo friend={friend} />
    <ChevronIcon />
  </View>
</Pressable>
```

#### Displayed Information
- Large avatar (64x64px)
- Full name or username
- Username handle
- Bio (truncated to 1 line)
- Fitness level and workout intensity
- City (if available)
- "Friends since" date

### WorkoutIntensitySelector
Card-based selection interface for workout intensity preference.

#### Props
```typescript
interface WorkoutIntensitySelectorProps {
  value: 'chill' | 'moderate' | 'intense';
  onChange: (value: 'chill' | 'moderate' | 'intense') => void;
}
```

#### Implementation
```jsx
{intensityOptions.map((option) => (
  <Pressable
    key={option.value}
    onPress={() => onChange(option.value)}
    className={`bg-gray-800/30 rounded-2xl p-4 border-2 ${
      value === option.value ? 'border-[#EC4899]' : 'border-transparent'
    }`}
  >
    <View className="flex-row items-center">
      <Text className="text-2xl mr-3">{option.emoji}</Text>
      <View className="flex-1">
        <Text className="text-white font-semibold">{option.label}</Text>
        <Text className="text-gray-400 text-sm">{option.description}</Text>
      </View>
      {value === option.value && <CheckIcon />}
    </View>
  </Pressable>
))}
```

## 🎨 Design System Integration

### Color Palette
```typescript
const colors = {
  primary: '#EC4899',      // Pink for accents
  background: '#0F0F0F',   // Dark background
  card: '#1F1F1F',         // Card background
  text: '#FFFFFF',         // Primary text
  textSecondary: '#9CA3AF', // Secondary text
  textMuted: '#6B7280',    // Muted text
  border: '#374151',       // Borders
  success: '#10B981',      // Success states
  warning: '#F59E0B',      // Warning states
  error: '#EF4444',        // Error states
};
```

### Typography Scale
```typescript
const typography = {
  title: 'text-2xl font-bold',      // Profile username
  heading: 'text-xl font-bold',     // Section headings
  subheading: 'text-lg font-semibold', // Form labels
  body: 'text-base',                // Regular text
  caption: 'text-sm',               // Secondary info
  micro: 'text-xs',                 // Timestamps, counts
};
```

### Spacing System
```typescript
const spacing = {
  xs: 'p-1',      // 4px
  sm: 'p-2',      // 8px
  md: 'p-4',      // 16px
  lg: 'p-6',      // 24px
  xl: 'p-8',      // 32px
};
```

### Component Variants

#### Card Styles
```typescript
const cardStyles = {
  primary: 'bg-gray-800/30 rounded-2xl p-6',
  secondary: 'bg-gray-800/20 rounded-2xl p-4',
  accent: 'bg-pink-500/10 border border-pink-500/20 rounded-2xl p-4',
};
```

#### Button Styles
```typescript
const buttonStyles = {
  primary: 'bg-[#EC4899] rounded-lg px-4 py-2',
  secondary: 'bg-gray-700 rounded-lg px-4 py-2',
  ghost: 'bg-transparent border border-gray-600 rounded-lg px-4 py-2',
};
```

## 📱 Responsive Design

### Avatar Sizing
```typescript
const avatarSizes = {
  small: 32,    // Friend preview
  medium: 48,   // Friend requests
  large: 64,    // Friends list
  xlarge: 128,  // Profile page
};
```

### Breakpoint Considerations
- **Phone (< 400px)**: Single column layout, smaller touch targets
- **Large Phone (400px+)**: Standard layout with comfortable spacing
- **Tablet**: Consider multi-column layouts for friends list

## 🔄 State Management Integration

### Hook Usage Patterns
```typescript
// Profile data
const { user, profile, updateProfile } = useAuthStore();

// Friends data
const { friends, fetchFriends, pendingRequests } = useFriendsStore();

// Loading states
const [isLoading, setIsLoading] = useState(false);

// Form state
const [bio, setBio] = useState(profile?.bio || '');
```

### Optimistic Updates
```typescript
// Update UI immediately, rollback on error
const handleProfileUpdate = async (updates: Partial<UserProfile>) => {
  const previousProfile = profile;
  
  // Optimistic update
  setProfile({ ...profile, ...updates });
  
  try {
    await updateProfile(updates);
  } catch (error) {
    // Rollback on error
    setProfile(previousProfile);
    Alert.alert('Error', 'Failed to update profile');
  }
};
```

## ♿ Accessibility

### Accessibility Features
- **Semantic markup**: Proper heading hierarchy
- **Touch targets**: Minimum 44px touch areas
- **Screen reader support**: Descriptive labels and hints
- **Color contrast**: WCAG AA compliant color combinations
- **Focus management**: Proper tab order and focus indicators

### Implementation Examples
```typescript
// Accessible button
<Pressable
  onPress={handlePress}
  accessibilityRole="button"
  accessibilityLabel="Edit profile"
  accessibilityHint="Opens the profile editing screen"
  className="bg-gray-700 px-4 py-2 rounded-lg min-h-[44px]"
>
  <Text className="text-white">Edit Profile</Text>
</Pressable>

// Accessible form field
<TextInput
  value={bio}
  onChangeText={setBio}
  accessibilityLabel="Bio"
  accessibilityHint="Enter your fitness motto or tagline"
  placeholder="Share your fitness motto..."
/>
```

## 🧪 Testing Considerations

### Component Testing
```typescript
// Test profile display
describe('ProfileScreen', () => {
  it('should display user bio when present', () => {
    const mockUser = { bio: 'Fitness is life!' };
    render(<ProfileScreen />);
    expect(screen.getByText('"Fitness is life!"')).toBeTruthy();
  });
});

// Test form validation
describe('EditProfileScreen', () => {
  it('should prevent saving bio longer than 150 characters', async () => {
    const longBio = 'a'.repeat(151);
    // Test validation logic
  });
});
```

### Integration Testing
- Profile update flow end-to-end
- Friends page navigation and data loading
- Image upload and avatar update
- Form validation and error handling

---

*These components follow React Native best practices and maintain consistency with the SnapConnect design system.*