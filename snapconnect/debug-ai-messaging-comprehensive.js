/**
 * Comprehensive AI Messaging System Diagnostic
 * Identifies all issues preventing proper AI-human conversations
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = 'https://lubfyjzdfgpoocsswrkz.supabase.co';
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

async function runComprehensiveDiagnostic() {
  console.log('🔍 AI MESSAGING SYSTEM COMPREHENSIVE DIAGNOSTIC');
  console.log('==============================================\n');

  const issues = [];
  const successes = [];

  // Test 1: Check if required database functions exist
  console.log('📋 Test 1: Database Functions');
  const requiredFunctions = [
    'send_ai_message',
    'get_ai_users',
    'get_ai_conversation_context',
    'get_messages_with_ai_support',
    'get_user_conversations_with_ai',
    'send_message'
  ];

  for (const funcName of requiredFunctions) {
    try {
      const { data, error } = await supabase.rpc('pg_get_functiondef', {
        func_name: funcName
      });
      
      if (error || !data) {
        // Try alternative check
        const { data: checkData, error: checkError } = await supabase
          .from('pg_proc')
          .select('proname')
          .eq('proname', funcName)
          .limit(1);
          
        if (checkError || !checkData || checkData.length === 0) {
          issues.push(`Missing database function: ${funcName}`);
          console.log(`   ❌ ${funcName} - MISSING`);
        } else {
          successes.push(`Database function ${funcName} exists`);
          console.log(`   ✅ ${funcName} - EXISTS`);
        }
      } else {
        successes.push(`Database function ${funcName} exists`);
        console.log(`   ✅ ${funcName} - EXISTS`);
      }
    } catch (error) {
      // Try direct test instead
      try {
        if (funcName === 'get_ai_users') {
          await supabase.rpc(funcName);
          successes.push(`Database function ${funcName} exists`);
          console.log(`   ✅ ${funcName} - EXISTS (tested)`);
        } else {
          issues.push(`Cannot test function: ${funcName}`);
          console.log(`   ⚠️  ${funcName} - CANNOT TEST`);
        }
      } catch (testError) {
        issues.push(`Missing or broken function: ${funcName}`);
        console.log(`   ❌ ${funcName} - MISSING/BROKEN`);
      }
    }
  }

  // Test 2: Check if AI users exist and have proper data
  console.log('\n📋 Test 2: AI Users');
  try {
    const { data: aiUsers, error: aiError } = await supabase.rpc('get_ai_users');
    
    if (aiError) {
      issues.push(`Cannot fetch AI users: ${aiError.message}`);
      console.log(`   ❌ Error fetching AI users: ${aiError.message}`);
    } else if (!aiUsers || aiUsers.length === 0) {
      issues.push('No AI users found in database');
      console.log('   ❌ No AI users found');
    } else {
      successes.push(`Found ${aiUsers.length} AI users`);
      console.log(`   ✅ Found ${aiUsers.length} AI users:`);
      
      aiUsers.forEach((ai, index) => {
        console.log(`      ${index + 1}. ${ai.full_name} (@${ai.username})`);
        console.log(`         - Has personality traits: ${!!ai.personality_traits}`);
        console.log(`         - Has response style: ${!!ai.ai_response_style}`);
        
        if (!ai.personality_traits) {
          issues.push(`AI user ${ai.username} missing personality traits`);
        }
        if (!ai.ai_response_style) {
          issues.push(`AI user ${ai.username} missing response style`);
        }
      });
    }
  } catch (error) {
    issues.push(`Cannot test AI users: ${error.message}`);
    console.log(`   ❌ Cannot test AI users: ${error.message}`);
  }

  // Test 3: Check if required tables exist
  console.log('\n📋 Test 3: Database Tables');
  const requiredTables = [
    'messages',
    'users', 
    'ai_proactive_messages'
  ];

  for (const tableName of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
        
      if (error) {
        issues.push(`Table ${tableName} missing or inaccessible: ${error.message}`);
        console.log(`   ❌ ${tableName} - ${error.message}`);
      } else {
        successes.push(`Table ${tableName} accessible`);
        console.log(`   ✅ ${tableName} - EXISTS`);
      }
    } catch (error) {
      issues.push(`Table ${tableName} error: ${error.message}`);
      console.log(`   ❌ ${tableName} - ERROR: ${error.message}`);
    }
  }

  // Test 4: Check if AI messaging works end-to-end
  console.log('\n📋 Test 4: End-to-End AI Messaging');
  try {
    // Get test user
    const { data: users } = await supabase
      .from('users')
      .select('id, email, username')
      .eq('email', 'test@test.com')
      .limit(1);

    if (!users || users.length === 0) {
      issues.push('Test user not found (test@test.com)');
      console.log('   ❌ Test user not found');
    } else {
      const testUser = users[0];
      console.log(`   ✅ Test user found: ${testUser.email}`);

      // Get AI user
      const { data: aiUsers } = await supabase.rpc('get_ai_users');
      if (aiUsers && aiUsers.length > 0) {
        const aiUser = aiUsers[0];
        console.log(`   ✅ AI user available: ${aiUser.username}`);

        // Test human to AI message
        try {
          const { data: messageId, error: sendError } = await supabase.rpc('send_message', {
            receiver_user_id: aiUser.user_id,
            message_content: 'Test message for diagnostic'
          });

          if (sendError) {
            issues.push(`Cannot send message to AI: ${sendError.message}`);
            console.log(`   ❌ Cannot send to AI: ${sendError.message}`);
          } else {
            successes.push('Human can send messages to AI');
            console.log(`   ✅ Human can send messages to AI (ID: ${messageId})`);
          }
        } catch (error) {
          issues.push(`Message sending failed: ${error.message}`);
          console.log(`   ❌ Message sending failed: ${error.message}`);
        }

        // Test AI to human message  
        try {
          const { data: aiMessageId, error: aiSendError } = await supabase.rpc('send_ai_message', {
            ai_user_id: aiUser.user_id,
            receiver_user_id: testUser.id,
            message_content: 'AI diagnostic test message',
            personality_type: 'test'
          });

          if (aiSendError) {
            issues.push(`AI cannot send messages: ${aiSendError.message}`);
            console.log(`   ❌ AI cannot send messages: ${aiSendError.message}`);
          } else {
            successes.push('AI can send messages to humans');
            console.log(`   ✅ AI can send messages to humans (ID: ${aiMessageId})`);
          }
        } catch (error) {
          issues.push(`AI message sending failed: ${error.message}`);
          console.log(`   ❌ AI message sending failed: ${error.message}`);
        }
      }
    }
  } catch (error) {
    issues.push(`End-to-end test failed: ${error.message}`);
    console.log(`   ❌ End-to-end test failed: ${error.message}`);
  }

  // Test 5: Check message retrieval
  console.log('\n📋 Test 5: Message Retrieval');
  try {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'test@test.com')
      .limit(1);

    if (users && users.length > 0) {
      const testUser = users[0];
      
      const { data: aiUsers } = await supabase.rpc('get_ai_users');
      if (aiUsers && aiUsers.length > 0) {
        const aiUser = aiUsers[0];

        // Test get_messages_with_ai_support
        try {
          const { data: messages, error: msgError } = await supabase.rpc('get_messages_with_ai_support', {
            other_user_id: aiUser.user_id,
            limit_count: 10
          });

          if (msgError) {
            issues.push(`Cannot retrieve AI messages: ${msgError.message}`);
            console.log(`   ❌ Cannot retrieve AI messages: ${msgError.message}`);
          } else {
            successes.push(`Can retrieve messages with AI (${messages?.length || 0} messages)`);
            console.log(`   ✅ Can retrieve AI messages (${messages?.length || 0} found)`);
          }
        } catch (error) {
          issues.push(`Message retrieval failed: ${error.message}`);
          console.log(`   ❌ Message retrieval failed: ${error.message}`);
        }

        // Test conversation list with AI
        try {
          const { data: conversations, error: convError } = await supabase.rpc('get_user_conversations_with_ai');

          if (convError) {
            issues.push(`Cannot retrieve AI conversations: ${convError.message}`);
            console.log(`   ❌ Cannot retrieve AI conversations: ${convError.message}`);
          } else {
            const aiConversations = conversations?.filter(c => c.is_ai_conversation) || [];
            successes.push(`Can retrieve AI conversations (${aiConversations.length} found)`);
            console.log(`   ✅ Can retrieve AI conversations (${aiConversations.length} found)`);
          }
        } catch (error) {
          issues.push(`Conversation retrieval failed: ${error.message}`);
          console.log(`   ❌ Conversation retrieval failed: ${error.message}`);
        }
      }
    }
  } catch (error) {
    issues.push(`Message retrieval test failed: ${error.message}`);
    console.log(`   ❌ Message retrieval test failed: ${error.message}`);
  }

  // Print Summary
  console.log('\n📊 DIAGNOSTIC SUMMARY');
  console.log('====================');
  console.log(`✅ Successes: ${successes.length}`);
  console.log(`❌ Issues: ${issues.length}\n`);

  if (issues.length > 0) {
    console.log('🚨 ISSUES TO FIX:');
    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
    console.log('');
  }

  if (successes.length > 0) {
    console.log('✅ WORKING CORRECTLY:');
    successes.forEach((success, index) => {
      console.log(`   ${index + 1}. ${success}`);
    });
    console.log('');
  }

  // Recommendations
  console.log('💡 RECOMMENDATIONS:');
  
  if (issues.some(i => i.includes('ai_proactive_messages'))) {
    console.log('   1. Create the ai_proactive_messages table');
  }
  
  if (issues.some(i => i.includes('personality traits') || i.includes('response style'))) {
    console.log('   2. Populate AI users with personality traits and response styles');
  }
  
  if (issues.some(i => i.includes('function'))) {
    console.log('   3. Run missing database migrations to create required functions');
  }
  
  if (issues.length === 0) {
    console.log('   🎉 All core functionality is working! The main issue may be:');
    console.log('      - AI message handler not initialized in the React Native app');
    console.log('      - Real-time subscriptions not set up properly');
    console.log('      - AI response generation service dependencies missing');
  }

  console.log('\n🏁 Diagnostic complete!');
}

runComprehensiveDiagnostic().catch(console.error);