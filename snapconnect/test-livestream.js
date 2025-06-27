/**
 * Live Streaming Test Script
 * Run this to test the live streaming functionality
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDatabase() {
  console.log('🔍 Testing database schema...');
  
  try {
    // Test if live_streams table exists
    const { data: streams, error: streamsError } = await supabase
      .from('live_streams')
      .select('*')
      .limit(1);
      
    if (streamsError) {
      console.error('❌ live_streams table error:', streamsError.message);
      return false;
    }
    
    // Test if stream_participants table exists
    const { data: participants, error: participantsError } = await supabase
      .from('stream_participants')
      .select('*')
      .limit(1);
      
    if (participantsError) {
      console.error('❌ stream_participants table error:', participantsError.message);
      return false;
    }
    
    // Test if events table has new columns
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, location_type, stream_id, is_live')
      .limit(1);
      
    if (eventsError) {
      console.error('❌ events table migration error:', eventsError.message);
      return false;
    }
    
    console.log('✅ Database schema is correct');
    return true;
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    return false;
  }
}

async function testEdgeFunction() {
  console.log('🔍 Testing Edge Function...');
  
  try {
    // Test the edge function endpoint
    const { data, error } = await supabase.functions.invoke('generate-agora-token', {
      body: {
        channelName: 'test_channel',
        uid: 12345,
        role: 'host',
        userId: 'test_user_id'
      }
    });
    
    if (error) {
      console.error('❌ Edge Function error:', error.message);
      return false;
    }
    
    console.log('✅ Edge Function is deployed and responding');
    return true;
    
  } catch (error) {
    console.error('❌ Edge Function test failed:', error.message);
    return false;
  }
}

async function testAgoraConfig() {
  console.log('🔍 Testing Agora configuration...');
  
  const appId = process.env.EXPO_PUBLIC_AGORA_APP_ID;
  const appCert = process.env.AGORA_APP_CERTIFICATE;
  
  if (!appId || appId === 'your_agora_app_id_here') {
    console.error('❌ EXPO_PUBLIC_AGORA_APP_ID not configured');
    return false;
  }
  
  if (!appCert || appCert === 'your_agora_app_certificate_here') {
    console.error('❌ AGORA_APP_CERTIFICATE not configured');
    return false;
  }
  
  console.log('✅ Agora credentials are configured');
  return true;
}

async function runTests() {
  console.log('🚀 Starting Live Streaming Tests...\n');
  
  const results = {
    database: await testDatabase(),
    edgeFunction: await testEdgeFunction(),
    agoraConfig: await testAgoraConfig()
  };
  
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(`Database Schema: ${results.database ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Edge Function: ${results.edgeFunction ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Agora Config: ${results.agoraConfig ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(Boolean);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! Live streaming is ready to test.');
    console.log('\n📱 Next steps:');
    console.log('1. Run "npm run ios" or "npm run android"');
    console.log('2. Navigate to the Clique tab');
    console.log('3. Tap "Go Live" to test streaming');
  } else {
    console.log('\n⚠️  Some tests failed. Fix the issues above before testing.');
  }
}

// Run the tests
runTests().catch(console.error);