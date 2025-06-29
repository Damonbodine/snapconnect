-- Migration: Enhance Voice Coaching for Pypecat Integration
-- 🎙️ Adds support for Pypecat voice service with WebSocket sessions and enhanced conversation state

-- Create voice sessions table to track WebSocket connections and conversation state
CREATE TABLE IF NOT EXISTS voice_coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL, -- WebSocket session identifier
  status TEXT CHECK (status IN ('connecting', 'active', 'paused', 'completed', 'error')) DEFAULT 'connecting',
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  total_duration INTEGER DEFAULT 0, -- Total session duration in seconds
  conversation_context JSONB DEFAULT '{}', -- Real-time conversation state
  voice_metrics JSONB DEFAULT '{}', -- Voice quality, interruptions, etc.
  workout_context JSONB DEFAULT '{}', -- Current workout being coached
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for voice sessions
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id ON voice_coaching_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_status ON voice_coaching_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_token ON voice_coaching_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_active ON voice_coaching_sessions(user_id, status) WHERE status IN ('connecting', 'active', 'paused');

-- Enable RLS for voice sessions
ALTER TABLE voice_coaching_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for voice sessions
CREATE POLICY "Users can view their own voice sessions" ON voice_coaching_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voice sessions" ON voice_coaching_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice sessions" ON voice_coaching_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Add voice session tracking to existing coach_conversations table
ALTER TABLE coach_conversations ADD COLUMN IF NOT EXISTS voice_session_id UUID REFERENCES voice_coaching_sessions(id) ON DELETE SET NULL;
ALTER TABLE coach_conversations ADD COLUMN IF NOT EXISTS speech_confidence REAL; -- STT confidence score (0.0-1.0)
ALTER TABLE coach_conversations ADD COLUMN IF NOT EXISTS voice_emotion TEXT; -- Detected emotion from voice
ALTER TABLE coach_conversations ADD COLUMN IF NOT EXISTS processing_latency INTEGER; -- Voice processing time in ms

-- Create index for voice session conversations
CREATE INDEX IF NOT EXISTS idx_coach_conversations_session ON coach_conversations(voice_session_id);

-- Create voice coaching command tracking table
CREATE TABLE IF NOT EXISTS voice_coaching_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES voice_coaching_sessions(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL, -- 'count_reps', 'start_timer', 'pause_workout', 'form_correction', etc.
  command_intent TEXT NOT NULL, -- Raw intent detected from voice
  command_parameters JSONB DEFAULT '{}', -- Parameters extracted (reps, duration, etc.)
  execution_status TEXT CHECK (execution_status IN ('pending', 'executed', 'failed')) DEFAULT 'pending',
  execution_result JSONB DEFAULT '{}', -- Result of command execution
  confidence_score REAL, -- Intent recognition confidence
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for voice commands
CREATE INDEX IF NOT EXISTS idx_voice_commands_session ON voice_coaching_commands(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_commands_type ON voice_coaching_commands(command_type);
CREATE INDEX IF NOT EXISTS idx_voice_commands_status ON voice_coaching_commands(execution_status);

-- Enable RLS for voice commands
ALTER TABLE voice_coaching_commands ENABLE ROW LEVEL SECURITY;

-- RLS policies for voice commands
CREATE POLICY "Users can view commands from their sessions" ON voice_coaching_commands
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM voice_coaching_sessions vcs 
      WHERE vcs.id = session_id AND vcs.user_id = auth.uid()
    )
  );

-- Create trigger for voice session updates
DROP TRIGGER IF EXISTS update_voice_sessions_updated_at ON voice_coaching_sessions;
CREATE TRIGGER update_voice_sessions_updated_at
  BEFORE UPDATE ON voice_coaching_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create new voice coaching session
