-- Fix storage policies for posts-media bucket
-- This allows authenticated users to upload files

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view media" ON storage.objects;

-- Create new policies for posts-media bucket
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own media" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'posts-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to view their own media
CREATE POLICY "Users can view their own media" ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'posts-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to media (for sharing)
CREATE POLICY "Public can view media" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'posts-media');

-- Allow authenticated users to delete their own media
CREATE POLICY "Users can delete their own media" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'posts-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Make sure the bucket is set to public for read access
UPDATE storage.buckets SET public = true WHERE id = 'posts-media';