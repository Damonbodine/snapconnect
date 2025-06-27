# Supabase Best Practices for SnapConnect

## Table of Contents
- [Overview](#overview)
- [Database Best Practices](#database-best-practices)
- [Authentication & Security](#authentication--security)
- [Real-time Subscriptions](#real-time-subscriptions)
- [Storage Management](#storage-management)
- [Edge Functions](#edge-functions)
- [Performance Optimization](#performance-optimization)
- [React Native Integration](#react-native-integration)
- [Error Handling](#error-handling)
- [Testing Strategies](#testing-strategies)

## Overview

Supabase is an open-source Firebase alternative that provides:
- **Database**: Full Postgres database with real-time functionality
- **Authentication**: User management with multiple providers
- **Storage**: File storage with CDN and image optimization
- **Edge Functions**: Globally distributed TypeScript functions
- **Real-time**: Live data synchronization across clients

## Database Best Practices

### Table Design

```sql
-- Use lowercase with underscores for table names
CREATE TABLE user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  fitness_level TEXT CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
```

### TypeScript Integration

```typescript
// Define database types
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          fitness_level: 'beginner' | 'intermediate' | 'advanced';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          username: string;
          fitness_level: 'beginner' | 'intermediate' | 'advanced';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          username?: string;
          fitness_level?: 'beginner' | 'intermediate' | 'advanced';
          updated_at?: string;
        };
      };
    };
  };
}

// Create typed client
const supabase = createClient<Database>(url, key);
```

### Query Optimization

```typescript
// Use specific selects instead of *
const { data: profiles } = await supabase
  .from('user_profiles')
  .select('id, username, fitness_level')
  .eq('user_id', userId)
  .single();

// Use batch operations for multiple inserts
const { data, error } = await supabase
  .from('posts')
  .insert([
    { title: 'Post 1', content: 'Content 1' },
    { title: 'Post 2', content: 'Content 2' }
  ]);

// Use database functions for complex operations
const { data } = await supabase.rpc('calculate_user_stats', {
  user_id: userId,
  date_range: '30 days'
});
```

### Database Functions

```sql
-- Create reusable database functions
CREATE OR REPLACE FUNCTION get_user_workout_stats(user_uuid UUID)
RETURNS TABLE(
  total_workouts INTEGER,
  avg_duration NUMERIC,
  favorite_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER,
    AVG(duration),
    MODE() WITHIN GROUP (ORDER BY workout_type)
  FROM workouts 
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
```

## Authentication & Security

### Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

-- Create policies for user data access
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Public posts are viewable by all" ON posts
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

-- Secure function execution
CREATE POLICY "Authenticated users can call functions" ON posts
  FOR ALL USING (auth.role() = 'authenticated');
```

### Authentication Implementation

```typescript
// Authentication service
export class AuthService {
  async signUpWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    
    if (error) throw new AuthError('Sign up failed', error);
    return data;
  }

  async signInWithOAuth(provider: 'google' | 'apple' | 'github') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });
    
    if (error) throw new AuthError('OAuth sign in failed', error);
    return data;
  }

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw new AuthError('Failed to get user', error);
    return user;
  }

  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null);
    });
  }
}
```

### React Native Auth Integration

```typescript
// Auth store with Zustand
interface AuthStore {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  
  signIn: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      set({ 
        user: data.user, 
        session: data.session, 
        loading: false 
      });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },
  
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ user: null, session: null });
  }
}));

