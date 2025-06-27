-- Add RLS policies for friendships table
-- This migration adds the missing security policies and database functions for the friends system

-- Enable RLS on friendships table (if not already enabled)
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view friendships where they are either the user or the friend
CREATE POLICY "Users can view their friendships" ON friendships
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

-- Policy 2: Users can manage friendships they initiated
CREATE POLICY "Users can manage their friendships" ON friendships
  FOR ALL USING (
    auth.uid() = user_id
  );

-- Policy 3: Users can update friendships where they are the friend (to accept requests)
CREATE POLICY "Users can update received friend requests" ON friendships
  FOR UPDATE USING (
    auth.uid() = friend_id AND status = 'pending'
  );

-- Function 1: Send friend request
CREATE OR REPLACE FUNCTION send_friend_request(friend_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_friendship_id UUID;
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is trying to friend themselves
  IF current_user_id = friend_user_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;
  
  -- Check if friendship already exists (in either direction)
  IF EXISTS (
    SELECT 1 FROM friendships 
    WHERE (user_id = current_user_id AND friend_id = friend_user_id)
       OR (user_id = friend_user_id AND friend_id = current_user_id)
  ) THEN
    RAISE EXCEPTION 'Friendship already exists or request already sent';
  END IF;
  
  -- Check if target user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = friend_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Insert new friendship request
  INSERT INTO friendships (user_id, friend_id, status)
  VALUES (current_user_id, friend_user_id, 'pending')
  RETURNING id INTO new_friendship_id;
  
  RETURN new_friendship_id;
END;
$$;

-- Function 2: Accept friend request
CREATE OR REPLACE FUNCTION accept_friend_request(friendship_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Update friendship status to accepted
  -- Only allow if current user is the friend_id and status is pending
  UPDATE friendships 
  SET status = 'accepted'
  WHERE id = friendship_id 
    AND friend_id = current_user_id 
    AND status = 'pending';
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found or already processed';
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function 3: Decline/Remove friend request
CREATE OR REPLACE FUNCTION decline_friend_request(friendship_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Delete friendship record
  -- Allow if user is either the sender or receiver
  DELETE FROM friendships 
  WHERE id = friendship_id 
    AND (user_id = current_user_id OR friend_id = current_user_id);
  
  -- Check if deletion was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found or not authorized';
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function 4: Get friendship status between two users
CREATE OR REPLACE FUNCTION get_friendship_status(friend_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  friendship_status TEXT;
  is_sender BOOLEAN;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is trying to check status with themselves
  IF current_user_id = friend_user_id THEN
    RETURN 'self';
  END IF;
  
  -- Find friendship status
  SELECT status, (user_id = current_user_id) INTO friendship_status, is_sender
  FROM friendships 
  WHERE (user_id = current_user_id AND friend_id = friend_user_id)
     OR (user_id = friend_user_id AND friend_id = current_user_id)
  LIMIT 1;
  
  -- If no friendship found
  IF friendship_status IS NULL THEN
    RETURN 'none';
  END IF;
  
  -- Return status with context
  IF friendship_status = 'accepted' THEN
    RETURN 'friends';
  ELSIF friendship_status = 'pending' AND is_sender THEN
    RETURN 'sent';
  ELSIF friendship_status = 'pending' AND NOT is_sender THEN
    RETURN 'received';
  ELSIF friendship_status = 'blocked' THEN
    RETURN 'blocked';
  END IF;
  
  RETURN friendship_status;
END;
$$;

-- Function 5: Get friends list with user details
CREATE OR REPLACE FUNCTION get_friends_list(target_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  fitness_level TEXT,
  created_at TIMESTAMPTZ,
  friendship_id UUID,
  friendship_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Use target_user_id if provided, otherwise use current user
  IF target_user_id IS NULL THEN
    target_user_id := current_user_id;
  END IF;
  
  -- Return friends list
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level,
    u.created_at,
    f.id as friendship_id,
    f.created_at as friendship_created_at
  FROM users u
  JOIN friendships f ON (
    (f.user_id = target_user_id AND f.friend_id = u.id) OR
    (f.friend_id = target_user_id AND f.user_id = u.id)
  )
  WHERE f.status = 'accepted'
    AND u.id != target_user_id
  ORDER BY f.created_at DESC;
END;
$$;

-- Function 6: Get pending friend requests (received)
CREATE OR REPLACE FUNCTION get_pending_requests()
RETURNS TABLE (
  friendship_id UUID,
  user_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  fitness_level TEXT,
  request_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Return pending requests received by current user
  RETURN QUERY
  SELECT 
    f.id as friendship_id,
    u.id as user_id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level,
    f.created_at as request_date
  FROM friendships f
  JOIN users u ON f.user_id = u.id
  WHERE f.friend_id = current_user_id 
    AND f.status = 'pending'
  ORDER BY f.created_at DESC;
END;
$$;

-- Function 7: Get sent friend requests
CREATE OR REPLACE FUNCTION get_sent_requests()
RETURNS TABLE (
  friendship_id UUID,
  friend_id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  fitness_level TEXT,
  request_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Return pending requests sent by current user
  RETURN QUERY
  SELECT 
    f.id as friendship_id,
    u.id as friend_id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level,
    f.created_at as request_date
  FROM friendships f
  JOIN users u ON f.friend_id = u.id
  WHERE f.user_id = current_user_id 
    AND f.status = 'pending'
  ORDER BY f.created_at DESC;
END;
$$;

-- Function 8: Get friends count for a user
CREATE OR REPLACE FUNCTION get_friends_count(target_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  friend_count INTEGER;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Use target_user_id if provided, otherwise use current user
  IF target_user_id IS NULL THEN
    target_user_id := current_user_id;
  END IF;
  
  -- Count accepted friendships
  SELECT COUNT(*) INTO friend_count
  FROM friendships f
  WHERE ((f.user_id = target_user_id) OR (f.friend_id = target_user_id))
    AND f.status = 'accepted';
  
  RETURN friend_count;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION send_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friendship_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friends_list(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION get_sent_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION get_friends_count(UUID) TO authenticated;