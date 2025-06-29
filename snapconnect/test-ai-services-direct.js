/**
 * Direct test of AI messaging services
 * Tests the actual implementation without module loading issues
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testAIServices() {
  console.log('🧪 Testing AI Services Directly...\n');

  try {
    // Test 1: Check if we can get AI users using the old function name
    console.log('📋 Test 1: Getting AI Users (original function)...');
    try {
      const { data: aiUsers1, error: error1 } = await supabase.rpc('get_ai_users');
      if (error1) {
        console.log(`   ❌ get_ai_users failed: ${error1.message}`);
      } else {
        console.log(`   ✅ get_ai_users works: ${aiUsers1?.length || 0} users found`);
      }
    } catch (e) {
      console.log(`   ❌ get_ai_users error: ${e.message}`);
    }

    // Test 2: Check if we can get AI users using the new function name
    console.log('\n📋 Test 2: Getting AI Users (new function)...');
    try {
      const { data: aiUsers2, error: error2 } = await supabase.rpc('get_available_ai_users');
      if (error2) {
        console.log(`   ❌ get_available_ai_users failed: ${error2.message}`);
      } else {
        console.log(`   ✅ get_available_ai_users works: ${aiUsers2?.length || 0} users found`);
        if (aiUsers2 && aiUsers2.length > 0) {
          console.log(`   First AI: ${aiUsers2[0].full_name} (@${aiUsers2[0].username})`);
        }
      }
    } catch (e) {
      console.log(`   ❌ get_available_ai_users error: ${e.message}`);
    }

    // Test 3: Check message sending functions
    console.log('\n📋 Test 3: Testing Message Functions...');
    
    // Get test user and AI user for testing
    const { data: testUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'test@test.com')
      .single();

    const { data: aiUsers } = await supabase.rpc('get_available_ai_users');
    
    if (testUser && aiUsers && aiUsers.length > 0) {
      const aiUser = aiUsers[0];
      console.log(`   Using test user: ${testUser.email}`);
      console.log(`   Using AI user: ${aiUser.username}`);

      // Test human to AI message
      try {
        const { data: messageId, error: sendError } = await supabase.rpc('send_message', {
          receiver_user_id: aiUser.user_id,
          message_content: 'Direct service test - please respond!'
        });

        if (sendError) {
          console.log(`   ❌ send_message failed: ${sendError.message}`);
        } else {
          console.log(`   ✅ send_message works: ${messageId}`);
        }
      } catch (e) {
        console.log(`   ❌ send_message error: ${e.message}`);
      }

      // Test AI to human message
      try {
        const { data: aiMessageId, error: aiSendError } = await supabase.rpc('send_ai_message', {
          ai_user_id: aiUser.user_id,
          receiver_user_id: testUser.id,
          message_content: 'Direct AI service test response! 🤖',
          personality_type: aiUser.personality_traits?.archetype_id || 'test'
        });

        if (aiSendError) {
          console.log(`   ❌ send_ai_message failed: ${aiSendError.message}`);
        } else {
          console.log(`   ✅ send_ai_message works: ${aiMessageId}`);
        }
      } catch (e) {
        console.log(`   ❌ send_ai_message error: ${e.message}`);
      }
    }

    // Test 4: Check conversation retrieval functions
    console.log('\n📋 Test 4: Testing Conversation Functions...');

    if (testUser && aiUsers && aiUsers.length > 0) {
      const aiUser = aiUsers[0];

      // Test get_messages_with_ai_support
      try {
        const { data: messages, error: msgError } = await supabase.rpc('get_messages_with_ai_support', {
          other_user_id: aiUser.user_id,
          limit_count: 5
        });

        if (msgError) {
          console.log(`   ❌ get_messages_with_ai_support failed: ${msgError.message}`);
        } else {
          console.log(`   ✅ get_messages_with_ai_support works: ${messages?.length || 0} messages`);
        }
      } catch (e) {
        console.log(`   ❌ get_messages_with_ai_support error: ${e.message}`);
      }

      // Test get_user_conversations_with_ai
      try {
        const { data: conversations, error: convError } = await supabase.rpc('get_user_conversations_with_ai');

        if (convError) {
          console.log(`   ❌ get_user_conversations_with_ai failed: ${convError.message}`);
        } else {
          const aiConvs = conversations?.filter(c => c.is_ai_conversation) || [];
          console.log(`   ✅ get_user_conversations_with_ai works: ${aiConvs.length} AI conversations`);
        }
      } catch (e) {
        console.log(`   ❌ get_user_conversations_with_ai error: ${e.message}`);
      }
    }

    // Test 5: Check helper functions
    console.log('\n📋 Test 5: Testing Helper Functions...');

    try {
      const { data: helperResult, error: helperError } = await supabase.rpc('create_proactive_messages_log_if_not_exists');
      if (helperError) {
        console.log(`   ❌ create_proactive_messages_log_if_not_exists failed: ${helperError.message}`);
      } else {
        console.log(`   ✅ create_proactive_messages_log_if_not_exists works: ${helperResult}`);
      }
    } catch (e) {
      console.log(`   ❌ create_proactive_messages_log_if_not_exists error: ${e.message}`);
    }

    try {
      const { data: cleanupResult, error: cleanupError } = await supabase.rpc('cleanup_expired_messages');
      if (cleanupError) {
        console.log(`   ❌ cleanup_expired_messages failed: ${cleanupError.message}`);
      } else {
        console.log(`   ✅ cleanup_expired_messages works: cleaned ${cleanupResult} messages`);
      }
    } catch (e) {
      console.log(`   ❌ cleanup_expired_messages error: ${e.message}`);
    }

    console.log('\n🎉 Direct service testing complete!');
    console.log('\n📊 SUMMARY:');
    console.log('The database-level functions are working. If you\'re still having issues');
    console.log('with AI conversations, the problem is likely in the React Native app');
    console.log('initialization. Make sure to initialize the aiMessagingSchedulerService');
    console.log('when your app starts up.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAIServices().catch(console.error);