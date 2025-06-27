// Test storage connection
// Run with: node scripts/test-storage-connection.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for testing

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Make sure you have EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStorageConnection() {
  console.log('🧪 Testing Supabase storage connection...');
  
  try {
    // Test 1: List buckets
    console.log('\n1. Testing bucket access...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Failed to list buckets:', bucketsError);
      return;
    }
    
    console.log('✅ Found buckets:', buckets.map(b => b.name));
    
    // Test 2: Check if posts-media bucket exists
    const postsMediaBucket = buckets.find(b => b.name === 'posts-media');
    if (!postsMediaBucket) {
      console.error('❌ posts-media bucket not found!');
      console.log('📝 Please create the posts-media bucket in your Supabase dashboard');
      return;
    }
    
    console.log('✅ posts-media bucket found');
    console.log('   - Public:', postsMediaBucket.public);
    console.log('   - Created:', postsMediaBucket.created_at);
    
    // Test 3: Try to list files in posts-media
    console.log('\n2. Testing bucket permissions...');
    const { data: files, error: filesError } = await supabase.storage
      .from('posts-media')
      .list('', { limit: 1 });
    
    if (filesError) {
      console.error('❌ Failed to access posts-media bucket:', filesError);
      console.log('📝 Make sure you ran the storage policies SQL script');
      return;
    }
    
    console.log('✅ Can access posts-media bucket');
    console.log('   - Current files:', files.length);
    
    // Test 4: Test upload (create a simple text file)
    console.log('\n3. Testing upload...');
    const testContent = new Blob(['Hello from SnapConnect!'], { type: 'text/plain' });
    const testPath = 'test/connection-test.txt';
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('posts-media')
      .upload(testPath, testContent, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (uploadError) {
      console.error('❌ Upload test failed:', uploadError);
      console.log('📝 Check your storage policies - upload might be restricted');
      return;
    }
    
    console.log('✅ Upload test successful');
    
    // Test 5: Test public URL generation
    console.log('\n4. Testing public URL...');
    const { data: urlData } = supabase.storage
      .from('posts-media')
      .getPublicUrl(testPath);
    
    console.log('✅ Public URL generated:', urlData.publicUrl);
    
    // Clean up test file
    await supabase.storage
      .from('posts-media')
      .remove([testPath]);
    
    console.log('\n🎉 All tests passed! Storage is ready for your app.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testStorageConnection();