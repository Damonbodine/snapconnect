-- Live Streaming Feature Migration
-- This migration adds tables and functionality for Agora-powered live streaming

-- Create live_streams table
CREATE TABLE live_streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Host information (reference to existing users table)
  host_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Stream metadata
  title TEXT NOT NULL,
  description TEXT,
  channel_id TEXT UNIQUE NOT NULL,
  
  -- Status tracking
  is_active BOOLEAN DEFAULT false,
  viewer_count INTEGER DEFAULT 0,
  max_viewers INTEGER DEFAULT 1000,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Integration with events (optional - for scheduled streams)
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  
  -- Agora-specific configuration
  agora_channel_name TEXT NOT NULL,
  agora_app_id TEXT NOT NULL,
  
  -- Stream settings
  quality TEXT CHECK (quality IN ('low', 'medium', 'high')) DEFAULT 'medium',
  is_private BOOLEAN DEFAULT false,
  
  -- SnapConnect standard fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stream_participants table for role management
CREATE TABLE stream_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id UUID REFERENCES live_streams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Role management
  role TEXT CHECK (role IN ('host', 'co_host', 'viewer')) DEFAULT 'viewer',
  agora_uid INTEGER NOT NULL,
  
  -- Participation timing
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  -- Connection status
  connection_state TEXT CHECK (connection_state IN ('connecting', 'connected', 'disconnected', 'failed')) DEFAULT 'connecting',
  
  -- Ensure one participation record per user per stream
  UNIQUE(stream_id, user_id)
);

-- Extend events table to support virtual/live streaming events
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_type TEXT CHECK (location_type IN ('physical', 'virtual')) DEFAULT 'physical';
ALTER TABLE events ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES live_streams(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX idx_live_streams_host_id ON live_streams(host_id);
CREATE INDEX idx_live_streams_is_active ON live_streams(is_active);
CREATE INDEX idx_live_streams_created_at ON live_streams(created_at DESC);
CREATE INDEX idx_live_streams_event_id ON live_streams(event_id);

CREATE INDEX idx_stream_participants_stream_id ON stream_participants(stream_id);
CREATE INDEX idx_stream_participants_user_id ON stream_participants(user_id);
CREATE INDEX idx_stream_participants_role ON stream_participants(role);
CREATE INDEX idx_stream_participants_is_active ON stream_participants(is_active);

-- Events table indexes for live streaming
CREATE INDEX idx_events_location_type ON events(location_type);
CREATE INDEX idx_events_is_live ON events(is_live);
CREATE INDEX idx_events_stream_id ON events(stream_id);

-- Functions for live streaming management

-- Function to update viewer count when participants join/leave
CREATE OR REPLACE FUNCTION update_stream_viewer_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update viewer count for the affected stream
  UPDATE live_streams 
  SET viewer_count = (
    SELECT COUNT(*) 
    FROM stream_participants 
    WHERE stream_id = COALESCE(NEW.stream_id, OLD.stream_id) 
    AND is_active = true
    AND role IN ('viewer', 'co_host')
  )
  WHERE id = COALESCE(NEW.stream_id, OLD.stream_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to automatically end inactive streams
CREATE OR REPLACE FUNCTION check_stream_activity()
RETURNS void AS $$
BEGIN
  -- End streams that have no active participants for more than 5 minutes
  UPDATE live_streams 
  SET 
    is_active = false,
    ended_at = NOW()
  WHERE 
    is_active = true 
    AND id NOT IN (
      SELECT DISTINCT stream_id 
      FROM stream_participants 
      WHERE is_active = true
    )
    AND updated_at < NOW() - INTERVAL '5 minutes';
    
  -- Update events that are linked to ended streams
  UPDATE events 
  SET is_live = false
  WHERE stream_id IN (
    SELECT id 
    FROM live_streams 
    WHERE is_active = false 
    AND ended_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql;

-- Function to handle stream start
CREATE OR REPLACE FUNCTION start_stream()
RETURNS TRIGGER AS $$
BEGIN
  -- When a stream becomes active, update timestamps
  IF NEW.is_active = true AND OLD.is_active = false THEN
    NEW.started_at = NOW();
    
    -- If linked to an event, mark the event as live
    IF NEW.event_id IS NOT NULL THEN
      UPDATE events 
      SET is_live = true
      WHERE id = NEW.event_id;
    END IF;
  END IF;
  
  -- When a stream ends, set end timestamp
  IF NEW.is_active = false AND OLD.is_active = true THEN
    NEW.ended_at = NOW();
    
    -- If linked to an event, mark the event as not live
    IF NEW.event_id IS NOT NULL THEN
      UPDATE events 
      SET is_live = false
      WHERE id = NEW.event_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trigger_update_stream_viewer_count
  AFTER INSERT OR UPDATE OR DELETE ON stream_participants
  FOR EACH ROW EXECUTE FUNCTION update_stream_viewer_count();

CREATE TRIGGER trigger_start_stream
  BEFORE UPDATE ON live_streams
  FOR EACH ROW EXECUTE FUNCTION start_stream();

-- Add updated_at trigger for new tables
CREATE TRIGGER update_live_streams_updated_at 
  BEFORE UPDATE ON live_streams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stream_participants_updated_at 
  BEFORE UPDATE ON stream_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) for live streaming tables
ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for live_streams
CREATE POLICY "Users can view active public streams" ON live_streams
  FOR SELECT USING (is_active = true AND is_private = false);

CREATE POLICY "Users can view their own streams" ON live_streams
  FOR SELECT USING (auth.uid() = host_id);

CREATE POLICY "Users can create their own streams" ON live_streams
  FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Stream hosts can update their streams" ON live_streams
  FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Stream hosts can delete their streams" ON live_streams
  FOR DELETE USING (auth.uid() = host_id);

-- RLS Policies for stream_participants
CREATE POLICY "Users can view participants of active public streams" ON stream_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM live_streams 
      WHERE live_streams.id = stream_participants.stream_id 
      AND live_streams.is_active = true
      AND live_streams.is_private = false
    )
  );

