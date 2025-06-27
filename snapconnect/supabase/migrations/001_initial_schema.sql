-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  fitness_level TEXT CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')) NOT NULL,
  goals TEXT[] DEFAULT '{}',
  dietary_preferences TEXT[] DEFAULT '{}',
  workout_frequency INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create event categories table
CREATE TABLE event_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT, -- emoji or icon name
  color TEXT, -- hex color for UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default event categories
INSERT INTO event_categories (name, description, icon, color) VALUES
('Workout', 'Group workout sessions', '💪', '#EC4899'),
('Running', 'Running and jogging events', '🏃', '#10B981'),
('Yoga', 'Yoga and mindfulness sessions', '🧘', '#7C3AED'),
('Cycling', 'Bike rides and cycling events', '🚴', '#F59E0B'),
('Swimming', 'Swimming and water activities', '🏊', '#3B82F6'),
('Sports', 'Team sports and games', '⚽', '#EF4444'),
('Hiking', 'Outdoor hiking and walking', '🥾', '#059669'),
('Dance', 'Dance fitness and classes', '💃', '#EC4899'),
('Martial Arts', 'Fighting and self-defense', '🥋', '#6B7280'),
('Other', 'Other fitness activities', '🎯', '#6B7280');

-- Create events table with comprehensive event management
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES event_categories(id),
  
  -- Location information
  location_name TEXT, -- "Gold's Gym Downtown"
  location_address TEXT, -- "123 Main St, City, State"
  location_coordinates POINT, -- PostGIS point for precise location
  location_details TEXT, -- "Meet at front desk", "Parking available"
  
  -- Event timing
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  timezone TEXT DEFAULT 'UTC',
  
  -- Capacity and requirements
  max_participants INTEGER,
  min_participants INTEGER DEFAULT 1,
  current_participants INTEGER DEFAULT 0,
  waitlist_enabled BOOLEAN DEFAULT TRUE,
  
  -- Requirements and details
  fitness_levels TEXT[] DEFAULT '{}', -- which fitness levels are welcome
  equipment_needed TEXT[], -- "yoga mat", "water bottle"
  cost_cents INTEGER DEFAULT 0, -- cost in cents, 0 for free
  cost_currency TEXT DEFAULT 'USD',
  
  -- Event management
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('draft', 'published', 'cancelled', 'completed')) DEFAULT 'published',
  visibility TEXT CHECK (visibility IN ('public', 'friends', 'private')) DEFAULT 'public',
  
  -- Media
  cover_image TEXT,
  images TEXT[], -- additional event photos
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE -- soft delete for historical data
);

-- Create event participants table for RSVP management
CREATE TABLE event_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- RSVP status
  status TEXT CHECK (status IN ('going', 'maybe', 'not_going', 'waitlist')) NOT NULL,
  previous_status TEXT, -- track status changes
  
  -- Participation details
  checked_in BOOLEAN DEFAULT FALSE,
  check_in_time TIMESTAMP WITH TIME ZONE,
  no_show BOOLEAN DEFAULT FALSE,
  
  -- Notifications
  notifications_enabled BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one RSVP per user per event
  UNIQUE(event_id, user_id)
);

-- Create event updates table for change notifications
CREATE TABLE event_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL, -- who made the update
  
  update_type TEXT CHECK (update_type IN ('created', 'edited', 'cancelled', 'time_changed', 'location_changed')) NOT NULL,
  changes JSONB, -- store what changed
  message TEXT, -- optional message to participants
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('photo', 'video')),
  expires_at TIMESTAMP WITH TIME ZONE,
  workout_type TEXT,
  content_embedding VECTOR(1536), -- OpenAI embedding dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create friendships table
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('text', 'photo', 'video')),
  expires_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stories table
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('photo', 'video')) NOT NULL,
  content TEXT,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fitness knowledge base table for RAG
CREATE TABLE fitness_knowledge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  tags TEXT[] DEFAULT '{}',
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user interactions table for personalization
CREATE TABLE user_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  interaction_type TEXT CHECK (interaction_type IN ('like', 'comment', 'save', 'share', 'view')),
  feedback JSONB, -- For storing additional feedback data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_expires_at ON posts(expires_at);

