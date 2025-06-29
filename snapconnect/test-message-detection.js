/**
 * Test if AI Message Handler detects new messages
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = 'https://lubfyjzdfgpoocsswrkz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testMessageDetection() {
  console.log('🧪 Testing if AI Message Handler detects new messages...\n');

  try {
    // Get test user
    const { data: testUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'test@test.com')
      .single();

    // Get AI user
    const { data: aiUsers } = await supabase.rpc('get_ai_users');
    const aiUser = aiUsers[0];

    console.log(`📤 Sending message from ${testUser.email} to AI ${aiUser.username}...`);
    console.log('⏳ Watch your app logs for: "🔥 AI Handler received message event:"');
    console.log('   This should trigger an automatic AI response within 1-3 seconds\n');

    // Send message using the same function as your app
    const testMessage = `Testing message detection at ${new Date().toLocaleTimeString()}. Please respond Mike!`;
    
    const { data: messageId, error } = await supabase.rpc('send_message', {
      receiver_user_id: aiUser.user_id,
      message_content: testMessage
    });

    if (error) {
      console.log('❌ Failed to send message:', error);
      return;
    }

    console.log(`✅ Message sent successfully!`);
    console.log(`   Message ID: ${messageId}`);
    console.log(`   Content: "${testMessage}"`);
    console.log('\n👀 Now check your app logs...');
    console.log('   You should see:');
    console.log('   1. "🔥 AI Handler received message event:" - subscription detected the message');
    console.log('   2. "🤖 Triggering AI response for AI user:" - handler processing');
    console.log('   3. An AI response appears in your app within 1-3 seconds');
    
    console.log('\n⏰ Waiting 10 seconds to see if AI responds...');

    // Wait and check if AI responded
    setTimeout(async () => {
      const { data: aiMessages } = await supabase
        .from('messages')
        .select('id, content, sent_at, is_ai_sender')
        .eq('sender_id', aiUser.user_id)
        .eq('receiver_id', testUser.id)
        .eq('is_ai_sender', true)
        .order('sent_at', { ascending: false })
        .limit(1);

      if (aiMessages && aiMessages.length > 0) {
        const latestResponse = aiMessages[0];
        const responseTime = new Date(latestResponse.sent_at);
        const messageTime = new Date();
        const timeDiff = messageTime - responseTime;

        if (timeDiff < 30000) { // Within 30 seconds
          console.log('\n🎉 SUCCESS! AI responded automatically!');
          console.log(`   Response: "${latestResponse.content.substring(0, 100)}..."`);
          console.log(`   Response time: ${Math.round(timeDiff/1000)} seconds`);
        } else {
          console.log('\n⚠️  AI response found but it\'s too old (not from this test)');
        }
      } else {
        console.log('\n❌ No AI response detected');
        console.log('   The real-time subscription may not be working properly');
      }
    }, 10000);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMessageDetection().catch(console.error);