/**
 * Test Reactive AI Response System
 * Check if AI users respond automatically when they receive messages
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

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

async function testReactiveAI() {
  console.log('🧪 Testing Reactive AI Response System...\n');
  
  try {
    // Get test user
    console.log('👤 Finding test user...');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, username, email, full_name')
      .eq('email', 'test@test.com')
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.log('❌ Test user not found');
      return;
    }

    const testUser = users[0];
    console.log(`✅ Found test user: ${testUser.full_name} (${testUser.email})`);
    
    // Get an AI user  
    console.log('\n🤖 Getting AI users...');
    const { data: aiUsers, error: aiError } = await supabase.rpc('get_ai_users');
    
    if (aiError || !aiUsers || aiUsers.length === 0) {
      console.log('❌ No AI users found');
      console.log('Error:', aiError);
      return;
    }
    
    const aiUser = aiUsers[0];
    console.log(`✅ Selected AI: ${aiUser.full_name} (@${aiUser.username})`);
    
    // Send a message TO the AI user (as the human)
    console.log('\n📤 Sending test message to AI user...');
    const testMessage = 'Hey there! How are you doing today? I just started my fitness journey and could use some motivation!';
    
    const { data: messageId, error: messageError } = await supabase.rpc('send_message', {
      receiver_user_id: aiUser.user_id,
      message_content: testMessage
    });
    
    if (messageError) {
      console.log('❌ Failed to send message:', messageError);
      return;
    }
    
    console.log('✅ Message sent successfully!');
    console.log(`   Message ID: ${messageId}`);
    console.log(`   From: ${testUser.full_name} (human)`);
    console.log(`   To: ${aiUser.full_name} (AI)`);
    console.log(`   Content: "${testMessage}"`);
    
    console.log('\n⏳ Waiting for AI to respond automatically...');
    console.log('   (The AI should detect this message and respond within a few seconds)');
    
    // Wait and check for AI response
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      attempts++;
      
      console.log(`   Checking for AI response... (attempt ${attempts}/${maxAttempts})`);
      
      // Check for messages from AI to human
      const { data: aiMessages, error: checkError } = await supabase
        .from('messages')
        .select('id, content, sent_at, is_ai_sender')
        .eq('sender_id', aiUser.user_id)
        .eq('receiver_id', testUser.id)
        .eq('is_ai_sender', true)
        .order('sent_at', { ascending: false })
        .limit(1);
      
      if (checkError) {
        console.log('❌ Error checking for AI response:', checkError);
        break;
      }
      
      if (aiMessages && aiMessages.length > 0) {
        const aiResponse = aiMessages[0];
        console.log('\n🎉 AI RESPONDED AUTOMATICALLY!');
        console.log(`   Response ID: ${aiResponse.id}`);
        console.log(`   Content: "${aiResponse.content}"`);
        console.log(`   Sent at: ${aiResponse.sent_at}`);
        console.log(`   Is AI Sender: ${aiResponse.is_ai_sender}`);
        
        console.log('\n✅ REACTIVE AI SYSTEM IS WORKING!');
        return;
      }
    }
    
    console.log('\n⚠️  No AI response detected after 20 seconds.');
    console.log('   This could indicate:');
    console.log('   1. AI message handler is not initialized');
    console.log('   2. Real-time subscriptions are not working');  
    console.log('   3. AI response generation is failing');
    console.log('   4. Database functions are not working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testReactiveAI().catch(console.error);