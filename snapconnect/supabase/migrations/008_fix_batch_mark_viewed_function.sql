-- Migration: Fix batch_mark_viewed function data type casting issue
-- The function was failing because duration field was receiving string instead of integer

BEGIN;

-- Drop and recreate function with proper type casting
DROP FUNCTION IF EXISTS batch_mark_viewed(UUID, JSONB);

CREATE OR REPLACE FUNCTION batch_mark_viewed(
  p_user_id UUID,
  p_view_records JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_record JSONB;
BEGIN
  -- Insert each view record with proper type casting
  FOR v_record IN SELECT * FROM jsonb_array_elements(p_view_records)
  LOOP
    INSERT INTO post_views (
      user_id, 
      post_id, 
      viewed_at,
      view_duration,
      view_percentage,
      device_type,
      app_version
    )
    VALUES (
      p_user_id,
      (v_record->>'postId')::UUID,
      TO_TIMESTAMP((v_record->>'viewedAt')::BIGINT / 1000.0),
      (v_record->>'duration')::INTEGER,  -- Explicit cast to INTEGER
      COALESCE((v_record->>'viewPercentage')::INTEGER, 100),
      v_record->>'deviceType',
      v_record->>'appVersion'
    )
    ON CONFLICT (user_id, post_id) 
    DO UPDATE SET 
      viewed_at = EXCLUDED.viewed_at,
      view_duration = GREATEST(post_views.view_duration, EXCLUDED.view_duration),
      view_percentage = GREATEST(post_views.view_percentage, EXCLUDED.view_percentage);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION batch_mark_viewed(UUID, JSONB) TO authenticated;

COMMIT;