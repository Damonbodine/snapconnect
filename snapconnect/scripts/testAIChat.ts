/**
 * Test script for AI chat functionality
 * Tests the new AI chat service integration
 * 
 * Usage: npx tsx scripts/testAIChat.ts
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { aiChatService } from '../src/services/aiChatService';

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

async function testAIChat() {
  console.log('🤖 Testing AI Chat Service...\n');

  try {
    // Test 1: Get available AI users
    console.log('📋 Test 1: Fetching available AI users');
    const aiUsers = await aiChatService.getAvailableAIUsers();
    console.log(`✅ Found ${aiUsers.length} AI users`);
    
    if (aiUsers.length > 0) {
      console.log('Sample AI users:');
      aiUsers.slice(0, 3).forEach(user => {
        console.log(`  - ${user.full_name} (@${user.username}) - ${user.archetype_id}`);
      });
    } else {
      console.log('⚠️  No AI users found. Run createBulkAIUsers.ts first.');
      return;
    }

    // Test 2: Get a test human user
    console.log('\n👤 Test 2: Finding a human test user');
    const { data: humanUsers, error: humanError } = await supabase
      .from('users')
      .select('id, username, full_name')
      .eq('is_mock_user', false)
      .limit(1);

    if (humanError || !humanUsers || humanUsers.length === 0) {
      console.log('⚠️  No human users found. Create a test user first.');
      return;
    }

    const testHuman = humanUsers[0];
    console.log(`✅ Using test human: ${testHuman.full_name} (@${testHuman.username})`);

    // Test 3: Generate AI response
    const testAI = aiUsers[0];
    console.log(`\n🤖 Test 3: Generating AI response from ${testAI.full_name}`);
    
    const testMessage = "Hey! I just finished a great workout. Any tips for recovery?";
    console.log(`Human message: "${testMessage}"`);
    
    const response = await aiChatService.generateAIResponse({
      ai_user_id: testAI.id,
      human_user_id: testHuman.id,
      human_message: testMessage,
    });

    console.log(`✅ AI Response generated:`);
    console.log(`  Message ID: ${response.message_id}`);
    console.log(`  Content: "${response.content}"`);
    console.log(`  Typing delay: ${response.typing_delay_ms}ms`);

    // Test 4: Get conversation context
    console.log(`\n💬 Test 4: Fetching conversation context`);
    const context = await aiChatService.getConversationContext(
      testAI.id, 
      testHuman.id, 
      5
    );
    console.log(`✅ Found ${context.length} previous messages`);

    // Test 5: Start a new conversation
    console.log(`\n🆕 Test 5: Starting new conversation`);
    const greeting = await aiChatService.startConversationWithAI(testAI.id, testHuman.id);
    console.log(`✅ Conversation started:`);
    console.log(`  Greeting: "${greeting.content}"`);
    console.log(`  Delay: ${greeting.typing_delay_ms}ms`);

    console.log('\n🎉 All AI chat tests passed!');
    console.log('\n📋 Summary:');
    console.log(`  - ${aiUsers.length} AI users available`);
    console.log(`  - AI responses working with natural delays`);
    console.log(`  - Conversation context retrieval working`);
    console.log(`  - New conversation initialization working`);

  } catch (error) {
    console.error('❌ AI chat test failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  testAIChat().catch(console.error);
}

export { testAIChat };