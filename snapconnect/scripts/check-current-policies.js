const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables.');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPolicies() {
  try {
    console.log('🔍 Checking current storage configuration...\n');

    // List all buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      return;
    }

    const avatarsBucket = buckets?.find(b => b.name === 'avatars');
    
    if (!avatarsBucket) {
      console.log('❌ Avatars bucket not found!');
      console.log('Available buckets:', buckets?.map(b => b.name).join(', '));
      return;
    }

    console.log('✅ Avatars bucket found');
    console.log(`   ID: ${avatarsBucket.id}`);
    console.log(`   Public: ${avatarsBucket.public}`);
    console.log(`   Created: ${avatarsBucket.created_at}`);
    console.log(`   File size limit: ${avatarsBucket.file_size_limit || 'None'}`);
    console.log(`   Allowed MIME types: ${avatarsBucket.allowed_mime_types?.join(', ') || 'All'}`);

    // Try a test upload with service role key (bypasses RLS)
    console.log('\n🧪 Testing upload with service role key...');
    const testFileName = `test-${Date.now()}.txt`;
    const testContent = 'This is a test file';
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(testFileName, new TextEncoder().encode(testContent), {
        contentType: 'text/plain',
        upsert: true
      });

    if (uploadError) {
      console.log('❌ Test upload failed:', uploadError);
    } else {
      console.log('✅ Test upload succeeded');
      
      // Clean up test file
      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove([testFileName]);
      
      if (!deleteError) {
        console.log('✅ Test file cleaned up');
      }
    }

    console.log('\n📋 Recommendations:');
    console.log('1. Make sure the bucket is set to public: ' + (avatarsBucket.public ? '✅' : '❌'));
    console.log('2. Check RLS policies in Supabase Dashboard → Storage → Policies');
    console.log('3. Ensure policies allow authenticated users to INSERT');

  } catch (error) {
    console.error('Check failed:', error);
  }
}

// Run the check
checkPolicies();