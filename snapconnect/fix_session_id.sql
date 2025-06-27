-- Quick fix: Add missing columns to post_views table
-- Run this in your Supabase SQL Editor

ALTER TABLE post_views 
ADD COLUMN IF NOT EXISTS session_id text,
ADD COLUMN IF NOT EXISTS duration integer;

-- Verify the fix
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'post_views' 
AND table_schema = 'public';

SELECT 'session_id column added successfully!' as result;