# Supabase Storage Setup Guide for Avatars

## Quick Setup

1. **Go to your Supabase Dashboard**
   - Navigate to your project
   - Click on "SQL Editor" in the left sidebar

2. **Copy and paste the SQL from `scripts/setup-storage-policies.sql`**
   - The script will:
     - Make the avatars bucket public
     - Create policies for authenticated users to manage their own avatars
     - Allow public read access to all avatars

3. **Run the SQL**
   - Click "Run" to execute the policies

## Manual Setup (Alternative)

If you prefer using the UI:

1. **Go to Storage → Buckets**
   - Find the "avatars" bucket
   - Click the three dots menu → Edit bucket
   - Toggle "Public bucket" to ON
   - Save changes

2. **Go to Storage → Policies**
   - Click "New Policy" for the avatars bucket
   - Create these policies:

### Policy 1: Upload Policy
- **Name**: Users can upload their own avatar
- **Policy**: INSERT
- **Target roles**: authenticated
- **WITH CHECK expression**: 
  ```sql
  bucket_id = 'avatars' AND 
  auth.uid()::text = (regexp_split_to_array(name, '-'))[2]
  ```

### Policy 2: View Policy
- **Name**: Anyone can view avatars
- **Policy**: SELECT
- **Target roles**: public
- **USING expression**: 
  ```sql
  bucket_id = 'avatars'
  ```

### Policy 3: Update Policy
- **Name**: Users can update their own avatar
- **Policy**: UPDATE
- **Target roles**: authenticated
- **USING expression**: 
  ```sql
  bucket_id = 'avatars' AND 
  auth.uid()::text = (regexp_split_to_array(name, '-'))[2]
  ```
- **WITH CHECK expression**: (same as USING)

### Policy 4: Delete Policy
- **Name**: Users can delete their own avatar
- **Policy**: DELETE
- **Target roles**: authenticated
- **USING expression**: 
  ```sql
  bucket_id = 'avatars' AND 
  auth.uid()::text = (regexp_split_to_array(name, '-'))[2]
  ```

## Testing the Setup

1. Try creating a new account and uploading an avatar
2. The avatar should appear on the onboarding complete screen
3. You should be able to change it from the profile screen
4. Other users should be able to see your avatar

## File Naming Convention

The app uploads files with this pattern: `avatars/{userId}-{timestamp}.{extension}`

This ensures:
- Each user's avatars are identifiable by their user ID
- Multiple uploads don't overwrite each other
- The policies can match files to their owners

## Troubleshooting

### "Policy violation" errors
- Make sure the bucket is set to public
- Verify all 4 policies are created
- Check that you're authenticated when uploading

### "Bucket not found" errors
- Ensure the bucket name is exactly "avatars"
- Verify the bucket exists in your Supabase project

### Images not displaying
- Verify the bucket is public
- Check that the public URL is being generated correctly
- Test the URL directly in a browser