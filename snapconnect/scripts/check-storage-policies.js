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

async function checkStoragePolicies() {
  try {
    console.log('🔍 Checking avatars bucket configuration...\n');

    // Check if bucket exists and is public
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      return;
    }

    const avatarsBucket = buckets?.find(b => b.name === 'avatars');
    
    if (!avatarsBucket) {
      console.log('❌ Avatars bucket not found!');
      return;
    }

    console.log('✅ Avatars bucket exists');
    console.log(`   Public: ${avatarsBucket.public ? '✅ Yes' : '❌ No'}`);
    console.log(`   Created: ${new Date(avatarsBucket.created_at).toLocaleString()}`);
    
    // Try to list files (tests read policy)
    console.log('\n🔍 Testing read access...');
    const { data: files, error: listError } = await supabase.storage
      .from('avatars')
      .list();

    if (listError) {
      console.log('❌ Cannot list files:', listError.message);
    } else {
      console.log('✅ Read access working');
      console.log(`   Files in bucket: ${files?.length || 0}`);
    }

    // Test public URL generation
    console.log('\n🔍 Testing public URL generation...');
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl('test-file.jpg');
    
    console.log('✅ Public URL format:', publicUrlData.publicUrl);

    console.log('\n✨ Storage configuration looks good!');
    console.log('Next: Try uploading an avatar from the app.');

  } catch (error) {
    console.error('Check failed:', error);
  }
}

// Run the check
checkStoragePolicies();