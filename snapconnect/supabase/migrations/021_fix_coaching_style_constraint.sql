-- Fix coaching_style constraint to match onboarding UI values
-- Database expects: 'gentle', 'motivational', 'data_driven', 'holistic', 'goal_focused'
-- UI sends: 'gentle', 'firm', 'motivational', 'educational'

-- First, update any existing rows with old values to new values
UPDATE users SET coaching_style = 
  CASE 
    WHEN coaching_style = 'data_driven' THEN 'educational'
    WHEN coaching_style = 'holistic' THEN 'gentle' 
    WHEN coaching_style = 'goal_focused' THEN 'firm'
    ELSE coaching_style
  END
WHERE coaching_style IN ('data_driven', 'holistic', 'goal_focused');

-- Drop the old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_coaching_style_check;

-- Add the new constraint with correct values that match UI
ALTER TABLE users ADD CONSTRAINT users_coaching_style_check 
CHECK (coaching_style IN ('gentle', 'firm', 'motivational', 'educational'));

-- Update default value to match (keeping motivational as it's valid in both)
ALTER TABLE users ALTER COLUMN coaching_style SET DEFAULT 'gentle';