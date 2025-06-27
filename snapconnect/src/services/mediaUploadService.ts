import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
// import * as VideoThumbnails from 'expo-video-thumbnails'; // Temporarily disabled until dev client rebuild
import { supabase } from './supabase';
import { MediaFile } from '../types/media';

export interface UploadProgress {
  progress: number; // 0-100
  isCompleted: boolean;
  error?: string;
}

export interface UploadedMedia {
  url: string;
  thumbnailUrl?: string;
  posterUrl?: string; // For video poster frames
  mediaType: 'photo' | 'video';
  size: number;
  duration?: number;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export class MediaUploadService {
  private static instance: MediaUploadService;
  private uploadQueue: Map<string, AbortController> = new Map();

  public static getInstance(): MediaUploadService {
    if (!MediaUploadService.instance) {
      MediaUploadService.instance = new MediaUploadService();
    }
    return MediaUploadService.instance;
  }

  /**
   * Generate optimized thumbnail for feed display
   */
  async generateThumbnail(
    uri: string,
    options: CompressionOptions = {}
  ): Promise<{ uri: string; size: number }> {
    try {
      const cleanUri = uri.startsWith('file://file://') ? uri.replace('file://file://', 'file://') : uri;
      
      console.log('🖼️ Starting thumbnail generation');
      console.log('🖼️ Original URI:', uri);
      console.log('🖼️ Thumbnail options:', options);
      
      const {
        maxWidth = 600,   // Optimized for mobile feed display
        maxHeight = 600,  // Square thumbnails for consistent layout
        quality = 0.95,   // High quality for crisp thumbnails
      } = options;

      const result = await ImageManipulator.manipulateAsync(
        cleanUri,
        [
          {
            resize: {
              width: maxWidth,
              height: maxHeight,
            },
          },
        ],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      console.log('🖼️ Thumbnail generated:', result.width, 'x', result.height);
      
      // Get file size
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      console.log('🖼️ Thumbnail size:', fileInfo.size, 'bytes');
      
      return {
        uri: result.uri,
        size: fileInfo.exists ? fileInfo.size : 0,
      };
    } catch (error) {
      console.error('🖼️ Thumbnail generation failed:', error);
      throw new Error(`Thumbnail generation failed: ${error.message}`);
    }
  }

  /**
   * Compress image for optimal upload
   */
  async compressImage(
    uri: string,
    options: CompressionOptions = {}
  ): Promise<{ uri: string; size: number }> {
    try {
      // Fix double file:// prefix issue
      const cleanUri = uri.startsWith('file://file://') ? uri.replace('file://file://', 'file://') : uri;
      
      console.log('🖼️ Starting image compression');
      console.log('🖼️ Original image URI:', uri);
      console.log('🖼️ Cleaned image URI:', cleanUri);
      console.log('🖼️ Compression options:', options);
      
      // First verify the original image exists and is valid
      const originalFileInfo = await FileSystem.getInfoAsync(cleanUri);
      console.log('🖼️ Original file info:', JSON.stringify(originalFileInfo, null, 2));
      
      if (!originalFileInfo.exists) {
        throw new Error(`Original image file does not exist: ${cleanUri}`);
      }
      
      if (originalFileInfo.size === 0) {
        throw new Error(`Original image file is empty (0 bytes): ${cleanUri}`);
      }
      
      const {
        maxWidth = 1920,  // Higher default resolution
        maxHeight = 1920, // Support modern camera resolutions 
        quality = 0.9,    // Higher default quality (90%)
      } = options;

      const result = await ImageManipulator.manipulateAsync(
        cleanUri,
        [
          {
            resize: {
              width: maxWidth,
              height: maxHeight,
            },
          },
        ],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      console.log('🖼️ ImageManipulator completed');
      console.log('🖼️ Compressed image result:', JSON.stringify(result, null, 2));
      console.log('🖼️ Original URI:', uri);
      console.log('🖼️ Compressed URI:', result.uri);
      console.log('🖼️ Compressed dimensions:', result.width, 'x', result.height);
      console.log('🖼️ Result has base64:', !!result.base64);
      
      // Immediately check if the compressed file exists
      try {
        const immediateCheck = await FileSystem.getInfoAsync(result.uri);
        console.log('🖼️ Immediate post-compression file check:', immediateCheck);
        if (!immediateCheck.exists) {
          console.error('🖼️ CRITICAL: ImageManipulator returned success but file does not exist!');
        }
      } catch (checkError) {
        console.error('🖼️ Error immediately checking compressed file:', checkError);
      }

      // Get file size from FileSystem with detailed debugging
      let size = 0;
      try {
        console.log('🖼️ Checking compressed file info for:', result.uri);
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        console.log('🖼️ Compressed file info:', JSON.stringify(fileInfo, null, 2));
        
        if (!fileInfo.exists) {
          console.error('🖼️ CRITICAL: Compressed file does not exist!');
          console.error('🖼️ ImageManipulator returned URI but file missing:', result.uri);
        }
        
        size = fileInfo.exists ? fileInfo.size : 0;
        console.log('🖼️ Compressed file size:', size, 'bytes');
        
        if (size === 0) {
          console.error('🖼️ CRITICAL: ImageManipulator created 0-byte file!');
          console.error('🖼️ This is the root cause of the upload issue');
        }
      } catch (sizeError) {
        console.error('🖼️ Error checking compressed file size:', sizeError);
        // Fallback to blob size check
        try {
          console.log('🖼️ Trying fallback blob size check...');
          const sizeResponse = await fetch(result.uri);
          const sizeBlob = await sizeResponse.blob();
          size = sizeBlob.size;
          console.log('🖼️ Fallback blob size:', size);
        } catch (blobError) {
          console.error('🖼️ Fallback blob size check also failed:', blobError);
        }
      }

      return {
        uri: result.uri,
        size,
      };
    } catch (error) {
      console.error('🖼️ ImageManipulator error:', error);
      console.error('🖼️ Error type:', typeof error);
      console.error('🖼️ Error message:', error?.message);
      console.error('🖼️ Error stack:', error?.stack);
      throw new Error(`Image compression failed: ${error.message}`);
    }
  }

  /**
   * Generate video thumbnail from first frame (temporarily disabled)
   */
  async generateVideoThumbnail(uri: string): Promise<{ uri: string; size: number }> {
    console.warn('🎬 Video thumbnails temporarily disabled - expo-video-thumbnails needs dev client rebuild');
    throw new Error('Video thumbnails temporarily disabled - rebuild development client to enable');
  }

  /**
   * Process video for upload with thumbnail generation
   */
  async processVideo(uri: string): Promise<{ uri: string; size: number; thumbnailUri?: string }> {
    try {
      console.log('🎥 Processing video for upload');
      console.log('🎥 Original video URI:', uri);
      
      // Get video file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('🎥 Video file info:', JSON.stringify(fileInfo, null, 2));
      
      if (!fileInfo.exists) {
        throw new Error(`Video file does not exist: ${uri}`);
      }
      
      if (fileInfo.size === 0) {
        throw new Error(`Video file is empty (0 bytes): ${uri}`);
      }
      
      console.log('🎥 Video ready for upload - size:', fileInfo.size, 'bytes');
      
      // Generate video thumbnail
      let thumbnailUri: string | undefined;
      try {
        const thumbnail = await this.generateVideoThumbnail(uri);
        thumbnailUri = thumbnail.uri;
        console.log('🎥 Video thumbnail generated successfully');
      } catch (thumbnailError) {
        console.warn('🎥 Video thumbnail generation failed, continuing without:', thumbnailError);
        // Continue without thumbnail rather than failing entire upload
      }
      
      return {
        uri,
        size: fileInfo.size,
        thumbnailUri,
      };
    } catch (error) {
      console.error('🎥 Error processing video:', error);
      throw new Error(`Failed to process video: ${error.message}`);
    }
  }

  /**
   * Upload media file to Supabase storage
   */
  async uploadMedia(
    media: MediaFile,
    userId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadedMedia> {
    const uploadId = `${userId}-${Date.now()}`;
    const abortController = new AbortController();
    this.uploadQueue.set(uploadId, abortController);

    try {
      // Process media with thumbnails for unified display
      let processedMedia: { uri: string; size: number; thumbnailUri?: string };
      let thumbnailMedia: { uri: string; size: number } | null = null;
      
      if (media.type === 'photo') {
        try {
          // Compress main image for storage
          processedMedia = await this.compressImage(media.uri, {
            maxWidth: 1920,  // High resolution for full-screen viewing
            maxHeight: 1920, // Support modern camera resolutions
            quality: 0.9,    // High quality (90%)
          });
          
          // Generate optimized thumbnail for feed display
          thumbnailMedia = await this.generateThumbnail(media.uri, {
            maxWidth: 600,   // Optimized for mobile feed
            maxHeight: 600,  // Square thumbnails for consistency
            quality: 0.95,   // Higher quality for crisp thumbnails
          });
          
          console.log('📸 Photo processed with thumbnail for feed display');
        } catch (compressionError) {
          console.warn('Image processing failed, using original:', compressionError);
          // Use original image if processing fails
          processedMedia = {
            uri: media.uri,
            size: 0, // Size will be determined when creating blob
          };
        }
      } else {
        // Process video with thumbnail generation
        processedMedia = await this.processVideo(media.uri);
        
        // Video thumbnail is handled in processVideo function
        if (processedMedia.thumbnailUri) {
          const thumbnailFileInfo = await FileSystem.getInfoAsync(processedMedia.thumbnailUri);
          thumbnailMedia = {
            uri: processedMedia.thumbnailUri,
            size: thumbnailFileInfo.exists ? thumbnailFileInfo.size : 0,
          };
        }
      }

      onProgress?.({ progress: 20, isCompleted: false });

      // Generate file path
      const fileExtension = media.type === 'photo' ? 'jpg' : 'mp4';
      const fileName = `${uploadId}.${fileExtension}`;
      const filePath = `${userId}/${fileName}`;

      // Verify file exists and get info before creating blob
      console.log('📤 Checking file exists:', processedMedia.uri);
      const fileInfo = await FileSystem.getInfoAsync(processedMedia.uri);
      console.log('📤 File info:', JSON.stringify(fileInfo, null, 2));
      
      if (!fileInfo.exists) {
        throw new Error(`Media file does not exist: ${processedMedia.uri}`);
      }
      
      if (fileInfo.size === 0) {
        console.error('📤 CRITICAL: FileSystem reports file size as 0!');
        console.error('📤 This means the compressed image file is empty');
        throw new Error(`Media file is empty (0 bytes): ${processedMedia.uri}`);
      }
      
      // Skip blob creation - FileSystem.uploadAsync will handle file reading natively
      console.log('📤 Skipping blob creation, using direct file upload');
      console.log('📤 File ready for upload - size:', fileInfo.size, 'bytes');

      onProgress?.({ progress: 40, isCompleted: false });

      // Upload to Supabase storage
      console.log('📤 Starting Supabase upload...');
      console.log('📤 File path:', filePath);
      console.log('📤 Bucket: posts-media');
      console.log('📤 User ID:', userId);
      console.log('📤 File size for upload:', processedMedia.size, 'bytes');
      console.log('📤 Media type:', media.type);
      
      // Use Expo FileSystem.uploadAsync instead of supabase client to avoid RN Blob issues
      console.log('📤 Using Expo FileSystem.uploadAsync for React Native compatibility');
      
      // Get auth session for authorization header
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No auth token available for upload');
      }
      
      // Build Supabase storage URL
      const supabaseUrl = supabase.supabaseUrl;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/posts-media/${filePath}`;
      console.log('📤 Upload URL:', uploadUrl);
      
      // Upload using Expo FileSystem (bypasses blob issues)
      console.log('📤 Starting FileSystem.uploadAsync...');
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, processedMedia.uri, {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': media.type === 'video' ? 'video/mp4' : 'image/jpeg',
          'cache-control': '3600',
          'x-upsert': 'false',
        },
      });
      
      console.log('📤 FileSystem.uploadAsync result:', uploadResult);
      console.log('📤 Upload status:', uploadResult.status);
      
      if (uploadResult.status !== 200) {
        console.error('📤 Upload failed with status:', uploadResult.status);
        console.error('📤 Upload body:', uploadResult.body);
        throw new Error(`Upload failed with status ${uploadResult.status}: ${uploadResult.body}`);
      }
      
      // Parse response
      let data, error;
      try {
        const responseData = JSON.parse(uploadResult.body);
        if (responseData.error) {
          error = responseData.error;
        } else {
          data = responseData;
        }
      } catch (parseError) {
        console.log('📤 Upload completed, assuming success (non-JSON response)');
        data = { path: filePath };
      }

      console.log('📤 Upload response - data:', JSON.stringify(data, null, 2));
      console.log('📤 Upload response - error:', JSON.stringify(error, null, 2));

      if (error) {
        console.error('📤 Upload error details:', JSON.stringify(error, null, 2));
        console.error('📤 Error code:', error.statusCode);
        console.error('📤 Error message:', error.message);
        throw new Error(`Upload failed: ${error.message}`);
      }
      
      console.log('📤 Upload successful! File uploaded to:', data?.path);
      console.log('📤 Upload response fullPath:', data?.fullPath);
      console.log('📤 Upload response id:', data?.id);
      
      // Immediately verify the uploaded file
      try {
        console.log('🔍 Verifying uploaded file...');
        const { data: listData, error: listError } = await supabase.storage
          .from('posts-media')
          .list(userId, { search: fileName });
          
        if (listError) {
          console.error('🔍 File verification failed:', listError);
        } else {
          const uploadedFile = listData?.find(file => file.name === fileName);
          if (uploadedFile) {
            console.log('🔍 Uploaded file verification:');
            console.log('🔍 - Name:', uploadedFile.name);
            console.log('🔍 - Size:', uploadedFile.metadata?.size || 'unknown');
            console.log('🔍 - Content type:', uploadedFile.metadata?.mimetype || 'unknown');
            console.log('🔍 - Created at:', uploadedFile.created_at);
            
            if (uploadedFile.metadata?.size === 0) {
              console.error('📤 CRITICAL: File uploaded but shows 0 bytes in Supabase!');
              console.error('📤 Original file size was:', processedMedia.size);
            }
          } else {
            console.error('🔍 File not found in listing after upload');
          }
        }
      } catch (verifyError) {
        console.error('🔍 File verification error:', verifyError);
      }

      onProgress?.({ progress: 70, isCompleted: false });

      // Get public URL
      console.log('📤 Getting public URL for:', filePath);
      const { data: urlData } = supabase.storage
        .from('posts-media')
        .getPublicUrl(filePath);
      
      console.log('📤 Public URL data:', urlData);
      console.log('📤 Public URL:', urlData?.publicUrl);

      onProgress?.({ progress: 90, isCompleted: false });

      // Upload thumbnail for both photos and videos
      let thumbnailUrl: string | undefined;
      if (thumbnailMedia) {
        try {
          console.log('📤 Uploading thumbnail...');
          const thumbnailPath = `${userId}/thumbnails/${uploadId}_thumb.jpg`;
          
          // Upload thumbnail using FileSystem.uploadAsync for consistency
          const thumbnailUploadUrl = `${supabaseUrl}/storage/v1/object/posts-media/${thumbnailPath}`;
          console.log('📤 Thumbnail upload URL:', thumbnailUploadUrl);
          
          const thumbnailUploadResult = await FileSystem.uploadAsync(thumbnailUploadUrl, thumbnailMedia.uri, {
            httpMethod: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'image/jpeg',
              'cache-control': '3600',
              'x-upsert': 'false',
            },
          });
          
          console.log('📤 Thumbnail upload result:', thumbnailUploadResult.status);
          
          if (thumbnailUploadResult.status === 200) {
            const { data: thumbnailUrlData } = supabase.storage
              .from('posts-media')
              .getPublicUrl(thumbnailPath);

            thumbnailUrl = thumbnailUrlData.publicUrl;
            console.log('📤 Thumbnail uploaded successfully:', thumbnailUrl);
          } else {
            console.warn('📤 Thumbnail upload failed, continuing without thumbnail');
          }
        } catch (thumbnailError) {
          console.warn('📤 Thumbnail upload failed:', thumbnailError);
          // Continue without thumbnail rather than failing entire upload
        }
      }

      onProgress?.({ progress: 100, isCompleted: true });

      return {
        url: urlData.publicUrl,
        thumbnailUrl,
        mediaType: media.type,
        size: processedMedia.size,
        duration: media.duration,
      };
    } catch (error) {
      const uploadError = error instanceof Error ? error.message : 'Upload failed';
      onProgress?.({ progress: 0, isCompleted: false, error: uploadError });
      throw error;
    } finally {
      this.uploadQueue.delete(uploadId);
    }
  }

  /**
   * Cancel an ongoing upload
   */
  cancelUpload(uploadId: string): void {
    const controller = this.uploadQueue.get(uploadId);
    if (controller) {
      controller.abort();
      this.uploadQueue.delete(uploadId);
    }
  }

  /**
   * Cancel all ongoing uploads
   */
  cancelAllUploads(): void {
    this.uploadQueue.forEach((controller) => {
      controller.abort();
    });
    this.uploadQueue.clear();
  }

  /**
   * Delete media from storage
   */
  async deleteMedia(filePath: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from('posts-media')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting media:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting media:', error);
      return false;
    }
  }

  /**
   * Batch upload multiple media files
   */
  async uploadMultipleMedia(
    mediaFiles: MediaFile[],
    userId: string,
    onProgress?: (overall: number, individual: UploadProgress[]) => void
  ): Promise<UploadedMedia[]> {
    const results: UploadedMedia[] = [];
    const progressTrackers: UploadProgress[] = mediaFiles.map(() => ({
      progress: 0,
      isCompleted: false,
    }));

    const updateOverallProgress = () => {
      const totalProgress = progressTrackers.reduce((sum, tracker) => sum + tracker.progress, 0);
      const overallProgress = totalProgress / mediaFiles.length;
      onProgress?.(overallProgress, [...progressTrackers]);
    };

    for (let i = 0; i < mediaFiles.length; i++) {
      try {
        const media = mediaFiles[i];
        const result = await this.uploadMedia(media, userId, (progress) => {
          progressTrackers[i] = progress;
          updateOverallProgress();
        });
        results.push(result);
      } catch (error) {
        progressTrackers[i] = {
          progress: 0,
          isCompleted: false,
          error: error instanceof Error ? error.message : 'Upload failed',
        };
        updateOverallProgress();
        throw error;
      }
    }

    return results;
  }

  /**
   * Get storage usage for a user
   */
  async getStorageUsage(userId: string): Promise<{ totalSize: number; fileCount: number }> {
    try {
      const { data, error } = await supabase.storage
        .from('posts-media')
        .list(userId, {
          limit: 1000, // Adjust as needed
        });

      if (error) {
        throw error;
      }

      const totalSize = data?.reduce((sum, file) => sum + (file.metadata?.size || 0), 0) || 0;
      const fileCount = data?.length || 0;

      return { totalSize, fileCount };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { totalSize: 0, fileCount: 0 };
    }
  }

  /**
   * Clean up expired media files
   */
  async cleanupExpiredMedia(userId: string, olderThanDays: number = 1): Promise<number> {
    try {
      const { data, error } = await supabase.storage
        .from('posts-media')
        .list(userId);

      if (error || !data) {
        return 0;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const expiredFiles = data.filter(file => {
        const fileDate = new Date(file.created_at);
        return fileDate < cutoffDate;
      });

      if (expiredFiles.length === 0) {
        return 0;
      }

      const filePaths = expiredFiles.map(file => `${userId}/${file.name}`);
      const { error: deleteError } = await supabase.storage
        .from('posts-media')
        .remove(filePaths);

      if (deleteError) {
        console.error('Error cleaning up expired media:', deleteError);
        return 0;
      }

      return expiredFiles.length;
    } catch (error) {
      console.error('Error cleaning up expired media:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const mediaUploadService = MediaUploadService.getInstance();