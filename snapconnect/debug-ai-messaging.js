#!/usr/bin/env node

/**
 * Debug script to test AI messaging system
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'your-url';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-key';

if (supabaseUrl === 'your-url' || supabaseKey === 'your-key') {
  console.log('❌ Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAIMessaging() {
  try {
    console.log('🔍 Debugging AI messaging system...\n');

    // 1. Check if Mike exists and is an AI user
    console.log('1. Checking AI users...');
    const { data: aiUsers, error: aiError } = await supabase.rpc('get_ai_users');
    
    if (aiError) {
      console.error('❌ Error fetching AI users:', aiError);
      return;
    }

    console.log(`   Found ${aiUsers?.length || 0} AI users:`);
    aiUsers?.forEach(user => {
      console.log(`   - ${user.username} (${user.full_name}) - ID: ${user.user_id.substring(0, 8)}...`);
    });

    // Find an AI user to test with (let's use the first one)
    const testAI = aiUsers?.[0];
    if (!testAI) {
      console.log('❌ No AI users found');
      return;
    }

    console.log(`✅ Found test AI: ${testAI.full_name} (@${testAI.username}) (ID: ${testAI.user_id.substring(0, 8)}...)\n`);

    // 2. Check the AI user's record directly
    console.log('2. Checking AI user\'s record...');
    const { data: aiUser, error: userError } = await supabase
      .from('users')
      .select('id, username, full_name, is_mock_user')
      .eq('id', testAI.user_id)
      .single();

    if (userError) {
      console.error('❌ Error fetching AI user record:', userError);
      return;
    }

    console.log('   AI user record:', {
      id: aiUser.id.substring(0, 8) + '...',
      username: aiUser.username,
      full_name: aiUser.full_name,
      is_mock_user: aiUser.is_mock_user
    });

    if (!aiUser.is_mock_user) {
      console.log('❌ AI user is not marked as a mock/AI user (is_mock_user should be true)');
      return;
    }

    console.log('✅ AI user is correctly marked as an AI user\n');

    // 3. Check recent messages to/from the AI user
    console.log('3. Checking recent messages to/from AI user...');
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${aiUser.id},receiver_id.eq.${aiUser.id}`)
      .order('sent_at', { ascending: false })
      .limit(5);

    if (msgError) {
      console.error('❌ Error fetching messages:', msgError);
      return;
    }

    console.log(`   Found ${messages?.length || 0} recent messages:`);
    messages?.forEach(msg => {
      const direction = msg.sender_id === aiUser.id ? 'AI → User' : 'User → AI';
      const content = msg.content?.substring(0, 50) + '...';
      const isAI = msg.is_ai_sender ? ' [AI]' : '';
      console.log(`   - ${direction}: "${content}"${isAI} (${new Date(msg.sent_at).toLocaleTimeString()})`);
    });

    // 4. Check if there are any unresponded messages to the AI user
    const unrespondedMessages = messages?.filter(msg => 
      msg.receiver_id === aiUser.id && 
      !msg.is_ai_sender &&
      !messages.some(response => 
        response.sender_id === aiUser.id && 
        response.sent_at > msg.sent_at
      )
    );

    console.log(`\n   Unresponded messages to AI: ${unrespondedMessages?.length || 0}`);
    unrespondedMessages?.forEach(msg => {
      console.log(`   - "${msg.content?.substring(0, 50)}..." (${new Date(msg.sent_at).toLocaleTimeString()})`);
    });

    console.log('\n🔍 Debug complete!');
    console.log('\n💡 Suggestions:');
    console.log('   1. Check if the React Native app is running and properly initialized');
    console.log('   2. Check console logs for any subscription errors');
    console.log(`   3. Try sending a new message to ${aiUser.username} to test real-time triggering`);
    console.log('   4. Verify the AI message handler subscription is active');
    console.log(`\n🎯 Test AI User Details:`);
    console.log(`   Username: ${aiUser.username}`);
    console.log(`   Full Name: ${aiUser.full_name}`);
    console.log(`   User ID: ${aiUser.id}`);

  } catch (error) {
    console.error('❌ Debug script failed:', error);
  }
}

// Run the debug
debugAIMessaging();