/**
 * Simple Edge Function Test
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function testFunction() {
  console.log('🧪 Testing Edge Function...');
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    // Test without authentication first (this should fail gracefully)
    const { data, error } = await supabase.functions.invoke('generate-agora-token', {
      body: {
        channelName: 'test_channel',
        uid: 12345,
        role: 'host',
        userId: 'test_user'
      }
    });
    
    console.log('Response data:', data);
    console.log('Response error:', error);
    
    if (error) {
      console.log('Status:', error.status);
      console.log('Details:', error.message);
    }
    
  } catch (err) {
    console.log('Caught error:', err.message);
  }
}

testFunction();