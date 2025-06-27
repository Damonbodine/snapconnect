-- Add bio field to users table
ALTER TABLE users 
ADD COLUMN bio TEXT CHECK (char_length(bio) <= 150);

-- Add index for bio field for text search capabilities
CREATE INDEX idx_users_bio ON users USING gin(to_tsvector('english', bio)) WHERE bio IS NOT NULL;