-- Migration: Add workout_notes table for user workout tracking
-- This table stores quick workout notes that users can add from the clique page

-- Create workout_notes table
CREATE TABLE IF NOT EXISTS workout_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  workout_type VARCHAR(50) NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE workout_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only manage their own workout notes
CREATE POLICY "Users can manage own workout notes" ON workout_notes
  FOR ALL USING (auth.uid() = user_id);

-- Add index for performance on user queries
CREATE INDEX IF NOT EXISTS idx_workout_notes_user_date ON workout_notes(user_id, created_at DESC);

-- Add constraint to ensure valid workout types
ALTER TABLE workout_notes ADD CONSTRAINT workout_notes_type_check 
  CHECK (workout_type IN ('Cardio', 'Strength', 'Yoga', 'Running', 'Walking', 'Cycling', 'Swimming', 'HIIT', 'Stretching', 'Other'));

-- Add constraint to ensure note is not empty
ALTER TABLE workout_notes ADD CONSTRAINT workout_notes_note_not_empty 
  CHECK (LENGTH(TRIM(note)) > 0);