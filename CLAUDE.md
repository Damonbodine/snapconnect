# CLAUDE.md - AI Assistant Development Guide for SnapConnect

## Project Overview

SnapConnect is a RAG-enhanced fitness social platform that combines Snapchat's core features   with AI-powered content generation, community, and coaching for fitness enthusiasts. This document provides guidance for AI assistants working on this project.

## Quick Start Commands

```bash
# Install dependencies
npm install

# Run on iOS
npm run ios

# Run on Android  
npm run android

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run typecheck

# Build for production
eas build --platform all
```

## Tech Stack Reference

- **Frontend**: React Native 0.74.x + Expo SDK 51
- **Language**: TypeScript (strict mode enabled)
- **State Management**: Zustand 4.5.x
- **Backend**: Supabase (Auth, Database, Storage, Realtime)
- **AI Integration**: OpenAI GPT-4 API
- **UI Framework**: [TBD - NativeWind/Tamagui/Gluestack]
- **Navigation**: Expo Router v3
- **Styling**: Gradient-based design with NativeWind
- **Testing**: Jest + React Native Testing Library

## Project Structure

```
snapconnect/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main tab screens
│   └── _layout.tsx        # Root layout
├── src/
│   ├── components/        # Reusable components
│   ├── stores/           # Zustand stores
│   ├── services/         # API and external services
│   ├── utils/            # Helper functions
│   └── types/            # TypeScript definitions
├── assets/               # Images, fonts, etc.
└── docs/                 # Documentation
```

## Coding Standards

### TypeScript Guidelines
```typescript
// Always use strict types
interface UserProfile {
  id: string;
  username: string;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  goals: FitnessGoal[];
}

// Prefer const assertions
const WORKOUT_TYPES = ['cardio', 'strength', 'flexibility'] as const;

// Use proper error handling
try {
  const result = await generateCaption(image);
  return result;
} catch (error) {
  console.error('Caption generation failed:', error);
  throw new AppError('Failed to generate caption', error);
}
```

### Component Patterns
```typescript
// Use functional components with TypeScript
interface Props {
  user: UserProfile;
  onPress: () => void;
}

export const UserCard: React.FC<Props> = ({ user, onPress }) => {
  // Use custom hooks for logic
  const { theme } = useTheme();
  
  // Memoize expensive computations
  const gradient = useMemo(() => 
    generateGradient(user.fitnessLevel), 
    [user.fitnessLevel]
  );
  
  return (
    <GradientCard gradient={gradient} onPress={onPress}>
      {/* Component content */}
    </GradientCard>
  );
};
```

### State Management with Zustand
```typescript
// Define stores with TypeScript
interface AuthStore {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,
  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const user = await authService.login(credentials);
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  logout: () => set({ user: null }),
}));
```

## RAG Integration Guidelines

### Content Generation Pattern
```typescript
// Always provide context for better generation
const generateWorkoutCaption = async (
  image: string,
  userProfile: UserProfile,
  recentPosts: Post[]
) => {
  const context = {
    userFitnessLevel: userProfile.fitnessLevel,
    userGoals: userProfile.goals,
    recentTopics: extractTopics(recentPosts),
    imageAnalysis: await analyzeWorkoutImage(image),
  };
  
  const prompt = buildPrompt('workout_caption', context);
  const caption = await openaiService.generate(prompt);
  
  return sanitizeAndPersonalize(caption, userProfile);
};
```

### Vector Search Implementation
```typescript
// Use embeddings for semantic search
const findSimilarWorkouts = async (query: string) => {
  const embedding = await generateEmbedding(query);
  
  const { data, error } = await supabase.rpc('match_workouts', {
    query_embedding: embedding,
    match_threshold: 0.78,
    match_count: 10,
  });
  
  return data;
};
```

## Supabase Integration

### Database Queries
```typescript
// Use proper error handling and types
const fetchUserPosts = async (userId: string): Promise<Post[]> => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) throw new DatabaseError('Failed to fetch posts', error);
  return data;
};
```

### Real-time Subscriptions
```typescript
// Set up real-time listeners properly
useEffect(() => {
  const subscription = supabase
    .channel('messages')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => handleNewMessage(payload.new)
    )
    .subscribe();
    
  return () => {
    subscription.unsubscribe();
  };
}, []);
```

## UI/UX Guidelines

