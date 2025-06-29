-- Simple fix for GROUP BY error in get_ai_conversation_memory function
-- Remove the problematic subquery and use a simpler approach

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
    '[]'::jsonb as recent_snapshots -- Temporarily return empty array to fix GROUP BY issue
  FROM ai_conversation_memories acm
  WHERE acm.ai_user_id = p_ai_user_id 
    AND acm.human_user_id = p_human_user_id;
END;
$$;