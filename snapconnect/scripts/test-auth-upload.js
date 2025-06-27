// Test authenticated upload
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuthenticatedUpload() {
  console.log('🧪 Testing authenticated upload...');
  
  try {
    // Check current auth status
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('❌ Auth error:', authError.message);
      return;
    }
    
    if (!user) {
      console.log('❌ No user authenticated');
      console.log('📝 You need to log in to test uploads');
      console.log('📝 The app requires authentication for uploads due to RLS policies');
      return;
    }
    
    console.log('✅ User authenticated:', user.id);
    
    // Test upload with authenticated user
    const testContent = new Blob(['test from authenticated user'], { type: 'text/plain' });
    const testPath = `${user.id}/test-auth-upload.txt`;
    
    console.log('📤 Attempting upload to path:', testPath);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('posts-media')
      .upload(testPath, testContent, { upsert: true });
    
    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message);
      console.log('📝 Check your RLS policies');
      return;
    }
    
    console.log('✅ Upload successful!');
    console.log('✅ File path:', uploadData.path);
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('posts-media')
      .getPublicUrl(testPath);
    
    console.log('✅ Public URL:', urlData.publicUrl);
    
    // Clean up
    await supabase.storage.from('posts-media').remove([testPath]);
    console.log('🧹 Cleaned up test file');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testAuthenticatedUpload();