// Simple storage test using anon key (like the app does)
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBasicAccess() {
  console.log('🧪 Testing basic storage access...');
  
  try {
    // Test: Try to access the posts-media bucket directly
    console.log('1. Testing posts-media bucket access...');
    const { data: files, error } = await supabase.storage
      .from('posts-media')
      .list('', { limit: 1 });
    
    if (error) {
      console.error('❌ Cannot access posts-media bucket:', error.message);
      console.log('📝 This usually means:');
      console.log('   - Bucket doesn\'t exist');
      console.log('   - Missing RLS policies');
      console.log('   - Bucket is not public');
      return;
    }
    
    console.log('✅ posts-media bucket is accessible!');
    console.log('   Current files:', files.length);
    
    // Test: Try to upload a test file
    console.log('\n2. Testing file upload...');
    const testContent = new Blob(['test'], { type: 'text/plain' });
    const testPath = 'test-file.txt';
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('posts-media')
      .upload(testPath, testContent, { upsert: true });
    
    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message);
      console.log('📝 Check your upload policies in Supabase dashboard');
      return;
    }
    
    console.log('✅ Upload successful!');
    
    // Test: Get public URL
    const { data: urlData } = supabase.storage
      .from('posts-media')
      .getPublicUrl(testPath);
    
    console.log('✅ Public URL:', urlData.publicUrl);
    
    // Clean up
    await supabase.storage.from('posts-media').remove([testPath]);
    console.log('\n🎉 All tests passed! Your camera uploads should work.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testBasicAccess();