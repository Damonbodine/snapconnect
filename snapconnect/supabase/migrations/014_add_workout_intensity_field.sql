-- Add workout_intensity field to users table
ALTER TABLE users 
ADD COLUMN workout_intensity TEXT CHECK (workout_intensity IN ('chill', 'moderate', 'intense')) DEFAULT 'moderate';

-- Add index for workout intensity for matching users with similar preferences
CREATE INDEX idx_users_workout_intensity ON users(workout_intensity) WHERE workout_intensity IS NOT NULL;