// Initialize auth state
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.setState({
    user: session?.user || null,
    session,
    loading: false
  });
});
```

## Real-time Subscriptions

### Database Change Subscriptions

```typescript
// Workout updates subscription
export const useWorkoutSubscription = (userId: string) => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    // Initial data fetch
    const fetchWorkouts = async () => {
      const { data } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      setWorkouts(data || []);
    };

    fetchWorkouts();

    // Subscribe to changes
    const subscription = supabase
      .channel('workout-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workouts',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setWorkouts(prev => [payload.new as Workout, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setWorkouts(prev => prev.map(w => 
            w.id === payload.new.id ? payload.new as Workout : w
          ));
        } else if (payload.eventType === 'DELETE') {
          setWorkouts(prev => prev.filter(w => w.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  return workouts;
};
```

### Presence and Broadcast

```typescript
// Real-time presence for workout sessions
export const useWorkoutPresence = (workoutId: string) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`workout-${workoutId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setParticipants(Object.values(state).flat());
      })
      .on('broadcast', { event: 'workout-update' }, (payload) => {
        // Handle workout updates from other participants
        console.log('Workout update:', payload);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            username: user.user_metadata?.username,
            status: 'active'
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [workoutId, user]);

  return { participants };
};
```

## Storage Management

### File Upload Patterns

```typescript
// Image upload service
export class StorageService {
  async uploadWorkoutImage(
    file: File | Blob,
    userId: string,
    workoutId: string
  ): Promise<string> {
    const fileExt = file.type.split('/')[1];
    const fileName = `${workoutId}-${Date.now()}.${fileExt}`;
    const filePath = `workouts/${userId}/${fileName}`;

    // Optimize image before upload
    const optimizedFile = await this.optimizeImage(file);

    const { data, error } = await supabase.storage
      .from('workout-images')
      .upload(filePath, optimizedFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw new StorageError('Upload failed', error);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('workout-images')
      .getPublicUrl(filePath);

    return publicUrl;
  }

  async optimizeImage(file: File | Blob): Promise<Blob> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        const maxWidth = 1080;
        const maxHeight = 1080;
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(resolve, 'image/jpeg', 0.8);
      };

      img.src = URL.createObjectURL(file);
    });
  }

  async deleteFile(filePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from('workout-images')
      .remove([filePath]);

    if (error) throw new StorageError('Delete failed', error);
  }
}
```

### React Native Storage

```typescript
// React Native specific image handling
import { ImageManipulator } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export class RNStorageService {
  async uploadImage(uri: string, path: string): Promise<string> {
    // Optimize image
    const optimized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1080 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Convert to blob
    const response = await fetch(optimized.uri);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from('images')
      .upload(path, blob);

    if (error) throw error;
    return data.path;
  }

  getPublicUrl(path: string): string {
    const { data } = supabase.storage
      .from('images')
      .getPublicUrl(path);
    
    return data.publicUrl;
  }
}
```

## Edge Functions

### Function Structure

```typescript
// edge-functions/generate-caption/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface CaptionRequest {
  imageUrl: string;
  userProfile: {
    fitnessLevel: string;
    goals: string[];
  };
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { imageUrl, userProfile }: CaptionRequest = await req.json();
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Analyze image and generate caption
    const caption = await generatePersonalizedCaption(imageUrl, userProfile);

    return new Response(
      JSON.stringify({ caption }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function generatePersonalizedCaption(
  imageUrl: string, 
  userProfile: any
): Promise<string> {
  // OpenAI integration logic here
  // Return personalized caption based on user profile and image
}
```

### Calling Edge Functions

```typescript
// Client-side function invocation
export const generateCaption = async (
  imageUrl: string,
  userProfile: UserProfile
): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('generate-caption', {
    body: {
      imageUrl,
      userProfile: {
        fitnessLevel: userProfile.fitness_level,
        goals: userProfile.goals
      }
    }
  });

  if (error) throw new Error(`Caption generation failed: ${error.message}`);
  return data.caption;
};
```

## Performance Optimization

### Query Optimization

```typescript
// Use indexes and specific selects
const { data: posts } = await supabase
  .from('posts')
  .select(`
    id,
    title,
    content,
    created_at,
    user_profiles!inner(username, avatar_url)
  `)
  .eq('is_public', true)
  .order('created_at', { ascending: false })
  .limit(20);

// Use pagination for large datasets
const { data, error } = await supabase
  .from('workouts')
  .select('*')
  .range(page * 10, (page + 1) * 10 - 1);
```

### Connection Pooling

```typescript
// Configure connection pooling
const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'snapconnect'
    }
  }
});
```

### Caching Strategies

```typescript
// React Query integration for caching
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: ['userProfile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', updates.user_id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['userProfile', data.user_id], data);
    }
  });
};
```

## React Native Integration

### Supabase Client Setup

```typescript
// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### Deep Linking Setup

```typescript
// app.json configuration
{
  "expo": {
    "scheme": "snapconnect",
    "web": {
      "bundler": "metro"
    }
  }
}

// Auth callback handling
export const handleAuthCallback = (url: string) => {
  const { hostname, pathname, searchParams } = new URL(url);
  
  if (hostname === 'auth' && pathname === '/callback') {
    const access_token = searchParams.get('access_token');
    const refresh_token = searchParams.get('refresh_token');
    
    if (access_token && refresh_token) {
      supabase.auth.setSession({
        access_token,
        refresh_token
      });
    }
  }
};
```

## Error Handling

### Custom Error Classes

```typescript
export class SupabaseError extends Error {
  constructor(
    message: string,
    public originalError?: any,
    public code?: string
  ) {
    super(message);
    this.name = 'SupabaseError';
  }
}

export class AuthError extends SupabaseError {
  constructor(message: string, originalError?: any) {
    super(message, originalError);
    this.name = 'AuthError';
  }
}

export class DatabaseError extends SupabaseError {
  constructor(message: string, originalError?: any) {
    super(message, originalError);
    this.name = 'DatabaseError';
  }
}

export class StorageError extends SupabaseError {
  constructor(message: string, originalError?: any) {
    super(message, originalError);
    this.name = 'StorageError';
  }
}
```

### Error Handling Patterns

```typescript
// Service layer error handling
export const workoutService = {
  async createWorkout(workout: CreateWorkoutInput): Promise<Workout> {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .insert(workout)
        .select()
        .single();

      if (error) {
        throw new DatabaseError('Failed to create workout', error);
      }

      return data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Unexpected error creating workout', error);
    }
  }
};

// Component error handling
export const WorkoutForm: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (workoutData: CreateWorkoutInput) => {
    setLoading(true);
    setError(null);

    try {
      await workoutService.createWorkout(workoutData);
      // Handle success
    } catch (error) {
      if (error instanceof AuthError) {
        setError('Please log in to create a workout');
      } else if (error instanceof DatabaseError) {
        setError('Failed to save workout. Please try again.');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      {error && <ErrorMessage message={error} />}
      {/* Form components */}
    </View>
  );
};
```

## Testing Strategies

### Unit Testing Database Functions

```typescript
// __tests__/services/workout.test.ts
import { workoutService } from '../src/services/workout';
import { supabase } from '../src/lib/supabase';

// Mock Supabase
jest.mock('../src/lib/supabase');

describe('WorkoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a workout successfully', async () => {
    const mockWorkout = {
      id: '123',
      title: 'Test Workout',
      user_id: 'user-123'
    };

    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockWorkout,
            error: null
          })
        })
      })
    });

    const result = await workoutService.createWorkout({
      title: 'Test Workout',
      user_id: 'user-123'
    });

    expect(result).toEqual(mockWorkout);
  });

  it('should handle database errors', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        })
      })
    });

    await expect(
      workoutService.createWorkout({
        title: 'Test Workout',
        user_id: 'user-123'
      })
    ).rejects.toThrow('Failed to create workout');
  });
});
```

### Integration Testing

```typescript
// __tests__/integration/auth.test.ts
import { supabase } from '../src/lib/supabase';