CREATE POLICY "Users can view participants of their own streams" ON stream_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM live_streams 
      WHERE live_streams.id = stream_participants.stream_id 
      AND live_streams.host_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own stream participation" ON stream_participants
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Stream hosts can manage all participants" ON stream_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM live_streams 
      WHERE live_streams.id = stream_participants.stream_id 
      AND live_streams.host_id = auth.uid()
    )
  );

-- Function for finding nearby live streams (using existing PostGIS setup)
CREATE OR REPLACE FUNCTION find_nearby_streams(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT DEFAULT 50
)
RETURNS TABLE (
  stream_id UUID,
  title TEXT,
  description TEXT,
  host_username TEXT,
  viewer_count INTEGER,
  distance_km FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ls.id,
    ls.title,
    ls.description,
    u.username,
    ls.viewer_count,
    ROUND(
      ST_Distance(
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
        e.location_coordinates::geography
      ) / 1000, 2
    ) AS distance_km
  FROM live_streams ls
  JOIN users u ON u.id = ls.host_id
  LEFT JOIN events e ON e.id = ls.event_id
  WHERE 
    ls.is_active = true 
    AND ls.is_private = false
    AND e.location_coordinates IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      e.location_coordinates::geography,
      radius_km * 1000
    )
  ORDER BY distance_km;
END;
$$;

-- Insert sample data for testing (optional - remove in production)
-- This creates some example event categories for live streaming
INSERT INTO event_categories (name, description, icon, color) 
VALUES 
  ('Live Workout', 'Real-time fitness classes', '📺', '#EC4899'),
  ('Virtual Training', 'Online personal training', '💻', '#7C3AED')
ON CONFLICT (name) DO NOTHING;

-- Create a function to generate Agora UID from user UUID
CREATE OR REPLACE FUNCTION generate_agora_uid(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  hash_value BIGINT;
  agora_uid INTEGER;
BEGIN
  -- Create a hash from the UUID and convert to positive integer
  hash_value := ABS(EXTRACT(EPOCH FROM (user_uuid::TEXT)::TIMESTAMP) * 1000000);
  agora_uid := (hash_value % 2147483647)::INTEGER; -- Ensure it fits in 32-bit signed integer
  
  -- Ensure it's positive and non-zero
  IF agora_uid <= 0 THEN
    agora_uid := 1;
  END IF;
  
  RETURN agora_uid;
END;
$$;

-- Add helpful comments
COMMENT ON TABLE live_streams IS 'Stores live streaming sessions powered by Agora';
COMMENT ON TABLE stream_participants IS 'Tracks users participating in live streams with their roles';
COMMENT ON COLUMN events.location_type IS 'Physical events have locations, virtual events are live streams';
COMMENT ON COLUMN events.stream_id IS 'Links physical events to their live stream (if any)';
COMMENT ON COLUMN events.is_live IS 'True when the event is currently being live streamed';