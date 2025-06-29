/**
 * Quick Test - Send AI Message
 * Simple script to send a test proactive message
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
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

async function sendQuickTestMessage() {
  console.log('🧪 Sending Quick Test AI Message...\n');

  try {
    // Find your user (assuming you have test@test.com email)
    console.log('👤 Finding your user...');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, username, email, full_name')
      .eq('email', 'test@test.com')
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.log('⚠️  User with email test@test.com not found.');
      console.log('   Available users:');
      
      const { data: allUsers } = await supabase
        .from('users')
        .select('email, username, full_name')
        .eq('is_mock_user', false)
        .limit(5);
      
      allUsers?.forEach(user => {
        console.log(`   - ${user.email} (${user.username})`);
      });
      return;
    }

    const targetUser = users[0];
    console.log(`✅ Found user: ${targetUser.full_name} (${targetUser.email})`);

    // Get an AI user
    console.log('\n🤖 Getting AI users...');
    const { data: aiUsers, error: aiError } = await supabase.rpc('get_ai_users');
    
    if (aiError || !aiUsers || aiUsers.length === 0) {
      console.log('❌ No AI users found. You need to create AI users first.');
      return;
    }

    const selectedAI = aiUsers[0];
    console.log(`✅ Selected AI: ${selectedAI.full_name} (@${selectedAI.username})`);

    // Send a direct message from AI to user
    console.log('\n📤 Sending AI message...');
    
    const testMessage = `Hey ${targetUser.full_name}! 👋 I noticed you're using the app and wanted to say hi! I'm ${selectedAI.full_name}, and I'm excited to see how your fitness journey goes. How are you finding the app so far?`;

    const { data: messageId, error: messageError } = await supabase.rpc('send_ai_message', {
      ai_user_id: selectedAI.user_id,
      receiver_user_id: targetUser.id,
      message_content: testMessage,
      personality_type: selectedAI.personality_traits?.archetype_id || 'friendly',
      context_data: {
        trigger_type: 'manual_test',
        test_message: true,
        sent_at: new Date().toISOString()
      }
    });

    if (messageError) {
      console.error('❌ Failed to send message:', messageError);
      return;
    }

    console.log(`✅ Message sent successfully!`);
    console.log(`   Message ID: ${messageId}`);
    console.log(`   From: ${selectedAI.full_name} (@${selectedAI.username})`);
    console.log(`   To: ${targetUser.full_name} (${targetUser.email})`);
    console.log(`   Content: "${testMessage}"`);

    console.log('\n🎉 Test completed! Check your messages in the app to see the AI message.');
    
    // Log the proactive message for tracking
    const { error: logError } = await supabase
      .from('ai_proactive_messages')
      .insert({
        user_id: targetUser.id,
        ai_user_id: selectedAI.user_id,
        message_id: messageId,
        trigger_type: 'manual_test',
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.log('⚠️  Note: Failed to log proactive message:', logError.message);
    } else {
      console.log('📝 Proactive message logged successfully');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
sendQuickTestMessage().catch(console.error);