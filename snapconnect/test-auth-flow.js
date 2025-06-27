/**
 * Test the complete authentication flow
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function testAuthenticatedRequest() {
  console.log('🔐 Testing authenticated Edge Function call...\n');
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    // Check current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log('❌ Session error:', sessionError.message);
      return;
    }
    
    if (!session) {
      console.log('❌ No active session found');
      console.log('💡 The user needs to be signed in for this to work');
      return;
    }
    
    console.log('✅ Found active session for user:', session.user.id);
    console.log('🔑 Access token exists:', !!session.access_token);
    
    // Now test the Edge Function with auth
    const { data, error } = await supabase.functions.invoke('generate-agora-token', {
      body: {
        channelName: 'test_channel_' + Date.now(),
        uid: 12345,
        role: 'host',
        userId: session.user.id
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    
    if (error) {
      console.log('❌ Edge Function failed:', error.message);
      if (error.status) {
        console.log('Status:', error.status);
      }
    } else if (data && data.token) {
      console.log('✅ Edge Function success!');
      console.log('Token generated:', data.token.substring(0, 20) + '...');
    } else {
      console.log('⚠️ Unexpected response:', data);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testAuthenticatedRequest();