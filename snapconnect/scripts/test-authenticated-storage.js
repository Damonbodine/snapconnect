// Test storage with actual authentication
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWithAuth() {
  console.log('🧪 Testing storage with authentication...');
  
  try {
    // For testing, create a test user or sign in with existing credentials
    // Replace these with actual test credentials
    const testEmail = 'test@example.com';
    const testPassword = 'testpassword123';
    
    console.log('🔐 Attempting to sign in...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (authError) {
      console.log('❌ Sign in failed:', authError.message);
      console.log('🔐 Attempting to sign up new test user...');
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword
      });
      
      if (signUpError) {
        console.error('❌ Sign up also failed:', signUpError.message);
        console.log('📝 Please create a test user manually or update the credentials in this script');
        return;
      }
      
      console.log('✅ Test user created successfully');
      if (signUpData.user) {
        console.log('✅ User ID:', signUpData.user.id);
      }
    } else {
      console.log('✅ Signed in successfully');
      console.log('✅ User ID:', authData.user.id);
    }
    
    // Get current user to ensure we're authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ Failed to get authenticated user:', userError?.message);
      return;
    }
    
    console.log('✅ Authenticated user confirmed:', user.id);
    
    // Now test upload with authenticated user
    const testContent = new Blob(['test content from authenticated user'], { type: 'text/plain' });
    const testPath = `${user.id}/test-upload.txt`;
    
    console.log('📤 Testing upload to path:', testPath);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('posts-media')
      .upload(testPath, testContent, { upsert: true });
    
    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message);
      console.log('📝 This usually means RLS policies need to be updated');
      console.log('📝 Run the fix-storage-policies.sql file in your Supabase dashboard');
      return;
    }
    
    console.log('✅ Upload successful!');
    console.log('✅ File path:', uploadData.path);
    
    // Test getting public URL
    const { data: urlData } = supabase.storage
      .from('posts-media')
      .getPublicUrl(testPath);
    
    console.log('✅ Public URL:', urlData.publicUrl);
    
    // Clean up
    await supabase.storage.from('posts-media').remove([testPath]);
    console.log('✅ Test file cleaned up');
    
    console.log('🎉 All authenticated storage tests passed!');
    console.log('📱 Your camera uploads should now work correctly');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testWithAuth();