-- Event indexes
CREATE INDEX idx_events_creator_id ON events(creator_id);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_category_id ON events(category_id);
CREATE INDEX idx_events_location_coordinates ON events USING GIST(location_coordinates);

-- Event participant indexes
CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX idx_event_participants_user_id ON event_participants(user_id);
CREATE INDEX idx_event_participants_status ON event_participants(status);

CREATE INDEX idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_stories_user_id ON stories(user_id);
CREATE INDEX idx_stories_expires_at ON stories(expires_at);
CREATE INDEX idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX idx_fitness_knowledge_category ON fitness_knowledge(category);

-- Functions for event management

-- Function to update participant count when RSVPs change
CREATE OR REPLACE FUNCTION update_event_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update current participant count
  UPDATE events 
  SET current_participants = (
    SELECT COUNT(*) 
    FROM event_participants 
    WHERE event_id = COALESCE(NEW.event_id, OLD.event_id) 
    AND status = 'going'
  )
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to handle waitlist management
CREATE OR REPLACE FUNCTION manage_event_waitlist()
RETURNS TRIGGER AS $$
DECLARE
  event_max_participants INTEGER;
  current_going_count INTEGER;
  next_waitlist_user UUID;
BEGIN
  -- Get event details
  SELECT max_participants INTO event_max_participants
  FROM events WHERE id = NEW.event_id;
  
  -- If no max participants limit, no waitlist needed
  IF event_max_participants IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Count current "going" participants
  SELECT COUNT(*) INTO current_going_count
  FROM event_participants 
  WHERE event_id = NEW.event_id AND status = 'going';
  
  -- If trying to RSVP "going" but event is full, put on waitlist
  IF NEW.status = 'going' AND current_going_count >= event_max_participants THEN
    NEW.status = 'waitlist';
  END IF;
  
  -- If someone cancels and there's a waitlist, promote the first person
  IF TG_OP = 'UPDATE' AND OLD.status = 'going' AND NEW.status != 'going' THEN
    SELECT user_id INTO next_waitlist_user
    FROM event_participants 
    WHERE event_id = NEW.event_id AND status = 'waitlist'
    ORDER BY created_at LIMIT 1;
    
    IF next_waitlist_user IS NOT NULL THEN
      UPDATE event_participants 
      SET status = 'going', previous_status = 'waitlist'
      WHERE event_id = NEW.event_id AND user_id = next_waitlist_user;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Vector similarity search function for RAG
CREATE OR REPLACE FUNCTION match_fitness_content(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.78,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fitness_knowledge.id,
    fitness_knowledge.content,
    fitness_knowledge.category,
    1 - (fitness_knowledge.embedding <=> query_embedding) AS similarity
  FROM fitness_knowledge
  WHERE 1 - (fitness_knowledge.embedding <=> query_embedding) > match_threshold
  ORDER BY fitness_knowledge.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to auto-delete expired content
CREATE OR REPLACE FUNCTION delete_expired_content()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM posts WHERE expires_at < NOW();
  DELETE FROM stories WHERE expires_at < NOW();
END;
$$;

-- Triggers
CREATE TRIGGER trigger_update_participant_count
  AFTER INSERT OR UPDATE OR DELETE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION update_event_participant_count();

CREATE TRIGGER trigger_manage_waitlist
  BEFORE INSERT OR UPDATE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION manage_event_waitlist();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_participants_updated_at BEFORE UPDATE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Set up RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own data" ON users
  FOR ALL USING (auth.uid() = id);

-- Event policies
CREATE POLICY "Users can view published events" ON events
  FOR SELECT USING (status = 'published' AND deleted_at IS NULL);

CREATE POLICY "Users can create events" ON events
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Event creators can update their events" ON events
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Event creators can delete their events" ON events
  FOR DELETE USING (auth.uid() = creator_id);

-- Event participant policies
CREATE POLICY "Users can view event participants for public events" ON event_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_participants.event_id 
      AND events.status = 'published'
    )
  );

CREATE POLICY "Users can manage their own event RSVPs" ON event_participants
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view public posts" ON posts
  FOR SELECT USING (expires_at > NOW() OR expires_at IS NULL);

CREATE POLICY "Users can insert their own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);