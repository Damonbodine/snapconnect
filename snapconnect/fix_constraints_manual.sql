-- Manual fix for constraint mismatch
-- Run this in Supabase SQL Editor

-- Step 1: Update existing data to use new constraint values
UPDATE users SET motivation_style = 
  CASE 
    WHEN motivation_style = 'encouraging' THEN 'supportive'
    WHEN motivation_style = 'challenging' THEN 'competitive' 
    WHEN motivation_style = 'scientific' THEN 'analytical'
    WHEN motivation_style = 'casual' THEN 'fun'
    ELSE motivation_style
  END
WHERE motivation_style IN ('encouraging', 'challenging', 'scientific', 'casual');

-- Step 2: Update existing coaching_style data
UPDATE users SET coaching_style = 
  CASE 
    WHEN coaching_style = 'data_driven' THEN 'educational'
    WHEN coaching_style = 'holistic' THEN 'gentle' 
    WHEN coaching_style = 'goal_focused' THEN 'firm'
    ELSE coaching_style
  END
WHERE coaching_style IN ('data_driven', 'holistic', 'goal_focused');

-- Step 3: Drop old constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_motivation_style_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_coaching_style_check;

-- Step 4: Add new constraints with correct values
ALTER TABLE users ADD CONSTRAINT users_motivation_style_check 
CHECK (motivation_style IN ('competitive', 'supportive', 'analytical', 'fun'));

ALTER TABLE users ADD CONSTRAINT users_coaching_style_check 
CHECK (coaching_style IN ('gentle', 'firm', 'motivational', 'educational'));

-- Step 5: Update default values
ALTER TABLE users ALTER COLUMN motivation_style SET DEFAULT 'supportive';
ALTER TABLE users ALTER COLUMN coaching_style SET DEFAULT 'gentle';

-- Verify the fix
SELECT DISTINCT motivation_style FROM users WHERE motivation_style IS NOT NULL;
SELECT DISTINCT coaching_style FROM users WHERE coaching_style IS NOT NULL;