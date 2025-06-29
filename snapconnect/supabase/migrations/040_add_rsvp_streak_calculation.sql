-- Migration: Add RSVP streak calculation system
-- This migration adds functions to calculate user activity streaks based on RSVP and event creation activity

-- Function to calculate current RSVP activity streak for a user
CREATE OR REPLACE FUNCTION calculate_user_activity_streak(target_user_id UUID)
RETURNS TABLE (
  current_streak INTEGER,
  best_streak INTEGER,
  total_activity_days INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  activity_dates DATE[];
  current_streak_count INTEGER := 0;
  best_streak_count INTEGER := 0;
  temp_streak INTEGER := 0;
  check_date DATE;
  prev_date DATE;
  i INTEGER;
BEGIN
  -- Get all unique dates where user had activity (RSVP or event creation)
  -- Convert timestamps to dates in user's timezone (assuming UTC for now)
  WITH user_activity AS (
    -- RSVP activity dates
    SELECT DISTINCT DATE(created_at) as activity_date
    FROM event_participants 
    WHERE user_id = target_user_id
    AND status IN ('going', 'maybe')
    
    UNION
    
    -- Event creation dates  
    SELECT DISTINCT DATE(created_at) as activity_date
    FROM events 
    WHERE creator_id = target_user_id
    AND status != 'draft'
    AND deleted_at IS NULL
  )
  SELECT ARRAY_AGG(activity_date ORDER BY activity_date DESC) 
  INTO activity_dates
  FROM user_activity;
  
  -- If no activity, return zeros
  IF activity_dates IS NULL OR array_length(activity_dates, 1) = 0 THEN
    current_streak := 0;
    best_streak := 0;
    total_activity_days := 0;
    RETURN QUERY SELECT current_streak, best_streak, total_activity_days;
    RETURN;
  END IF;
  
  -- Set total activity days
  total_activity_days := array_length(activity_dates, 1);
  
  -- Calculate current streak (consecutive days from today backwards)
  check_date := CURRENT_DATE;
  current_streak_count := 0;
  
  -- Check if there's activity today or yesterday (to allow for timezone differences)
  FOR i IN 1..array_length(activity_dates, 1) LOOP
    IF activity_dates[i] = check_date OR activity_dates[i] = check_date - 1 THEN
      -- Found activity on current check date, start counting
      current_streak_count := 1;
      prev_date := activity_dates[i];
      EXIT;
    ELSIF activity_dates[i] < check_date - 1 THEN
      -- No recent activity, streak is 0
      EXIT;
    END IF;
  END LOOP;
  
  -- Continue counting consecutive days backwards
  IF current_streak_count > 0 THEN
    FOR i IN 2..array_length(activity_dates, 1) LOOP
      -- Check if this date is consecutive to the previous
      IF activity_dates[i] = prev_date - 1 THEN
        current_streak_count := current_streak_count + 1;
        prev_date := activity_dates[i];
      ELSE
        -- Gap found, stop counting current streak
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- Calculate best streak ever
  best_streak_count := 0;
  temp_streak := 1;
  
  IF array_length(activity_dates, 1) > 0 THEN
    best_streak_count := 1; -- At least 1 if there's any activity
    
    FOR i IN 2..array_length(activity_dates, 1) LOOP
      -- Note: activity_dates is ordered DESC, so we need to check if prev date is 1 day after current
      IF activity_dates[i-1] = activity_dates[i] + 1 THEN
        temp_streak := temp_streak + 1;
        best_streak_count := GREATEST(best_streak_count, temp_streak);
      ELSE
        temp_streak := 1;
      END IF;
    END LOOP;
  END IF;
  
  current_streak := current_streak_count;
  best_streak := best_streak_count;
  
  RETURN QUERY SELECT current_streak, best_streak, total_activity_days;
END;
$$;

-- Function to get comprehensive RSVP statistics including real streak data
CREATE OR REPLACE FUNCTION get_user_rsvp_stats(target_user_id UUID)
RETURNS TABLE (
  total_events_rsvp INTEGER,
  total_events_created INTEGER,
  total_events_attended INTEGER,
  current_streak INTEGER,
  best_streak INTEGER,
  total_activity_days INTEGER,
  attendance_rate NUMERIC,
  upcoming_events_count INTEGER,
  favorite_categories JSONB,
  recent_activity JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  rsvp_count INTEGER;
  created_count INTEGER;
  attended_count INTEGER;
  streak_data RECORD;
  upcoming_count INTEGER;
  attendance_percentage NUMERIC;
BEGIN
  -- Get basic counts
  SELECT COUNT(*) INTO rsvp_count
  FROM event_participants 
  WHERE user_id = target_user_id 
  AND status IN ('going', 'maybe');
  
  SELECT COUNT(*) INTO created_count
  FROM events 
  WHERE creator_id = target_user_id 
  AND status != 'draft'
  AND deleted_at IS NULL;
  
  SELECT COUNT(*) INTO attended_count
  FROM event_participants 
  WHERE user_id = target_user_id 
  AND checked_in = TRUE;
  
  -- Calculate attendance rate
  IF rsvp_count > 0 THEN
    attendance_percentage := (attended_count::NUMERIC / rsvp_count::NUMERIC) * 100;
  ELSE
    attendance_percentage := 0;
  END IF;
  
  -- Get streak data
  SELECT * INTO streak_data 
  FROM calculate_user_activity_streak(target_user_id);
  
  -- Get upcoming events count
  SELECT COUNT(*) INTO upcoming_count
  FROM event_participants ep
  JOIN events e ON ep.event_id = e.id
  WHERE ep.user_id = target_user_id 
  AND ep.status = 'going'
  AND e.start_time > NOW()
  AND e.deleted_at IS NULL;
  
  -- Get favorite categories (top 5)
  WITH category_counts AS (
    SELECT 
      ec.name,
      COUNT(*) as count
    FROM event_participants ep
    JOIN events e ON ep.event_id = e.id
    JOIN event_categories ec ON e.category_id = ec.id
    WHERE ep.user_id = target_user_id
    AND ep.status IN ('going', 'maybe')
    GROUP BY ec.id, ec.name
    
    UNION ALL
    
    SELECT 
      ec.name,
      COUNT(*) as count
    FROM events e
    JOIN event_categories ec ON e.category_id = ec.id
    WHERE e.creator_id = target_user_id
    AND e.status != 'draft'
    AND e.deleted_at IS NULL
    GROUP BY ec.id, ec.name
  ),
  aggregated_categories AS (
    SELECT 
      name,
      SUM(count) as total_count
    FROM category_counts
    GROUP BY name
    ORDER BY total_count DESC
    LIMIT 5
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'category', name,
      'count', total_count
    )
  ) INTO favorite_categories
  FROM aggregated_categories;
  
  -- Get recent activity (last 10 activities)
  WITH recent_activities AS (
    SELECT 
      'rsvp' as type,
      e.title as event_title,
      ep.created_at as date
    FROM event_participants ep
    JOIN events e ON ep.event_id = e.id
    WHERE ep.user_id = target_user_id
    AND ep.status IN ('going', 'maybe')
    
    UNION ALL
    
    SELECT 
      'created' as type,
      e.title as event_title,
      e.created_at as date
    FROM events e
    WHERE e.creator_id = target_user_id
    AND e.status != 'draft'
    AND e.deleted_at IS NULL
    
    ORDER BY date DESC
    LIMIT 10
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'type', type,
      'eventTitle', event_title,
      'date', date
    )
  ) INTO recent_activity
  FROM recent_activities;
  
  -- Return all data
  total_events_rsvp := rsvp_count;
  total_events_created := created_count;
  total_events_attended := attended_count;
  current_streak := streak_data.current_streak;
  best_streak := streak_data.best_streak;
  total_activity_days := streak_data.total_activity_days;
  attendance_rate := COALESCE(attendance_percentage, 0);
  upcoming_events_count := upcoming_count;
  favorite_categories := COALESCE(favorite_categories, '[]'::jsonb);
  recent_activity := COALESCE(recent_activity, '[]'::jsonb);
  
  RETURN QUERY SELECT 
    total_events_rsvp,
    total_events_created, 
    total_events_attended,
    current_streak,
    best_streak,
    total_activity_days,
    attendance_rate,
    upcoming_events_count,
    favorite_categories,
    recent_activity;
END;
$$;

-- Create indexes to optimize streak calculations
CREATE INDEX IF NOT EXISTS idx_event_participants_user_status_date 
ON event_participants(user_id, status, created_at) 
WHERE status IN ('going', 'maybe');

CREATE INDEX IF NOT EXISTS idx_events_creator_status_date 
ON events(creator_id, status, created_at) 
WHERE status != 'draft' AND deleted_at IS NULL;

-- Add comment explaining the streak logic
COMMENT ON FUNCTION calculate_user_activity_streak IS 
'Calculates activity streaks based on consecutive days with RSVP or event creation activity. 
Current streak counts backwards from today, best streak is the longest ever achieved.';

COMMENT ON FUNCTION get_user_rsvp_stats IS 
'Comprehensive function to get all user RSVP statistics including real streak calculations, 
attendance rates, favorite categories, and recent activity.';