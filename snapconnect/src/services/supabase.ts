import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase configuration. Please check your environment variables.');
}

// Debug: Log the values to ensure they're loaded
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types (will be auto-generated from Supabase in production)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          fitness_level: 'beginner' | 'intermediate' | 'advanced';
          goals: string[];
          dietary_preferences: string[];
          workout_frequency: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          username: string;
          full_name?: string | null;
          avatar_url?: string | null;
          fitness_level: 'beginner' | 'intermediate' | 'advanced';
          goals: string[];
          dietary_preferences?: string[];
          workout_frequency: number;
        };
        Update: {
          username?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          fitness_level?: 'beginner' | 'intermediate' | 'advanced';
          goals?: string[];
          dietary_preferences?: string[];
          workout_frequency?: number;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          content: string | null;
          media_url: string | null;
          media_type: 'photo' | 'video';
          expires_at: string | null;
          workout_type: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          content?: string | null;
          media_url?: string | null;
          media_type: 'photo' | 'video';
          expires_at?: string | null;
          workout_type?: string | null;
        };
        Update: {
          content?: string | null;
          media_url?: string | null;
          expires_at?: string | null;
          workout_type?: string | null;
        };
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          location: any; // JSON
          date_time: string;
          max_participants: number | null;
          fitness_level: string[];
          event_type: string;
          creator_id: string;
          cover_image: string | null;
          location_type: 'physical' | 'virtual';
          stream_id: string | null;
          is_live: boolean;
          created_at: string;
        };
        Insert: {
          title: string;
          description?: string | null;
          location: any;
          date_time: string;
          max_participants?: number | null;
          fitness_level: string[];
          event_type: string;
          creator_id: string;
          cover_image?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          location?: any;
          date_time?: string;
          max_participants?: number | null;
          fitness_level?: string[];
          event_type?: string;
          cover_image?: string | null;
          location_type?: 'physical' | 'virtual';
          stream_id?: string | null;
          is_live?: boolean;
        };
      };
      friendships: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          status: 'pending' | 'accepted' | 'blocked';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          status?: 'pending' | 'accepted' | 'blocked';
          created_at?: string;
        };
        Update: {
          status?: 'pending' | 'accepted' | 'blocked';
        };
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          content: string | null;
          media_url: string | null;
          media_type: 'photo' | 'video' | null;
          message_type: 'text' | 'photo' | 'video' | 'mixed';
          sent_at: string;
          expires_at: string | null;
          is_viewed: boolean;
          viewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          content?: string | null;
          media_url?: string | null;
          media_type?: 'photo' | 'video' | null;
          message_type?: 'text' | 'photo' | 'video' | 'mixed';
          sent_at?: string;
          expires_at?: string | null;
          is_viewed?: boolean;
          viewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          content?: string | null;
          media_url?: string | null;
          media_type?: 'photo' | 'video' | null;
          message_type?: 'text' | 'photo' | 'video' | 'mixed';
          expires_at?: string | null;
          is_viewed?: boolean;
          viewed_at?: string | null;
        };
      };
      message_views: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          viewed_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          user_id: string;
          viewed_at?: string;
        };
        Update: {
          viewed_at?: string;
        };
      };
      live_streams: {
        Row: {
          id: string;
          host_id: string;
          title: string;
          description: string | null;
          channel_id: string;
          is_active: boolean;
          viewer_count: number;
          max_viewers: number;
          started_at: string | null;
          ended_at: string | null;
          event_id: string | null;
          agora_channel_name: string;
          agora_app_id: string;
          quality: 'low' | 'medium' | 'high';
          is_private: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          host_id: string;
          title: string;
          description?: string | null;
          channel_id: string;
          is_active?: boolean;
          viewer_count?: number;
          max_viewers?: number;
          started_at?: string | null;
          ended_at?: string | null;
          event_id?: string | null;
          agora_channel_name: string;
          agora_app_id: string;
          quality?: 'low' | 'medium' | 'high';
          is_private?: boolean;
        };
        Update: {
          title?: string;
          description?: string | null;
          is_active?: boolean;
          viewer_count?: number;
          max_viewers?: number;
          started_at?: string | null;
          ended_at?: string | null;
          event_id?: string | null;
          quality?: 'low' | 'medium' | 'high';
          is_private?: boolean;
          updated_at?: string;
        };
      };
      stream_participants: {
        Row: {
          id: string;
          stream_id: string;
          user_id: string;
          role: 'host' | 'co_host' | 'viewer';
          agora_uid: number;
          joined_at: string;
          left_at: string | null;
          is_active: boolean;
          connection_state: 'connecting' | 'connected' | 'disconnected' | 'failed';
        };
        Insert: {
          stream_id: string;
          user_id: string;
          role?: 'host' | 'co_host' | 'viewer';
          agora_uid: number;
          joined_at?: string;
          left_at?: string | null;
          is_active?: boolean;
          connection_state?: 'connecting' | 'connected' | 'disconnected' | 'failed';
        };
        Update: {
          role?: 'host' | 'co_host' | 'viewer';
          left_at?: string | null;
          is_active?: boolean;
          connection_state?: 'connecting' | 'connected' | 'disconnected' | 'failed';
        };
      };
    };
  };
}