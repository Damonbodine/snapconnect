-- Check if realtime is enabled for messages table
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    CASE 
        WHEN oid IN (
            SELECT schemaname::regnamespace::oid 
            FROM information_schema.tables 
            WHERE table_name = 'messages'
        ) THEN 'Realtime enabled'
        ELSE 'Realtime not enabled'
    END as realtime_status
FROM pg_tables 
WHERE tablename = 'messages';

-- Check if realtime publication includes messages table
SELECT 
    puballtables,
    pubname,
    pubowner 
FROM pg_publication 
WHERE pubname = 'supabase_realtime';

-- Check what tables are in the realtime publication
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename = 'messages';