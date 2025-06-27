-- Fix motivation_style constraint to match onboarding UI values
-- Need to update existing data first, then change constraint

-- First, update any existing rows with old values to new values
UPDATE users SET motivation_style = 
  CASE 
    WHEN motivation_style = 'encouraging' THEN 'supportive'
    WHEN motivation_style = 'challenging' THEN 'competitive' 
    WHEN motivation_style = 'scientific' THEN 'analytical'
    WHEN motivation_style = 'casual' THEN 'fun'
    ELSE motivation_style
  END
WHERE motivation_style IN ('encouraging', 'challenging', 'scientific', 'casual');

-- Drop the old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_motivation_style_check;

-- Add the new constraint with correct values
ALTER TABLE users ADD CONSTRAINT users_motivation_style_check 
CHECK (motivation_style IN ('competitive', 'supportive', 'analytical', 'fun'));

-- Update default value to match
ALTER TABLE users ALTER COLUMN motivation_style SET DEFAULT 'supportive';