describe('Auth Integration', () => {
  const testEmail = 'test@example.com';
  const testPassword = 'testpassword123';

  afterEach(async () => {
    // Clean up test user
    await supabase.auth.signOut();
  });

  it('should sign up and sign in a user', async () => {
    // Sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });

    expect(signUpError).toBeNull();
    expect(signUpData.user).toBeTruthy();

    // Sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    expect(signInError).toBeNull();
    expect(signInData.user?.email).toBe(testEmail);
  });
});
```

## Security Checklist

- [ ] Enable RLS on all public tables
- [ ] Create appropriate policies for each table
- [ ] Use `auth.uid()` for user-specific data access
- [ ] Validate input data with database constraints
- [ ] Use service role key only in Edge Functions
- [ ] Store sensitive configuration in environment variables
- [ ] Implement proper error handling without exposing sensitive data
- [ ] Use HTTPS for all client connections
- [ ] Regularly audit and update dependencies
- [ ] Implement rate limiting for API endpoints

## Environment Configuration

```bash
# .env.local
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# For Edge Functions only
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Migration Management

```sql
-- migrations/001_initial_schema.sql
-- Create user profiles table
CREATE TABLE user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  fitness_level TEXT CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
```

## Monitoring and Analytics

```typescript
// Performance monitoring
export const trackQuery = async (
  queryName: string,
  queryFn: () => Promise<any>
) => {
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    
    // Log performance metrics
    console.log(`Query ${queryName} completed in ${duration}ms`);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Query ${queryName} failed after ${duration}ms:`, error);
    throw error;
  }
};

// Usage tracking
export const trackUserAction = (action: string, metadata?: any) => {
  supabase.functions.invoke('track-analytics', {
    body: {
      action,
      metadata,
      timestamp: new Date().toISOString(),
      user_id: supabase.auth.getUser()?.id
    }
  });
};
```

This comprehensive guide provides the foundation for building a robust, secure, and performant application with Supabase in your SnapConnect project. Remember to always test thoroughly and follow security best practices when implementing these patterns.