-- Simple Storage policies for avatars bucket
-- Run these in Supabase SQL Editor

-- Step 1: Make sure the bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'avatars';

-- Step 2: Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Step 3: Create simple upload policy - any authenticated user can upload
CREATE POLICY "Authenticated users can upload avatars" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'avatars');

-- Step 4: Create public read policy
CREATE POLICY "Anyone can view avatars" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'avatars');

-- Step 5: Create update policy - any authenticated user can update
CREATE POLICY "Authenticated users can update avatars" 
ON storage.objects 
FOR UPDATE 
TO authenticated 
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

-- Step 6: Create delete policy - any authenticated user can delete
CREATE POLICY "Authenticated users can delete avatars" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (bucket_id = 'avatars');

-- Note: These are simplified policies that allow any authenticated user
-- to manage any avatar. For production, you'd want to restrict to user's own files.