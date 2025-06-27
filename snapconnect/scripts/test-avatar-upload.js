const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing environment variables.');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAvatarBucket() {
  try {
    console.log('🔍 Testing avatars bucket access...\n');

    // Test 1: Try to list files in avatars bucket
    console.log('Test 1: Listing files in avatars bucket...');
    const { data: files, error: listError } = await supabase.storage
      .from('avatars')
      .list();

    if (listError) {
      console.log('❌ List error:', listError.message);
      if (listError.message.includes('not found')) {
        console.log('   → The bucket might not exist or name is different');
      }
    } else {
      console.log('✅ Can list files in avatars bucket');
      console.log(`   Files found: ${files?.length || 0}`);
      if (files && files.length > 0) {
        console.log('   First few files:', files.slice(0, 3).map(f => f.name));
      }
    }

    // Test 2: Check public URL generation
    console.log('\nTest 2: Generating public URL...');
    const testFileName = 'test-avatar.jpg';
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(testFileName);
    
    console.log('✅ Public URL generated:', publicUrlData.publicUrl);

    // Test 3: Try to download from public URL (if bucket is public)
    console.log('\nTest 3: Testing public access...');
    try {
      const response = await fetch(publicUrlData.publicUrl);
      if (response.status === 404) {
        console.log('ℹ️  File not found (expected for test file)');
      } else if (response.status === 400) {
        console.log('❌ Bucket might not be public or doesn\'t exist');
      } else {
        console.log(`✅ Public access response: ${response.status} ${response.statusText}`);
      }
    } catch (fetchError) {
      console.log('❌ Failed to test public URL:', fetchError.message);
    }

    console.log('\n📋 Summary:');
    console.log('- If you see "bucket not found", check the bucket name in Supabase Dashboard');
    console.log('- If you see permission errors, the policies might need adjustment');
    console.log('- Try uploading from the app to see specific error messages');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testAvatarBucket();