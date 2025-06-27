import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { UserProfile, CreateUserProfileData, transformDatabaseUserToProfile, isAIUser } from '../types/user';

interface AuthStore {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isOnboardingComplete: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setOnboardingComplete: (complete: boolean) => void;
  
  // Auth methods
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthState: () => void;
  
  // Profile methods
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  createProfile: (profileData: CreateUserProfileData) => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => {
  const setUserAndSession = (user: User, session: Session | null) => {
    console.log('🔐 setUserAndSession called with user:', user?.email?.substring(0, 3) + '***');
    set({ user, session });
  };

  return {
    user: null,
    profile: null,
    session: null,
    isLoading: false,
    isOnboardingComplete: false,

    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    setSession: (session) => set({ session }),
    setLoading: (isLoading) => set({ isLoading }),
    setOnboardingComplete: (isOnboardingComplete) => set({ isOnboardingComplete }),

    signUp: async (email: string, password: string) => {
      set({ isLoading: true });
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user && data.session) {
          setUserAndSession(data.user, data.session);
        }
      } catch (error) {
        console.error('Sign up error:', error);
        throw error;
      } finally {
        set({ isLoading: false });
      }
    },

    signIn: async (email: string, password: string) => {
      console.log('🔐 signIn called with email:', email?.substring(0, 3) + '***');
      set({ isLoading: true });
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        
        if (data.user && data.session) {
          setUserAndSession(data.user, data.session);
          
          // Fetch user profile with AI fields
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();
            
          if (!profileError && profileData) {
            const profile = transformDatabaseUserToProfile(profileData);
            set({ profile, isOnboardingComplete: true });
          } else if (profileError?.code === 'PGRST116') {
            // Profile doesn't exist - user needs to complete onboarding
            console.log('Profile not found, redirecting to onboarding');
            set({ profile: null, isOnboardingComplete: false });
          } else if (profileError) {
            // Other database error
            console.error('Profile fetch error:', profileError);
            throw new Error('Failed to fetch user profile');
          }
        }
      } catch (error) {
        console.error('Sign in error:', error);
        throw error;
      } finally {
        set({ isLoading: false });
      }
    },

    signOut: async () => {
      set({ isLoading: true });
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        set({ 
          user: null, 
          profile: null, 
          session: null, 
          isOnboardingComplete: false 
        });
      } catch (error) {
        console.error('Sign out error:', error);
        throw error;
      } finally {
        set({ isLoading: false });
      }
    },

    clearAuthState: () => {
      console.log('🧹 Clearing auth state');
      set({ 
        user: null, 
        profile: null, 
        session: null, 
        isOnboardingComplete: false,
        isLoading: false
      });
    },

    createProfile: async (profileData) => {
      const { user } = get();
      if (!user) throw new Error("No user found");

      set({ isLoading: true });
      try {
        // Build comprehensive profile with all enhanced fields
        const profile = {
          id: user.id,
          email: user.email!,
          username: profileData.username,
          full_name: profileData.full_name || null,
          avatar_url: profileData.avatar_url || null,
          bio: profileData.bio || null,
          city: profileData.city || null,
          fitness_level: profileData.fitness_level,
          workout_intensity: profileData.workout_intensity || 'moderate',
          goals: profileData.goals || [],
          dietary_preferences: profileData.dietary_preferences || [],
          workout_frequency: profileData.workout_frequency || 3,
          
          // Health baseline fields
          current_weight_kg: profileData.current_weight_kg || null,
          target_weight_kg: profileData.target_weight_kg || null,
          height_cm: profileData.height_cm || null,
          daily_step_goal: profileData.daily_step_goal || null,
          weekly_workout_goal: profileData.weekly_workout_goal || null,
          current_activity_level: profileData.current_activity_level || null,
          injuries_limitations: profileData.injuries_limitations || null,
          
          // SMART goal fields
          primary_goal: profileData.primary_goal || null,
          smart_goal_target: profileData.smart_goal_target || null,
          smart_goal_value: profileData.smart_goal_value || null,
          smart_goal_unit: profileData.smart_goal_unit || null,
          smart_goal_timeframe: profileData.smart_goal_timeframe || null,
          smart_goal_why: profileData.smart_goal_why || null,
          smart_goal_target_date: profileData.smart_goal_target_date || null,
          
          // Lifestyle preferences
          exercise_preferences: profileData.exercise_preferences || [],
          coaching_style: profileData.coaching_style || null,
          available_workout_days: profileData.available_workout_days || [],
          has_equipment: profileData.has_equipment || false,
          equipment_list: profileData.equipment_list || null,
          
          
          // System settings
          privacy_level: profileData.privacy_level || 'friends',
          measurement_system: profileData.measurement_system || 'metric',
          timezone: profileData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          
          // Onboarding tracking
          onboarding_completed_steps: [
            'welcome',
            'fitness_level',
            'health_baseline', 
            'goals_enhanced',
            'lifestyle_preferences',
            'coaching_setup'
          ],
          onboarding_completion_date: new Date().toISOString(),
          profile_setup_phase: 'complete',
          
          // AI system fields (for real users)
          is_mock_user: false,
          personality_traits: null,
          ai_response_style: null,
          posting_schedule: null,
          conversation_context: null,
          
          // Other optional fields with defaults
          preferred_workout_times: profileData.preferred_workout_times || null,
          available_equipment: profileData.available_equipment || null,
          sleep_schedule: profileData.sleep_schedule || null,
          fitness_experience_years: profileData.fitness_experience_years || null,
          preferred_workout_duration: profileData.preferred_workout_duration || null,
          meal_prep_preference: profileData.meal_prep_preference || null,
          cooking_skill_level: profileData.cooking_skill_level || null,
          food_allergies: profileData.food_allergies || null,
          nutrition_goals: profileData.nutrition_goals || null,
          stress_level: profileData.stress_level || null,
          energy_level: profileData.energy_level || null,
          wellness_goals: profileData.wellness_goals || null,
          accountability_preference: profileData.accountability_preference || null,
          social_sharing_comfort: profileData.social_sharing_comfort || null,
          workout_time_constraints: profileData.workout_time_constraints || null,
          feedback_frequency: profileData.feedback_frequency || null,
          progress_tracking_detail: profileData.progress_tracking_detail || null,
          primary_motivation: profileData.primary_motivation || null,
          biggest_fitness_challenge: profileData.biggest_fitness_challenge || null,
          previous_fitness_successes: profileData.previous_fitness_successes || null,
          location_type: profileData.location_type || null,
        };

        const { data, error } = await supabase.from("users").upsert(profile).select().single();

        if (error) {
          if (error.message.includes("duplicate key value violates unique constraint \"users_username_key\"")) {
            throw new Error("Username already taken. Please choose a different username.");
          }
          throw error;
        }

        const transformedProfile = transformDatabaseUserToProfile(data);
        set({ profile: transformedProfile, isOnboardingComplete: true });
      } catch (error) {
        console.error("Create profile error:", error);
        throw error;
      } finally {
        set({ isLoading: false });
      }
    },

    updateProfile: async (updates) => {
      const { profile } = get();
      if (!profile) throw new Error("No profile found");

      set({ isLoading: true });
      try {
        const { data, error } = await supabase
          .from("users")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", profile.id)
          .select()
          .single();

        if (error) throw error;

        const updatedProfile = transformDatabaseUserToProfile(data);
        set({ profile: updatedProfile });
      } catch (error) {
        console.error("Update profile error:", error);
        throw error;
      } finally {
        set({ isLoading: false });
      }
    },
  };
});