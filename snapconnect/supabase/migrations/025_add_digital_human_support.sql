-- Add Digital Human Support
-- This migration adds tables for comprehensive digital human personalities
-- while maintaining backward compatibility with existing AI users

-- Digital Humans table - extends AI users with comprehensive personality data
CREATE TABLE IF NOT EXISTS digital_humans (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Core personality traits (500+ traits system)
  personality JSONB NOT NULL DEFAULT '{}',
  
  -- Complete life context (career, relationships, background)
  life_context JSONB NOT NULL DEFAULT '{}',
  
  -- Autobiographical memory system
  memory_system JSONB NOT NULL DEFAULT '{}',
  
  -- Current dynamic state
  current_state JSONB NOT NULL DEFAULT '{
    "mood": {"primary_emotion": "neutral", "intensity": 5, "stability": 7},
    "energy": 7,
    "stress_level": 3,
    "social_battery": 8,
    "life_satisfaction": 7
  }',
  
  -- Evolution and growth tracking
  evolution_data JSONB NOT NULL DEFAULT '{
    "personality_evolution": [],
    "relationship_growth": [],
    "life_learning": []
  }',
  
  -- Metadata
  meta_data JSONB NOT NULL DEFAULT '{
    "interaction_count": 0,
    "relationship_development_stage": "initial_contact"
  }',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Digital Human Life Events table - tracks life events that shape personality
CREATE TABLE IF NOT EXISTS digital_human_life_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digital_human_id UUID NOT NULL REFERENCES digital_humans(id) ON DELETE CASCADE,
  
  -- Event details
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- career, relationship, health, crisis, etc.
  event_data JSONB NOT NULL,
  
  -- Event impact
  impact_magnitude INTEGER DEFAULT 5, -- 1-10 scale
  life_domains_affected TEXT[] DEFAULT '{}',
  
  -- Timing
  event_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_days INTEGER DEFAULT 1,
  is_ongoing BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Digital Human Relationship Memory table - tracks relationships with human users
CREATE TABLE IF NOT EXISTS digital_human_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digital_human_id UUID NOT NULL REFERENCES digital_humans(id) ON DELETE CASCADE,
  human_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Relationship data
  relationship_data JSONB NOT NULL DEFAULT '{
    "first_interaction": null,
    "interaction_count": 0,
    "relationship_stage": "initial_contact",
    "trust_level": 1,
    "emotional_connection": 1,
    "shared_experiences": [],
    "conversation_themes": [],
    "user_preferences_learned": {},
    "significant_moments": []
  }',
  
  -- Relationship state
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  relationship_strength INTEGER DEFAULT 1, -- 1-10 scale
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(digital_human_id, human_user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_digital_humans_created_at ON digital_humans(created_at);
CREATE INDEX IF NOT EXISTS idx_digital_human_life_events_digital_human_id ON digital_human_life_events(digital_human_id);
CREATE INDEX IF NOT EXISTS idx_digital_human_life_events_event_type ON digital_human_life_events(event_type);
CREATE INDEX IF NOT EXISTS idx_digital_human_life_events_event_date ON digital_human_life_events(event_date);
CREATE INDEX IF NOT EXISTS idx_digital_human_relationships_digital_human_id ON digital_human_relationships(digital_human_id);
CREATE INDEX IF NOT EXISTS idx_digital_human_relationships_human_user_id ON digital_human_relationships(human_user_id);
CREATE INDEX IF NOT EXISTS idx_digital_human_relationships_last_interaction ON digital_human_relationships(last_interaction_at);

-- Update trigger for digital_humans
CREATE OR REPLACE FUNCTION update_digital_humans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_digital_humans_updated_at
  BEFORE UPDATE ON digital_humans
  FOR EACH ROW
  EXECUTE FUNCTION update_digital_humans_updated_at();

-- Update trigger for digital_human_relationships
CREATE TRIGGER trigger_update_digital_human_relationships_updated_at
  BEFORE UPDATE ON digital_human_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_digital_humans_updated_at();

-- Helper function to check if a user is a digital human
CREATE OR REPLACE FUNCTION is_digital_human(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM digital_humans WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql;

-- Helper function to get digital human with relationship context
CREATE OR REPLACE FUNCTION get_digital_human_with_relationship_context(
  digital_human_id UUID,
  human_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'digital_human', row_to_json(dh.*),
    'relationship_memory', row_to_json(dhr.*),
    'recent_life_events', (
      SELECT jsonb_agg(row_to_json(dhle.*))
      FROM digital_human_life_events dhle
      WHERE dhle.digital_human_id = dh.id
      AND dhle.event_date >= NOW() - INTERVAL '30 days'
      ORDER BY dhle.event_date DESC
      LIMIT 5
    )
  ) INTO result
  FROM digital_humans dh
  LEFT JOIN digital_human_relationships dhr ON (
    dhr.digital_human_id = dh.id AND dhr.human_user_id = get_digital_human_with_relationship_context.human_user_id
  )
  WHERE dh.id = digital_human_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Helper function to create or update relationship memory
CREATE OR REPLACE FUNCTION upsert_digital_human_relationship(
  p_digital_human_id UUID,
  p_human_user_id UUID,
  p_interaction_data JSONB
)
RETURNS UUID AS $$
DECLARE
  relationship_id UUID;
BEGIN
  -- Insert or update relationship record
  INSERT INTO digital_human_relationships (
    digital_human_id,
    human_user_id,
    relationship_data,
    last_interaction_at
  ) VALUES (
    p_digital_human_id,
    p_human_user_id,
    p_interaction_data,
    NOW()
  )
  ON CONFLICT (digital_human_id, human_user_id)
  DO UPDATE SET
    relationship_data = digital_human_relationships.relationship_data || p_interaction_data,
    last_interaction_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO relationship_id;
  
  RETURN relationship_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function to add life event to digital human
CREATE OR REPLACE FUNCTION add_digital_human_life_event(
  p_digital_human_id UUID,
  p_event_type VARCHAR(50),
  p_event_data JSONB,
  p_impact_magnitude INTEGER DEFAULT 5,
  p_duration_days INTEGER DEFAULT 1
)
RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO digital_human_life_events (
    digital_human_id,
    event_id,
    event_type,
    event_data,
    impact_magnitude,
    duration_days,
    life_domains_affected
  ) VALUES (
    p_digital_human_id,
    p_digital_human_id || '_' || p_event_type || '_' || extract(epoch from now()),
    p_event_type,
    p_event_data,
    p_impact_magnitude,
    p_duration_days,
    COALESCE((p_event_data->>'life_domains_affected')::TEXT[], '{}')
  )
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Comment explaining the integration approach
COMMENT ON TABLE digital_humans IS 'Extends AI users with comprehensive digital human personalities. Backward compatible with existing AI archetype system.';
COMMENT ON TABLE digital_human_life_events IS 'Tracks life events that shape digital human personality and behavior over time.';
COMMENT ON TABLE digital_human_relationships IS 'Maintains relationship memory between digital humans and human users.';