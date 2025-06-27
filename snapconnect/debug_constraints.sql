-- Query to check current constraints on users table
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'users'::regclass 
  AND (conname LIKE '%motivation_style%' OR conname LIKE '%coaching_style%');

-- Also check the current column definitions
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND (column_name = 'motivation_style' OR column_name = 'coaching_style');