### Gradient Implementation
```typescript
// Use consistent gradient patterns
const gradients = {
  primary: ['#7C3AED', '#EC4899'],
  secondary: ['#F472B6', '#FBBF24'],
  success: ['#10B981', '#34D399'],
  danger: ['#EF4444', '#F87171'],
};

// Apply gradients consistently
<LinearGradient
  colors={gradients.primary}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.container}
>
  {children}
</LinearGradient>
```

### Animation Standards
```typescript
// Use React Native Reanimated for smooth animations
const animatedStyle = useAnimatedStyle(() => {
  return {
    transform: [
      {
        scale: withSpring(pressed.value ? 0.95 : 1, {
          damping: 15,
          stiffness: 150,
        }),
      },
    ],
  };
});
```

## Performance Optimization

### Image Handling
```typescript
// Always optimize images
const optimizeImage = async (uri: string) => {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1080 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );
  return manipulated.uri;
};
```

### Memoization
```typescript
// Memoize expensive operations
const MemoizedWorkoutList = React.memo(WorkoutList, (prev, next) => {
  return prev.workouts.length === next.workouts.length &&
         prev.userId === next.userId;
});
```

## Testing Guidelines

### Component Testing
```typescript
describe('UserCard', () => {
  it('should display user information correctly', () => {
    const user = mockUser();
    const { getByText } = render(<UserCard user={user} />);
    
    expect(getByText(user.username)).toBeTruthy();
    expect(getByText(user.fitnessLevel)).toBeTruthy();
  });
});
```

### Integration Testing
```typescript
describe('Caption Generation', () => {
  it('should generate relevant fitness captions', async () => {
    const caption = await generateWorkoutCaption(
      mockImage,
      mockUserProfile,
      mockRecentPosts
    );
    
    expect(caption).toContain(mockUserProfile.goals[0]);
    expect(caption.length).toBeLessThan(280);
  });
});
```

## Deployment Checklist

- [ ] Run `npm run typecheck` - no errors
- [ ] Run `npm run lint` - no errors
- [ ] Run `npm test` - all tests pass
- [ ] Check bundle size is under 50MB
- [ ] Verify all environment variables are set
- [ ] Test on both iOS and Android devices
- [ ] Ensure all API keys are in .env files
- [ ] Update version number in app.json
- [ ] Create release notes
- [ ] Submit to app stores

## Common Issues & Solutions

### Issue: Gradient performance on Android
```typescript
// Solution: Use native driver when possible
const animatedGradient = useAnimatedProps(() => {
  return {
    colors: [
      interpolateColor(progress.value, [0, 1], ['#7C3AED', '#EC4899']),
      interpolateColor(progress.value, [0, 1], ['#EC4899', '#F472B6']),
    ],
  };
});
```

### Issue: API rate limiting
```typescript
// Solution: Implement request queuing
const requestQueue = new PQueue({ 
  concurrency: 2, 
  interval: 1000, 
  intervalCap: 10 
});
```

## Security Best Practices

1. **Never commit sensitive data**
   - Use .env files for API keys
   - Add .env to .gitignore
   
2. **Validate all inputs**
   ```typescript
   const validateWorkoutData = (data: unknown): WorkoutData => {
     const schema = z.object({
       type: z.enum(['cardio', 'strength', 'flexibility']),
       duration: z.number().min(1).max(300),
       intensity: z.enum(['low', 'medium', 'high']),
     });
     
     return schema.parse(data);
   };
   ```

3. **Sanitize generated content**
   ```typescript
   const sanitizeAIContent = (content: string): string => {
     return DOMPurify.sanitize(content, {
       ALLOWED_TAGS: [],
       ALLOWED_ATTR: [],
     });
   };
   ```

## Git Workflow

```bash
# Feature branch workflow
git checkout -b feature/caption-generation
git add .
git commit -m "feat: add AI-powered caption generation"
git push origin feature/caption-generation

# Commit message format
# feat: new feature
# fix: bug fix
# docs: documentation changes
# style: code style changes
# refactor: code refactoring
# test: test additions or fixes
# chore: maintenance tasks
```

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)
- [Supabase Docs](https://supabase.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)

---

Remember: The goal is to create a polished, performant, and user-friendly fitness social platform that showcases the power of RAG in enhancing user-generated content. Always prioritize user experience and ensure AI-generated content feels natural and personalized.