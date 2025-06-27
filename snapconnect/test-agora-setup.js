/**
 * Quick Agora Setup Test
 */

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const agoraAppId = process.env.EXPO_PUBLIC_AGORA_APP_ID;

console.log('🔍 Testing Agora Setup...\n');

// Test 1: Check local environment
console.log('📱 Local Environment:');
console.log(`Supabase URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
console.log(`Supabase Key: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`);
console.log(`Agora App ID: ${agoraAppId ? '✅ Set' : '❌ Missing'}`);

if (agoraAppId) {
  console.log(`App ID: ${agoraAppId}`);
}

// Test 2: Test Edge Function with real credentials
async function testEdgeFunction() {
  console.log('\n🔧 Testing Edge Function...');
  
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data, error } = await supabase.functions.invoke('generate-agora-token', {
      body: {
        channelName: 'test_channel_' + Date.now(),
        uid: 12345,
        role: 'host',
        userId: 'test_user_id'
      }
    });
    
    if (error) {
      console.log('❌ Edge Function Error:', error.message);
      return false;
    }
    
    if (data && data.token) {
      console.log('✅ Edge Function working!');
      console.log('Token generated:', data.token.substring(0, 20) + '...');
      return true;
    } else {
      console.log('❌ No token returned');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Edge Function failed:', error.message);
    return false;
  }
}

// Test 3: Check database tables
async function testDatabase() {
  console.log('\n💾 Testing Database...');
  
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data, error } = await supabase
      .from('live_streams')
      .select('count')
      .limit(1);
      
    if (error) {
      console.log('❌ Database error:', error.message);
      return false;
    }
    
    console.log('✅ Database tables accessible');
    return true;
    
  } catch (error) {
    console.log('❌ Database failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  if (!supabaseUrl || !supabaseAnonKey || !agoraAppId) {
    console.log('\n❌ Missing required environment variables');
    return;
  }
  
  const dbTest = await testDatabase();
  const edgeTest = await testEdgeFunction();
  
  console.log('\n📊 Results:');
  console.log(`Database: ${dbTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Edge Function: ${edgeTest ? '✅ PASS' : '❌ FAIL'}`);
  
  if (dbTest && edgeTest) {
    console.log('\n🎉 Setup is complete! Try the app now.');
  } else {
    console.log('\n⚠️ Some issues found. Check the errors above.');
  }
}

runAllTests().catch(console.error);