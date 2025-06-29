-- Simple fix: Just add the missing column and set defaults
-- Don't try to use it in functions yet

-- Add last_sign_in_at column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ DEFAULT NOW();

-- Set a default value for existing users so they're considered "active"
UPDATE users SET last_sign_in_at = NOW() WHERE last_sign_in_at IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_last_sign_in_at ON users(last_sign_in_at) WHERE is_mock_user = FALSE;