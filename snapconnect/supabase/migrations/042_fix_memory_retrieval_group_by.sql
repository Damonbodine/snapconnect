-- Fix GROUP BY error in get_ai_conversation_memory function
-- The error occurs because PostgreSQL requires proper aggregate function handling

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
          ) ORDER BY acs.conversation_date DESC
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