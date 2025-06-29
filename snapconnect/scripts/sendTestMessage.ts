/**
 * Send Test AI Message Script
 * Quick test to send a proactive message from an AI to the current user
 */

import { supabase } from '../src/services/supabase';
import { appInitializationService } from '../src/services/appInitialization';
import { aiMessagingSchedulerService } from '../src/services/aiMessagingScheduler';

async function sendTestAIMessage() {
  try {
    console.log('🧪 Testing AI Proactive Message System...\n');

    // Initialize the AI messaging system
    console.log('🚀 Initializing AI messaging system...');
    await appInitializationService.initializeApp();

    // Get current authenticated user
    console.log('👤 Getting current user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ No authenticated user found:', userError);
      console.log('   Please make sure you\'re logged into the app');
      return;
    }

    console.log(`✅ Found user: ${user.id}`);
    console.log(`   Email: ${user.email}\n`);

    // Get available AI users
    console.log('🤖 Getting available AI users...');
    const aiUsers = await aiMessagingSchedulerService.getAvailableAIUsers();
    
    if (aiUsers.length === 0) {
      console.error('❌ No AI users found in database');
      console.log('   Make sure AI users are created in your database');
      return;
    }

    console.log(`✅ Found ${aiUsers.length} AI users:`);
    aiUsers.forEach((ai, index) => {
      console.log(`   ${index + 1}. ${ai.username} (${ai.archetype_id || 'unknown archetype'})`);
    });
    console.log('');

    // Test different types of proactive messages
    const testTriggers = [
      'onboarding_welcome',
      'check_in', 
      'motivation_boost',
      'random_social'
    ] as const;

    console.log('📤 Sending test proactive messages...\n');

    for (const trigger of testTriggers) {
      console.log(`   Testing trigger: ${trigger}`);
      
      try {
        const success = await aiMessagingSchedulerService.triggerProactiveMessageForUser(
          user.id,
          trigger
        );
        
        if (success) {
          console.log(`   ✅ ${trigger} message sent successfully`);
        } else {
          console.log(`   ⚠️  ${trigger} message not sent (may be rate limited)`);
        }
      } catch (error) {
        console.log(`   ❌ ${trigger} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n🎉 Test completed! Check your messages in the app to see AI responses.');
    console.log('   Note: Messages may take a few seconds to appear due to typing delays.\n');

    // Show system status
    const status = aiMessagingSchedulerService.getStatus();
    console.log('📊 System Status:');
    console.log(`   Initialized: ${status.initialized}`);
    console.log(`   Scheduler Running: ${status.schedulerRunning}`);
    console.log(`   Message Handler: ${JSON.stringify(status.messageHandlerStatus)}\n`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
sendTestAIMessage().catch(console.error);