/**
 * Debug AI Message Handler
 * Check why automatic responses aren't working
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

async function debugAIHandler() {
  console.log('🔧 Debugging AI Message Handler...\n');

  try {
    // Let's manually test the AI chat service instead
    console.log('🧪 Testing AI chat service directly...');
    
    // Import the AI chat service
    const { aiChatService } = await import('../src/services/aiChatService');
    
    console.log('✅ AI chat service imported');
    
    // Test generating an AI response
    const response = await aiChatService.generateAIResponse({
      ai_user_id: 'dd6ad0c0-d95a-436d-ba38-20208663db6c', // Mike's ID
      human_user_id: '2f06a32c-7148-4d24-9af5-63f1ea4cd79a', // Your ID
      human_message: 'Hey Mike, how are you doing today?'
    });
    
    console.log('✅ AI response generated:');
    console.log('   Message ID:', response.message_id);
    console.log('   Content:', response.content);
    console.log('   Typing delay:', response.typing_delay_ms + 'ms');
    
    console.log('\n🎉 Manual AI response sent! Check your messages.');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    
    // Let's check what went wrong
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Run the debug
debugAIHandler().catch(console.error);