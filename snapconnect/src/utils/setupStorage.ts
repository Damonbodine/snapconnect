import { supabase } from '../services/supabase';

export async function checkAndSetupAvatarsBucket() {
  try {
    // Try to list files in avatars bucket to check if it exists and is accessible
    const { data, error } = await supabase.storage
      .from('avatars')
      .list('', { limit: 1 });

    if (error) {
      console.log('Avatars bucket check:', error.message);
      // Bucket might not be public or doesn't exist
      return false;
    }

    console.log('✅ Avatars bucket is accessible');
    return true;
  } catch (error) {
    console.error('Error checking avatars bucket:', error);
    return false;
  }
}

// Storage policies that need to be added via Supabase Dashboard SQL editor:
export const STORAGE_POLICIES = `
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public to view avatars
CREATE POLICY "Anyone can view avatars" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'avatars');

-- Allow users to update their own avatars
CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
`;