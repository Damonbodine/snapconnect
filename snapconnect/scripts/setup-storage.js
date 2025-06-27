const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Make sure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupAvatarsBucket() {
  try {
    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }

    const avatarsBucket = buckets?.find(bucket => bucket.name === 'avatars');
    
    if (avatarsBucket) {
      console.log('✅ Avatars bucket already exists');
      
      // Update bucket to ensure it's public
      const { error: updateError } = await supabase.storage.updateBucket('avatars', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880, // 5MB
      });

      if (updateError) {
        console.error('Error updating bucket:', updateError);
      } else {
        console.log('✅ Avatars bucket updated to public');
      }
    } else {
      // Create the bucket
      const { data, error: createError } = await supabase.storage.createBucket('avatars', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880, // 5MB
      });

      if (createError) {
        console.error('Error creating bucket:', createError);
      } else {
        console.log('✅ Avatars bucket created successfully');
      }
    }

    console.log('\n📋 Storage policies need to be set up via Supabase Dashboard:');
    console.log('1. Go to Storage → Policies');
    console.log('2. Create policies for the avatars bucket to allow:');
    console.log('   - Authenticated users to upload their own avatars');
    console.log('   - Public read access to all avatars');
    console.log('   - Users to update/delete their own avatars');
    
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

// Run the setup
setupAvatarsBucket();