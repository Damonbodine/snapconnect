/**
 * Test AI Messaging System
 * Comprehensive test script for AI-to-human messaging functionality
 */

import { aiMessagingSchedulerService } from '../src/services/aiMessagingScheduler';
import { aiChatService } from '../src/services/aiChatService';
import { aiProactiveMessagingService } from '../src/services/aiProactiveMessaging';
import { supabase } from '../src/services/supabase';

interface TestResult {
  testName: string;
  success: boolean;
  message: string;
  details?: any;
}

class AIMessagingSystemTester {
  private results: TestResult[] = [];

  /**
   * Run comprehensive test suite
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting AI Messaging System Test Suite...\n');

    // Test 1: Initialize AI messaging system
    await this.testSystemInitialization();

    // Test 2: Get available AI users
    await this.testGetAIUsers();

    // Test 3: Test AI response generation
    await this.testAIResponseGeneration();

    // Test 4: Test proactive message triggers
    await this.testProactiveMessageTriggers();

    // Test 5: Test conversation flow
    await this.testConversationFlow();

    // Test 6: Test system status
    await this.testSystemStatus();

    // Print results
    this.printTestResults();
  }

  /**
   * Test system initialization
   */
  private async testSystemInitialization(): Promise<void> {
    try {
      console.log('📋 Test 1: System Initialization');
      
      await aiMessagingSchedulerService.initialize();
      
      this.addResult({
        testName: 'System Initialization',
        success: true,
        message: 'AI messaging system initialized successfully',
      });
      
      console.log('✅ System initialization passed\n');
    } catch (error) {
      this.addResult({
        testName: 'System Initialization',
        success: false,
        message: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
      });
      
      console.log('❌ System initialization failed\n');
    }
  }

  /**
   * Test getting AI users
   */
  private async testGetAIUsers(): Promise<void> {
    try {
      console.log('📋 Test 2: Get AI Users');
      
      const aiUsers = await aiChatService.getAvailableAIUsers();
      
      if (aiUsers.length > 0) {
        this.addResult({
          testName: 'Get AI Users',
          success: true,
          message: `Found ${aiUsers.length} AI users`,
          details: aiUsers.map(u => ({ id: u.id, username: u.username, archetype: u.archetype_id })),
        });
        
        console.log(`✅ Found ${aiUsers.length} AI users:`);
        aiUsers.forEach(user => {
          console.log(`   - ${user.username} (${user.archetype_id})`);
        });
        console.log('');
      } else {
        this.addResult({
          testName: 'Get AI Users',
          success: false,
          message: 'No AI users found in database',
        });
        
        console.log('❌ No AI users found\n');
      }
    } catch (error) {
      this.addResult({
        testName: 'Get AI Users',
        success: false,
        message: `Failed to get AI users: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
      });
      
      console.log('❌ Get AI users failed\n');
    }
  }

  /**
   * Test AI response generation
   */
  private async testAIResponseGeneration(): Promise<void> {
    try {
      console.log('📋 Test 3: AI Response Generation');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Get an AI user
      const aiUsers = await aiChatService.getAvailableAIUsers();
      if (aiUsers.length === 0) {
        throw new Error('No AI users available for testing');
      }

      const testAI = aiUsers[0];
      const testMessage = "Hey! I just had a great workout today. Feeling really motivated!";

      console.log(`   Testing with AI: ${testAI.username}`);
      console.log(`   Test message: "${testMessage}"`);

      const response = await aiChatService.generateAIResponse({
        ai_user_id: testAI.id,
        human_user_id: user.id,
        human_message: testMessage,
      });

      this.addResult({
        testName: 'AI Response Generation',
        success: true,
        message: 'AI response generated successfully',
        details: {
          aiUser: testAI.username,
          response: response.content,
          messageId: response.message_id,
          typingDelay: response.typing_delay_ms,
        },
      });

      console.log(`✅ AI Response Generated:`);
      console.log(`   From: ${testAI.username}`);
      console.log(`   Response: "${response.content}"`);
      console.log(`   Message ID: ${response.message_id}`);
      console.log(`   Typing delay: ${response.typing_delay_ms}ms\n`);

    } catch (error) {
      this.addResult({
        testName: 'AI Response Generation',
        success: false,
        message: `AI response generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
      });

      console.log('❌ AI response generation failed\n');
    }
  }

