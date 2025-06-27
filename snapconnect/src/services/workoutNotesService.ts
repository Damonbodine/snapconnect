/**
 * Workout Notes Service
 * Simple service for creating and fetching user workout notes
 */

import { supabase } from './supabase';

export interface WorkoutNote {
  id: string;
  user_id: string;
  workout_type: string;
  note: string;
  created_at: string;
}

export interface CreateNoteRequest {
  workout_type: string;
  note: string;
}

export const WORKOUT_TYPES = [
  'Cardio', 'Strength', 'Yoga', 'Running', 'Walking', 
  'Cycling', 'Swimming', 'HIIT', 'Stretching', 'Other'
] as const;

export type WorkoutType = typeof WORKOUT_TYPES[number];

export class WorkoutNotesService {
  private static instance: WorkoutNotesService;

  public static getInstance(): WorkoutNotesService {
    if (!WorkoutNotesService.instance) {
      WorkoutNotesService.instance = new WorkoutNotesService();
    }
    return WorkoutNotesService.instance;
  }

  /**
   * Create a new workout note
   */
  async createNote(note: CreateNoteRequest): Promise<WorkoutNote> {
    try {
      console.log('📝 Creating workout note...');

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Insert note into database
      const { data, error } = await supabase
        .from('workout_notes')
        .insert([
          {
            user_id: user.id,
            workout_type: note.workout_type,
            note: note.note.trim(),
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create workout note:', error);
        throw new Error('Failed to create note');
      }

      console.log('✅ Workout note created successfully');
      return data;
    } catch (error) {
      console.error('❌ Error creating workout note:', error);
      throw error;
    }
  }

  /**
   * Get user's recent workout notes
   */
  async getUserNotes(limit: number = 20): Promise<WorkoutNote[]> {
    try {
      console.log('📖 Fetching user workout notes...');

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Fetch user's notes
      const { data, error } = await supabase
        .from('workout_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Failed to fetch workout notes:', error);
        throw new Error('Failed to fetch notes');
      }

      console.log(`✅ Fetched ${data?.length || 0} workout notes`);
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching workout notes:', error);
      throw error;
    }
  }

  /**
   * Delete a workout note
   */
  async deleteNote(noteId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting workout note...');

      // Get current user for security check
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Delete note (with user_id check for security)
      const { error } = await supabase
        .from('workout_notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Failed to delete workout note:', error);
        throw new Error('Failed to delete note');
      }

      console.log('✅ Workout note deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting workout note:', error);
      throw error;
    }
  }

  /**
   * Format time ago string for display
   */
  formatTimeAgo(createdAt: string): string {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // For older posts, show the date
    return created.toLocaleDateString();
  }

  /**
   * Get emoji for workout type
   */
  getWorkoutEmoji(workoutType: string): string {
    const emojiMap: Record<string, string> = {
      'Cardio': '❤️',
      'Strength': '💪',
      'Yoga': '🧘‍♀️',
      'Running': '🏃‍♀️',
      'Walking': '🚶‍♀️',
      'Cycling': '🚴‍♀️',
      'Swimming': '🏊‍♀️',
      'HIIT': '🔥',
      'Stretching': '🤸‍♀️',
      'Other': '🏋️‍♀️',
    };
    return emojiMap[workoutType] || '💪';
  }
}

// Export singleton instance
export const workoutNotesService = WorkoutNotesService.getInstance();