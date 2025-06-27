# Posts Media Storage Setup Guide

## Overview
This guide helps you set up the `posts-media` storage bucket in Supabase for handling ephemeral photo and video content in SnapConnect.

## Quick Setup

1. **Go to your Supabase Dashboard**
   - Navigate to your project
   - Click on "SQL Editor" in the left sidebar

2. **Copy and paste the SQL from `scripts/setup-posts-media-storage.sql`**
   - The script will:
     - Create the `posts-media` bucket as a public bucket
     - Set up policies for authenticated users to manage their own media
     - Allow public read access to all media (for ephemeral sharing)
     - Enable Row Level Security (RLS)

3. **Run the SQL**
   - Click "Run" to execute the policies

## Storage Structure

The storage follows this structure:
```
posts-media/
├── {userId}/
│   ├── {uploadId}.jpg          # Photo files
│   ├── {uploadId}.mp4          # Video files
│   └── thumbnails/
│       └── {uploadId}_thumb.jpg # Video thumbnails
```

## File Naming Convention

Files are uploaded with this pattern: `{userId}/{uploadId}.{extension}`

Where:
- `userId`: The authenticated user's UUID
- `uploadId`: Unique identifier combining userId and timestamp
- `extension`: `jpg` for photos, `mp4` for videos

This ensures:
- Each user's media is organized in their own folder
- Files are uniquely named to prevent conflicts
- Policies can match files to their owners
- Easy cleanup of expired content

## Storage Policies

### 1. Upload Policy
- **Name**: Users can upload their own posts media
- **Action**: INSERT
- **Target**: authenticated users
- **Rule**: Users can only upload to their own folder

### 2. View Policy  
- **Name**: Anyone can view posts media
- **Action**: SELECT
- **Target**: public access
- **Rule**: All media is publicly viewable (for ephemeral sharing)

### 3. Update Policy
- **Name**: Users can update their own posts media
- **Action**: UPDATE
- **Target**: authenticated users
- **Rule**: Users can only update their own files

### 4. Delete Policy
- **Name**: Users can delete their own posts media
- **Action**: DELETE
- **Target**: authenticated users
- **Rule**: Users can only delete their own files

## File Size Limits

Recommended limits:
- **Photos**: Max 10MB (compressed to ~2MB on upload)
- **Videos**: Max 50MB for 10-second clips (compressed to ~10MB)
- **Total per user**: Monitor usage and implement quotas as needed

## Ephemeral Content Management

The MediaUploadService includes automatic cleanup:
- `cleanupExpiredMedia()`: Removes files older than specified days
- Default: 24 hours for ephemeral content
- Can be customized per post type

## Testing the Setup

1. **Test Upload**: Try uploading a photo through the camera
2. **Test Access**: Verify uploaded media displays in the feed
3. **Test Permissions**: Ensure users can't access others' upload folders
4. **Test Cleanup**: Verify expired content gets removed

## Manual Bucket Creation (Alternative)

If you prefer using the Supabase Dashboard UI:

1. **Go to Storage → Buckets**
   - Click "New bucket"
   - Name: `posts-media`
   - Set as Public: ✅
   - Create bucket

2. **Go to Storage → Policies**
   - Click "New Policy" for the posts-media bucket
   - Create the 4 policies listed above using the provided SQL expressions

## Troubleshooting

### "Policy violation" errors
- Verify the bucket is set to public
- Ensure all 4 policies are created and active
- Check that the user is authenticated when uploading
- Verify the file path follows the correct structure

### "Bucket not found" errors
- Ensure the bucket name is exactly "posts-media"
- Verify the bucket exists in your Supabase project
- Check that the bucket creation SQL ran successfully

### Upload failures
- Check file size limits
- Verify internet connection
- Ensure the media file is valid
- Check Supabase storage quotas

### Media not displaying
- Verify the bucket is public
- Test the public URL directly in a browser
- Check that the file was uploaded successfully
- Ensure the correct URL format is being used

## Security Considerations

- **Public bucket**: Media is publicly accessible via URL
- **User isolation**: Users can only manage their own files
- **Ephemeral nature**: Content auto-expires for privacy
- **No sensitive data**: Don't store sensitive information in filenames

## Monitoring & Maintenance

- Monitor storage usage in Supabase dashboard
- Set up alerts for storage quotas
- Regularly run cleanup jobs for expired content
- Monitor upload/download patterns for optimization