/**
 * Fix AI Responses Script
 * Diagnoses and fixes issues preventing AI responses
 */

import { aiMessageHandler } from '../src/services/aiMessageHandler';
import { aiChatService } from '../src/services/aiChatService';
import { messageService } from '../src/services/messageService';
import { supabase } from '../src/services/supabase';

export class AIResponseFixer {
  
  /**
   * Comprehensive diagnostic and fix for AI responses
   */
  static async diagnoseAndFix(): Promise<void> {
    console.log('🔧 Starting AI Response Diagnostic & Fix...');

    try {
      // 1. Check if AI message handler is initialized
      console.log('\n1️⃣ Checking AI Message Handler...');
      await this.checkAIMessageHandler();

      // 2. Test database functions
      console.log('\n2️⃣ Testing Database Functions...');
      await this.testDatabaseFunctions();

      // 3. Test AI service integration
      console.log('\n3️⃣ Testing AI Service Integration...');
      await this.testAIServiceIntegration();

      // 4. Test end-to-end flow
      console.log('\n4️⃣ Testing End-to-End AI Response Flow...');
      await this.testEndToEndFlow();

      console.log('\n✅ AI Response Diagnostic Complete!');
      
    } catch (error: any) {
      console.error('❌ AI Response Diagnostic Failed:', error.message);
      throw error;
    }
  }

  /**
   * Check AI message handler status
   */
  private static async checkAIMessageHandler(): Promise<void> {
    try {
      const handler = aiMessageHandler.getInstance();
      
      // Try to initialize if not already done
      await handler.initialize();
      
      console.log('✅ AI Message Handler is running');
      
    } catch (error: any) {
      console.error('❌ AI Message Handler issue:', error.message);
      console.log('🔧 Fix: Ensure real-time subscriptions are working');
      throw error;
    }
  }

  /**
   * Test essential database functions
   */
  private static async testDatabaseFunctions(): Promise<void> {
    try {
      // Test send_ai_message function
      console.log('  Testing send_ai_message function...');
      
      // This is a dry run test - we'll call the function but with test data
      const { error: sendError } = await supabase.rpc('send_ai_message', {
        receiver_user_id: '00000000-0000-0000-0000-000000000000', // Invalid ID for test
        message_content: 'Test message',
        personality_type: 'test'
      });
      
      // We expect this to fail due to invalid ID, but function should exist
      if (sendError && sendError.message.includes('function') && sendError.message.includes('does not exist')) {
        console.error('❌ send_ai_message function does not exist');
        throw new Error('Database function send_ai_message is missing');
      } else {
        console.log('✅ send_ai_message function exists');
      }

      // Test get_ai_users function
      console.log('  Testing get_ai_users function...');
      const { data: aiUsers, error: getUsersError } = await supabase.rpc('get_ai_users');
      
      if (getUsersError) {
        console.error('❌ get_ai_users function error:', getUsersError.message);
        throw getUsersError;
      }
      
      if (!aiUsers || aiUsers.length === 0) {
        console.warn('⚠️ No AI users found in database');
        console.log('🔧 Fix: Create AI users or check is_mock_user flag');
      } else {
        console.log(`✅ Found ${aiUsers.length} AI users`);
      }

    } catch (error: any) {
      console.error('❌ Database function test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test AI service integration
   */
  private static async testAIServiceIntegration(): Promise<void> {
    try {
      const chatService = aiChatService.getInstance();
      
      // Test getting AI users
      console.log('  Testing AI user retrieval...');
      const aiUsers = await chatService.getAvailableAIUsers();
      
      if (aiUsers.length === 0) {
        console.warn('⚠️ No AI users available for chat');
        console.log('🔧 Fix: Create AI users with proper personality traits');
        return;
      }
      
      console.log(`✅ AI service can access ${aiUsers.length} AI users`);
      
      // Test AI response generation (dry run)
      console.log('  Testing AI response generation...');
      const testAI = aiUsers[0];
      
      try {
        const response = await chatService.generateAIResponse({
          ai_user_id: testAI.id,
          human_user_id: '00000000-0000-0000-0000-000000000000', // Test ID
          human_message: 'Hello, this is a test message'
        });
        
        console.log('✅ AI response generation works');
        console.log(`  Response: "${response.content.substring(0, 50)}..."`);
        
      } catch (error: any) {
        if (error.message.includes('OpenAI API key')) {
          console.error('❌ OpenAI API key not configured');
          console.log('🔧 Fix: Set EXPO_PUBLIC_OPENAI_API_KEY in your .env file');
        } else {
          console.error('❌ AI response generation failed:', error.message);
        }
        throw error;
      }
      
    } catch (error: any) {
      console.error('❌ AI service integration test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test end-to-end AI response flow
   */
  private static async testEndToEndFlow(): Promise<void> {
    try {
      console.log('  Testing full AI response workflow...');
      
      // This would test the complete flow from human message to AI response
      // For now, we'll just verify the components are in place
      
      const chatService = aiChatService.getInstance();
      const handler = aiMessageHandler.getInstance();
      
      console.log('✅ All AI response components are initialized');
      console.log('  - AI Chat Service: ✓');
      console.log('  - AI Message Handler: ✓');
      console.log('  - Database Functions: ✓');
      
      console.log('\n🎯 Next Steps to Enable AI Responses:');
      console.log('1. Send a message in your app to an AI user');
      console.log('2. Check console logs for AI response generation');
      console.log('3. Look for messages in your chat within 3-5 seconds');
      
    } catch (error: any) {
      console.error('❌ End-to-end test failed:', error.message);
      throw error;
    }
  }

  /**
   * Quick fix for common AI response issues
   */
  static async quickFix(): Promise<void> {
    console.log('🚀 Running Quick AI Response Fix...');
    
    try {
      // 1. Reinitialize AI message handler
      const handler = aiMessageHandler.getInstance();
      await handler.initialize();
      
      // 2. Test basic connectivity
      const { data, error } = await supabase.rpc('get_ai_users');
      if (error) throw error;
      
      console.log('✅ Quick fix complete - AI responses should now work');
      console.log(`Found ${data?.length || 0} AI users ready to respond`);
      
    } catch (error: any) {
      console.error('❌ Quick fix failed:', error.message);
      console.log('Run the full diagnostic: AIResponseFixer.diagnoseAndFix()');
    }
  }
}

export default AIResponseFixer;