-- Create posts-media storage bucket and policies
-- Run this in your Supabase SQL Editor

-- Create the posts-media bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('posts-media', 'posts-media', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own posts media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view posts media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own posts media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own posts media" ON storage.objects;

-- Policy 1: Allow authenticated users to upload their own media
CREATE POLICY "Users can upload their own posts media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'posts-media' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Allow public access to view all posts media
CREATE POLICY "Anyone can view posts media" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'posts-media');

-- Policy 3: Allow users to update their own media
CREATE POLICY "Users can update their own posts media" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'posts-media' AND 
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'posts-media' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Allow users to delete their own media
CREATE POLICY "Users can delete their own posts media" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'posts-media' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;