  /**
   * Test proactive message triggers
   */
  private async testProactiveMessageTriggers(): Promise<void> {
    try {
      console.log('📋 Test 4: Proactive Message Triggers');

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      console.log(`   Testing proactive message for user: ${user.id}`);

      // Test onboarding welcome trigger
      const success = await aiProactiveMessagingService.triggerProactiveMessageForUser(
        user.id,
        'onboarding_welcome'
      );

      if (success) {
        this.addResult({
          testName: 'Proactive Message Triggers',
          success: true,
          message: 'Proactive message sent successfully',
          details: {
            userId: user.id,
            triggerType: 'onboarding_welcome',
          },
        });

        console.log('✅ Proactive message sent successfully\n');
      } else {
        throw new Error('Proactive message trigger returned false');
      }

    } catch (error) {
      this.addResult({
        testName: 'Proactive Message Triggers',
        success: false,
        message: `Proactive message failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
      });

      console.log('❌ Proactive message trigger failed\n');
    }
  }

  /**
   * Test conversation flow
   */
  private async testConversationFlow(): Promise<void> {
    try {
      console.log('📋 Test 5: Conversation Flow');

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Get an AI user
      const aiUsers = await aiChatService.getAvailableAIUsers();
      if (aiUsers.length === 0) {
        throw new Error('No AI users available for testing');
      }

      const testAI = aiUsers[0];

      console.log(`   Testing conversation start with: ${testAI.username}`);

      // Start conversation
      const conversationResponse = await aiChatService.startConversationWithAI(
        testAI.id,
        user.id
      );

      this.addResult({
        testName: 'Conversation Flow',
        success: true,
        message: 'Conversation started successfully',
        details: {
          aiUser: testAI.username,
          greetingMessage: conversationResponse.content,
          messageId: conversationResponse.message_id,
        },
      });

      console.log(`✅ Conversation Started:`);
      console.log(`   AI: ${testAI.username}`);
      console.log(`   Greeting: "${conversationResponse.content}"`);
      console.log(`   Message ID: ${conversationResponse.message_id}\n`);

    } catch (error) {
      this.addResult({
        testName: 'Conversation Flow',
        success: false,
        message: `Conversation flow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
      });

      console.log('❌ Conversation flow failed\n');
    }
  }

  /**
   * Test system status
   */
  private async testSystemStatus(): Promise<void> {
    try {
      console.log('📋 Test 6: System Status');

      const status = aiMessagingSchedulerService.getStatus();

      this.addResult({
        testName: 'System Status',
        success: status.initialized,
        message: status.initialized ? 'System is properly initialized' : 'System is not initialized',
        details: status,
      });

      console.log(`✅ System Status:`);
      console.log(`   Initialized: ${status.initialized}`);
      console.log(`   Scheduler Running: ${status.schedulerRunning}`);
      console.log(`   Message Handler: ${JSON.stringify(status.messageHandlerStatus)}\n`);

    } catch (error) {
      this.addResult({
        testName: 'System Status',
        success: false,
        message: `System status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
      });

      console.log('❌ System status check failed\n');
    }
  }

  /**
   * Add test result
   */
  private addResult(result: TestResult): void {
    this.results.push(result);
  }

  /**
   * Print comprehensive test results
   */
  private printTestResults(): void {
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('========================\n');

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => r.success === false).length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    // Detailed results
    this.results.forEach((result, index) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${index + 1}. ${result.testName}: ${status}`);
      console.log(`   ${result.message}`);
      
      if (result.details && !result.success) {
        console.log(`   Error Details: ${JSON.stringify(result.details, null, 2)}`);
      }
      console.log('');
    });

    // Final assessment
    if (passed === total) {
      console.log('🎉 ALL TESTS PASSED! AI Messaging System is working correctly.\n');
    } else {
      console.log('⚠️  Some tests failed. Please review the issues above.\n');
    }
  }

  /**
   * Manual trigger for testing specific functionality
   */
  async testSpecificTrigger(
    userId: string,
    triggerType: 'onboarding_welcome' | 'workout_streak' | 'milestone_celebration' | 'motivation_boost' | 'check_in' | 'random_social'
  ): Promise<void> {
    console.log(`🧪 Testing specific trigger: ${triggerType} for user ${userId}`);
    
    try {
      const success = await aiProactiveMessagingService.triggerProactiveMessageForUser(userId, triggerType);
      
      if (success) {
        console.log(`✅ Trigger ${triggerType} executed successfully`);
      } else {
        console.log(`❌ Trigger ${triggerType} failed`);
      }
    } catch (error) {
      console.log(`❌ Trigger ${triggerType} error:`, error);
    }
  }
}

// Export the tester
export const aiMessagingTester = new AIMessagingSystemTester();

// If this script is run directly
if (require.main === module) {
  aiMessagingTester.runAllTests().catch(console.error);
}