CREATE OR REPLACE FUNCTION create_voice_coaching_session(
  target_user_id UUID,
  session_token TEXT,
  workout_context JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_session_id UUID;
  user_context JSONB;
BEGIN
  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Get user context for session
  SELECT json_build_object(
    'fitness_level', u.fitness_level,
    'coaching_style', u.coaching_style,
    'motivation_style', u.motivation_style,
    'current_goals', array_agg(DISTINCT ug.category),
    'health_metrics', json_build_object(
      'height', u.height,
      'weight', u.weight,
      'activity_level', u.activity_level
    )
  )
  INTO user_context
  FROM users u
  LEFT JOIN user_goals ug ON u.id = ug.user_id AND ug.status = 'active'
  WHERE u.id = target_user_id
  GROUP BY u.id, u.fitness_level, u.coaching_style, u.motivation_style, u.height, u.weight, u.activity_level;
  
  -- Create new session
  INSERT INTO voice_coaching_sessions (
    user_id,
    session_token,
    conversation_context,
    workout_context
  )
  VALUES (
    target_user_id,
    session_token,
    user_context,
    workout_context
  )
  RETURNING id INTO new_session_id;
  
  RETURN new_session_id;
END;
$$;

-- Function to update voice session status
CREATE OR REPLACE FUNCTION update_voice_session_status(
  session_token TEXT,
  new_status TEXT,
  duration_update INTEGER DEFAULT NULL,
  metrics_update JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE voice_coaching_sessions
  SET 
    status = new_status,
    total_duration = COALESCE(duration_update, total_duration),
    voice_metrics = CASE 
      WHEN metrics_update IS NOT NULL THEN voice_metrics || metrics_update
      ELSE voice_metrics
    END,
    session_end = CASE 
      WHEN new_status IN ('completed', 'error') THEN NOW()
      ELSE session_end
    END
  WHERE session_token = session_token;
  
  RETURN FOUND;
END;
$$;

-- Function to get active voice session for user
CREATE OR REPLACE FUNCTION get_active_voice_session(target_user_id UUID)
RETURNS TABLE (
  session_id UUID,
  session_token TEXT,
  status TEXT,
  conversation_context JSONB,
  workout_context JSONB,
  session_duration INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vcs.id as session_id,
    vcs.session_token,
    vcs.status,
    vcs.conversation_context,
    vcs.workout_context,
    EXTRACT(EPOCH FROM (NOW() - vcs.session_start))::INTEGER as session_duration
  FROM voice_coaching_sessions vcs
  WHERE 
    vcs.user_id = target_user_id 
    AND vcs.status IN ('connecting', 'active', 'paused')
  ORDER BY vcs.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to record voice coaching command
CREATE OR REPLACE FUNCTION record_voice_command(
  session_token TEXT,
  command_type TEXT,
  command_intent TEXT,
  command_parameters JSONB DEFAULT '{}',
  confidence_score REAL DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_id UUID;
  command_id UUID;
BEGIN
  -- Get session ID from token
  SELECT id INTO session_id
  FROM voice_coaching_sessions
  WHERE session_token = session_token AND status IN ('connecting', 'active', 'paused');
  
  IF session_id IS NULL THEN
    RAISE EXCEPTION 'Active voice session not found for token: %', session_token;
  END IF;
  
  -- Insert command record
  INSERT INTO voice_coaching_commands (
    session_id,
    command_type,
    command_intent,
    command_parameters,
    confidence_score
  )
  VALUES (
    session_id,
    command_type,
    command_intent,
    command_parameters,
    confidence_score
  )
  RETURNING id INTO command_id;
  
  RETURN command_id;
END;
$$;

-- Function to get voice coaching session statistics
CREATE OR REPLACE FUNCTION get_voice_coaching_stats(target_user_id UUID)
RETURNS TABLE (
  total_sessions BIGINT,
  total_voice_time INTEGER,
  avg_session_duration NUMERIC,
  total_commands BIGINT,
  successful_commands BIGINT,
  sessions_this_week BIGINT,
  voice_time_this_week INTEGER,
  most_used_commands TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH session_stats AS (
    SELECT 
      COUNT(*) as total_sessions,
      SUM(total_duration) as total_voice_time,
      AVG(total_duration) as avg_session_duration,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as sessions_this_week,
      SUM(total_duration) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as voice_time_this_week
    FROM voice_coaching_sessions
    WHERE user_id = target_user_id AND status = 'completed'
  ),
  command_stats AS (
    SELECT 
      COUNT(*) as total_commands,
      COUNT(*) FILTER (WHERE execution_status = 'executed') as successful_commands,
      array_agg(DISTINCT command_type ORDER BY COUNT(*) DESC) FILTER (WHERE command_type IS NOT NULL) as most_used_commands
    FROM voice_coaching_commands vcc
    JOIN voice_coaching_sessions vcs ON vcc.session_id = vcs.id
    WHERE vcs.user_id = target_user_id
    GROUP BY vcs.user_id
  )
  SELECT 
    ss.total_sessions,
    COALESCE(ss.total_voice_time, 0)::INTEGER,
    ss.avg_session_duration,
    COALESCE(cs.total_commands, 0),
    COALESCE(cs.successful_commands, 0),
    ss.sessions_this_week,
    COALESCE(ss.voice_time_this_week, 0)::INTEGER,
    COALESCE(cs.most_used_commands, ARRAY[]::TEXT[])
  FROM session_stats ss
  FULL OUTER JOIN command_stats cs ON true;
END;
$$;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION create_voice_coaching_session(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_voice_session_status(TEXT, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_voice_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_voice_command(TEXT, TEXT, TEXT, JSONB, REAL) TO authenticated;
GRANT EXECUTE ON FUNCTION get_voice_coaching_stats(UUID) TO authenticated;

-- Enhanced view for voice conversations with session context
CREATE OR REPLACE VIEW voice_conversations_enhanced AS
SELECT 
  cc.*,
  vcs.session_token,
  vcs.status as session_status,
  vcs.workout_context,
  u.username,
  u.full_name,
  u.fitness_level,
  u.coaching_style
FROM coach_conversations cc
LEFT JOIN voice_coaching_sessions vcs ON cc.voice_session_id = vcs.id
JOIN users u ON cc.user_id = u.id
WHERE cc.is_voice_message = true;

-- Add helpful comments
COMMENT ON TABLE voice_coaching_sessions IS 'WebSocket voice coaching sessions with Pypecat integration';
COMMENT ON TABLE voice_coaching_commands IS 'Voice commands and intents detected during coaching sessions';
COMMENT ON COLUMN voice_coaching_sessions.session_token IS 'Unique WebSocket session identifier for Pypecat integration';
COMMENT ON COLUMN voice_coaching_sessions.voice_metrics IS 'Voice quality metrics: interruptions, clarity, emotion, etc.';
COMMENT ON COLUMN coach_conversations.speech_confidence IS 'Speech-to-text confidence score from Deepgram';
COMMENT ON COLUMN coach_conversations.voice_emotion IS 'Detected emotion from voice input';
COMMENT ON COLUMN coach_conversations.processing_latency IS 'Total voice processing latency in milliseconds';

-- Success message
SELECT 'Voice coaching schema enhanced for Pypecat integration! 🎙️✨' as status;