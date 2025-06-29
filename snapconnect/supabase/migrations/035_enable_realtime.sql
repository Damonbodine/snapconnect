-- Enable real-time subscriptions for AI messaging
-- This allows the AI Message Handler to detect new messages automatically

-- Enable real-time for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Verify real-time is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'messages';