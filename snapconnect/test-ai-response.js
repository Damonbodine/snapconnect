#!/usr/bin/env node

/**
 * Test script to manually send a message to an AI user and check for automatic response
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

async function testAIResponse() {
  try {
    console.log('🧪 Testing AI automatic response system...\n');

    // 1. Get a test user (non-AI) to send the message from
    console.log('1. Finding a test human user...');
    const { data: humanUsers, error: humanError } = await supabase
      .from('users')
      .select('id, username, full_name')
      .eq('is_mock_user', false)
      .limit(1);

    if (humanError || !humanUsers?.length) {
      console.error('❌ No human users found:', humanError);
      return;
    }

    const humanUser = humanUsers[0];
    console.log(`✅ Found human user: ${humanUser.full_name} (@${humanUser.username})`);

    // 2. Get an AI user to send the message to
    console.log('\n2. Finding an AI user...');
    const { data: aiUsers, error: aiError } = await supabase.rpc('get_ai_users');
    
    if (aiError || !aiUsers?.length) {
      console.error('❌ No AI users found:', aiError);
      return;
    }

    const aiUser = aiUsers[0]; // Use the first AI user
    console.log(`✅ Found AI user: ${aiUser.full_name} (@${aiUser.username})`);

    // 3. Send a test message from human to AI
    console.log('\n3. Sending test message to AI user...');
    const testMessage = `Hi ${aiUser.full_name}! This is a test message to check if you respond automatically. How are you doing today?`;
    
    // We need to authenticate as the human user first
    // For this test, we'll use the service role to bypass auth
    const supabaseService = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: messageId, error: sendError } = await supabaseService.rpc('send_message', {
      receiver_user_id: aiUser.user_id,
      message_content: testMessage,
      message_media_url: null,
      message_media_type: null,
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    });

    if (sendError) {
      console.error('❌ Failed to send message:', sendError);
      return;
    }

    console.log(`✅ Message sent successfully! Message ID: ${messageId}`);
    console.log(`   From: ${humanUser.full_name} (${humanUser.id.substring(0, 8)}...)`);
    console.log(`   To: ${aiUser.full_name} (${aiUser.user_id.substring(0, 8)}...)`);
    console.log(`   Content: "${testMessage}"`);

    // 4. Wait a bit and check for AI response
    console.log('\n4. Waiting for AI response...');
    console.log('   (Checking every 2 seconds for up to 30 seconds)');
    
    let responseFound = false;
    const startTime = Date.now();
    const maxWaitTime = 30000; // 30 seconds

    while (!responseFound && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      // Check for new messages from the AI user
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('sender_id', aiUser.user_id)
        .eq('receiver_id', humanUser.id)
        .order('sent_at', { ascending: false })
        .limit(1);

      if (msgError) {
        console.error('❌ Error checking for response:', msgError);
        break;
      }

      if (messages?.length > 0) {
        const response = messages[0];
        const responseTime = new Date(response.sent_at);
        const messageTime = new Date(); // Approximate since we just sent it
        const delay = responseTime.getTime() - (startTime);
        
        console.log(`\n✅ AI Response received after ~${Math.round(delay/1000)} seconds!`);
        console.log(`   Response: "${response.content}"`);
        console.log(`   Sent at: ${responseTime.toLocaleTimeString()}`);
        console.log(`   Is AI sender: ${response.is_ai_sender}`);
        
        responseFound = true;
        break;
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      process.stdout.write(`\r   Waiting... ${elapsed}s elapsed`);
    }

    if (!responseFound) {
      console.log(`\n❌ No AI response received within ${maxWaitTime/1000} seconds`);
      console.log('\n💡 This suggests the AI message handler may not be running or properly configured');
      console.log('   Check the React Native app console for any errors or initialization issues');
    }

    console.log('\n🔍 Test complete!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAIResponse();