-- Add Digital Human Memory System
-- Enables persistent conversation memory and relationship tracking between AI and human users

-- Add system prompt storage to users table for generated digital human personalities
ALTER TABLE users ADD COLUMN IF NOT EXISTS generated_system_prompt TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS personality_generated_at TIMESTAMPTZ;

-- Create conversation memory table for AI-Human relationships
CREATE TABLE IF NOT EXISTS ai_conversation_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  human_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Relationship tracking
  first_conversation_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_conversation_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_conversations INTEGER DEFAULT 1,
  total_messages_exchanged INTEGER DEFAULT 0,
  relationship_stage TEXT DEFAULT 'new_connection' CHECK (relationship_stage IN ('new_connection', 'getting_acquainted', 'friendly_acquaintance', 'good_friend', 'close_friend')),
  
  -- Human details learned by AI
  human_details_learned JSONB DEFAULT '{}', -- {name, job, goals, interests, personal_details, etc.}
  shared_experiences JSONB DEFAULT '[]', -- Array of shared conversation topics/experiences
  important_dates JSONB DEFAULT '{}', -- {birthdays, anniversaries, important events mentioned}
  
  -- Conversation context
  last_conversation_summary TEXT,
  ongoing_topics JSONB DEFAULT '[]', -- Current topics being discussed across conversations
  conversation_themes JSONB DEFAULT '{}', -- Most common discussion themes with counts
  
  -- Emotional and relationship context
  human_personality_notes TEXT, -- AI's observations about human's personality
  communication_preferences JSONB DEFAULT '{}', -- How this human likes to communicate
  relationship_tone TEXT DEFAULT 'friendly' CHECK (relationship_tone IN ('professional', 'friendly', 'casual', 'supportive', 'playful')),
  
  -- Memory persistence
  memory_highlights JSONB DEFAULT '[]', -- Most important/memorable conversation moments
  follow_up_items JSONB DEFAULT '[]', -- Things to ask about in future conversations
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique constraint to ensure one memory record per AI-Human pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_conversation_memories_unique 
ON ai_conversation_memories(ai_user_id, human_user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_conversation_memories_ai_user ON ai_conversation_memories(ai_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_memories_human_user ON ai_conversation_memories(human_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_memories_last_conversation ON ai_conversation_memories(last_conversation_at);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_memories_relationship_stage ON ai_conversation_memories(relationship_stage);

-- Create conversation snapshots table for detailed conversation history
CREATE TABLE IF NOT EXISTS ai_conversation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES ai_conversation_memories(id) ON DELETE CASCADE,
  
  -- Conversation details
  conversation_date DATE NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  conversation_duration_minutes INTEGER, -- Estimated based on message timing
  
  -- Conversation summary
  conversation_summary TEXT NOT NULL,
  key_topics JSONB DEFAULT '[]', -- Main topics discussed in this conversation
  emotional_tone TEXT DEFAULT 'neutral' CHECK (emotional_tone IN ('positive', 'neutral', 'supportive', 'concerned', 'excited', 'reflective')),
  
  -- Details learned/shared
  new_details_learned JSONB DEFAULT '{}', -- New things learned about the human in this conversation
  ai_details_shared JSONB DEFAULT '{}', -- Things the AI shared about themselves
  
  -- Follow-up context
  unresolved_topics JSONB DEFAULT '[]', -- Topics that weren't fully resolved
  planned_follow_ups JSONB DEFAULT '[]', -- Things to follow up on next time
  
  -- Memory importance
  importance_score INTEGER DEFAULT 1 CHECK (importance_score BETWEEN 1 AND 5), -- How significant this conversation was
  contains_milestone BOOLEAN DEFAULT FALSE, -- Whether this conversation contained important life updates
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for conversation snapshots
CREATE INDEX IF NOT EXISTS idx_ai_conversation_snapshots_memory ON ai_conversation_snapshots(memory_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_snapshots_date ON ai_conversation_snapshots(conversation_date);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_snapshots_importance ON ai_conversation_snapshots(importance_score);

-- Function to update conversation memory after each interaction
CREATE OR REPLACE FUNCTION update_ai_conversation_memory(
  p_ai_user_id UUID,
  p_human_user_id UUID,
  p_conversation_summary TEXT DEFAULT NULL,
  p_new_details JSONB DEFAULT '{}',
  p_topics_discussed JSONB DEFAULT '[]',
  p_message_count INTEGER DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  memory_id UUID;
  new_snapshot_id UUID;
BEGIN
  -- Insert or update conversation memory
  INSERT INTO ai_conversation_memories (
    ai_user_id,
    human_user_id,
    last_conversation_at,
    total_conversations,
    total_messages_exchanged,
    last_conversation_summary
  )
  VALUES (
    p_ai_user_id,
    p_human_user_id,
    NOW(),
    1,
    p_message_count,
    p_conversation_summary
  )
  ON CONFLICT (ai_user_id, human_user_id)
  DO UPDATE SET
    last_conversation_at = NOW(),
    total_conversations = ai_conversation_memories.total_conversations + 1,
    total_messages_exchanged = ai_conversation_memories.total_messages_exchanged + p_message_count,
    last_conversation_summary = COALESCE(p_conversation_summary, ai_conversation_memories.last_conversation_summary),
    updated_at = NOW()
  RETURNING id INTO memory_id;
  
  -- Create conversation snapshot if summary provided
  IF p_conversation_summary IS NOT NULL THEN
    INSERT INTO ai_conversation_snapshots (
      memory_id,
      conversation_date,
      message_count,
      conversation_summary,
      key_topics,
      new_details_learned
    )
    VALUES (
      memory_id,
      CURRENT_DATE,
      p_message_count,
      p_conversation_summary,
      p_topics_discussed,
      p_new_details
    )
    RETURNING id INTO new_snapshot_id;
  END IF;
  
  RETURN memory_id;
END;
$$;

-- Function to get conversation memory for AI context
CREATE OR REPLACE FUNCTION get_ai_conversation_memory(
  p_ai_user_id UUID,
  p_human_user_id UUID
)
RETURNS TABLE (
  memory_id UUID,
  total_conversations INTEGER,
  relationship_stage TEXT,
  human_details_learned JSONB,
  shared_experiences JSONB,
  last_conversation_summary TEXT,
  ongoing_topics JSONB,
  recent_snapshots JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    acm.id as memory_id,
    acm.total_conversations,
    acm.relationship_stage,
    acm.human_details_learned,
    acm.shared_experiences,
    acm.last_conversation_summary,
    acm.ongoing_topics,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', acs.conversation_date,
            'summary', acs.conversation_summary,
            'topics', acs.key_topics,
            'emotional_tone', acs.emotional_tone
          )
        )
        FROM ai_conversation_snapshots acs
        WHERE acs.memory_id = acm.id
        ORDER BY acs.conversation_date DESC
        LIMIT 5
      ),
      '[]'::jsonb
    ) as recent_snapshots
  FROM ai_conversation_memories acm
  WHERE acm.ai_user_id = p_ai_user_id 
    AND acm.human_user_id = p_human_user_id;
END;
$$;

-- Function to update human details learned
CREATE OR REPLACE FUNCTION update_human_details_learned(
  p_ai_user_id UUID,
  p_human_user_id UUID,
  p_new_details JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ai_conversation_memories
  SET 
    human_details_learned = human_details_learned || p_new_details,
    updated_at = NOW()
  WHERE ai_user_id = p_ai_user_id 
    AND human_user_id = p_human_user_id;
  
  RETURN FOUND;
END;
$$;

-- Function to generate or update system prompt for AI user
CREATE OR REPLACE FUNCTION generate_ai_system_prompt(
  p_ai_user_id UUID,
  p_system_prompt TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET 
    generated_system_prompt = p_system_prompt,
    personality_generated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_ai_user_id 
    AND is_mock_user = TRUE;
  
  RETURN FOUND;
END;
$$;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION update_ai_conversation_memory(UUID, UUID, TEXT, JSONB, JSONB, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_conversation_memory(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_human_details_learned(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_ai_system_prompt(UUID, TEXT) TO authenticated;

-- RLS policies for conversation memories
ALTER TABLE ai_conversation_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can access conversation memories involving them
CREATE POLICY "Users can access their AI conversation memories" ON ai_conversation_memories
  FOR ALL USING (
    auth.uid() = human_user_id OR 
    (auth.uid() = ai_user_id AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_mock_user = TRUE
    ))
  );

-- Users can access conversation snapshots for their conversations
CREATE POLICY "Users can access their conversation snapshots" ON ai_conversation_snapshots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM ai_conversation_memories acm
      WHERE acm.id = memory_id
        AND (acm.human_user_id = auth.uid() OR 
             (acm.ai_user_id = auth.uid() AND EXISTS (
               SELECT 1 FROM users WHERE id = auth.uid() AND is_mock_user = TRUE
             )))
    )
  );

-- Add helpful comments
COMMENT ON TABLE ai_conversation_memories IS 'Stores persistent memory and relationship context between AI and human users';
COMMENT ON TABLE ai_conversation_snapshots IS 'Detailed conversation summaries for building rich AI memory';
COMMENT ON FUNCTION update_ai_conversation_memory IS 'Updates conversation memory after each AI-human interaction';
COMMENT ON FUNCTION get_ai_conversation_memory IS 'Retrieves conversation memory for AI context building';
COMMENT ON FUNCTION generate_ai_system_prompt IS 'Stores generated system prompt for AI user personalities';