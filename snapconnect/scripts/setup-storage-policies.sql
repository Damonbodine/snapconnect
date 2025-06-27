-- Storage policies for avatars bucket in Supabase
-- Run these in your Supabase SQL Editor

-- First, ensure the bucket exists and is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'avatars';

-- Policy 1: Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (
bucket_id = 'avatars' AND 
(storage.foldername(name))[1] = 'avatars' AND
auth.uid()::text = (regexp_split_to_array(name, '-'))[2]
);

-- Policy 2: Allow public to view all avatars
CREATE POLICY "Anyone can view avatars" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'avatars');

-- Policy 3: Allow users to update their own avatars
CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
TO authenticated 
USING (
bucket_id = 'avatars' AND 
auth.uid()::text = (regexp_split_to_array(name, '-'))[2]
)
WITH CHECK (
bucket_id = 'avatars' AND 
auth.uid()::text = (regexp_split_to_array(name, '-'))[2]
);

-- Policy 4: Allow users to delete their own avatars
CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (
bucket_id = 'avatars' AND 
auth.uid()::text = (regexp_split_to_array(name, '-'))[2]
);

-- To verify policies were created, you can check them in the Supabase Dashboard
-- Go to Storage → Policies tab to see all policies for the avatars bucket