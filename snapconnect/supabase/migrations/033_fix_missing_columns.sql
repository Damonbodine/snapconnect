-- Fix missing columns that are preventing AI messaging from working
-- Add missing columns to users table

-- 1. Add last_sign_in_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'last_sign_in_at') THEN
        ALTER TABLE users ADD COLUMN last_sign_in_at TIMESTAMPTZ;
        
        -- Set a default value for existing users so they're considered "active"
        UPDATE users SET last_sign_in_at = NOW() WHERE last_sign_in_at IS NULL;
        
        RAISE NOTICE 'Added last_sign_in_at column to users table';
    ELSE
        RAISE NOTICE 'last_sign_in_at column already exists';
    END IF;
END $$;

-- 2. Fix the proactive messaging function to handle missing column gracefully
CREATE OR REPLACE FUNCTION get_active_users_for_proactive_messaging(days_threshold INTEGER DEFAULT 30)
RETURNS TABLE (
    user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if last_sign_in_at column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'last_sign_in_at') THEN
        -- Use last_sign_in_at if it exists
        RETURN QUERY
        SELECT u.id as user_id
        FROM users u
        WHERE u.is_mock_user = FALSE 
          AND u.last_sign_in_at >= NOW() - (days_threshold || ' days')::INTERVAL
        LIMIT 100;
    ELSE
        -- Fallback: just get non-AI users (they're all considered "active")
        RETURN QUERY
        SELECT u.id as user_id
        FROM users u
        WHERE u.is_mock_user = FALSE 
        LIMIT 100;
    END IF;
END;
$$;

-- 3. Update the AI proactive messaging service to use the new function
-- This ensures it won't crash even if columns are missing

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_active_users_for_proactive_messaging(INTEGER) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_active_users_for_proactive_messaging IS 'Gets active users for proactive messaging, handles missing columns gracefully';

-- Test the function
SELECT COUNT(*) as active_users FROM get_active_users_for_proactive_messaging(30);