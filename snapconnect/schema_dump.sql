

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."accept_friend_request"("friendship_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Update friendship status to accepted
  -- Only allow if current user is the friend_id and status is pending
  UPDATE friendships 
  SET status = 'accepted'
  WHERE id = friendship_id 
    AND friend_id = current_user_id 
    AND status = 'pending';
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found or already processed';
  END IF;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."accept_friend_request"("friendship_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."batch_mark_viewed"("p_user_id" "uuid", "p_view_records" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."batch_mark_viewed"("p_user_id" "uuid", "p_view_records" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."batch_update_step_data"("target_user_id" "uuid", "step_data" "json") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  step_record JSON;
  inserted_count INTEGER := 0;
  updated_count INTEGER := 0;
BEGIN
  -- Loop through the step data array
  FOR step_record IN SELECT * FROM json_array_elements(step_data)
  LOOP
    INSERT INTO daily_step_logs (
      user_id, 
      date, 
      step_count, 
      goal_reached,
      updated_at
    )
    VALUES (
      target_user_id,
      (step_record->>'date')::DATE,
      (step_record->>'steps')::INTEGER,
      (step_record->>'steps')::INTEGER >= 10000,
      NOW()
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
      step_count = (step_record->>'steps')::INTEGER,
      goal_reached = (step_record->>'steps')::INTEGER >= 10000,
      updated_at = NOW();
    
    -- Count operations for response
    IF FOUND THEN
      updated_count := updated_count + 1;
    ELSE
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'total', inserted_count + updated_count
  );
END;
$$;


ALTER FUNCTION "public"."batch_update_step_data"("target_user_id" "uuid", "step_data" "json") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_distance_json"("coords1" "text", "coords2" "text") RETURNS double precision
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  lat1 FLOAT;
  lon1 FLOAT;
  lat2 FLOAT;
  lon2 FLOAT;
  r FLOAT := 6371; -- Earth radius in km
  dlat FLOAT;
  dlon FLOAT;
  a FLOAT;
  c FLOAT;
BEGIN
  -- Parse JSON coordinates
  lat1 := (coords1::json->>'latitude')::FLOAT;
  lon1 := (coords1::json->>'longitude')::FLOAT;
  lat2 := (coords2::json->>'latitude')::FLOAT;
  lon2 := (coords2::json->>'longitude')::FLOAT;
  
  -- Convert to radians
  lat1 := lat1 * pi() / 180;
  lon1 := lon1 * pi() / 180;
  lat2 := lat2 * pi() / 180;
  lon2 := lon2 * pi() / 180;
  
  -- Haversine formula
  dlat := lat2 - lat1;
  dlon := lon2 - lon1;
  a := sin(dlat/2) * sin(dlat/2) + cos(lat1) * cos(lat2) * sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN r * c;
END;
$$;


ALTER FUNCTION "public"."calculate_distance_json"("coords1" "text", "coords2" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_enhanced_profile_completeness"("target_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  completeness_score INTEGER := 0;
  total_fields INTEGER := 35; -- Updated count including new fields
BEGIN
  -- Count filled essential fields (weight more heavily)
  SELECT 
    -- Basic profile (weight: 2 each)
    (CASE WHEN username IS NOT NULL THEN 2 ELSE 0 END) +
    (CASE WHEN full_name IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN avatar_url IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN bio IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN city IS NOT NULL THEN 1 ELSE 0 END) +
    
    -- Core fitness info (weight: 2 each) 
    (CASE WHEN fitness_level IS NOT NULL THEN 2 ELSE 0 END) +
    (CASE WHEN workout_intensity IS NOT NULL THEN 2 ELSE 0 END) +
    (CASE WHEN array_length(goals, 1) > 0 THEN 2 ELSE 0 END) +
    (CASE WHEN array_length(dietary_preferences, 1) > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN workout_frequency IS NOT NULL THEN 2 ELSE 0 END) +
    
    -- Health baseline (weight: 1 each)
    (CASE WHEN current_weight_kg IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN target_weight_kg IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN height_cm IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN daily_step_goal IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN weekly_workout_goal IS NOT NULL THEN 1 ELSE 0 END) +
    
    -- Lifestyle preferences (weight: 1 each)
    (CASE WHEN array_length(preferred_workout_times, 1) > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN array_length(available_equipment, 1) > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN motivation_style IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN current_activity_level IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN fitness_experience_years IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN preferred_workout_duration IS NOT NULL THEN 1 ELSE 0 END) +
    
    -- Coaching preferences (weight: 1 each)
    (CASE WHEN coaching_style IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN feedback_frequency IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN progress_tracking_detail IS NOT NULL THEN 1 ELSE 0 END) +
    
    -- Optional but valuable (weight: 1 each)
    (CASE WHEN primary_motivation IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN biggest_fitness_challenge IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN previous_fitness_successes IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN sleep_schedule IS NOT NULL AND sleep_schedule != '{}' THEN 1 ELSE 0 END) +
    (CASE WHEN array_length(wellness_goals, 1) > 0 THEN 1 ELSE 0 END) +
    (CASE WHEN accountability_preference IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN social_sharing_comfort IS NOT NULL THEN 1 ELSE 0 END)
  INTO completeness_score
  FROM users 
  WHERE id = target_user_id;
  
  -- Return percentage (cap at 100%)
  RETURN LEAST(100, ROUND((completeness_score::DECIMAL / total_fields) * 100));
END;
$$;


ALTER FUNCTION "public"."calculate_enhanced_profile_completeness"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_user_activity_streak"("target_user_id" "uuid") RETURNS TABLE("current_streak" integer, "best_streak" integer, "total_activity_days" integer)
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."calculate_user_activity_streak"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_user_activity_streak"("target_user_id" "uuid") IS 'Calculates activity streaks based on consecutive days with RSVP or event creation activity. 
Current streak counts backwards from today, best streak is the longest ever achieved.';



CREATE OR REPLACE FUNCTION "public"."check_step_achievements"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Award achievement for first 10K steps
  IF NEW.step_count >= 10000 AND NEW.goal_reached THEN
    INSERT INTO user_achievements (user_id, achievement_type, achievement_id, title, description, icon_name)
    VALUES (NEW.user_id, 'steps', 'first_10k', 'Step Champion', 'Reached 10,000 steps in a day!', 'trophy')
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;
  
  -- Award achievements for step streaks
  DECLARE
    current_streak INTEGER;
  BEGIN
    SELECT current_count INTO current_streak
    FROM user_streaks 
    WHERE user_id = NEW.user_id AND streak_type = 'daily_steps';
    
    -- 7-day streak
    IF current_streak >= 7 THEN
      INSERT INTO user_achievements (user_id, achievement_type, achievement_id, title, description, icon_name, level)
      VALUES (NEW.user_id, 'streak', 'weekly_warrior', 'Weekly Warrior', 'Maintained a 7-day step streak!', 'fire', 1)
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
    END IF;
    
    -- 30-day streak
    IF current_streak >= 30 THEN
      INSERT INTO user_achievements (user_id, achievement_type, achievement_id, title, description, icon_name, level)
      VALUES (NEW.user_id, 'streak', 'monthly_master', 'Monthly Master', 'Incredible 30-day step streak!', 'crown', 2)
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
    END IF;
  END;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_step_achievements"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_stream_activity"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."check_stream_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_comments"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Delete comments on posts that expired more than 7 days ago
  DELETE FROM comments 
  WHERE post_id IN (
    SELECT id FROM posts 
    WHERE expires_at < NOW() - INTERVAL '7 days'
  );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_comments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_post_views"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Delete view records for posts that expired more than 7 days ago
  DELETE FROM post_views 
  WHERE post_id IN (
    SELECT id FROM posts 
    WHERE expires_at < NOW() - INTERVAL '7 days'
  );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_post_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_posts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete posts that have expired
  DELETE FROM posts 
  WHERE expires_at < NOW()
  AND expires_at IS NOT NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_posts"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_posts"() IS 'Removes expired posts from the database';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_coach_conversations"("days_to_keep" integer DEFAULT 90) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  DELETE FROM coach_conversations 
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_coach_conversations"("days_to_keep" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_proactive_messages_log_if_not_exists"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- This function ensures the table exists (it now does)
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."create_proactive_messages_log_if_not_exists"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_proactive_messages_log_if_not_exists"() IS 'Helper function to ensure proactive messages table exists';



CREATE OR REPLACE FUNCTION "public"."create_progress_log_on_goal_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only create log if current_value actually changed
  IF OLD.current_value IS DISTINCT FROM NEW.current_value THEN
    INSERT INTO goal_progress_logs (
      goal_id,
      user_id,
      recorded_value,
      previous_value,
      progress_percentage,
      log_type,
      data_source
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.current_value,
      OLD.current_value,
      NEW.progress_percentage,
      'auto_sync',
      'app_tracking'
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_progress_log_on_goal_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_voice_coaching_session"("target_user_id" "uuid", "session_token" "text", "workout_context" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_session_id UUID;
  user_context JSONB;
BEGIN
  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Get user context for session (FIXED: use ug.status = 'active' instead of ug.is_active)
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


ALTER FUNCTION "public"."create_voice_coaching_session"("target_user_id" "uuid", "session_token" "text", "workout_context" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decline_friend_request"("friendship_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Delete friendship record
  -- Allow if user is either the sender or receiver
  DELETE FROM friendships 
  WHERE id = friendship_id 
    AND (user_id = current_user_id OR friend_id = current_user_id);
  
  -- Check if deletion was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found or not authorized';
  END IF;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."decline_friend_request"("friendship_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_expired_content"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM posts WHERE expires_at < NOW();
  DELETE FROM stories WHERE expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."delete_expired_content"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_events_within_radius"("user_lat" double precision, "user_lon" double precision, "radius_km" double precision DEFAULT 25) RETURNS TABLE("id" "uuid", "title" "text", "location_name" "text", "location_coordinates" "text", "start_time" timestamp with time zone, "distance_km" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.location_name,
    e.location_coordinates,
    e.start_time,
    calculate_distance_json(
      json_build_object('latitude', user_lat, 'longitude', user_lon)::text,
      e.location_coordinates
    ) as distance_km
  FROM events e
  WHERE e.location_coordinates IS NOT NULL
    AND e.status = 'published'
    AND e.deleted_at IS NULL
    AND calculate_distance_json(
      json_build_object('latitude', user_lat, 'longitude', user_lon)::text,
      e.location_coordinates
    ) <= radius_km
  ORDER BY distance_km;
END;
$$;


ALTER FUNCTION "public"."find_events_within_radius"("user_lat" double precision, "user_lon" double precision, "radius_km" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_nearby_streams"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision DEFAULT 50) RETURNS TABLE("stream_id" "uuid", "title" "text", "description" "text", "host_username" "text", "viewer_count" integer, "distance_km" double precision)
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."find_nearby_streams"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_agora_uid"("user_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."generate_agora_uid"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_ai_system_prompt"("p_ai_user_id" "uuid", "p_system_prompt" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."generate_ai_system_prompt"("p_ai_user_id" "uuid", "p_system_prompt" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_ai_system_prompt"("p_ai_user_id" "uuid", "p_system_prompt" "text") IS 'Stores generated system prompt for AI user personalities';



CREATE OR REPLACE FUNCTION "public"."generate_post_id"() RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN gen_random_uuid();
END;
$$;


ALTER FUNCTION "public"."generate_post_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_voice_session"("target_user_id" "uuid") RETURNS TABLE("session_id" "uuid", "session_token" "text", "status" "text", "conversation_context" "jsonb", "workout_context" "jsonb", "session_duration" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_active_voice_session"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ai_conversation_context"("ai_user_id" "uuid", "human_user_id" "uuid", "message_limit" integer DEFAULT 10) RETURNS TABLE("message_id" "uuid", "content" "text", "is_from_ai" boolean, "sent_at" timestamp with time zone, "message_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Return recent message history between AI and human
  RETURN QUERY
  SELECT 
    m.id as message_id,
    m.content,
    COALESCE(m.is_ai_sender, FALSE) as is_from_ai,
    m.sent_at,
    m.message_type
  FROM messages m
  WHERE 
    ((m.sender_id = ai_user_id AND m.receiver_id = human_user_id) 
     OR (m.sender_id = human_user_id AND m.receiver_id = ai_user_id))
    AND (m.expires_at IS NULL OR m.expires_at > NOW()) -- Only non-expired messages
  ORDER BY m.sent_at DESC
  LIMIT message_limit;
END;
$$;


ALTER FUNCTION "public"."get_ai_conversation_context"("ai_user_id" "uuid", "human_user_id" "uuid", "message_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_ai_conversation_context"("ai_user_id" "uuid", "human_user_id" "uuid", "message_limit" integer) IS 'Gets conversation history between AI and human user for context';



CREATE OR REPLACE FUNCTION "public"."get_ai_conversation_memory"("p_ai_user_id" "uuid", "p_human_user_id" "uuid") RETURNS TABLE("memory_id" "uuid", "total_conversations" integer, "relationship_stage" "text", "human_details_learned" "jsonb", "shared_experiences" "jsonb", "last_conversation_summary" "text", "ongoing_topics" "jsonb", "recent_snapshots" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_ai_conversation_memory"("p_ai_user_id" "uuid", "p_human_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_ai_conversation_memory"("p_ai_user_id" "uuid", "p_human_user_id" "uuid") IS 'Retrieves conversation memory for AI context building';



CREATE OR REPLACE FUNCTION "public"."get_ai_user_posting_history"("target_user_id" "uuid", "days_back" integer DEFAULT 30) RETURNS TABLE("post_id" "uuid", "created_at" timestamp with time zone, "content" "text", "workout_type" "text", "content_length" integer, "days_since_last_post" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  period_start TIMESTAMP WITH TIME ZONE;
BEGIN
  period_start := CURRENT_DATE - INTERVAL '1 day' * days_back;
  
  -- Verify this is an AI user
  IF NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = target_user_id AND u.is_mock_user = TRUE
  ) THEN
    RAISE EXCEPTION 'User % is not an AI user or does not exist', target_user_id;
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id as post_id,
    p.created_at,
    p.content,
    p.workout_type,
    LENGTH(p.content) as content_length,
    COALESCE(
      (p.created_at::date - LAG(p.created_at::date) OVER (ORDER BY p.created_at))::INTEGER,
      0
    ) as days_since_last_post
  FROM posts p
  WHERE p.user_id = target_user_id
    AND p.created_at >= period_start
  ORDER BY p.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_ai_user_posting_history"("target_user_id" "uuid", "days_back" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_ai_user_posting_history"("target_user_id" "uuid", "days_back" integer) IS 'Returns posting history for a specific AI user';



CREATE OR REPLACE FUNCTION "public"."get_ai_user_posting_stats"("days_back" integer DEFAULT 7) RETURNS TABLE("total_ai_users" integer, "users_posted_today" integer, "total_posts_today" integer, "total_posts_period" integer, "avg_posts_per_user" numeric, "archetype_breakdown" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  period_start TIMESTAMP WITH TIME ZONE;
  today_start TIMESTAMP WITH TIME ZONE;
  archetype_stats JSONB;
BEGIN
  period_start := CURRENT_DATE - INTERVAL '1 day' * days_back;
  today_start := CURRENT_DATE;
  
  -- Build archetype breakdown
  SELECT jsonb_object_agg(
    archetype_name,
    jsonb_build_object(
      'users', user_count,
      'posts_today', posts_today,
      'posts_period', posts_period
    )
  ) INTO archetype_stats
  FROM (
    SELECT 
      COALESCE(u.personality_traits->>'archetype', 'unknown') as archetype_name,
      COUNT(DISTINCT u.id) as user_count,
      COUNT(DISTINCT CASE WHEN p.created_at >= today_start THEN p.id END) as posts_today,
      COUNT(DISTINCT CASE WHEN p.created_at >= period_start THEN p.id END) as posts_period
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    WHERE u.is_mock_user = TRUE
    GROUP BY COALESCE(u.personality_traits->>'archetype', 'unknown')
  ) archetype_data;
  
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM users WHERE is_mock_user = TRUE) as total_ai_users,
    (
      SELECT COUNT(DISTINCT p.user_id)::INTEGER 
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      WHERE u.is_mock_user = TRUE 
        AND p.created_at >= today_start
    ) as users_posted_today,
    (
      SELECT COUNT(*)::INTEGER 
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      WHERE u.is_mock_user = TRUE 
        AND p.created_at >= today_start
    ) as total_posts_today,
    (
      SELECT COUNT(*)::INTEGER 
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      WHERE u.is_mock_user = TRUE 
        AND p.created_at >= period_start
    ) as total_posts_period,
    (
      SELECT 
        CASE 
          WHEN COUNT(DISTINCT p.user_id) > 0 
          THEN ROUND(COUNT(*)::DECIMAL / COUNT(DISTINCT p.user_id), 2)
          ELSE 0
        END
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      WHERE u.is_mock_user = TRUE 
        AND p.created_at >= period_start
    ) as avg_posts_per_user,
    archetype_stats as archetype_breakdown;
END;
$$;


ALTER FUNCTION "public"."get_ai_user_posting_stats"("days_back" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_ai_user_posting_stats"("days_back" integer) IS 'Returns comprehensive posting statistics for AI users';



CREATE OR REPLACE FUNCTION "public"."get_ai_users"() RETURNS TABLE("user_id" "uuid", "username" "text", "full_name" "text", "avatar_url" "text", "personality_traits" "jsonb", "ai_response_style" "jsonb", "conversation_context" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.personality_traits,
    u.ai_response_style,
    u.conversation_context
  FROM users u
  WHERE u.is_mock_user = TRUE AND u.personality_traits IS NOT NULL
  ORDER BY u.username;
END;
$$;


ALTER FUNCTION "public"."get_ai_users"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_ai_users"() IS 'Returns all AI users available for chat';



CREATE OR REPLACE FUNCTION "public"."get_ai_users_for_commenting"("post_id" "uuid", "max_commenters" integer DEFAULT 3) RETURNS TABLE("id" "uuid", "username" "text", "personality_traits" "jsonb", "compatibility_score" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  post_record RECORD;
BEGIN
  -- Get post details
  SELECT p.workout_type, p.content, u.fitness_level, u.goals
  INTO post_record
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE p.id = post_id;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.personality_traits,
    -- Score based on workout type match and personality engagement level
    CASE 
      WHEN u.personality_traits->>'social_engagement' = 'high' THEN 0.4
      WHEN u.personality_traits->>'social_engagement' = 'medium' THEN 0.3
      ELSE 0.2
    END +
    CASE 
      WHEN post_record.workout_type = ANY(
        SELECT jsonb_array_elements_text(u.personality_traits->'preferred_workout_types')
      ) THEN 0.3
      ELSE 0.1
    END +
    -- Fitness level compatibility
    CASE 
      WHEN u.fitness_level = post_record.fitness_level THEN 0.2
      WHEN (u.fitness_level = 'advanced' AND post_record.fitness_level = 'intermediate') OR
           (u.fitness_level = 'intermediate' AND post_record.fitness_level = 'beginner') THEN 0.1
      ELSE 0.05
    END as compatibility_score
  FROM users u
  WHERE u.is_mock_user = TRUE
    AND u.id != (SELECT user_id FROM posts WHERE id = post_id)
    AND NOT EXISTS (
      SELECT 1 FROM comments c 
      WHERE c.post_id = post_id AND c.user_id = u.id
    )
  ORDER BY compatibility_score DESC, RANDOM()
  LIMIT max_commenters;
END;
$$;


ALTER FUNCTION "public"."get_ai_users_for_commenting"("post_id" "uuid", "max_commenters" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ai_users_for_posting"("target_hour" integer DEFAULT NULL::integer) RETURNS TABLE("id" "uuid", "username" "text", "personality_traits" "jsonb", "posting_schedule" "jsonb", "last_post_date" "date")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.personality_traits,
    u.posting_schedule,
    DATE(COALESCE(last_post.created_at, '1970-01-01'::timestamp)) as last_post_date
  FROM users u
  LEFT JOIN (
    SELECT DISTINCT ON (user_id) 
      user_id, 
      created_at
    FROM posts 
    ORDER BY user_id, created_at DESC
  ) last_post ON u.id = last_post.user_id
  WHERE u.is_mock_user = TRUE
    AND (target_hour IS NULL OR 
         (u.posting_schedule->>'preferred_hour')::INTEGER = target_hour OR
         u.posting_schedule->>'preferred_hour' IS NULL)
    AND (last_post.created_at IS NULL OR 
         DATE(last_post.created_at) < CURRENT_DATE);
END;
$$;


ALTER FUNCTION "public"."get_ai_users_for_posting"("target_hour" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ai_users_ready_for_posting"("target_hour" integer DEFAULT NULL::integer, "target_day" integer DEFAULT NULL::integer) RETURNS TABLE("id" "uuid", "username" "text", "full_name" "text", "personality_traits" "jsonb", "posting_schedule" "jsonb", "last_post_date" timestamp with time zone, "archetype" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_hour INTEGER;
  current_day INTEGER;
BEGIN
  -- Use current time if not specified
  current_hour := COALESCE(target_hour, EXTRACT(HOUR FROM NOW()));
  current_day := COALESCE(target_day, EXTRACT(DOW FROM NOW()));
  
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.full_name,
    u.personality_traits,
    u.posting_schedule,
    last_post.created_at as last_post_date,
    COALESCE(u.personality_traits->>'archetype', 'fitness_newbie') as archetype
  FROM users u
  LEFT JOIN LATERAL (
    SELECT created_at
    FROM posts p
    WHERE p.user_id = u.id
    ORDER BY p.created_at DESC
    LIMIT 1
  ) last_post ON true
  WHERE u.is_mock_user = TRUE
    -- Check if user should post at this hour (if they have a preference)
    AND (
      u.posting_schedule->>'preferred_hour' IS NULL OR
      (u.posting_schedule->>'preferred_hour')::INTEGER = current_hour
    )
    -- Check if today is not a rest day
    AND (
      u.posting_schedule->'rest_days' IS NULL OR
      NOT (u.posting_schedule->'rest_days' @> to_jsonb(current_day))
    )
    -- Check if today is a preferred day (if specified)
    AND (
      u.posting_schedule->'preferred_days' IS NULL OR
      u.posting_schedule->'preferred_days' @> to_jsonb(current_day)
    )
    -- Check if user hasn't posted today
    AND (
      last_post.created_at IS NULL OR
      DATE(last_post.created_at) < CURRENT_DATE
    )
  ORDER BY 
    -- Prioritize users who haven't posted in longer
    COALESCE(last_post.created_at, '1970-01-01'::timestamp) ASC,
    u.username ASC;
END;
$$;


ALTER FUNCTION "public"."get_ai_users_ready_for_posting"("target_hour" integer, "target_day" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_ai_users_ready_for_posting"("target_hour" integer, "target_day" integer) IS 'Returns AI users ready to post based on their schedules and posting history';



CREATE OR REPLACE FUNCTION "public"."get_available_ai_users"() RETURNS TABLE("user_id" "uuid", "username" "text", "full_name" "text", "avatar_url" "text", "personality_traits" "jsonb", "ai_response_style" "jsonb", "conversation_context" "jsonb", "is_digital_human" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.personality_traits,
    u.ai_response_style,
    u.conversation_context,
    FALSE as is_digital_human  -- Default to false since column doesn't exist
  FROM users u
  WHERE u.is_mock_user = TRUE 
    AND u.personality_traits IS NOT NULL
    AND u.username IS NOT NULL
  ORDER BY u.username;
END;
$$;


ALTER FUNCTION "public"."get_available_ai_users"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_available_ai_users"() IS 'Enhanced version of get_ai_users with additional metadata';



CREATE OR REPLACE FUNCTION "public"."get_coach_conversation_stats"("target_user_id" "uuid") RETURNS TABLE("total_messages" bigint, "voice_messages" bigint, "text_messages" bigint, "user_messages" bigint, "coach_messages" bigint, "total_voice_duration" integer, "first_conversation" timestamp with time zone, "last_conversation" timestamp with time zone, "conversations_today" bigint, "conversations_this_week" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_messages,
    COUNT(*) FILTER (WHERE is_voice_message = true) as voice_messages,
    COUNT(*) FILTER (WHERE is_voice_message = false) as text_messages,
    COUNT(*) FILTER (WHERE is_user_message = true) as user_messages,
    COUNT(*) FILTER (WHERE is_user_message = false) as coach_messages,
    COALESCE(SUM(audio_duration), 0)::INTEGER as total_voice_duration,
    MIN(created_at) as first_conversation,
    MAX(created_at) as last_conversation,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as conversations_today,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as conversations_this_week
  FROM coach_conversations
  WHERE user_id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."get_coach_conversation_stats"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_comment_counts"("p_post_ids" "uuid"[]) RETURNS TABLE("post_id" "uuid", "comment_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.post_id,
    COUNT(*) as comment_count
  FROM comments c
  WHERE c.post_id = ANY(p_post_ids)
  GROUP BY c.post_id;
END;
$$;


ALTER FUNCTION "public"."get_comment_counts"("p_post_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_compatible_ai_users"("target_user_id" "uuid", "limit_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "username" "text", "full_name" "text", "avatar_url" "text", "fitness_level" "text", "personality_traits" "jsonb", "compatibility_score" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  target_user_record RECORD;
BEGIN
  -- Get target user's profile
  SELECT u.fitness_level, u.goals, u.personality_traits
  INTO target_user_record
  FROM users u
  WHERE u.id = target_user_id;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level,
    u.personality_traits,
    -- Simple compatibility scoring based on shared goals and fitness level
    CASE 
      WHEN u.fitness_level = target_user_record.fitness_level THEN 0.5
      ELSE 0.2
    END +
    CASE 
      WHEN u.goals && target_user_record.goals THEN 0.3
      ELSE 0.1
    END +
    -- Add personality compatibility (if both have personality traits)
    CASE 
      WHEN u.personality_traits ? 'communication_style' AND 
           target_user_record.personality_traits ? 'communication_style' AND
           u.personality_traits->>'communication_style' = target_user_record.personality_traits->>'communication_style'
      THEN 0.2
      ELSE 0.1
    END as compatibility_score
  FROM users u
  WHERE u.is_mock_user = TRUE
    AND u.id != target_user_id
    AND NOT EXISTS (
      SELECT 1 FROM friendships f 
      WHERE (f.user_id = target_user_id AND f.friend_id = u.id) OR
            (f.user_id = u.id AND f.friend_id = target_user_id)
    )
  ORDER BY compatibility_score DESC
  LIMIT limit_count;
END;
$$;


ALTER FUNCTION "public"."get_compatible_ai_users"("target_user_id" "uuid", "limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_friends_count"("target_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_id UUID;
  friend_count INTEGER;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Use target_user_id if provided, otherwise use current user
  IF target_user_id IS NULL THEN
    target_user_id := current_user_id;
  END IF;
  
  -- Count accepted friendships
  SELECT COUNT(*) INTO friend_count
  FROM friendships f
  WHERE ((f.user_id = target_user_id) OR (f.friend_id = target_user_id))
    AND f.status = 'accepted';
  
  RETURN friend_count;
END;
$$;


ALTER FUNCTION "public"."get_friends_count"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_friends_list"("target_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "username" "text", "full_name" "text", "avatar_url" "text", "fitness_level" "text", "created_at" timestamp with time zone, "friendship_id" "uuid", "friendship_created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Use target_user_id if provided, otherwise use current user
  IF target_user_id IS NULL THEN
    target_user_id := current_user_id;
  END IF;
  
  -- Return friends list
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level,
    u.created_at,
    f.id as friendship_id,
    f.created_at as friendship_created_at
  FROM users u
  JOIN friendships f ON (
    (f.user_id = target_user_id AND f.friend_id = u.id) OR
    (f.friend_id = target_user_id AND f.user_id = u.id)
  )
  WHERE f.status = 'accepted'
    AND u.id != target_user_id
  ORDER BY f.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_friends_list"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_friendship_status"("friend_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_id UUID;
  friendship_status TEXT;
  is_sender BOOLEAN;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is trying to check status with themselves
  IF current_user_id = friend_user_id THEN
    RETURN 'self';
  END IF;
  
  -- Find friendship status
  SELECT status, (user_id = current_user_id) INTO friendship_status, is_sender
  FROM friendships 
  WHERE (user_id = current_user_id AND friend_id = friend_user_id)
     OR (user_id = friend_user_id AND friend_id = current_user_id)
  LIMIT 1;
  
  -- If no friendship found
  IF friendship_status IS NULL THEN
    RETURN 'none';
  END IF;
  
  -- Return status with context
  IF friendship_status = 'accepted' THEN
    RETURN 'friends';
  ELSIF friendship_status = 'pending' AND is_sender THEN
    RETURN 'sent';
  ELSIF friendship_status = 'pending' AND NOT is_sender THEN
    RETURN 'received';
  ELSIF friendship_status = 'blocked' THEN
    RETURN 'blocked';
  END IF;
  
  RETURN friendship_status;
END;
$$;


ALTER FUNCTION "public"."get_friendship_status"("friend_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_goal_insights_for_coaching"("target_user_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'active_goals_count', (
      SELECT COUNT(*) FROM user_goals 
      WHERE user_id = target_user_id AND status = 'active'
    ),
    'overdue_goals_count', (
      SELECT COUNT(*) FROM user_goals 
      WHERE user_id = target_user_id AND status = 'overdue'
    ),
    'goals_needing_attention', (
      SELECT COUNT(*) FROM user_goals 
      WHERE user_id = target_user_id 
        AND status = 'active'
        AND (last_progress_update < NOW() - INTERVAL '7 days' OR last_progress_update IS NULL)
    ),
    'average_progress', (
      SELECT ROUND(AVG(progress_percentage), 1) 
      FROM user_goals 
      WHERE user_id = target_user_id AND status = 'active'
    ),
    'recent_progress', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'goal_title', g.title,
          'category', g.category,
          'progress_percentage', g.progress_percentage,
          'days_remaining', (g.target_date - CURRENT_DATE),
          'last_update', DATE(g.last_progress_update)
        ) ORDER BY g.last_progress_update DESC
      ), '[]'::json)
      FROM user_goals g
      WHERE g.user_id = target_user_id 
        AND g.status = 'active'
        AND g.last_progress_update >= NOW() - INTERVAL '30 days'
      LIMIT 5
    ),
    'goal_categories', (
      SELECT json_agg(DISTINCT category)
      FROM user_goals 
      WHERE user_id = target_user_id AND status = 'active'
    ),
    'upcoming_deadlines', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'goal_title', title,
          'target_date', target_date,
          'days_remaining', (target_date - CURRENT_DATE),
          'progress_percentage', progress_percentage
        ) ORDER BY target_date ASC
      ), '[]'::json)
      FROM user_goals 
      WHERE user_id = target_user_id 
        AND status = 'active'
        AND target_date <= CURRENT_DATE + INTERVAL '30 days'
      LIMIT 3
    )
  ) INTO result;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_goal_insights_for_coaching"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_health_dashboard"("target_user_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'todaysSteps', COALESCE((
      SELECT step_count 
      FROM daily_step_logs 
      WHERE user_id = target_user_id AND date = CURRENT_DATE
    ), 0),
    'currentStreak', COALESCE((
      SELECT current_count 
      FROM user_streaks 
      WHERE user_id = target_user_id AND streak_type = 'daily_steps' AND is_active = true
    ), 0),
    'bestStreak', COALESCE((
      SELECT best_count 
      FROM user_streaks 
      WHERE user_id = target_user_id AND streak_type = 'daily_steps'
    ), 0),
    'totalAchievements', (
      SELECT COUNT(*) 
      FROM user_achievements 
      WHERE user_id = target_user_id
    ),
    'weeklyAverage', COALESCE((
      SELECT ROUND(AVG(step_count)) 
      FROM daily_step_logs 
      WHERE user_id = target_user_id 
        AND date >= CURRENT_DATE - INTERVAL '7 days'
    ), 0),
    'recentAchievements', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', id,
          'title', title,
          'description', description,
          'icon_name', icon_name,
          'earned_date', earned_date
        ) ORDER BY earned_date DESC
      ), '[]'::json)
      FROM user_achievements 
      WHERE user_id = target_user_id 
        AND earned_date >= CURRENT_DATE - INTERVAL '7 days'
    )
  ) INTO result;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_health_dashboard"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_messages_between_friends"("target_friend_id" "uuid", "limit_count" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "sender_id" "uuid", "receiver_id" "uuid", "content" "text", "media_url" "text", "media_type" "text", "created_at" timestamp with time zone, "viewed_at" timestamp with time zone, "expires_at" timestamp with time zone, "is_ai_sender" boolean, "message_type" "text", "sent_at" timestamp with time zone, "is_viewed" boolean, "ai_personality_type" "text", "response_context" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    RETURN QUERY
    SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.content,
        m.media_url,
        m.media_type,
        m.created_at,
        m.viewed_at,
        m.expires_at,
        m.is_ai_sender,
        m.message_type,
        m.sent_at,
        m.is_viewed,
        m.ai_personality_type,
        m.response_context
    FROM messages m
    WHERE 
        (m.sender_id = current_user_id AND m.receiver_id = target_friend_id)
        OR 
        (m.sender_id = target_friend_id AND m.receiver_id = current_user_id)
        -- Removed: AND (m.expires_at IS NULL OR m.expires_at > NOW())
    ORDER BY m.created_at DESC
    LIMIT limit_count;
END;
$$;


ALTER FUNCTION "public"."get_messages_between_friends"("target_friend_id" "uuid", "limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_messages_with_ai_support"("other_user_id" "uuid", "limit_count" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "sender_id" "uuid", "receiver_id" "uuid", "content" "text", "media_url" "text", "media_type" "text", "message_type" "text", "sent_at" timestamp with time zone, "expires_at" timestamp with time zone, "is_viewed" boolean, "viewed_at" timestamp with time zone, "sender_username" "text", "receiver_username" "text", "is_expired" boolean, "is_ai_sender" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_id UUID;
  other_user_is_ai BOOLEAN;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if the other user is an AI
  SELECT COALESCE(is_mock_user, FALSE) INTO other_user_is_ai
  FROM users 
  WHERE users.id = other_user_id;
  
  -- If other user is AI, allow conversation regardless of friendship
  -- If other user is human, require friendship
  IF NOT other_user_is_ai THEN
    -- Check if they are friends (original logic)
    IF NOT EXISTS (
      SELECT 1 FROM friendships 
      WHERE ((user_id = current_user_id AND friend_id = other_user_id) 
             OR (friend_id = current_user_id AND user_id = other_user_id))
        AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Can only view messages with friends or AI users';
    END IF;
  END IF;
  
  -- Return messages between the two users
  -- CRITICAL FIX: Use LEFT JOIN to include AI messages with NULL sender_id
  RETURN QUERY
  SELECT 
    m.id,
    m.sender_id,
    m.receiver_id,
    m.content,
    m.media_url,
    m.media_type,
    m.message_type,
    m.sent_at,
    m.expires_at,
    m.is_viewed,
    m.viewed_at,
    -- Handle NULL sender_id for AI messages
    COALESCE(s.username, 'AI Assistant') as sender_username,
    r.username as receiver_username,
    (m.expires_at IS NOT NULL AND m.expires_at < NOW()) as is_expired,
    COALESCE(m.is_ai_sender, FALSE) as is_ai_sender
  FROM messages m
  -- LEFT JOIN allows AI messages with NULL sender_id to be included
  LEFT JOIN users s ON m.sender_id = s.id
  -- Regular JOIN for receiver since it's never NULL
  JOIN users r ON m.receiver_id = r.id
  WHERE 
    ((m.sender_id = current_user_id AND m.receiver_id = other_user_id) 
     OR (m.sender_id = other_user_id AND m.receiver_id = current_user_id)
     -- CRITICAL: Include AI messages where sender_id is NULL
     OR (m.sender_id IS NULL AND m.receiver_id = current_user_id AND COALESCE(m.is_ai_sender, FALSE) = TRUE))
    AND (
      -- Include non-expired messages
      (m.expires_at IS NULL OR m.expires_at > NOW())
      OR 
      -- Always include AI messages even if they would be "expired" (they shouldn't expire anyway)
      COALESCE(m.is_ai_sender, FALSE) = TRUE
    )
  ORDER BY m.sent_at DESC
  LIMIT limit_count;
END;
$$;


ALTER FUNCTION "public"."get_messages_with_ai_support"("other_user_id" "uuid", "limit_count" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_messages_with_ai_support"("other_user_id" "uuid", "limit_count" integer) IS 'Fixed to properly handle AI messages with NULL sender_id using LEFT JOIN and explicit NULL checks';



CREATE OR REPLACE FUNCTION "public"."get_pending_requests"() RETURNS TABLE("friendship_id" "uuid", "user_id" "uuid", "username" "text", "full_name" "text", "avatar_url" "text", "fitness_level" "text", "request_date" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Return pending requests received by current user
  RETURN QUERY
  SELECT 
    f.id as friendship_id,
    u.id as user_id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level,
    f.created_at as request_date
  FROM friendships f
  JOIN users u ON f.user_id = u.id
  WHERE f.friend_id = current_user_id 
    AND f.status = 'pending'
  ORDER BY f.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_pending_requests"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_post_comments"("p_post_id" "uuid", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "content" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "is_edited" boolean, "user_id" "uuid", "username" "text", "full_name" "text", "avatar_url" "text", "fitness_level" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.content,
    c.created_at,
    c.updated_at,
    c.is_edited,
    c.user_id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level
  FROM comments c
  JOIN users u ON c.user_id = u.id
  WHERE 
    c.post_id = p_post_id
    AND EXISTS (
      SELECT 1 FROM posts p 
      WHERE p.id = p_post_id 
      AND (p.expires_at > NOW() OR p.expires_at IS NULL)
    )
  ORDER BY c.created_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_post_comments"("p_post_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recent_coach_conversation"("target_user_id" "uuid", "message_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "message_text" "text", "is_user_message" boolean, "is_voice_message" boolean, "audio_duration" integer, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id,
    cc.message_text,
    cc.is_user_message,
    cc.is_voice_message,
    cc.audio_duration,
    cc.created_at
  FROM coach_conversations cc
  WHERE cc.user_id = target_user_id
  ORDER BY cc.created_at DESC
  LIMIT message_limit;
END;
$$;


ALTER FUNCTION "public"."get_recent_coach_conversation"("target_user_id" "uuid", "message_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recent_conversation_messages"("user1_id" "uuid", "user2_id" "uuid", "message_limit" integer DEFAULT 10) RETURNS TABLE("message_id" "uuid", "content" "text", "is_from_ai" boolean, "sent_at" timestamp with time zone, "message_type" "text", "sender_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as message_id,
    m.content,
    COALESCE(m.is_ai_sender, FALSE) as is_from_ai,
    m.sent_at,
    m.message_type,
    m.sender_id
  FROM messages m
  WHERE 
    ((m.sender_id = user1_id AND m.receiver_id = user2_id) 
     OR (m.sender_id = user2_id AND m.receiver_id = user1_id))
    AND m.content IS NOT NULL
    AND (
      -- Include non-expired messages
      (m.expires_at IS NULL OR m.expires_at > NOW())
      OR 
      -- Always include AI messages (they don't expire)
      COALESCE(m.is_ai_sender, FALSE) = TRUE
    )
  ORDER BY m.sent_at DESC
  LIMIT message_limit;
END;
$$;


ALTER FUNCTION "public"."get_recent_conversation_messages"("user1_id" "uuid", "user2_id" "uuid", "message_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_recent_conversation_messages"("user1_id" "uuid", "user2_id" "uuid", "message_limit" integer) IS 'Gets recent conversation messages for AI context with proper filtering';



CREATE OR REPLACE FUNCTION "public"."get_sent_requests"() RETURNS TABLE("friendship_id" "uuid", "friend_id" "uuid", "username" "text", "full_name" "text", "avatar_url" "text", "fitness_level" "text", "request_date" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Return pending requests sent by current user
  RETURN QUERY
  SELECT 
    f.id as friendship_id,
    u.id as friend_id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level,
    f.created_at as request_date
  FROM friendships f
  JOIN users u ON f.friend_id = u.id
  WHERE f.user_id = current_user_id 
    AND f.status = 'pending'
  ORDER BY f.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_sent_requests"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unviewed_posts"("p_user_id" "uuid", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "user_id" "uuid", "content" "text", "media_url" "text", "media_type" "text", "thumbnail_url" "text", "poster_url" "text", "workout_type" "text", "created_at" timestamp with time zone, "username" "text", "full_name" "text", "avatar_url" "text", "fitness_level" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,  -- Added missing user_id field
    p.content,
    p.media_url,
    p.media_type,
    p.thumbnail_url,  -- Added for consistency
    p.poster_url,     -- Added for consistency
    p.workout_type,
    p.created_at,
    u.username,
    u.full_name,
    u.avatar_url,
    u.fitness_level
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE 
    p.expires_at > NOW()  -- Not expired
    AND NOT EXISTS (  -- Not viewed by user (including their own posts)
      SELECT 1 FROM post_views pv 
      WHERE pv.post_id = p.id AND pv.user_id = p_user_id
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_unviewed_posts"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_active_goals"("target_user_id" "uuid") RETURNS TABLE("id" "uuid", "title" character varying, "category" "text", "target_date" "date", "days_remaining" integer, "progress_percentage" integer, "current_value" numeric, "target_value" numeric, "target_unit" "text", "priority" "text", "last_progress_date" "date", "coaching_needed" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.title,
    g.category,
    g.target_date,
    (g.target_date - CURRENT_DATE)::INTEGER as days_remaining,
    g.progress_percentage,
    g.current_value,
    g.target_value,
    g.target_unit,
    g.priority,
    DATE(g.last_progress_update) as last_progress_date,
    -- Coaching needed if no progress update in last 7 days for weekly+ goals
    CASE 
      WHEN g.coaching_frequency = 'daily' AND (g.last_progress_update < NOW() - INTERVAL '2 days' OR g.last_progress_update IS NULL) THEN TRUE
      WHEN g.coaching_frequency = 'weekly' AND (g.last_progress_update < NOW() - INTERVAL '7 days' OR g.last_progress_update IS NULL) THEN TRUE
      WHEN g.coaching_frequency = 'biweekly' AND (g.last_progress_update < NOW() - INTERVAL '14 days' OR g.last_progress_update IS NULL) THEN TRUE
      ELSE FALSE
    END as coaching_needed
  FROM user_goals g
  WHERE g.user_id = target_user_id
    AND g.status = 'active'
  ORDER BY 
    g.priority DESC,
    g.target_date ASC,
    g.progress_percentage ASC;
END;
$$;


ALTER FUNCTION "public"."get_user_active_goals"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_conversations"() RETURNS TABLE("friend_id" "uuid", "friend_username" "text", "friend_full_name" "text", "friend_avatar_url" "text", "last_message_id" "uuid", "last_message_content" "text", "last_message_type" "text", "last_message_sent_at" timestamp with time zone, "unread_count" integer, "is_sender" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  RETURN QUERY
  WITH latest_messages AS (
    SELECT 
      CASE 
        WHEN m.sender_id = current_user_id THEN m.receiver_id 
        ELSE m.sender_id 
      END as friend_user_id,
      m.id,
      m.content,
      m.message_type,
      m.sent_at,
      m.sender_id = current_user_id as is_sender,
      ROW_NUMBER() OVER (
        PARTITION BY 
          CASE 
            WHEN m.sender_id = current_user_id THEN m.receiver_id 
            ELSE m.sender_id 
          END 
        ORDER BY m.sent_at DESC
      ) as rn
    FROM messages m
    WHERE 
      (m.sender_id = current_user_id OR m.receiver_id = current_user_id)
      AND (m.expires_at IS NULL OR m.expires_at > NOW()) -- Only non-expired messages
  ),
  unread_counts AS (
    SELECT 
      m.sender_id as friend_user_id,
      COUNT(*) as unread_count
    FROM messages m
    WHERE 
      m.receiver_id = current_user_id 
      AND m.is_viewed = FALSE
      AND (m.expires_at IS NULL OR m.expires_at > NOW())
    GROUP BY m.sender_id
  )
  SELECT 
    u.id as friend_id,
    u.username as friend_username,
    u.full_name as friend_full_name,
    u.avatar_url as friend_avatar_url,
    lm.id as last_message_id,
    lm.content as last_message_content,
    lm.message_type as last_message_type,
    lm.sent_at as last_message_sent_at,
    COALESCE(uc.unread_count, 0)::INTEGER as unread_count,
    lm.is_sender
  FROM latest_messages lm
  JOIN users u ON lm.friend_user_id = u.id
  LEFT JOIN unread_counts uc ON uc.friend_user_id = u.id
  WHERE lm.rn = 1 -- Only latest message per conversation
    AND EXISTS ( -- Only include friends
      SELECT 1 FROM friendships f
      WHERE ((f.user_id = current_user_id AND f.friend_id = u.id) 
             OR (f.friend_id = current_user_id AND f.user_id = u.id))
        AND f.status = 'accepted'
    )
  ORDER BY lm.sent_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_user_conversations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_conversations_with_ai"() RETURNS TABLE("friend_id" "uuid", "friend_username" "text", "friend_full_name" "text", "friend_avatar_url" "text", "last_message_id" "uuid", "last_message_content" "text", "last_message_type" "text", "last_message_sent_at" timestamp with time zone, "unread_count" integer, "is_sender" boolean, "is_ai_conversation" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  RETURN QUERY
  WITH latest_messages AS (
    SELECT 
      CASE 
        WHEN m.sender_id = current_user_id THEN m.receiver_id 
        ELSE m.sender_id 
      END as friend_user_id,
      m.id,
      m.content,
      m.message_type,
      m.sent_at,
      m.sender_id = current_user_id as is_sender,
      COALESCE(m.is_ai_sender, FALSE) as is_ai_sender,
      ROW_NUMBER() OVER (
        PARTITION BY 
          CASE 
            WHEN m.sender_id = current_user_id THEN m.receiver_id 
            ELSE m.sender_id 
          END 
        ORDER BY m.sent_at DESC
      ) as rn
    FROM messages m
    WHERE 
      (m.sender_id = current_user_id OR m.receiver_id = current_user_id)
      AND (
        -- Non-expired messages
        (m.expires_at IS NULL OR m.expires_at > NOW())
        OR
        -- Always include AI messages
        COALESCE(m.is_ai_sender, FALSE) = TRUE
      )
  ),
  unread_counts AS (
    SELECT 
      m.sender_id as friend_user_id,
      COUNT(*) as unread_count
    FROM messages m
    WHERE 
      m.receiver_id = current_user_id 
      AND m.is_viewed = FALSE
      AND (
        (m.expires_at IS NULL OR m.expires_at > NOW())
        OR
        COALESCE(m.is_ai_sender, FALSE) = TRUE
      )
    GROUP BY m.sender_id
  )
  SELECT 
    u.id as friend_id,
    u.username as friend_username,
    u.full_name as friend_full_name,
    u.avatar_url as friend_avatar_url,
    lm.id as last_message_id,
    lm.content as last_message_content,
    lm.message_type as last_message_type,
    lm.sent_at as last_message_sent_at,
    COALESCE(uc.unread_count, 0)::INTEGER as unread_count,
    lm.is_sender,
    COALESCE(u.is_mock_user, FALSE) as is_ai_conversation
  FROM latest_messages lm
  JOIN users u ON lm.friend_user_id = u.id
  LEFT JOIN unread_counts uc ON uc.friend_user_id = u.id
  WHERE lm.rn = 1 -- Only latest message per conversation
    AND (
      -- Include friends (existing logic)
      EXISTS (
        SELECT 1 FROM friendships f
        WHERE ((f.user_id = current_user_id AND f.friend_id = u.id) 
               OR (f.friend_id = current_user_id AND f.user_id = u.id))
          AND f.status = 'accepted'
      )
      OR
      -- Include AI conversations (new logic)
      COALESCE(u.is_mock_user, FALSE) = TRUE
    )
  ORDER BY lm.sent_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_user_conversations_with_ai"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_conversations_with_ai"() IS 'Get conversation list including AI conversations';



CREATE OR REPLACE FUNCTION "public"."get_user_rsvp_stats"("target_user_id" "uuid") RETURNS TABLE("total_events_rsvp" integer, "total_events_created" integer, "total_events_attended" integer, "current_streak" integer, "best_streak" integer, "total_activity_days" integer, "attendance_rate" numeric, "upcoming_events_count" integer, "favorite_categories" "jsonb", "recent_activity" "jsonb")
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."get_user_rsvp_stats"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_rsvp_stats"("target_user_id" "uuid") IS 'Comprehensive function to get all user RSVP statistics including real streak calculations, 
attendance rates, favorite categories, and recent activity.';



CREATE OR REPLACE FUNCTION "public"."get_users_needing_profile_enhancement"("min_completeness" integer DEFAULT 70) RETURNS TABLE("id" "uuid", "username" "text", "profile_completeness_percentage" integer, "coaching_readiness" "text", "missing_critical_fields" "text"[])
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    calculate_enhanced_profile_completeness(u.id) as profile_completeness_percentage,
    CASE 
      WHEN u.daily_step_goal IS NOT NULL AND 
           u.current_activity_level IS NOT NULL AND 
           u.coaching_style IS NOT NULL AND
           array_length(u.goals, 1) > 0 THEN 'ready'
      WHEN u.fitness_level IS NOT NULL AND 
           u.workout_frequency IS NOT NULL THEN 'basic_ready'
      ELSE 'needs_setup'
    END as coaching_readiness,
    -- Identify missing critical fields
    ARRAY(
      SELECT field_name FROM (
        VALUES 
          ('daily_step_goal', u.daily_step_goal IS NULL),
          ('current_activity_level', u.current_activity_level IS NULL), 
          ('coaching_style', u.coaching_style IS NULL),
          ('goals', array_length(u.goals, 1) IS NULL OR array_length(u.goals, 1) = 0),
          ('motivation_style', u.motivation_style IS NULL),
          ('preferred_workout_times', u.preferred_workout_times IS NULL OR u.preferred_workout_times = '{}'),
          ('workout_intensity', u.workout_intensity IS NULL)
      ) AS missing_fields(field_name, is_missing)
      WHERE is_missing = TRUE
    ) as missing_critical_fields
  FROM users u
  WHERE u.is_mock_user = FALSE -- Only real users
    AND calculate_enhanced_profile_completeness(u.id) < min_completeness
  ORDER BY calculate_enhanced_profile_completeness(u.id) ASC;
END;
$$;


ALTER FUNCTION "public"."get_users_needing_profile_enhancement"("min_completeness" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_voice_coaching_stats"("target_user_id" "uuid") RETURNS TABLE("total_sessions" bigint, "total_voice_time" integer, "avg_session_duration" numeric, "total_commands" bigint, "successful_commands" bigint, "sessions_this_week" bigint, "voice_time_this_week" integer, "most_used_commands" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_voice_coaching_stats"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_event_waitlist"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."manage_event_waitlist"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_ai_message_viewed"("message_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    message_record RECORD;
    viewer_user_id UUID;
BEGIN
    -- Get the current user
    viewer_user_id := auth.uid();
    
    IF viewer_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Get message details
    SELECT * INTO message_record 
    FROM messages 
    WHERE id = message_id;
    
    IF message_record IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verify the viewer is the recipient of the AI message
    IF viewer_user_id != message_record.receiver_id THEN
        RETURN FALSE;
    END IF;
    
    -- Update the message as viewed (no expiration for AI messages)
    UPDATE messages 
    SET 
        is_viewed = TRUE,
        viewed_at = NOW()
    WHERE id = message_id;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."mark_ai_message_viewed"("message_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_ai_message_viewed"("message_id" "uuid") IS 'Mark AI messages as viewed without setting expiration (non-ephemeral)';



CREATE OR REPLACE FUNCTION "public"."mark_ai_user_posted_today"("user_id" "uuid", "content_type" "text" DEFAULT 'workout_post'::"text", "post_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update user's last posting info in a tracking table (optional)
  -- For now, we'll just verify the user exists and is an AI user
  
  -- Verify this is an AI user
  IF NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = user_id AND u.is_mock_user = TRUE
  ) THEN
    RAISE EXCEPTION 'User % is not an AI user or does not exist', user_id;
  END IF;
  
  -- Could add additional tracking logic here in the future
  -- For example, updating a posting_log table
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."mark_ai_user_posted_today"("user_id" "uuid", "content_type" "text", "post_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_ai_user_posted_today"("user_id" "uuid", "content_type" "text", "post_id" "uuid") IS 'Marks an AI user as having posted today with content tracking';



CREATE OR REPLACE FUNCTION "public"."mark_message_viewed"("message_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    message_record RECORD;
    sender_user_id UUID;
    viewer_user_id UUID;
BEGIN
    -- Get the current user
    viewer_user_id := auth.uid();
    
    IF viewer_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Get message details
    SELECT * INTO message_record 
    FROM messages 
    WHERE id = message_id;
    
    IF message_record IS NULL THEN
        RETURN FALSE;
    END IF;
    
    sender_user_id := message_record.sender_id;
    
    -- Verify the viewer is either sender or recipient
    IF viewer_user_id != sender_user_id AND viewer_user_id != message_record.receiver_id THEN
        RETURN FALSE;
    END IF;
    
    -- Update the message as viewed (no expiration set)
    UPDATE messages 
    SET 
        is_viewed = TRUE,
        viewed_at = NOW()
    WHERE id = message_id;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."mark_message_viewed"("message_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_message_viewed"("message_id" "uuid") IS 'Enhanced version that handles AI message expiration correctly';



CREATE OR REPLACE FUNCTION "public"."match_fitness_content"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.78, "match_count" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "content" "text", "category" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."match_fitness_content"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_voice_command"("session_token" "text", "command_type" "text", "command_intent" "text", "command_parameters" "jsonb" DEFAULT '{}'::"jsonb", "confidence_score" real DEFAULT NULL::real) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."record_voice_command"("session_token" "text", "command_type" "text", "command_intent" "text", "command_parameters" "jsonb", "confidence_score" real) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_ai_message"("receiver_user_id" "uuid", "message_content" "text", "personality_type" "text" DEFAULT 'supportive'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    message_id UUID;
BEGIN
    IF message_content IS NULL OR message_content = '' THEN
        RAISE EXCEPTION 'AI message content cannot be empty';
    END IF;
    
    INSERT INTO messages (
        sender_id, 
        receiver_id, 
        content, 
        is_ai_sender,
        ai_personality_type
    )
    VALUES (
        NULL, -- AI messages have no sender_id
        receiver_user_id, 
        message_content, 
        TRUE,
        personality_type
    )
    RETURNING id INTO message_id;
    
    RETURN message_id;
END;
$$;


ALTER FUNCTION "public"."send_ai_message"("receiver_user_id" "uuid", "message_content" "text", "personality_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_ai_message"("ai_user_id" "uuid", "receiver_user_id" "uuid", "message_content" "text" DEFAULT NULL::"text", "message_media_url" "text" DEFAULT NULL::"text", "message_media_type" "text" DEFAULT NULL::"text", "personality_type" "text" DEFAULT NULL::"text", "context_data" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_message_id UUID;
  msg_type TEXT;
  is_ai_user BOOLEAN;
BEGIN
  -- Verify the sender is actually an AI user
  SELECT is_mock_user INTO is_ai_user
  FROM users 
  WHERE id = ai_user_id;
  
  IF is_ai_user IS NULL OR is_ai_user = FALSE THEN
    RAISE EXCEPTION 'Only AI users can use this function';
  END IF;
  
  -- Check if receiver exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = receiver_user_id) THEN
    RAISE EXCEPTION 'Receiver user not found';
  END IF;
  
  -- Determine message type
  IF message_content IS NOT NULL AND message_media_url IS NOT NULL THEN
    msg_type := 'mixed';
  ELSIF message_media_url IS NOT NULL THEN
    msg_type := message_media_type; -- 'photo' or 'video'
  ELSE
    msg_type := 'text';
  END IF;
  
  -- Insert new AI message
  INSERT INTO messages (
    sender_id, 
    receiver_id, 
    content, 
    media_url, 
    media_type,
    message_type,
    is_ai_sender,
    ai_personality_type,
    response_context
  )
  VALUES (
    ai_user_id, 
    receiver_user_id, 
    message_content, 
    message_media_url, 
    message_media_type,
    msg_type,
    TRUE,
    personality_type,
    context_data
  )
  RETURNING id INTO new_message_id;
  
  RETURN new_message_id;
END;
$$;


ALTER FUNCTION "public"."send_ai_message"("ai_user_id" "uuid", "receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text", "personality_type" "text", "context_data" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."send_ai_message"("ai_user_id" "uuid", "receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text", "personality_type" "text", "context_data" "jsonb") IS 'Allows AI users to send messages to any user, bypassing friendship requirements';



CREATE OR REPLACE FUNCTION "public"."send_friend_request"("friend_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_friendship_id UUID;
  current_user_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is trying to friend themselves
  IF current_user_id = friend_user_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;
  
  -- Check if friendship already exists (in either direction)
  IF EXISTS (
    SELECT 1 FROM friendships 
    WHERE (user_id = current_user_id AND friend_id = friend_user_id)
       OR (user_id = friend_user_id AND friend_id = current_user_id)
  ) THEN
    RAISE EXCEPTION 'Friendship already exists or request already sent';
  END IF;
  
  -- Check if target user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = friend_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Insert new friendship request
  INSERT INTO friendships (user_id, friend_id, status)
  VALUES (current_user_id, friend_user_id, 'pending')
  RETURNING id INTO new_friendship_id;
  
  RETURN new_friendship_id;
END;
$$;


ALTER FUNCTION "public"."send_friend_request"("friend_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_message"("receiver_user_id" "uuid", "message_content" "text" DEFAULT NULL::"text", "message_media_url" "text" DEFAULT NULL::"text", "message_media_type" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    sender_user_id UUID;
    message_id UUID;
BEGIN
    sender_user_id := auth.uid();
    
    IF sender_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;
    
    IF message_content IS NULL AND message_media_url IS NULL THEN
        RAISE EXCEPTION 'Message must have either content or media';
    END IF;
    
    INSERT INTO messages (sender_id, receiver_id, content, media_url, media_type, is_ai_sender)
    VALUES (sender_user_id, receiver_user_id, message_content, message_media_url, message_media_type, FALSE)
    RETURNING id INTO message_id;
    
    RETURN message_id;
END;
$$;


ALTER FUNCTION "public"."send_message"("receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_non_ephemeral_ai_message"("ai_user_id" "uuid", "receiver_user_id" "uuid", "message_content" "text" DEFAULT NULL::"text", "message_media_url" "text" DEFAULT NULL::"text", "message_media_type" "text" DEFAULT NULL::"text", "personality_type" "text" DEFAULT NULL::"text", "context_data" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_message_id UUID;
  msg_type TEXT;
  is_ai_user BOOLEAN;
BEGIN
  -- Verify the sender is actually an AI user
  SELECT is_mock_user INTO is_ai_user
  FROM users 
  WHERE id = ai_user_id;
  
  IF is_ai_user IS NULL OR is_ai_user = FALSE THEN
    RAISE EXCEPTION 'Only AI users can use this function';
  END IF;
  
  -- Check if receiver exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = receiver_user_id) THEN
    RAISE EXCEPTION 'Receiver user not found';
  END IF;
  
  -- Determine message type
  IF message_content IS NOT NULL AND message_media_url IS NOT NULL THEN
    msg_type := 'mixed';
  ELSIF message_media_url IS NOT NULL THEN
    msg_type := message_media_type; -- 'photo' or 'video'
  ELSE
    msg_type := 'text';
  END IF;
  
  -- Insert new AI message with explicit non-ephemeral settings
  INSERT INTO messages (
    sender_id, 
    receiver_id, 
    content, 
    media_url, 
    media_type,
    message_type,
    is_ai_sender,
    ai_personality_type,
    response_context,
    expires_at -- Explicitly set to NULL for non-ephemeral
  )
  VALUES (
    ai_user_id, 
    receiver_user_id, 
    message_content, 
    message_media_url, 
    message_media_type,
    msg_type,
    TRUE,
    personality_type,
    context_data,
    NULL -- Never expires!
  )
  RETURNING id INTO new_message_id;
  
  RETURN new_message_id;
END;
$$;


ALTER FUNCTION "public"."send_non_ephemeral_ai_message"("ai_user_id" "uuid", "receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text", "personality_type" "text", "context_data" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."send_non_ephemeral_ai_message"("ai_user_id" "uuid", "receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text", "personality_type" "text", "context_data" "jsonb") IS 'Send AI messages that never expire, even when viewed';



CREATE OR REPLACE FUNCTION "public"."start_stream"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."start_stream"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ai_conversation_context"("user_id" "uuid", "context_update" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE users 
  SET conversation_context = conversation_context || context_update,
      updated_at = NOW()
  WHERE id = user_id AND is_mock_user = TRUE;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_ai_conversation_context"("user_id" "uuid", "context_update" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ai_conversation_memory"("p_ai_user_id" "uuid", "p_human_user_id" "uuid", "p_conversation_summary" "text" DEFAULT NULL::"text", "p_new_details" "jsonb" DEFAULT '{}'::"jsonb", "p_topics_discussed" "jsonb" DEFAULT '[]'::"jsonb", "p_message_count" integer DEFAULT 1) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."update_ai_conversation_memory"("p_ai_user_id" "uuid", "p_human_user_id" "uuid", "p_conversation_summary" "text", "p_new_details" "jsonb", "p_topics_discussed" "jsonb", "p_message_count" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_ai_conversation_memory"("p_ai_user_id" "uuid", "p_human_user_id" "uuid", "p_conversation_summary" "text", "p_new_details" "jsonb", "p_topics_discussed" "jsonb", "p_message_count" integer) IS 'Updates conversation memory after each AI-human interaction';



CREATE OR REPLACE FUNCTION "public"."update_comment_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Set is_edited to true if content changed (but not on insert)
  IF TG_OP = 'UPDATE' AND OLD.content != NEW.content THEN
    NEW.is_edited = TRUE;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_comment_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_event_participant_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_event_participant_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_human_details_learned"("p_ai_user_id" "uuid", "p_human_user_id" "uuid", "p_new_details" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."update_human_details_learned"("p_ai_user_id" "uuid", "p_human_user_id" "uuid", "p_new_details" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_overdue_goals"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE user_goals 
  SET status = 'overdue'
  WHERE status = 'active' 
    AND target_date < CURRENT_DATE
    AND progress_percentage < 100;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."update_overdue_goals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_step_streak"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update daily steps streak when a step log is inserted/updated
  IF NEW.goal_reached THEN
    -- Goal reached, increment or start streak
    INSERT INTO user_streaks (user_id, streak_type, current_count, best_count, last_updated)
    VALUES (NEW.user_id, 'daily_steps', 1, 1, NEW.date)
    ON CONFLICT (user_id, streak_type) DO UPDATE SET
      current_count = CASE 
        WHEN user_streaks.last_updated = NEW.date - INTERVAL '1 day' 
        THEN user_streaks.current_count + 1
        ELSE 1
      END,
      best_count = GREATEST(user_streaks.best_count, 
        CASE 
          WHEN user_streaks.last_updated = NEW.date - INTERVAL '1 day'
          THEN user_streaks.current_count + 1
          ELSE 1
        END
      ),
      last_updated = NEW.date,
      is_active = true,
      updated_at = NOW();
  ELSE
    -- Goal not reached, break streak if it was active yesterday
    UPDATE user_streaks 
    SET 
      current_count = 0,
      is_active = false,
      updated_at = NOW()
    WHERE user_id = NEW.user_id 
      AND streak_type = 'daily_steps'
      AND last_updated = NEW.date - INTERVAL '1 day'
      AND is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_step_streak"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stream_viewer_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_stream_viewer_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_goals_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Update last_progress_update when current_value changes
  IF OLD.current_value IS DISTINCT FROM NEW.current_value THEN
    NEW.last_progress_update = NOW();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_goals_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_voice_session_status"("session_token" "text", "new_status" "text", "duration_update" integer DEFAULT NULL::integer, "metrics_update" "jsonb" DEFAULT NULL::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."update_voice_session_status"("session_token" "text", "new_status" "text", "duration_update" integer, "metrics_update" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_ai_personality_traits"("traits" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check required fields for AI users
  IF NOT (traits ? 'communication_style' AND 
          traits ? 'posting_personality' AND 
          traits ? 'social_engagement') THEN
    RETURN FALSE;
  END IF;
  
  -- Validate enum values
  IF NOT (traits->>'communication_style' IN ('casual', 'motivational', 'technical', 'friendly')) THEN
    RETURN FALSE;
  END IF;
  
  IF NOT (traits->>'posting_personality' IN ('progress_focused', 'social', 'educational', 'inspirational')) THEN
    RETURN FALSE;
  END IF;
  
  IF NOT (traits->>'social_engagement' IN ('high', 'medium', 'low')) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."validate_ai_personality_traits"("traits" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_ai_personality_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_mock_user = TRUE AND NEW.personality_traits != '{}' THEN
    IF NOT validate_ai_personality_traits(NEW.personality_traits) THEN
      RAISE EXCEPTION 'Invalid AI personality traits provided';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_ai_personality_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_ai_user_for_posting"("target_user_id" "uuid") RETURNS TABLE("is_valid" boolean, "validation_errors" "text"[], "archetype" "text", "preferred_hour" integer, "posts_per_week" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_record RECORD;
  errors TEXT[] := '{}';
  is_valid_result BOOLEAN := TRUE;
BEGIN
  -- Get user data
  SELECT 
    u.is_mock_user,
    u.personality_traits,
    u.posting_schedule
  INTO user_record
  FROM users u
  WHERE u.id = target_user_id;
  
  -- Check if user exists and is AI user
  IF NOT FOUND THEN
    errors := array_append(errors, 'User not found');
    is_valid_result := FALSE;
  ELSIF user_record.is_mock_user IS NOT TRUE THEN
    errors := array_append(errors, 'User is not an AI user');
    is_valid_result := FALSE;
  END IF;
  
  -- Validate personality traits
  IF user_record.personality_traits IS NULL OR user_record.personality_traits = '{}' THEN
    errors := array_append(errors, 'Missing personality traits');
    is_valid_result := FALSE;
  END IF;
  
  -- Validate posting schedule
  IF user_record.posting_schedule IS NULL OR user_record.posting_schedule = '{}' THEN
    errors := array_append(errors, 'Missing posting schedule');
    is_valid_result := FALSE;
  END IF;
  
  RETURN QUERY
  SELECT 
    is_valid_result,
    errors,
    COALESCE(user_record.personality_traits->>'archetype', 'unknown'),
    COALESCE((user_record.posting_schedule->>'preferred_hour')::INTEGER, 12),
    COALESCE((user_record.posting_schedule->>'posts_per_week')::INTEGER, 3);
END;
$$;


ALTER FUNCTION "public"."validate_ai_user_for_posting"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_ai_user_for_posting"("target_user_id" "uuid") IS 'Validates AI user data for posting automation';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_coaching_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message_type" character varying(50) NOT NULL,
    "message_text" "text" NOT NULL,
    "health_context" "jsonb" DEFAULT '{}'::"jsonb",
    "is_actionable" boolean DEFAULT false,
    "suggested_action" "text",
    "user_response" character varying(20),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone
);


ALTER TABLE "public"."ai_coaching_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_conversation_memories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ai_user_id" "uuid" NOT NULL,
    "human_user_id" "uuid" NOT NULL,
    "first_conversation_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_conversation_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_conversations" integer DEFAULT 1,
    "total_messages_exchanged" integer DEFAULT 0,
    "relationship_stage" "text" DEFAULT 'new_connection'::"text",
    "human_details_learned" "jsonb" DEFAULT '{}'::"jsonb",
    "shared_experiences" "jsonb" DEFAULT '[]'::"jsonb",
    "important_dates" "jsonb" DEFAULT '{}'::"jsonb",
    "last_conversation_summary" "text",
    "ongoing_topics" "jsonb" DEFAULT '[]'::"jsonb",
    "conversation_themes" "jsonb" DEFAULT '{}'::"jsonb",
    "human_personality_notes" "text",
    "communication_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "relationship_tone" "text" DEFAULT 'friendly'::"text",
    "memory_highlights" "jsonb" DEFAULT '[]'::"jsonb",
    "follow_up_items" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_conversation_memories_relationship_stage_check" CHECK (("relationship_stage" = ANY (ARRAY['new_connection'::"text", 'getting_acquainted'::"text", 'friendly_acquaintance'::"text", 'good_friend'::"text", 'close_friend'::"text"]))),
    CONSTRAINT "ai_conversation_memories_relationship_tone_check" CHECK (("relationship_tone" = ANY (ARRAY['professional'::"text", 'friendly'::"text", 'casual'::"text", 'supportive'::"text", 'playful'::"text"])))
);


ALTER TABLE "public"."ai_conversation_memories" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_conversation_memories" IS 'Stores persistent memory and relationship context between AI and human users';



CREATE TABLE IF NOT EXISTS "public"."ai_conversation_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "memory_id" "uuid" NOT NULL,
    "conversation_date" "date" NOT NULL,
    "message_count" integer DEFAULT 0 NOT NULL,
    "conversation_duration_minutes" integer,
    "conversation_summary" "text" NOT NULL,
    "key_topics" "jsonb" DEFAULT '[]'::"jsonb",
    "emotional_tone" "text" DEFAULT 'neutral'::"text",
    "new_details_learned" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_details_shared" "jsonb" DEFAULT '{}'::"jsonb",
    "unresolved_topics" "jsonb" DEFAULT '[]'::"jsonb",
    "planned_follow_ups" "jsonb" DEFAULT '[]'::"jsonb",
    "importance_score" integer DEFAULT 1,
    "contains_milestone" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_conversation_snapshots_emotional_tone_check" CHECK (("emotional_tone" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'supportive'::"text", 'concerned'::"text", 'excited'::"text", 'reflective'::"text"]))),
    CONSTRAINT "ai_conversation_snapshots_importance_score_check" CHECK ((("importance_score" >= 1) AND ("importance_score" <= 5)))
);


ALTER TABLE "public"."ai_conversation_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_conversation_snapshots" IS 'Detailed conversation summaries for building rich AI memory';



CREATE TABLE IF NOT EXISTS "public"."ai_proactive_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ai_user_id" "uuid" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "trigger_type" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_proactive_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_proactive_messages" IS 'Tracks proactive messages sent by AI users to humans for frequency control';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text" NOT NULL,
    "username" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "fitness_level" "text" NOT NULL,
    "goals" "text"[] DEFAULT '{}'::"text"[],
    "dietary_preferences" "text"[] DEFAULT '{}'::"text"[],
    "workout_frequency" integer DEFAULT 3,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "personality_traits" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_response_style" "jsonb" DEFAULT '{}'::"jsonb",
    "is_mock_user" boolean DEFAULT false,
    "posting_schedule" "jsonb" DEFAULT '{}'::"jsonb",
    "conversation_context" "jsonb" DEFAULT '{}'::"jsonb",
    "city" "text",
    "bio" "text",
    "workout_intensity" "text" DEFAULT 'moderate'::"text",
    "current_weight_kg" numeric(5,2),
    "target_weight_kg" numeric(5,2),
    "height_cm" numeric(5,1),
    "daily_step_goal" integer DEFAULT 10000,
    "weekly_workout_goal" integer DEFAULT 3,
    "preferred_workout_times" "text"[] DEFAULT '{}'::"text"[],
    "available_equipment" "text"[] DEFAULT '{}'::"text"[],
    "injuries_limitations" "text",
    "sleep_schedule" "jsonb" DEFAULT '{}'::"jsonb",
    "motivation_style" "text" DEFAULT 'encouraging'::"text",
    "current_activity_level" "text" DEFAULT 'lightly_active'::"text",
    "fitness_experience_years" integer DEFAULT 0,
    "preferred_workout_duration" integer DEFAULT 30,
    "meal_prep_preference" "text" DEFAULT 'simple'::"text",
    "cooking_skill_level" "text" DEFAULT 'intermediate'::"text",
    "food_allergies" "text"[] DEFAULT '{}'::"text"[],
    "nutrition_goals" "text"[] DEFAULT '{}'::"text"[],
    "stress_level" integer DEFAULT 5,
    "energy_level" integer DEFAULT 5,
    "wellness_goals" "text"[] DEFAULT '{}'::"text"[],
    "accountability_preference" "text" DEFAULT 'app_only'::"text",
    "social_sharing_comfort" "text" DEFAULT 'friends_only'::"text",
    "available_workout_days" "text"[] DEFAULT '{}'::"text"[],
    "workout_time_constraints" "jsonb" DEFAULT '{}'::"jsonb",
    "coaching_style" "text" DEFAULT 'gentle'::"text",
    "feedback_frequency" "text" DEFAULT 'daily'::"text",
    "progress_tracking_detail" "text" DEFAULT 'detailed'::"text",
    "primary_motivation" "text",
    "biggest_fitness_challenge" "text",
    "previous_fitness_successes" "text",
    "location_type" "text" DEFAULT 'suburban'::"text",
    "onboarding_completed_steps" "text"[] DEFAULT '{}'::"text"[],
    "onboarding_completion_date" timestamp with time zone,
    "profile_setup_phase" "text" DEFAULT 'basic'::"text",
    "equipment_list" "text",
    "exercise_preferences" "text"[] DEFAULT '{}'::"text"[],
    "has_equipment" boolean DEFAULT false,
    "primary_goal" "text",
    "smart_goal_target" "text",
    "smart_goal_value" "text",
    "smart_goal_unit" "text",
    "smart_goal_timeframe" "text",
    "smart_goal_why" "text",
    "smart_goal_target_date" "date",
    "privacy_level" "text" DEFAULT 'friends'::"text",
    "measurement_system" "text" DEFAULT 'metric'::"text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "last_sign_in_at" timestamp with time zone DEFAULT "now"(),
    "generated_system_prompt" "text",
    "personality_generated_at" timestamp with time zone,
    CONSTRAINT "users_accountability_preference_check" CHECK (("accountability_preference" = ANY (ARRAY['none'::"text", 'app_only'::"text", 'friends'::"text", 'coach'::"text", 'community'::"text"]))),
    CONSTRAINT "users_bio_check" CHECK (("char_length"("bio") <= 150)),
    CONSTRAINT "users_coaching_style_check" CHECK (("coaching_style" = ANY (ARRAY['gentle'::"text", 'firm'::"text", 'motivational'::"text", 'educational'::"text"]))),
    CONSTRAINT "users_cooking_skill_level_check" CHECK (("cooking_skill_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "users_current_activity_level_check" CHECK (("current_activity_level" = ANY (ARRAY['sedentary'::"text", 'lightly_active'::"text", 'moderately_active'::"text", 'very_active'::"text", 'extremely_active'::"text"]))),
    CONSTRAINT "users_energy_level_check" CHECK ((("energy_level" >= 1) AND ("energy_level" <= 10))),
    CONSTRAINT "users_feedback_frequency_check" CHECK (("feedback_frequency" = ANY (ARRAY['real_time'::"text", 'daily'::"text", 'weekly'::"text", 'minimal'::"text"]))),
    CONSTRAINT "users_fitness_level_check" CHECK (("fitness_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "users_location_type_check" CHECK (("location_type" = ANY (ARRAY['urban'::"text", 'suburban'::"text", 'rural'::"text"]))),
    CONSTRAINT "users_meal_prep_preference_check" CHECK (("meal_prep_preference" = ANY (ARRAY['none'::"text", 'simple'::"text", 'moderate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "users_measurement_system_check" CHECK (("measurement_system" = ANY (ARRAY['metric'::"text", 'imperial'::"text"]))),
    CONSTRAINT "users_motivation_style_check" CHECK (("motivation_style" = ANY (ARRAY['encouraging'::"text", 'challenging'::"text", 'scientific'::"text", 'casual'::"text"]))),
    CONSTRAINT "users_privacy_level_check" CHECK (("privacy_level" = ANY (ARRAY['private'::"text", 'friends'::"text", 'public'::"text"]))),
    CONSTRAINT "users_profile_setup_phase_check" CHECK (("profile_setup_phase" = ANY (ARRAY['basic'::"text", 'enhanced'::"text", 'complete'::"text"]))),
    CONSTRAINT "users_progress_tracking_detail_check" CHECK (("progress_tracking_detail" = ANY (ARRAY['basic'::"text", 'detailed'::"text", 'comprehensive'::"text"]))),
    CONSTRAINT "users_social_sharing_comfort_check" CHECK (("social_sharing_comfort" = ANY (ARRAY['private'::"text", 'friends_only'::"text", 'selective'::"text", 'public'::"text"]))),
    CONSTRAINT "users_stress_level_check" CHECK ((("stress_level" >= 1) AND ("stress_level" <= 10))),
    CONSTRAINT "users_workout_intensity_check" CHECK (("workout_intensity" = ANY (ARRAY['chill'::"text", 'moderate'::"text", 'intense'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."personality_traits" IS 'JSONB field storing AI personality traits and user preferences';



COMMENT ON COLUMN "public"."users"."ai_response_style" IS 'JSONB field storing AI conversation and response patterns';



COMMENT ON COLUMN "public"."users"."is_mock_user" IS 'Boolean flag to identify AI users vs real users';



COMMENT ON COLUMN "public"."users"."posting_schedule" IS 'JSONB field storing AI posting preferences and schedules';



COMMENT ON COLUMN "public"."users"."conversation_context" IS 'JSONB field storing AI conversation history and context';



COMMENT ON COLUMN "public"."users"."current_weight_kg" IS 'User current weight in kilograms for BMI and calorie calculations';



COMMENT ON COLUMN "public"."users"."target_weight_kg" IS 'User target weight in kilograms for goal tracking';



COMMENT ON COLUMN "public"."users"."height_cm" IS 'User height in centimeters (allows decimal like 175.5) for BMI and calorie calculations';



COMMENT ON COLUMN "public"."users"."daily_step_goal" IS 'User personalized daily step goal (default 10,000)';



COMMENT ON COLUMN "public"."users"."weekly_workout_goal" IS 'User weekly workout goal (default 3 sessions)';



COMMENT ON COLUMN "public"."users"."preferred_workout_times" IS 'Array of preferred workout times like [morning, evening, lunch]';



COMMENT ON COLUMN "public"."users"."available_equipment" IS 'Array of available equipment like [dumbbells, yoga_mat, resistance_bands]';



COMMENT ON COLUMN "public"."users"."injuries_limitations" IS 'Free text describing any injuries or physical limitations for safe workout recommendations';



COMMENT ON COLUMN "public"."users"."sleep_schedule" IS 'JSON object with bedtime, wakeup, and sleep goal hours for recovery tracking';



COMMENT ON COLUMN "public"."users"."motivation_style" IS 'Preferred coaching motivation style for AI personalization';



COMMENT ON COLUMN "public"."users"."current_activity_level" IS 'Current activity level from sedentary to extremely active';



COMMENT ON COLUMN "public"."users"."fitness_experience_years" IS 'Years of fitness experience (0 for complete beginner)';



COMMENT ON COLUMN "public"."users"."preferred_workout_duration" IS 'Preferred workout session duration in minutes';



COMMENT ON COLUMN "public"."users"."coaching_style" IS 'Preferred AI coaching approach style';



COMMENT ON COLUMN "public"."users"."feedback_frequency" IS 'How often user wants coaching feedback and check-ins';



COMMENT ON COLUMN "public"."users"."progress_tracking_detail" IS 'Level of detail for progress tracking and analytics';



COMMENT ON COLUMN "public"."users"."primary_motivation" IS 'User primary motivation for fitness journey';



COMMENT ON COLUMN "public"."users"."biggest_fitness_challenge" IS 'User biggest challenge to help AI provide targeted support';



COMMENT ON COLUMN "public"."users"."previous_fitness_successes" IS 'What has worked for user before for AI to build on successes';



COMMENT ON COLUMN "public"."users"."onboarding_completed_steps" IS 'Array tracking which enhanced onboarding steps user completed';



COMMENT ON COLUMN "public"."users"."profile_setup_phase" IS 'Current profile setup phase: basic, enhanced, or complete';



COMMENT ON COLUMN "public"."users"."equipment_list" IS 'Free text description of fitness equipment user has available';



COMMENT ON COLUMN "public"."users"."exercise_preferences" IS 'Array of exercise types user prefers (gym, outdoor, home, classes, sports)';



COMMENT ON COLUMN "public"."users"."has_equipment" IS 'Boolean indicating if user has any fitness equipment at home';



COMMENT ON COLUMN "public"."users"."primary_goal" IS 'User primary fitness goal from enhanced onboarding';



COMMENT ON COLUMN "public"."users"."smart_goal_target" IS 'Specific SMART goal description from onboarding';



COMMENT ON COLUMN "public"."users"."smart_goal_value" IS 'Target numeric value for SMART goal';



COMMENT ON COLUMN "public"."users"."smart_goal_unit" IS 'Unit of measurement for SMART goal (kg, km, reps, etc.)';



COMMENT ON COLUMN "public"."users"."smart_goal_timeframe" IS 'Timeframe for achieving SMART goal';



COMMENT ON COLUMN "public"."users"."smart_goal_why" IS 'User motivation for their SMART goal';



COMMENT ON COLUMN "public"."users"."smart_goal_target_date" IS 'Target date for achieving SMART goal';



COMMENT ON COLUMN "public"."users"."privacy_level" IS 'User privacy preference for profile and posts';



COMMENT ON COLUMN "public"."users"."measurement_system" IS 'Preferred measurement system (metric or imperial)';



COMMENT ON COLUMN "public"."users"."timezone" IS 'User timezone for scheduling and notifications';



CREATE OR REPLACE VIEW "public"."ai_user_stats" AS
 SELECT "count"(*) AS "total_ai_users",
    "count"(*) FILTER (WHERE ("date"("users"."created_at") = CURRENT_DATE)) AS "ai_users_created_today",
    "count"(*) FILTER (WHERE ("users"."personality_traits" ? 'communication_style'::"text")) AS "ai_users_with_personality",
    "count"(*) FILTER (WHERE ("users"."posting_schedule" ? 'preferred_hour'::"text")) AS "ai_users_with_schedule",
    "avg"("array_length"("users"."goals", 1)) AS "avg_goals_per_ai_user",
    "mode"() WITHIN GROUP (ORDER BY "users"."fitness_level") AS "most_common_fitness_level"
   FROM "public"."users"
  WHERE ("users"."is_mock_user" = true);


ALTER TABLE "public"."ai_user_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "message_text" "text" NOT NULL,
    "is_user_message" boolean DEFAULT false NOT NULL,
    "is_voice_message" boolean DEFAULT false NOT NULL,
    "audio_duration" integer,
    "context_snapshot" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "voice_session_id" "uuid",
    "speech_confidence" real,
    "voice_emotion" "text",
    "processing_latency" integer
);


ALTER TABLE "public"."coach_conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."coach_conversations" IS 'Voice and text conversations between users and Coach Alex';



COMMENT ON COLUMN "public"."coach_conversations"."is_voice_message" IS 'True if this message was input/output via voice';



COMMENT ON COLUMN "public"."coach_conversations"."audio_duration" IS 'Duration in seconds for voice messages';



COMMENT ON COLUMN "public"."coach_conversations"."context_snapshot" IS 'Full enhanced context (health, social, events) at time of message';



COMMENT ON COLUMN "public"."coach_conversations"."speech_confidence" IS 'Speech-to-text confidence score from Deepgram';



COMMENT ON COLUMN "public"."coach_conversations"."voice_emotion" IS 'Detected emotion from voice input';



COMMENT ON COLUMN "public"."coach_conversations"."processing_latency" IS 'Total voice processing latency in milliseconds';



CREATE OR REPLACE VIEW "public"."coach_conversations_with_context" AS
 SELECT "cc"."id",
    "cc"."user_id",
    "cc"."message_text",
    "cc"."is_user_message",
    "cc"."is_voice_message",
    "cc"."audio_duration",
    "cc"."context_snapshot",
    "cc"."created_at",
    "cc"."updated_at",
    "u"."username",
    "u"."full_name",
    "u"."fitness_level",
    "u"."coaching_style"
   FROM ("public"."coach_conversations" "cc"
     JOIN "public"."users" "u" ON (("cc"."user_id" = "u"."id")));


ALTER TABLE "public"."coach_conversations_with_context" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_edited" boolean DEFAULT false,
    CONSTRAINT "comments_content_check" CHECK ((("length"("content") > 0) AND ("length"("content") <= 500)))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."comments_with_users" AS
 SELECT "c"."id",
    "c"."post_id",
    "c"."content",
    "c"."created_at",
    "c"."updated_at",
    "c"."is_edited",
    "c"."user_id",
    "u"."username",
    "u"."full_name",
    "u"."avatar_url",
    "u"."fitness_level"
   FROM ("public"."comments" "c"
     JOIN "public"."users" "u" ON (("c"."user_id" = "u"."id")));


ALTER TABLE "public"."comments_with_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_step_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "step_count" integer DEFAULT 0 NOT NULL,
    "goal_reached" boolean DEFAULT false,
    "calories_burned" integer DEFAULT 0,
    "distance_km" numeric(8,2) DEFAULT 0,
    "active_minutes" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_step_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_participants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "previous_status" "text",
    "checked_in" boolean DEFAULT false,
    "check_in_time" timestamp with time zone,
    "no_show" boolean DEFAULT false,
    "notifications_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_participants_status_check" CHECK (("status" = ANY (ARRAY['going'::"text", 'maybe'::"text", 'not_going'::"text", 'waitlist'::"text"])))
);


ALTER TABLE "public"."event_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_updates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "update_type" "text" NOT NULL,
    "changes" "jsonb",
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_updates_update_type_check" CHECK (("update_type" = ANY (ARRAY['created'::"text", 'edited'::"text", 'cancelled'::"text", 'time_changed'::"text", 'location_changed'::"text"])))
);


ALTER TABLE "public"."event_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category_id" "uuid",
    "location_name" "text",
    "location_address" "text",
    "location_coordinates" "text",
    "location_details" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone,
    "timezone" "text" DEFAULT 'UTC'::"text",
    "max_participants" integer,
    "min_participants" integer DEFAULT 1,
    "current_participants" integer DEFAULT 0,
    "waitlist_enabled" boolean DEFAULT true,
    "fitness_levels" "text"[] DEFAULT '{}'::"text"[],
    "equipment_needed" "text"[],
    "cost_cents" integer DEFAULT 0,
    "cost_currency" "text" DEFAULT 'USD'::"text",
    "creator_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'published'::"text",
    "visibility" "text" DEFAULT 'public'::"text",
    "cover_image" "text",
    "images" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "location_type" "text" DEFAULT 'physical'::"text",
    "stream_id" "uuid",
    "is_live" boolean DEFAULT false,
    CONSTRAINT "check_location_coordinates_json" CHECK ((("location_coordinates" IS NULL) OR (("location_coordinates")::"json" IS NOT NULL))),
    CONSTRAINT "events_location_type_check" CHECK (("location_type" = ANY (ARRAY['physical'::"text", 'virtual'::"text"]))),
    CONSTRAINT "events_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'cancelled'::"text", 'completed'::"text"]))),
    CONSTRAINT "events_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'friends'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."location_type" IS 'Physical events have locations, virtual events are live streams';



COMMENT ON COLUMN "public"."events"."stream_id" IS 'Links physical events to their live stream (if any)';



COMMENT ON COLUMN "public"."events"."is_live" IS 'True when the event is currently being live streamed';



CREATE TABLE IF NOT EXISTS "public"."fitness_knowledge" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "category" "text" NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "public"."vector"(1536),
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "difficulty_level" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "fitness_knowledge_difficulty_level_check" CHECK (("difficulty_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"])))
);


ALTER TABLE "public"."fitness_knowledge" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "friend_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "friendships_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_coaching_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message_text" "text" NOT NULL,
    "message_type" "text" NOT NULL,
    "coaching_tone" "text",
    "triggered_by" "text",
    "goal_context" "jsonb" DEFAULT '{}'::"jsonb",
    "user_context" "jsonb" DEFAULT '{}'::"jsonb",
    "user_response" "text",
    "user_feedback" "text",
    "led_to_action" boolean DEFAULT false,
    "effectiveness_score" numeric(3,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone,
    CONSTRAINT "goal_coaching_messages_coaching_tone_check" CHECK (("coaching_tone" = ANY (ARRAY['motivational'::"text", 'analytical'::"text", 'supportive'::"text", 'challenging'::"text"]))),
    CONSTRAINT "goal_coaching_messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['encouragement'::"text", 'milestone_celebration'::"text", 'course_correction'::"text", 'strategy_suggestion'::"text", 'obstacle_help'::"text", 'check_in'::"text"]))),
    CONSTRAINT "goal_coaching_messages_triggered_by_check" CHECK (("triggered_by" = ANY (ARRAY['progress_update'::"text", 'missed_checkin'::"text", 'milestone_reached'::"text", 'goal_stalled'::"text", 'user_request'::"text", 'scheduled'::"text"]))),
    CONSTRAINT "goal_coaching_messages_user_response_check" CHECK (("user_response" = ANY (ARRAY['helpful'::"text", 'not_helpful'::"text", 'motivating'::"text", 'overwhelming'::"text", 'ignored'::"text"])))
);


ALTER TABLE "public"."goal_coaching_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."goal_coaching_messages" IS 'AI coaching messages specific to individual goals';



COMMENT ON COLUMN "public"."goal_coaching_messages"."triggered_by" IS 'What event triggered this coaching message';



COMMENT ON COLUMN "public"."goal_coaching_messages"."effectiveness_score" IS 'AI learning score for message effectiveness (0.0-1.0)';



CREATE TABLE IF NOT EXISTS "public"."goal_progress_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "recorded_value" numeric(10,2) NOT NULL,
    "previous_value" numeric(10,2),
    "change_amount" numeric(10,2) GENERATED ALWAYS AS (("recorded_value" - COALESCE("previous_value", (0)::numeric))) STORED,
    "progress_percentage" integer,
    "log_type" "text" DEFAULT 'manual'::"text",
    "data_source" "text" DEFAULT 'user_input'::"text",
    "notes" "text",
    "mood_rating" integer,
    "confidence_level" integer,
    "ai_generated_insights" "text"[],
    "coaching_triggered" boolean DEFAULT false,
    "photo_urls" "text"[],
    "recorded_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "goal_progress_logs_confidence_level_check" CHECK ((("confidence_level" >= 1) AND ("confidence_level" <= 5))),
    CONSTRAINT "goal_progress_logs_data_source_check" CHECK (("data_source" = ANY (ARRAY['user_input'::"text", 'healthkit'::"text", 'app_tracking'::"text", 'ai_estimate'::"text", 'external_sync'::"text"]))),
    CONSTRAINT "goal_progress_logs_log_type_check" CHECK (("log_type" = ANY (ARRAY['manual'::"text", 'auto_sync'::"text", 'milestone'::"text", 'correction'::"text"]))),
    CONSTRAINT "goal_progress_logs_mood_rating_check" CHECK ((("mood_rating" >= 1) AND ("mood_rating" <= 5)))
);


ALTER TABLE "public"."goal_progress_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."goal_progress_logs" IS 'Historical log of all goal progress updates with context';



COMMENT ON COLUMN "public"."goal_progress_logs"."mood_rating" IS 'User mood when logging progress (1=frustrated, 5=excited)';



COMMENT ON COLUMN "public"."goal_progress_logs"."confidence_level" IS 'User confidence in achieving goal (1=low, 5=very confident)';



CREATE TABLE IF NOT EXISTS "public"."health_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "resting_heart_rate" integer,
    "sleep_hours" numeric(4,2),
    "sleep_quality" integer,
    "weight_kg" numeric(5,2),
    "body_fat_percentage" numeric(5,2),
    "energy_level" integer,
    "stress_level" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "health_metrics_energy_level_check" CHECK ((("energy_level" >= 1) AND ("energy_level" <= 10))),
    CONSTRAINT "health_metrics_sleep_quality_check" CHECK ((("sleep_quality" >= 1) AND ("sleep_quality" <= 10))),
    CONSTRAINT "health_metrics_stress_level_check" CHECK ((("stress_level" >= 1) AND ("stress_level" <= 10)))
);


ALTER TABLE "public"."health_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_streams" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "host_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "channel_id" "text" NOT NULL,
    "is_active" boolean DEFAULT false,
    "viewer_count" integer DEFAULT 0,
    "max_viewers" integer DEFAULT 1000,
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "event_id" "uuid",
    "agora_channel_name" "text" NOT NULL,
    "agora_app_id" "text" NOT NULL,
    "quality" "text" DEFAULT 'medium'::"text",
    "is_private" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "live_streams_quality_check" CHECK (("quality" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."live_streams" OWNER TO "postgres";


COMMENT ON TABLE "public"."live_streams" IS 'Stores live streaming sessions powered by Agora';



CREATE TABLE IF NOT EXISTS "public"."message_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."message_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "sender_id" "uuid",
    "receiver_id" "uuid",
    "content" "text",
    "media_url" "text",
    "media_type" "text",
    "expires_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "message_type" "text" DEFAULT 'text'::"text",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_viewed" boolean DEFAULT false,
    "viewed_at" timestamp with time zone,
    "is_ai_sender" boolean DEFAULT false,
    "ai_personality_type" "text",
    "response_context" "jsonb",
    CONSTRAINT "check_different_users" CHECK (("sender_id" <> "receiver_id")),
    CONSTRAINT "messages_media_type_check" CHECK (("media_type" = ANY (ARRAY['text'::"text", 'photo'::"text", 'video'::"text"]))),
    CONSTRAINT "messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'photo'::"text", 'video'::"text", 'mixed'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_views" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"(),
    "view_duration" integer DEFAULT 0,
    "view_percentage" integer DEFAULT 100,
    "device_type" "text",
    "app_version" "text",
    "session_id" "text",
    "duration" integer
);


ALTER TABLE "public"."post_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "content" "text",
    "media_url" "text",
    "media_type" "text",
    "expires_at" timestamp with time zone,
    "workout_type" "text",
    "content_embedding" "public"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "thumbnail_url" "text",
    "poster_url" "text",
    CONSTRAINT "posts_media_type_check" CHECK (("media_type" = ANY (ARRAY['photo'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."posts"."thumbnail_url" IS 'Optimized thumbnail (600x600) for feed display - both photos and videos';



COMMENT ON COLUMN "public"."posts"."poster_url" IS 'Video poster frame URL for enhanced video display';



CREATE TABLE IF NOT EXISTS "public"."stories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "media_url" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "content" "text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "stories_media_type_check" CHECK (("media_type" = ANY (ARRAY['photo'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."stories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stream_participants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "stream_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'viewer'::"text",
    "agora_uid" integer NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "left_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "connection_state" "text" DEFAULT 'connecting'::"text",
    CONSTRAINT "stream_participants_connection_state_check" CHECK (("connection_state" = ANY (ARRAY['connecting'::"text", 'connected'::"text", 'disconnected'::"text", 'failed'::"text"]))),
    CONSTRAINT "stream_participants_role_check" CHECK (("role" = ANY (ARRAY['host'::"text", 'co_host'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."stream_participants" OWNER TO "postgres";


COMMENT ON TABLE "public"."stream_participants" IS 'Tracks users participating in live streams with their roles';



CREATE TABLE IF NOT EXISTS "public"."user_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "achievement_type" character varying(50) NOT NULL,
    "achievement_id" character varying(100) NOT NULL,
    "title" character varying(200) NOT NULL,
    "description" "text",
    "icon_name" character varying(100),
    "level" integer DEFAULT 1,
    "earned_date" "date" DEFAULT CURRENT_DATE,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" character varying(200) NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "goal_type" "text" DEFAULT 'outcome'::"text",
    "specific_target" "text" NOT NULL,
    "measurable_metric" "text" NOT NULL,
    "target_value" numeric(10,2),
    "target_unit" "text",
    "start_date" "date" DEFAULT CURRENT_DATE,
    "target_date" "date" NOT NULL,
    "estimated_duration_days" integer GENERATED ALWAYS AS (("target_date" - "start_date")) STORED,
    "current_value" numeric(10,2) DEFAULT 0,
    "progress_percentage" integer GENERATED ALWAYS AS (
CASE
    WHEN ("target_value" > (0)::numeric) THEN LEAST((100)::numeric, "round"((("current_value" / "target_value") * (100)::numeric)))
    ELSE (0)::numeric
END) STORED,
    "status" "text" DEFAULT 'active'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "difficulty_level" "text" DEFAULT 'moderate'::"text",
    "why_important" "text",
    "success_criteria" "text"[],
    "obstacles_anticipated" "text"[],
    "support_needed" "text"[],
    "ai_coaching_enabled" boolean DEFAULT true,
    "coaching_frequency" "text" DEFAULT 'weekly'::"text",
    "coaching_style_override" "text",
    "share_progress_publicly" boolean DEFAULT false,
    "accountability_buddy_id" "uuid",
    "celebration_preference" "text" DEFAULT 'friends'::"text",
    "milestones" "jsonb" DEFAULT '[]'::"jsonb",
    "rewards_system" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_context" "jsonb" DEFAULT '{}'::"jsonb",
    "related_goals" "uuid"[],
    "parent_goal_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "last_progress_update" timestamp with time zone,
    CONSTRAINT "no_self_parent" CHECK (("id" <> "parent_goal_id")),
    CONSTRAINT "user_goals_category_check" CHECK (("category" = ANY (ARRAY['fitness'::"text", 'weight'::"text", 'strength'::"text", 'endurance'::"text", 'flexibility'::"text", 'nutrition'::"text", 'wellness'::"text", 'habit'::"text", 'custom'::"text"]))),
    CONSTRAINT "user_goals_celebration_preference_check" CHECK (("celebration_preference" = ANY (ARRAY['private'::"text", 'friends'::"text", 'public'::"text", 'none'::"text"]))),
    CONSTRAINT "user_goals_coaching_frequency_check" CHECK (("coaching_frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'biweekly'::"text", 'milestone_based'::"text"]))),
    CONSTRAINT "user_goals_coaching_style_override_check" CHECK (("coaching_style_override" = ANY (ARRAY['gentle'::"text", 'motivational'::"text", 'data_driven'::"text", 'holistic'::"text"]))),
    CONSTRAINT "user_goals_difficulty_level_check" CHECK (("difficulty_level" = ANY (ARRAY['easy'::"text", 'moderate'::"text", 'challenging'::"text", 'ambitious'::"text"]))),
    CONSTRAINT "user_goals_goal_type_check" CHECK (("goal_type" = ANY (ARRAY['outcome'::"text", 'process'::"text", 'performance'::"text"]))),
    CONSTRAINT "user_goals_priority_check" CHECK (("priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "user_goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'completed'::"text", 'cancelled'::"text", 'overdue'::"text"]))),
    CONSTRAINT "valid_current_value" CHECK (("current_value" >= (0)::numeric)),
    CONSTRAINT "valid_target_date" CHECK (("target_date" > "start_date")),
    CONSTRAINT "valid_target_value" CHECK (("target_value" > (0)::numeric))
);


ALTER TABLE "public"."user_goals" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_goals" IS 'Detailed SMART goal tracking with AI coaching integration';



COMMENT ON COLUMN "public"."user_goals"."specific_target" IS 'Clear, specific description of what user wants to achieve';



COMMENT ON COLUMN "public"."user_goals"."measurable_metric" IS 'The metric that will be tracked (weight_kg, run_time_minutes, etc.)';



COMMENT ON COLUMN "public"."user_goals"."target_value" IS 'Numeric target value to achieve';



COMMENT ON COLUMN "public"."user_goals"."progress_percentage" IS 'Auto-calculated progress percentage based on current vs target value';



COMMENT ON COLUMN "public"."user_goals"."milestones" IS 'JSON array of milestone objects with dates, values, and rewards';



COMMENT ON COLUMN "public"."user_goals"."ai_context" IS 'AI learning context about user patterns and preferences for this goal';



CREATE TABLE IF NOT EXISTS "public"."user_interactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "post_id" "uuid",
    "interaction_type" "text",
    "feedback" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_interactions_interaction_type_check" CHECK (("interaction_type" = ANY (ARRAY['like'::"text", 'comment'::"text", 'save'::"text", 'share'::"text", 'view'::"text"])))
);


ALTER TABLE "public"."user_interactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_profiles_enhanced" AS
 SELECT "u"."id",
    "u"."email",
    "u"."username",
    "u"."full_name",
    "u"."avatar_url",
    "u"."fitness_level",
    "u"."goals",
    "u"."dietary_preferences",
    "u"."workout_frequency",
    "u"."created_at",
    "u"."updated_at",
    "u"."personality_traits",
    "u"."ai_response_style",
    "u"."is_mock_user",
    "u"."posting_schedule",
    "u"."conversation_context",
    "u"."city",
    "u"."bio",
    "u"."workout_intensity",
    "u"."current_weight_kg",
    "u"."target_weight_kg",
    "u"."height_cm",
    "u"."daily_step_goal",
    "u"."weekly_workout_goal",
    "u"."preferred_workout_times",
    "u"."available_equipment",
    "u"."injuries_limitations",
    "u"."sleep_schedule",
    "u"."motivation_style",
    "u"."current_activity_level",
    "u"."fitness_experience_years",
    "u"."preferred_workout_duration",
    "u"."meal_prep_preference",
    "u"."cooking_skill_level",
    "u"."food_allergies",
    "u"."nutrition_goals",
    "u"."stress_level",
    "u"."energy_level",
    "u"."wellness_goals",
    "u"."accountability_preference",
    "u"."social_sharing_comfort",
    "u"."available_workout_days",
    "u"."workout_time_constraints",
    "u"."coaching_style",
    "u"."feedback_frequency",
    "u"."progress_tracking_detail",
    "u"."primary_motivation",
    "u"."biggest_fitness_challenge",
    "u"."previous_fitness_successes",
    "u"."location_type",
    "u"."onboarding_completed_steps",
    "u"."onboarding_completion_date",
    "u"."profile_setup_phase",
    "u"."equipment_list",
    "u"."exercise_preferences",
    "u"."has_equipment",
    "u"."primary_goal",
    "u"."smart_goal_target",
    "u"."smart_goal_value",
    "u"."smart_goal_unit",
    "u"."smart_goal_timeframe",
    "u"."smart_goal_why",
    "u"."smart_goal_target_date",
    "u"."privacy_level",
    "u"."measurement_system",
    "u"."timezone",
    "public"."calculate_enhanced_profile_completeness"("u"."id") AS "profile_completeness_percentage",
        CASE
            WHEN ("public"."calculate_enhanced_profile_completeness"("u"."id") >= 90) THEN 'complete'::"text"
            WHEN ("public"."calculate_enhanced_profile_completeness"("u"."id") >= 70) THEN 'mostly_complete'::"text"
            WHEN ("public"."calculate_enhanced_profile_completeness"("u"."id") >= 50) THEN 'partially_complete'::"text"
            ELSE 'needs_enhancement'::"text"
        END AS "profile_status",
        CASE
            WHEN (("u"."daily_step_goal" IS NOT NULL) AND ("u"."current_activity_level" IS NOT NULL) AND ("u"."coaching_style" IS NOT NULL) AND ("array_length"("u"."goals", 1) > 0)) THEN 'ready'::"text"
            WHEN (("u"."fitness_level" IS NOT NULL) AND ("u"."workout_frequency" IS NOT NULL)) THEN 'basic_ready'::"text"
            ELSE 'needs_setup'::"text"
        END AS "coaching_readiness"
   FROM "public"."users" "u";


ALTER TABLE "public"."user_profiles_enhanced" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_streaks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "streak_type" character varying(50) NOT NULL,
    "current_count" integer DEFAULT 0,
    "best_count" integer DEFAULT 0,
    "last_updated" "date" DEFAULT CURRENT_DATE,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_streaks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voice_coaching_commands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "command_type" "text" NOT NULL,
    "command_intent" "text" NOT NULL,
    "command_parameters" "jsonb" DEFAULT '{}'::"jsonb",
    "execution_status" "text" DEFAULT 'pending'::"text",
    "execution_result" "jsonb" DEFAULT '{}'::"jsonb",
    "confidence_score" real,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "voice_coaching_commands_execution_status_check" CHECK (("execution_status" = ANY (ARRAY['pending'::"text", 'executed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."voice_coaching_commands" OWNER TO "postgres";


COMMENT ON TABLE "public"."voice_coaching_commands" IS 'Voice commands and intents detected during coaching sessions';



CREATE TABLE IF NOT EXISTS "public"."voice_coaching_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_token" "text" NOT NULL,
    "status" "text" DEFAULT 'connecting'::"text",
    "session_start" timestamp with time zone DEFAULT "now"(),
    "session_end" timestamp with time zone,
    "total_duration" integer DEFAULT 0,
    "conversation_context" "jsonb" DEFAULT '{}'::"jsonb",
    "voice_metrics" "jsonb" DEFAULT '{}'::"jsonb",
    "workout_context" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "voice_coaching_sessions_status_check" CHECK (("status" = ANY (ARRAY['connecting'::"text", 'active'::"text", 'paused'::"text", 'completed'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."voice_coaching_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."voice_coaching_sessions" IS 'WebSocket voice coaching sessions with Pypecat integration';



COMMENT ON COLUMN "public"."voice_coaching_sessions"."session_token" IS 'Unique WebSocket session identifier for Pypecat integration';



COMMENT ON COLUMN "public"."voice_coaching_sessions"."voice_metrics" IS 'Voice quality metrics: interruptions, clarity, emotion, etc.';



CREATE OR REPLACE VIEW "public"."voice_conversations_enhanced" AS
 SELECT "cc"."id",
    "cc"."user_id",
    "cc"."message_text",
    "cc"."is_user_message",
    "cc"."is_voice_message",
    "cc"."audio_duration",
    "cc"."context_snapshot",
    "cc"."created_at",
    "cc"."updated_at",
    "cc"."voice_session_id",
    "cc"."speech_confidence",
    "cc"."voice_emotion",
    "cc"."processing_latency",
    "vcs"."session_token",
    "vcs"."status" AS "session_status",
    "vcs"."workout_context",
    "u"."username",
    "u"."full_name",
    "u"."fitness_level",
    "u"."coaching_style"
   FROM (("public"."coach_conversations" "cc"
     LEFT JOIN "public"."voice_coaching_sessions" "vcs" ON (("cc"."voice_session_id" = "vcs"."id")))
     JOIN "public"."users" "u" ON (("cc"."user_id" = "u"."id")))
  WHERE ("cc"."is_voice_message" = true);


ALTER TABLE "public"."voice_conversations_enhanced" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_health_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "week_starting" "date" NOT NULL,
    "total_steps" integer DEFAULT 0,
    "average_daily_steps" integer DEFAULT 0,
    "goal_days_reached" integer DEFAULT 0,
    "total_workouts" integer DEFAULT 0,
    "total_active_minutes" integer DEFAULT 0,
    "average_sleep_hours" numeric(4,2),
    "new_achievements" integer DEFAULT 0,
    "weekly_insight" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."weekly_health_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workout_type" character varying(50) NOT NULL,
    "duration_minutes" integer NOT NULL,
    "calories_burned" integer,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "average_heart_rate" integer,
    "max_heart_rate" integer,
    "intensity_level" character varying(20),
    "notes" "text",
    "source" character varying(50) DEFAULT 'manual'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workout_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workout_type" character varying(50) NOT NULL,
    "note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "workout_notes_note_not_empty" CHECK (("length"(TRIM(BOTH FROM "note")) > 0)),
    CONSTRAINT "workout_notes_type_check" CHECK ((("workout_type")::"text" = ANY ((ARRAY['Cardio'::character varying, 'Strength'::character varying, 'Yoga'::character varying, 'Running'::character varying, 'Walking'::character varying, 'Cycling'::character varying, 'Swimming'::character varying, 'HIIT'::character varying, 'Stretching'::character varying, 'Other'::character varying])::"text"[])))
);


ALTER TABLE "public"."workout_notes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_coaching_messages"
    ADD CONSTRAINT "ai_coaching_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_conversation_memories"
    ADD CONSTRAINT "ai_conversation_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_conversation_snapshots"
    ADD CONSTRAINT "ai_conversation_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_proactive_messages"
    ADD CONSTRAINT "ai_proactive_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_conversations"
    ADD CONSTRAINT "coach_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_step_logs"
    ADD CONSTRAINT "daily_step_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_step_logs"
    ADD CONSTRAINT "daily_step_logs_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."event_categories"
    ADD CONSTRAINT "event_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."event_categories"
    ADD CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_updates"
    ADD CONSTRAINT "event_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fitness_knowledge"
    ADD CONSTRAINT "fitness_knowledge_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_id_friend_id_key" UNIQUE ("user_id", "friend_id");



ALTER TABLE ONLY "public"."goal_coaching_messages"
    ADD CONSTRAINT "goal_coaching_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_progress_logs"
    ADD CONSTRAINT "goal_progress_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."health_metrics"
    ADD CONSTRAINT "health_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."health_metrics"
    ADD CONSTRAINT "health_metrics_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."live_streams"
    ADD CONSTRAINT "live_streams_channel_id_key" UNIQUE ("channel_id");



ALTER TABLE ONLY "public"."live_streams"
    ADD CONSTRAINT "live_streams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_views"
    ADD CONSTRAINT "message_views_message_id_user_id_key" UNIQUE ("message_id", "user_id");



ALTER TABLE ONLY "public"."message_views"
    ADD CONSTRAINT "message_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_views"
    ADD CONSTRAINT "post_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_views"
    ADD CONSTRAINT "post_views_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stream_participants"
    ADD CONSTRAINT "stream_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stream_participants"
    ADD CONSTRAINT "stream_participants_stream_id_user_id_key" UNIQUE ("stream_id", "user_id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_achievement_id_key" UNIQUE ("user_id", "achievement_id");



ALTER TABLE ONLY "public"."user_goals"
    ADD CONSTRAINT "user_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_streaks"
    ADD CONSTRAINT "user_streaks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_streaks"
    ADD CONSTRAINT "user_streaks_user_id_streak_type_key" UNIQUE ("user_id", "streak_type");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."voice_coaching_commands"
    ADD CONSTRAINT "voice_coaching_commands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_coaching_sessions"
    ADD CONSTRAINT "voice_coaching_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voice_coaching_sessions"
    ADD CONSTRAINT "voice_coaching_sessions_session_token_key" UNIQUE ("session_token");



ALTER TABLE ONLY "public"."weekly_health_summaries"
    ADD CONSTRAINT "weekly_health_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_health_summaries"
    ADD CONSTRAINT "weekly_health_summaries_user_id_week_starting_key" UNIQUE ("user_id", "week_starting");



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_notes"
    ADD CONSTRAINT "workout_notes_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_ai_coaching_messages_user_date" ON "public"."ai_coaching_messages" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_ai_conversation_memories_ai_user" ON "public"."ai_conversation_memories" USING "btree" ("ai_user_id");



CREATE INDEX "idx_ai_conversation_memories_human_user" ON "public"."ai_conversation_memories" USING "btree" ("human_user_id");



CREATE INDEX "idx_ai_conversation_memories_last_conversation" ON "public"."ai_conversation_memories" USING "btree" ("last_conversation_at");



CREATE INDEX "idx_ai_conversation_memories_relationship_stage" ON "public"."ai_conversation_memories" USING "btree" ("relationship_stage");



CREATE UNIQUE INDEX "idx_ai_conversation_memories_unique" ON "public"."ai_conversation_memories" USING "btree" ("ai_user_id", "human_user_id");



CREATE INDEX "idx_ai_conversation_snapshots_date" ON "public"."ai_conversation_snapshots" USING "btree" ("conversation_date");



CREATE INDEX "idx_ai_conversation_snapshots_importance" ON "public"."ai_conversation_snapshots" USING "btree" ("importance_score");



CREATE INDEX "idx_ai_conversation_snapshots_memory" ON "public"."ai_conversation_snapshots" USING "btree" ("memory_id");



CREATE INDEX "idx_ai_proactive_messages_ai_user_id" ON "public"."ai_proactive_messages" USING "btree" ("ai_user_id");



CREATE INDEX "idx_ai_proactive_messages_sent_at" ON "public"."ai_proactive_messages" USING "btree" ("sent_at");



CREATE INDEX "idx_ai_proactive_messages_trigger_type" ON "public"."ai_proactive_messages" USING "btree" ("trigger_type");



CREATE INDEX "idx_ai_proactive_messages_user_id" ON "public"."ai_proactive_messages" USING "btree" ("user_id");



CREATE INDEX "idx_coach_conversations_created_at" ON "public"."coach_conversations" USING "btree" ("created_at");



CREATE INDEX "idx_coach_conversations_session" ON "public"."coach_conversations" USING "btree" ("voice_session_id");



CREATE INDEX "idx_coach_conversations_user_id" ON "public"."coach_conversations" USING "btree" ("user_id");



CREATE INDEX "idx_coach_conversations_user_recent" ON "public"."coach_conversations" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_coach_conversations_voice" ON "public"."coach_conversations" USING "btree" ("user_id", "is_voice_message");



CREATE INDEX "idx_comments_created_at" ON "public"."comments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_comments_post_created" ON "public"."comments" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "idx_comments_post_id" ON "public"."comments" USING "btree" ("post_id");



CREATE INDEX "idx_comments_user_id" ON "public"."comments" USING "btree" ("user_id");



CREATE INDEX "idx_daily_step_logs_user_date" ON "public"."daily_step_logs" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_event_participants_event_id" ON "public"."event_participants" USING "btree" ("event_id");



CREATE INDEX "idx_event_participants_status" ON "public"."event_participants" USING "btree" ("status");



CREATE INDEX "idx_event_participants_user_id" ON "public"."event_participants" USING "btree" ("user_id");



CREATE INDEX "idx_event_participants_user_status_date" ON "public"."event_participants" USING "btree" ("user_id", "status", "created_at") WHERE ("status" = ANY (ARRAY['going'::"text", 'maybe'::"text"]));



CREATE INDEX "idx_events_category_id" ON "public"."events" USING "btree" ("category_id");



CREATE INDEX "idx_events_creator_id" ON "public"."events" USING "btree" ("creator_id");



CREATE INDEX "idx_events_creator_status_date" ON "public"."events" USING "btree" ("creator_id", "status", "created_at") WHERE (("status" <> 'draft'::"text") AND ("deleted_at" IS NULL));



CREATE INDEX "idx_events_is_live" ON "public"."events" USING "btree" ("is_live");



CREATE INDEX "idx_events_location_type" ON "public"."events" USING "btree" ("location_type");



CREATE INDEX "idx_events_start_time" ON "public"."events" USING "btree" ("start_time");



CREATE INDEX "idx_events_status" ON "public"."events" USING "btree" ("status");



CREATE INDEX "idx_events_stream_id" ON "public"."events" USING "btree" ("stream_id");



CREATE INDEX "idx_fitness_knowledge_category" ON "public"."fitness_knowledge" USING "btree" ("category");



CREATE INDEX "idx_goal_coaching_messages_created_at" ON "public"."goal_coaching_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_goal_coaching_messages_goal_id" ON "public"."goal_coaching_messages" USING "btree" ("goal_id");



CREATE INDEX "idx_goal_coaching_messages_user_id" ON "public"."goal_coaching_messages" USING "btree" ("user_id");



CREATE INDEX "idx_goal_progress_logs_goal_id" ON "public"."goal_progress_logs" USING "btree" ("goal_id");



CREATE INDEX "idx_goal_progress_logs_recorded_at" ON "public"."goal_progress_logs" USING "btree" ("recorded_at" DESC);



CREATE INDEX "idx_goal_progress_logs_user_goal" ON "public"."goal_progress_logs" USING "btree" ("user_id", "goal_id");



CREATE INDEX "idx_health_metrics_user_date" ON "public"."health_metrics" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_live_streams_created_at" ON "public"."live_streams" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_live_streams_event_id" ON "public"."live_streams" USING "btree" ("event_id");



CREATE INDEX "idx_live_streams_host_id" ON "public"."live_streams" USING "btree" ("host_id");



CREATE INDEX "idx_live_streams_is_active" ON "public"."live_streams" USING "btree" ("is_active");



CREATE INDEX "idx_message_views_message_id" ON "public"."message_views" USING "btree" ("message_id");



CREATE INDEX "idx_message_views_user_id" ON "public"."message_views" USING "btree" ("user_id");



CREATE INDEX "idx_messages_ai_personality" ON "public"."messages" USING "btree" ("ai_personality_type") WHERE ("ai_personality_type" IS NOT NULL);



CREATE INDEX "idx_messages_ai_sender" ON "public"."messages" USING "btree" ("is_ai_sender") WHERE ("is_ai_sender" = true);



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_messages_receiver_sender" ON "public"."messages" USING "btree" ("receiver_id", "sender_id");



CREATE INDEX "idx_messages_sender_receiver" ON "public"."messages" USING "btree" ("sender_id", "receiver_id");



CREATE INDEX "idx_messages_sent_at" ON "public"."messages" USING "btree" ("sent_at" DESC);



CREATE INDEX "idx_post_views_post_id" ON "public"."post_views" USING "btree" ("post_id");



CREATE INDEX "idx_post_views_user_id" ON "public"."post_views" USING "btree" ("user_id");



CREATE INDEX "idx_post_views_user_post" ON "public"."post_views" USING "btree" ("user_id", "post_id");



CREATE INDEX "idx_post_views_user_viewed_at" ON "public"."post_views" USING "btree" ("user_id", "viewed_at" DESC);



CREATE INDEX "idx_post_views_viewed_at" ON "public"."post_views" USING "btree" ("viewed_at" DESC);



CREATE INDEX "idx_posts_created_at" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_posts_expires_at" ON "public"."posts" USING "btree" ("expires_at");



CREATE INDEX "idx_posts_thumbnail_url" ON "public"."posts" USING "btree" ("thumbnail_url");



CREATE INDEX "idx_posts_user_created_date" ON "public"."posts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_posts_user_id" ON "public"."posts" USING "btree" ("user_id");



CREATE INDEX "idx_stories_expires_at" ON "public"."stories" USING "btree" ("expires_at");



CREATE INDEX "idx_stories_user_id" ON "public"."stories" USING "btree" ("user_id");



CREATE INDEX "idx_stream_participants_is_active" ON "public"."stream_participants" USING "btree" ("is_active");



CREATE INDEX "idx_stream_participants_role" ON "public"."stream_participants" USING "btree" ("role");



CREATE INDEX "idx_stream_participants_stream_id" ON "public"."stream_participants" USING "btree" ("stream_id");



CREATE INDEX "idx_stream_participants_user_id" ON "public"."stream_participants" USING "btree" ("user_id");



CREATE INDEX "idx_user_achievements_user_type" ON "public"."user_achievements" USING "btree" ("user_id", "achievement_type");



CREATE INDEX "idx_user_goals_active" ON "public"."user_goals" USING "btree" ("user_id", "status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_user_goals_category" ON "public"."user_goals" USING "btree" ("category");



CREATE INDEX "idx_user_goals_parent_goal" ON "public"."user_goals" USING "btree" ("parent_goal_id") WHERE ("parent_goal_id" IS NOT NULL);



CREATE INDEX "idx_user_goals_priority" ON "public"."user_goals" USING "btree" ("priority");



CREATE INDEX "idx_user_goals_progress" ON "public"."user_goals" USING "btree" ("progress_percentage");



CREATE INDEX "idx_user_goals_status" ON "public"."user_goals" USING "btree" ("status");



CREATE INDEX "idx_user_goals_target_date" ON "public"."user_goals" USING "btree" ("target_date");



CREATE INDEX "idx_user_goals_user_id" ON "public"."user_goals" USING "btree" ("user_id");



CREATE INDEX "idx_user_interactions_user_id" ON "public"."user_interactions" USING "btree" ("user_id");



CREATE INDEX "idx_user_streaks_user_type" ON "public"."user_streaks" USING "btree" ("user_id", "streak_type");



CREATE INDEX "idx_users_ai_response_style" ON "public"."users" USING "gin" ("ai_response_style");



CREATE INDEX "idx_users_available_equipment" ON "public"."users" USING "gin" ("available_equipment") WHERE ("available_equipment" <> '{}'::"text"[]);



CREATE INDEX "idx_users_bio" ON "public"."users" USING "gin" ("to_tsvector"('"english"'::"regconfig", "bio")) WHERE ("bio" IS NOT NULL);



CREATE INDEX "idx_users_city" ON "public"."users" USING "btree" ("city") WHERE ("city" IS NOT NULL);



CREATE INDEX "idx_users_coaching_style" ON "public"."users" USING "btree" ("coaching_style") WHERE ("coaching_style" IS NOT NULL);



CREATE INDEX "idx_users_current_activity_level" ON "public"."users" USING "btree" ("current_activity_level") WHERE ("current_activity_level" IS NOT NULL);



CREATE INDEX "idx_users_daily_step_goal" ON "public"."users" USING "btree" ("daily_step_goal") WHERE ("daily_step_goal" IS NOT NULL);



CREATE INDEX "idx_users_exercise_preferences" ON "public"."users" USING "gin" ("exercise_preferences") WHERE ("exercise_preferences" <> '{}'::"text"[]);



CREATE INDEX "idx_users_has_equipment" ON "public"."users" USING "btree" ("has_equipment");



CREATE INDEX "idx_users_is_mock_user" ON "public"."users" USING "btree" ("is_mock_user");



CREATE INDEX "idx_users_last_sign_in_at" ON "public"."users" USING "btree" ("last_sign_in_at") WHERE ("is_mock_user" = false);



CREATE INDEX "idx_users_measurement_system" ON "public"."users" USING "btree" ("measurement_system");



CREATE INDEX "idx_users_motivation_style" ON "public"."users" USING "btree" ("motivation_style") WHERE ("motivation_style" IS NOT NULL);



CREATE INDEX "idx_users_onboarding_completion" ON "public"."users" USING "btree" ("onboarding_completion_date") WHERE ("onboarding_completion_date" IS NOT NULL);



CREATE INDEX "idx_users_personality_traits" ON "public"."users" USING "gin" ("personality_traits");



CREATE INDEX "idx_users_posting_schedule" ON "public"."users" USING "gin" ("posting_schedule");



CREATE INDEX "idx_users_preferred_workout_times" ON "public"."users" USING "gin" ("preferred_workout_times") WHERE ("preferred_workout_times" <> '{}'::"text"[]);



CREATE INDEX "idx_users_primary_goal" ON "public"."users" USING "btree" ("primary_goal") WHERE ("primary_goal" IS NOT NULL);



CREATE INDEX "idx_users_privacy_level" ON "public"."users" USING "btree" ("privacy_level");



CREATE INDEX "idx_users_profile_setup_phase" ON "public"."users" USING "btree" ("profile_setup_phase");



CREATE INDEX "idx_users_smart_goal_target_date" ON "public"."users" USING "btree" ("smart_goal_target_date") WHERE ("smart_goal_target_date" IS NOT NULL);



CREATE INDEX "idx_users_workout_intensity" ON "public"."users" USING "btree" ("workout_intensity") WHERE ("workout_intensity" IS NOT NULL);



CREATE INDEX "idx_voice_commands_session" ON "public"."voice_coaching_commands" USING "btree" ("session_id");



CREATE INDEX "idx_voice_commands_status" ON "public"."voice_coaching_commands" USING "btree" ("execution_status");



CREATE INDEX "idx_voice_commands_type" ON "public"."voice_coaching_commands" USING "btree" ("command_type");



CREATE INDEX "idx_voice_sessions_active" ON "public"."voice_coaching_sessions" USING "btree" ("user_id", "status") WHERE ("status" = ANY (ARRAY['connecting'::"text", 'active'::"text", 'paused'::"text"]));



CREATE INDEX "idx_voice_sessions_status" ON "public"."voice_coaching_sessions" USING "btree" ("status");



CREATE INDEX "idx_voice_sessions_token" ON "public"."voice_coaching_sessions" USING "btree" ("session_token");



CREATE INDEX "idx_voice_sessions_user_id" ON "public"."voice_coaching_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_weekly_summaries_user_week" ON "public"."weekly_health_summaries" USING "btree" ("user_id", "week_starting" DESC);



CREATE INDEX "idx_workout_logs_user_date" ON "public"."workout_logs" USING "btree" ("user_id", "start_time" DESC);



CREATE INDEX "idx_workout_notes_user_date" ON "public"."workout_notes" USING "btree" ("user_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "trigger_check_step_achievements" AFTER INSERT OR UPDATE ON "public"."daily_step_logs" FOR EACH ROW EXECUTE FUNCTION "public"."check_step_achievements"();



CREATE OR REPLACE TRIGGER "trigger_create_progress_log_on_goal_update" AFTER UPDATE ON "public"."user_goals" FOR EACH ROW EXECUTE FUNCTION "public"."create_progress_log_on_goal_update"();



CREATE OR REPLACE TRIGGER "trigger_manage_waitlist" BEFORE INSERT OR UPDATE ON "public"."event_participants" FOR EACH ROW EXECUTE FUNCTION "public"."manage_event_waitlist"();



CREATE OR REPLACE TRIGGER "trigger_start_stream" BEFORE UPDATE ON "public"."live_streams" FOR EACH ROW EXECUTE FUNCTION "public"."start_stream"();



CREATE OR REPLACE TRIGGER "trigger_update_participant_count" AFTER INSERT OR DELETE OR UPDATE ON "public"."event_participants" FOR EACH ROW EXECUTE FUNCTION "public"."update_event_participant_count"();



CREATE OR REPLACE TRIGGER "trigger_update_step_streak" AFTER INSERT OR UPDATE ON "public"."daily_step_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_step_streak"();



CREATE OR REPLACE TRIGGER "trigger_update_stream_viewer_count" AFTER INSERT OR DELETE OR UPDATE ON "public"."stream_participants" FOR EACH ROW EXECUTE FUNCTION "public"."update_stream_viewer_count"();



CREATE OR REPLACE TRIGGER "trigger_update_user_goals_updated_at" BEFORE UPDATE ON "public"."user_goals" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_goals_updated_at"();



CREATE OR REPLACE TRIGGER "update_coach_conversations_updated_at" BEFORE UPDATE ON "public"."coach_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_updated_at"();



CREATE OR REPLACE TRIGGER "update_event_participants_updated_at" BEFORE UPDATE ON "public"."event_participants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_live_streams_updated_at" BEFORE UPDATE ON "public"."live_streams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stream_participants_updated_at" BEFORE UPDATE ON "public"."stream_participants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_voice_sessions_updated_at" BEFORE UPDATE ON "public"."voice_coaching_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_ai_personality_traits_trigger" BEFORE INSERT OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."validate_ai_personality_trigger"();



ALTER TABLE ONLY "public"."ai_coaching_messages"
    ADD CONSTRAINT "ai_coaching_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_conversation_memories"
    ADD CONSTRAINT "ai_conversation_memories_ai_user_id_fkey" FOREIGN KEY ("ai_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_conversation_memories"
    ADD CONSTRAINT "ai_conversation_memories_human_user_id_fkey" FOREIGN KEY ("human_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_conversation_snapshots"
    ADD CONSTRAINT "ai_conversation_snapshots_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "public"."ai_conversation_memories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_proactive_messages"
    ADD CONSTRAINT "ai_proactive_messages_ai_user_id_fkey" FOREIGN KEY ("ai_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_proactive_messages"
    ADD CONSTRAINT "ai_proactive_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_proactive_messages"
    ADD CONSTRAINT "ai_proactive_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_conversations"
    ADD CONSTRAINT "coach_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_conversations"
    ADD CONSTRAINT "coach_conversations_voice_session_id_fkey" FOREIGN KEY ("voice_session_id") REFERENCES "public"."voice_coaching_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_step_logs"
    ADD CONSTRAINT "daily_step_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_updates"
    ADD CONSTRAINT "event_updates_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_updates"
    ADD CONSTRAINT "event_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."event_categories"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "public"."live_streams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_friend_id_fkey" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_coaching_messages"
    ADD CONSTRAINT "goal_coaching_messages_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."user_goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_coaching_messages"
    ADD CONSTRAINT "goal_coaching_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_progress_logs"
    ADD CONSTRAINT "goal_progress_logs_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."user_goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_progress_logs"
    ADD CONSTRAINT "goal_progress_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."health_metrics"
    ADD CONSTRAINT "health_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_streams"
    ADD CONSTRAINT "live_streams_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."live_streams"
    ADD CONSTRAINT "live_streams_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_views"
    ADD CONSTRAINT "message_views_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_views"
    ADD CONSTRAINT "message_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_views"
    ADD CONSTRAINT "post_views_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_views"
    ADD CONSTRAINT "post_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stream_participants"
    ADD CONSTRAINT "stream_participants_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "public"."live_streams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stream_participants"
    ADD CONSTRAINT "stream_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_goals"
    ADD CONSTRAINT "user_goals_accountability_buddy_id_fkey" FOREIGN KEY ("accountability_buddy_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_goals"
    ADD CONSTRAINT "user_goals_parent_goal_id_fkey" FOREIGN KEY ("parent_goal_id") REFERENCES "public"."user_goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_goals"
    ADD CONSTRAINT "user_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_streaks"
    ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_coaching_commands"
    ADD CONSTRAINT "voice_coaching_commands_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."voice_coaching_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_coaching_sessions"
    ADD CONSTRAINT "voice_coaching_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_health_summaries"
    ADD CONSTRAINT "weekly_health_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_notes"
    ADD CONSTRAINT "workout_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "AI users can create events" ON "public"."events" FOR INSERT WITH CHECK ((("auth"."uid"() = "creator_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))));



CREATE POLICY "AI users can insert their own posts" ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "AI users can manage their own event RSVPs" ON "public"."event_participants" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "AI users can send messages" ON "public"."messages" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "AI users can send messages to anyone" ON "public"."messages" FOR INSERT WITH CHECK (((COALESCE("is_ai_sender", false) = true) AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "messages"."sender_id") AND ("users"."is_mock_user" = true))))));



CREATE POLICY "AI users can update their events" ON "public"."events" FOR UPDATE USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "AI users can view messages" ON "public"."messages" FOR SELECT USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



CREATE POLICY "AI users can view public posts" ON "public"."posts" FOR SELECT USING ((("expires_at" > "now"()) OR ("expires_at" IS NULL)));



CREATE POLICY "AI users can view published events" ON "public"."events" FOR SELECT USING ((("status" = 'published'::"text") AND ("deleted_at" IS NULL)));



CREATE POLICY "Event creators can delete their events" ON "public"."events" FOR DELETE USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "Event creators can update their events" ON "public"."events" FOR UPDATE USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "Prevent message deletion" ON "public"."messages" FOR DELETE USING (false);



CREATE POLICY "Service role can insert proactive messages" ON "public"."ai_proactive_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Stream hosts can delete their streams" ON "public"."live_streams" FOR DELETE USING (("auth"."uid"() = "host_id"));



CREATE POLICY "Stream hosts can manage all participants" ON "public"."stream_participants" USING ((EXISTS ( SELECT 1
   FROM "public"."live_streams"
  WHERE (("live_streams"."id" = "stream_participants"."stream_id") AND ("live_streams"."host_id" = "auth"."uid"())))));



CREATE POLICY "Stream hosts can update their streams" ON "public"."live_streams" FOR UPDATE USING (("auth"."uid"() = "host_id"));



CREATE POLICY "System can insert goal coaching messages" ON "public"."goal_coaching_messages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can access their AI conversation memories" ON "public"."ai_conversation_memories" USING ((("auth"."uid"() = "human_user_id") OR (("auth"."uid"() = "ai_user_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_mock_user" = true)))))));



CREATE POLICY "Users can access their conversation snapshots" ON "public"."ai_conversation_snapshots" USING ((EXISTS ( SELECT 1
   FROM "public"."ai_conversation_memories" "acm"
  WHERE (("acm"."id" = "ai_conversation_snapshots"."memory_id") AND (("acm"."human_user_id" = "auth"."uid"()) OR (("acm"."ai_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_mock_user" = true))))))))));



CREATE POLICY "Users can create events" ON "public"."events" FOR INSERT WITH CHECK (("auth"."uid"() = "creator_id"));



CREATE POLICY "Users can create their own streams" ON "public"."live_streams" FOR INSERT WITH CHECK (("auth"."uid"() = "host_id"));



CREATE POLICY "Users can delete own comments or post owners can delete comment" ON "public"."comments" FOR DELETE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "comments"."post_id") AND ("posts"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete their own coach conversations" ON "public"."coach_conversations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert comments on active posts" ON "public"."comments" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "comments"."post_id") AND (("posts"."expires_at" > "now"()) OR ("posts"."expires_at" IS NULL)))))));



CREATE POLICY "Users can insert own achievements" ON "public"."user_achievements" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own coaching messages" ON "public"."ai_coaching_messages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own step logs" ON "public"."daily_step_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own coach conversations" ON "public"."coach_conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own post views" ON "public"."post_views" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own posts" ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own voice sessions" ON "public"."voice_coaching_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own health metrics" ON "public"."health_metrics" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own streaks" ON "public"."user_streaks" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own weekly summaries" ON "public"."weekly_health_summaries" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own workout logs" ON "public"."workout_logs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own workout notes" ON "public"."workout_notes" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their friendships" ON "public"."friendships" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own event RSVPs" ON "public"."event_participants" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own goal progress logs" ON "public"."goal_progress_logs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own goals" ON "public"."user_goals" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own stream participation" ON "public"."stream_participants" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can mark messages as viewed" ON "public"."message_views" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."messages"
  WHERE (("messages"."id" = "message_views"."message_id") AND ("messages"."receiver_id" = "auth"."uid"()))))));



CREATE POLICY "Users can send messages" ON "public"."messages" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can send messages to AI users" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "messages"."receiver_id") AND ("users"."is_mock_user" = true))))));



CREATE POLICY "Users can send messages to friends" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."friendships"
  WHERE (((("friendships"."user_id" = "auth"."uid"()) AND ("friendships"."friend_id" = "messages"."receiver_id")) OR (("friendships"."friend_id" = "auth"."uid"()) AND ("friendships"."user_id" = "messages"."receiver_id"))) AND ("friendships"."status" = 'accepted'::"text"))))));



CREATE POLICY "Users can update own coaching messages" ON "public"."ai_coaching_messages" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own step logs" ON "public"."daily_step_logs" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update received friend requests" ON "public"."friendships" FOR UPDATE USING ((("auth"."uid"() = "friend_id") AND ("status" = 'pending'::"text")));



CREATE POLICY "Users can update their own coach conversations" ON "public"."coach_conversations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own comments" ON "public"."comments" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "comments"."post_id") AND (("posts"."expires_at" > "now"()) OR ("posts"."expires_at" IS NULL))))))) WITH CHECK ((("auth"."uid"() = "user_id") AND ("post_id" = "post_id") AND ("user_id" = "user_id")));



CREATE POLICY "Users can update their own goal coaching messages" ON "public"."goal_coaching_messages" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own post views" ON "public"."post_views" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own voice sessions" ON "public"."voice_coaching_sessions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their sent messages" ON "public"."messages" FOR UPDATE USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



CREATE POLICY "Users can view AI messages" ON "public"."messages" FOR SELECT USING (((COALESCE("is_ai_sender", false) = true) AND (("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id"))));



CREATE POLICY "Users can view active public streams" ON "public"."live_streams" FOR SELECT USING ((("is_active" = true) AND ("is_private" = false)));



CREATE POLICY "Users can view commands from their sessions" ON "public"."voice_coaching_commands" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."voice_coaching_sessions" "vcs"
  WHERE (("vcs"."id" = "voice_coaching_commands"."session_id") AND ("vcs"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view comments on viewable posts" ON "public"."comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "comments"."post_id") AND (("posts"."expires_at" > "now"()) OR ("posts"."expires_at" IS NULL))))));



CREATE POLICY "Users can view event participants for public events" ON "public"."event_participants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_participants"."event_id") AND ("events"."status" = 'published'::"text")))));



CREATE POLICY "Users can view other users' profiles" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Users can view own achievements" ON "public"."user_achievements" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own coaching messages" ON "public"."ai_coaching_messages" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own step logs" ON "public"."daily_step_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own streaks" ON "public"."user_streaks" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own weekly summaries" ON "public"."weekly_health_summaries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view participants of active public streams" ON "public"."stream_participants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."live_streams"
  WHERE (("live_streams"."id" = "stream_participants"."stream_id") AND ("live_streams"."is_active" = true) AND ("live_streams"."is_private" = false)))));



CREATE POLICY "Users can view participants of their own streams" ON "public"."stream_participants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."live_streams"
  WHERE (("live_streams"."id" = "stream_participants"."stream_id") AND ("live_streams"."host_id" = "auth"."uid"())))));



CREATE POLICY "Users can view public posts" ON "public"."posts" FOR SELECT USING ((("expires_at" > "now"()) OR ("expires_at" IS NULL)));



CREATE POLICY "Users can view published events" ON "public"."events" FOR SELECT USING ((("status" = 'published'::"text") AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view their friendships" ON "public"."friendships" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "friend_id")));



CREATE POLICY "Users can view their message views" ON "public"."message_views" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their messages" ON "public"."messages" FOR SELECT USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



CREATE POLICY "Users can view their own coach conversations" ON "public"."coach_conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own data" ON "public"."users" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own goal coaching messages" ON "public"."goal_coaching_messages" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own post views" ON "public"."post_views" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own streams" ON "public"."live_streams" FOR SELECT USING (("auth"."uid"() = "host_id"));



CREATE POLICY "Users can view their own voice sessions" ON "public"."voice_coaching_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their proactive messages" ON "public"."ai_proactive_messages" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."ai_coaching_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_conversation_memories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_conversation_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_proactive_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_step_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goal_coaching_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goal_progress_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."health_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."live_streams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stream_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_streaks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_coaching_commands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_coaching_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_health_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workout_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workout_notes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_friend_request"("friendship_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_friend_request"("friendship_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_friend_request"("friendship_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."batch_mark_viewed"("p_user_id" "uuid", "p_view_records" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."batch_mark_viewed"("p_user_id" "uuid", "p_view_records" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."batch_mark_viewed"("p_user_id" "uuid", "p_view_records" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."batch_update_step_data"("target_user_id" "uuid", "step_data" "json") TO "anon";
GRANT ALL ON FUNCTION "public"."batch_update_step_data"("target_user_id" "uuid", "step_data" "json") TO "authenticated";
GRANT ALL ON FUNCTION "public"."batch_update_step_data"("target_user_id" "uuid", "step_data" "json") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_distance_json"("coords1" "text", "coords2" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_distance_json"("coords1" "text", "coords2" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_distance_json"("coords1" "text", "coords2" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_enhanced_profile_completeness"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_enhanced_profile_completeness"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_enhanced_profile_completeness"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_user_activity_streak"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_user_activity_streak"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_user_activity_streak"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_step_achievements"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_step_achievements"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_step_achievements"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_stream_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_stream_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_stream_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_comments"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_comments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_comments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_post_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_post_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_post_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_posts"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_posts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_posts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_coach_conversations"("days_to_keep" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_coach_conversations"("days_to_keep" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_coach_conversations"("days_to_keep" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_proactive_messages_log_if_not_exists"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_proactive_messages_log_if_not_exists"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_proactive_messages_log_if_not_exists"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_progress_log_on_goal_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_progress_log_on_goal_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_progress_log_on_goal_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_voice_coaching_session"("target_user_id" "uuid", "session_token" "text", "workout_context" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_voice_coaching_session"("target_user_id" "uuid", "session_token" "text", "workout_context" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_voice_coaching_session"("target_user_id" "uuid", "session_token" "text", "workout_context" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."decline_friend_request"("friendship_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decline_friend_request"("friendship_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decline_friend_request"("friendship_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_expired_content"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_expired_content"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_expired_content"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_events_within_radius"("user_lat" double precision, "user_lon" double precision, "radius_km" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."find_events_within_radius"("user_lat" double precision, "user_lon" double precision, "radius_km" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_events_within_radius"("user_lat" double precision, "user_lon" double precision, "radius_km" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_nearby_streams"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."find_nearby_streams"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_nearby_streams"("user_lat" double precision, "user_lng" double precision, "radius_km" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_agora_uid"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_agora_uid"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_agora_uid"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ai_system_prompt"("p_ai_user_id" "uuid", "p_system_prompt" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ai_system_prompt"("p_ai_user_id" "uuid", "p_system_prompt" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ai_system_prompt"("p_ai_user_id" "uuid", "p_system_prompt" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_post_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_post_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_post_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_voice_session"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_voice_session"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_voice_session"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ai_conversation_context"("ai_user_id" "uuid", "human_user_id" "uuid", "message_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_ai_conversation_context"("ai_user_id" "uuid", "human_user_id" "uuid", "message_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ai_conversation_context"("ai_user_id" "uuid", "human_user_id" "uuid", "message_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ai_conversation_memory"("p_ai_user_id" "uuid", "p_human_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_ai_conversation_memory"("p_ai_user_id" "uuid", "p_human_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ai_conversation_memory"("p_ai_user_id" "uuid", "p_human_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ai_user_posting_history"("target_user_id" "uuid", "days_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_ai_user_posting_history"("target_user_id" "uuid", "days_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ai_user_posting_history"("target_user_id" "uuid", "days_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ai_user_posting_stats"("days_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_ai_user_posting_stats"("days_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ai_user_posting_stats"("days_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ai_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_ai_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ai_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ai_users_for_commenting"("post_id" "uuid", "max_commenters" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_ai_users_for_commenting"("post_id" "uuid", "max_commenters" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ai_users_for_commenting"("post_id" "uuid", "max_commenters" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ai_users_for_posting"("target_hour" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_ai_users_for_posting"("target_hour" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ai_users_for_posting"("target_hour" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ai_users_ready_for_posting"("target_hour" integer, "target_day" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_ai_users_ready_for_posting"("target_hour" integer, "target_day" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ai_users_ready_for_posting"("target_hour" integer, "target_day" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_ai_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_ai_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_ai_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_coach_conversation_stats"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_coach_conversation_stats"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_coach_conversation_stats"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_comment_counts"("p_post_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_comment_counts"("p_post_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_comment_counts"("p_post_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_compatible_ai_users"("target_user_id" "uuid", "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_compatible_ai_users"("target_user_id" "uuid", "limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_compatible_ai_users"("target_user_id" "uuid", "limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_friends_count"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_friends_count"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_friends_count"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_friends_list"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_friends_list"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_friends_list"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_friendship_status"("friend_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_friendship_status"("friend_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_friendship_status"("friend_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_goal_insights_for_coaching"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_goal_insights_for_coaching"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_goal_insights_for_coaching"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_health_dashboard"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_health_dashboard"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_health_dashboard"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_messages_between_friends"("target_friend_id" "uuid", "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_messages_between_friends"("target_friend_id" "uuid", "limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_messages_between_friends"("target_friend_id" "uuid", "limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_messages_with_ai_support"("other_user_id" "uuid", "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_messages_with_ai_support"("other_user_id" "uuid", "limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_messages_with_ai_support"("other_user_id" "uuid", "limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_requests"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_requests"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_requests"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_post_comments"("p_post_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_post_comments"("p_post_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_post_comments"("p_post_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recent_coach_conversation"("target_user_id" "uuid", "message_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recent_coach_conversation"("target_user_id" "uuid", "message_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recent_coach_conversation"("target_user_id" "uuid", "message_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recent_conversation_messages"("user1_id" "uuid", "user2_id" "uuid", "message_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recent_conversation_messages"("user1_id" "uuid", "user2_id" "uuid", "message_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recent_conversation_messages"("user1_id" "uuid", "user2_id" "uuid", "message_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sent_requests"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_sent_requests"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sent_requests"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unviewed_posts"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_unviewed_posts"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unviewed_posts"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_active_goals"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_active_goals"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_active_goals"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_conversations"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_conversations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_conversations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_conversations_with_ai"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_conversations_with_ai"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_conversations_with_ai"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_rsvp_stats"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_rsvp_stats"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_rsvp_stats"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_users_needing_profile_enhancement"("min_completeness" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_users_needing_profile_enhancement"("min_completeness" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_users_needing_profile_enhancement"("min_completeness" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_voice_coaching_stats"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_voice_coaching_stats"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_voice_coaching_stats"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."manage_event_waitlist"() TO "anon";
GRANT ALL ON FUNCTION "public"."manage_event_waitlist"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."manage_event_waitlist"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_ai_message_viewed"("message_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_ai_message_viewed"("message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_ai_message_viewed"("message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_ai_user_posted_today"("user_id" "uuid", "content_type" "text", "post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_ai_user_posted_today"("user_id" "uuid", "content_type" "text", "post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_ai_user_posted_today"("user_id" "uuid", "content_type" "text", "post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_message_viewed"("message_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_message_viewed"("message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_message_viewed"("message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_fitness_content"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_fitness_content"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_fitness_content"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."record_voice_command"("session_token" "text", "command_type" "text", "command_intent" "text", "command_parameters" "jsonb", "confidence_score" real) TO "anon";
GRANT ALL ON FUNCTION "public"."record_voice_command"("session_token" "text", "command_type" "text", "command_intent" "text", "command_parameters" "jsonb", "confidence_score" real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_voice_command"("session_token" "text", "command_type" "text", "command_intent" "text", "command_parameters" "jsonb", "confidence_score" real) TO "service_role";



GRANT ALL ON FUNCTION "public"."send_ai_message"("receiver_user_id" "uuid", "message_content" "text", "personality_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."send_ai_message"("receiver_user_id" "uuid", "message_content" "text", "personality_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_ai_message"("receiver_user_id" "uuid", "message_content" "text", "personality_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_ai_message"("ai_user_id" "uuid", "receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text", "personality_type" "text", "context_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."send_ai_message"("ai_user_id" "uuid", "receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text", "personality_type" "text", "context_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_ai_message"("ai_user_id" "uuid", "receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text", "personality_type" "text", "context_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_friend_request"("friend_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."send_friend_request"("friend_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_friend_request"("friend_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_message"("receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."send_message"("receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_message"("receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_non_ephemeral_ai_message"("ai_user_id" "uuid", "receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text", "personality_type" "text", "context_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."send_non_ephemeral_ai_message"("ai_user_id" "uuid", "receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text", "personality_type" "text", "context_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_non_ephemeral_ai_message"("ai_user_id" "uuid", "receiver_user_id" "uuid", "message_content" "text", "message_media_url" "text", "message_media_type" "text", "personality_type" "text", "context_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."start_stream"() TO "anon";
GRANT ALL ON FUNCTION "public"."start_stream"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_stream"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ai_conversation_context"("user_id" "uuid", "context_update" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_ai_conversation_context"("user_id" "uuid", "context_update" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ai_conversation_context"("user_id" "uuid", "context_update" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ai_conversation_memory"("p_ai_user_id" "uuid", "p_human_user_id" "uuid", "p_conversation_summary" "text", "p_new_details" "jsonb", "p_topics_discussed" "jsonb", "p_message_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_ai_conversation_memory"("p_ai_user_id" "uuid", "p_human_user_id" "uuid", "p_conversation_summary" "text", "p_new_details" "jsonb", "p_topics_discussed" "jsonb", "p_message_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ai_conversation_memory"("p_ai_user_id" "uuid", "p_human_user_id" "uuid", "p_conversation_summary" "text", "p_new_details" "jsonb", "p_topics_discussed" "jsonb", "p_message_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_comment_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_comment_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_comment_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_event_participant_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_event_participant_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event_participant_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_human_details_learned"("p_ai_user_id" "uuid", "p_human_user_id" "uuid", "p_new_details" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_human_details_learned"("p_ai_user_id" "uuid", "p_human_user_id" "uuid", "p_new_details" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_human_details_learned"("p_ai_user_id" "uuid", "p_human_user_id" "uuid", "p_new_details" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_overdue_goals"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_overdue_goals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_overdue_goals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_step_streak"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_step_streak"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_step_streak"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stream_viewer_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_stream_viewer_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stream_viewer_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_goals_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_goals_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_goals_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_voice_session_status"("session_token" "text", "new_status" "text", "duration_update" integer, "metrics_update" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_voice_session_status"("session_token" "text", "new_status" "text", "duration_update" integer, "metrics_update" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_voice_session_status"("session_token" "text", "new_status" "text", "duration_update" integer, "metrics_update" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_ai_personality_traits"("traits" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_ai_personality_traits"("traits" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_ai_personality_traits"("traits" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_ai_personality_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_ai_personality_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_ai_personality_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_ai_user_for_posting"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_ai_user_for_posting"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_ai_user_for_posting"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."ai_coaching_messages" TO "anon";
GRANT ALL ON TABLE "public"."ai_coaching_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_coaching_messages" TO "service_role";



GRANT ALL ON TABLE "public"."ai_conversation_memories" TO "anon";
GRANT ALL ON TABLE "public"."ai_conversation_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_conversation_memories" TO "service_role";



GRANT ALL ON TABLE "public"."ai_conversation_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."ai_conversation_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_conversation_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."ai_proactive_messages" TO "anon";
GRANT ALL ON TABLE "public"."ai_proactive_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_proactive_messages" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."ai_user_stats" TO "anon";
GRANT ALL ON TABLE "public"."ai_user_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_user_stats" TO "service_role";



GRANT ALL ON TABLE "public"."coach_conversations" TO "anon";
GRANT ALL ON TABLE "public"."coach_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."coach_conversations_with_context" TO "anon";
GRANT ALL ON TABLE "public"."coach_conversations_with_context" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_conversations_with_context" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."comments_with_users" TO "anon";
GRANT ALL ON TABLE "public"."comments_with_users" TO "authenticated";
GRANT ALL ON TABLE "public"."comments_with_users" TO "service_role";



GRANT ALL ON TABLE "public"."daily_step_logs" TO "anon";
GRANT ALL ON TABLE "public"."daily_step_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_step_logs" TO "service_role";



GRANT ALL ON TABLE "public"."event_categories" TO "anon";
GRANT ALL ON TABLE "public"."event_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."event_categories" TO "service_role";



GRANT ALL ON TABLE "public"."event_participants" TO "anon";
GRANT ALL ON TABLE "public"."event_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."event_participants" TO "service_role";



GRANT ALL ON TABLE "public"."event_updates" TO "anon";
GRANT ALL ON TABLE "public"."event_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."event_updates" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."fitness_knowledge" TO "anon";
GRANT ALL ON TABLE "public"."fitness_knowledge" TO "authenticated";
GRANT ALL ON TABLE "public"."fitness_knowledge" TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT ALL ON TABLE "public"."goal_coaching_messages" TO "anon";
GRANT ALL ON TABLE "public"."goal_coaching_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_coaching_messages" TO "service_role";



GRANT ALL ON TABLE "public"."goal_progress_logs" TO "anon";
GRANT ALL ON TABLE "public"."goal_progress_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_progress_logs" TO "service_role";



GRANT ALL ON TABLE "public"."health_metrics" TO "anon";
GRANT ALL ON TABLE "public"."health_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."health_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."live_streams" TO "anon";
GRANT ALL ON TABLE "public"."live_streams" TO "authenticated";
GRANT ALL ON TABLE "public"."live_streams" TO "service_role";



GRANT ALL ON TABLE "public"."message_views" TO "anon";
GRANT ALL ON TABLE "public"."message_views" TO "authenticated";
GRANT ALL ON TABLE "public"."message_views" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."post_views" TO "anon";
GRANT ALL ON TABLE "public"."post_views" TO "authenticated";
GRANT ALL ON TABLE "public"."post_views" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."stories" TO "anon";
GRANT ALL ON TABLE "public"."stories" TO "authenticated";
GRANT ALL ON TABLE "public"."stories" TO "service_role";



GRANT ALL ON TABLE "public"."stream_participants" TO "anon";
GRANT ALL ON TABLE "public"."stream_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."stream_participants" TO "service_role";



GRANT ALL ON TABLE "public"."user_achievements" TO "anon";
GRANT ALL ON TABLE "public"."user_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_achievements" TO "service_role";



GRANT ALL ON TABLE "public"."user_goals" TO "anon";
GRANT ALL ON TABLE "public"."user_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."user_goals" TO "service_role";



GRANT ALL ON TABLE "public"."user_interactions" TO "anon";
GRANT ALL ON TABLE "public"."user_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles_enhanced" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles_enhanced" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles_enhanced" TO "service_role";



GRANT ALL ON TABLE "public"."user_streaks" TO "anon";
GRANT ALL ON TABLE "public"."user_streaks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_streaks" TO "service_role";



GRANT ALL ON TABLE "public"."voice_coaching_commands" TO "anon";
GRANT ALL ON TABLE "public"."voice_coaching_commands" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_coaching_commands" TO "service_role";



GRANT ALL ON TABLE "public"."voice_coaching_sessions" TO "anon";
GRANT ALL ON TABLE "public"."voice_coaching_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_coaching_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."voice_conversations_enhanced" TO "anon";
GRANT ALL ON TABLE "public"."voice_conversations_enhanced" TO "authenticated";
GRANT ALL ON TABLE "public"."voice_conversations_enhanced" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_health_summaries" TO "anon";
GRANT ALL ON TABLE "public"."weekly_health_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_health_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."workout_logs" TO "anon";
GRANT ALL ON TABLE "public"."workout_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_logs" TO "service_role";



GRANT ALL ON TABLE "public"."workout_notes" TO "anon";
GRANT ALL ON TABLE "public"."workout_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_notes" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






RESET ALL;
