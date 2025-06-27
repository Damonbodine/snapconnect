-- Add city field to users table
ALTER TABLE users 
ADD COLUMN city TEXT;

-- Add index for city field for potential location-based features
CREATE INDEX idx_users_city ON users(city) WHERE city IS NOT NULL;