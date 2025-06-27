-- Storage policies for avatars bucket in Supabase
-- Run each policy one at a time in your Supabase SQL Editor

-- Step 1: Make sure the bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'avatars';

-- Step 2: Create upload policy for authenticated users
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'avatars' AND 
  (auth.uid())::text = (storage.foldername(name))[1]
);

-- Step 3: Create public read policy
CREATE POLICY "Anyone can view avatars" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'avatars');

-- Step 4: Create update policy for users to update their own avatars
CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = split_part(name, '-', 1)
)
WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.uid()::text = split_part(name, '-', 1)
);

-- Step 5: Create delete policy for users to delete their own avatars
CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = split_part(name, '-', 1)
);

-- Note: To verify policies were created, check the Supabase Dashboard
-- Go to Storage → Policies tab to see all policies for the avatars bucket