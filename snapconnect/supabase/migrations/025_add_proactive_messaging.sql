-- Add proactive messaging support
-- Track when AIs send proactive messages to prevent spam

-- Table to log proactive messages
CREATE TABLE IF NOT EXISTS ai_proactive_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_proactive_messages_user_trigger 
  ON ai_proactive_messages(user_id, trigger_type, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_proactive_messages_user_ai 
  ON ai_proactive_messages(user_id, ai_user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_proactive_messages_sent_at 
  ON ai_proactive_messages(sent_at DESC);

-- RLS policies for proactive messages
ALTER TABLE ai_proactive_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their proactive message logs" ON ai_proactive_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert proactive message logs" ON ai_proactive_messages
  FOR INSERT WITH CHECK (true); -- Allow system to log all proactive messages

-- Function to create the table if it doesn't exist (for backward compatibility)
CREATE OR REPLACE FUNCTION create_proactive_messages_log_if_not_exists()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function exists for backward compatibility
  -- The table is now created in the migration
  NULL;
END;
$$;

-- Function to get proactive message stats for a user
CREATE OR REPLACE FUNCTION get_user_proactive_message_stats(target_user_id UUID)
RETURNS TABLE (
  trigger_type TEXT,
  message_count BIGINT,
  last_sent_at TIMESTAMPTZ,
  days_since_last NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.trigger_type,
    COUNT(*) as message_count,
    MAX(p.sent_at) as last_sent_at,
    EXTRACT(DAY FROM (NOW() - MAX(p.sent_at))) as days_since_last
  FROM ai_proactive_messages p
  WHERE p.user_id = target_user_id
  GROUP BY p.trigger_type
  ORDER BY last_sent_at DESC;
END;
$$;

-- Function to clean up old proactive message logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_proactive_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ai_proactive_messages 
  WHERE sent_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_proactive_messages_log_if_not_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_proactive_message_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_proactive_messages() TO authenticated;

-- Add helpful comments
COMMENT ON TABLE ai_proactive_messages IS 'Logs when AIs send proactive messages to users to prevent spam and track engagement';
COMMENT ON FUNCTION get_user_proactive_message_stats IS 'Returns proactive message statistics for a specific user';
COMMENT ON FUNCTION cleanup_old_proactive_messages IS 'Cleans up proactive message logs older than 90 days';