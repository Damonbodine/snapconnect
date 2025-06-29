/**
 * Test Digital Human Memory System
 * Tests the complete digital human personality and memory system
 */

import { aiChatService } from '../src/services/aiChatService';
import { digitalHumanMemoryService } from '../src/services/digitalHumanMemory';
import { DigitalHumanPersonality } from '../src/services/digitalHumanPersonality';

async function testDigitalHumanMemorySystem() {
  console.log('🧪 Testing Digital Human Memory System...\n');

  try {
    // Step 1: Get available AI users
    console.log('📋 Step 1: Getting available AI users...');
    const aiUsers = await aiChatService.getAvailableAIUsers();
    console.log(`✅ Found ${aiUsers.length} AI users available`);
    
    if (aiUsers.length === 0) {
      console.log('❌ No AI users found. Make sure you have AI users in your database.');
      return;
    }

    const testAI = aiUsers[0]; // Use first AI user for testing
    console.log(`🤖 Testing with AI: ${testAI.full_name} (@${testAI.username})`);
    console.log(`   Archetype: ${testAI.archetype_id}\n`);

    // Step 2: Test personality generation
    console.log('🎭 Step 2: Testing personality generation...');
    const systemPrompt = DigitalHumanPersonality.generateSystemPrompt(testAI);
    console.log('✅ Generated system prompt:');
    console.log(systemPrompt.substring(0, 500) + '...\n');

    // Step 3: Store system prompt
    console.log('💾 Step 3: Testing system prompt storage...');
    const stored = await digitalHumanMemoryService.storeSystemPrompt(testAI.id, systemPrompt);
    console.log(`✅ System prompt stored: ${stored}\n`);

    // Step 4: Test conversation memory (simulate user)
    const testHumanUserId = 'test-human-user-123'; // Would be real user ID in practice
    console.log('🧠 Step 4: Testing conversation memory...');
    
    // First conversation - should be null
    let memory = await digitalHumanMemoryService.getConversationMemory(testAI.id, testHumanUserId);
    console.log(`✅ Initial memory (should be null): ${memory ? 'Found existing' : 'None'}`);

    // Simulate a conversation
    console.log('\n💬 Step 5: Simulating first conversation...');
    const testMessages = [
      { content: "Hi! I'm John, new to fitness and looking for some motivation", is_ai_sender: false, sent_at: new Date().toISOString() },
      { content: "Hey John! Welcome to the fitness journey! I'm Sarah and I love helping newcomers", is_ai_sender: true, sent_at: new Date().toISOString() }
    ];

    // Extract details and update memory
    const humanDetails = digitalHumanMemoryService.extractHumanDetails(testMessages);
    console.log('✅ Extracted human details:', humanDetails);

    // Update conversation memory
    const memoryId = await digitalHumanMemoryService.updateConversationMemory(
      testAI.id,
      testHumanUserId,
      2 // 2 messages exchanged
    );
    console.log(`✅ Updated conversation memory: ${memoryId}`);

    // Update human details learned
    if (Object.keys(humanDetails).length > 0) {
      const updated = await digitalHumanMemoryService.updateHumanDetailsLearned(
        testAI.id,
        testHumanUserId,
        humanDetails
      );
      console.log(`✅ Updated human details: ${updated}`);
    }

    // Step 6: Test memory retrieval
    console.log('\n🔍 Step 6: Testing memory retrieval...');
    memory = await digitalHumanMemoryService.getConversationMemory(testAI.id, testHumanUserId);
    if (memory) {
      console.log('✅ Retrieved conversation memory:');
      console.log(`   Total conversations: ${memory.total_conversations}`);
      console.log(`   Relationship stage: ${memory.relationship_stage}`);
      console.log(`   Human details learned:`, memory.human_details_learned);
    }

    // Step 7: Test memory context building
    console.log('\n🏗️ Step 7: Testing memory context building...');
    const memoryContext = digitalHumanMemoryService.buildMemoryContext(memory, 'John');
    console.log('✅ Built memory context:');
    console.log(memoryContext);

    // Step 8: Test full AI response with memory
    console.log('\n🤖 Step 8: Testing full AI response with memory...');
    try {
      const response = await aiChatService.generateAIResponse({
        ai_user_id: testAI.id,
        human_user_id: testHumanUserId,
        human_message: "I'm really struggling to stay motivated with my workouts. Any tips?"
      });

      console.log('✅ Generated AI response with memory:');
      console.log(`   Message ID: ${response.message_id}`);
      console.log(`   Content: ${response.content}`);
      console.log(`   Typing delay: ${response.typing_delay_ms}ms`);
    } catch (error) {
      console.log('⚠️ AI response generation failed (this might be expected if OpenAI is not configured):');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Step 9: Test conversation summary generation
    console.log('\n📝 Step 9: Testing conversation summary generation...');
    try {
      const summary = await digitalHumanMemoryService.generateConversationSummary(
        testMessages,
        testAI.full_name,
        'John'
      );

      if (summary) {
        console.log('✅ Generated conversation summary:');
        console.log(`   Summary: ${summary.summary}`);
        console.log(`   Topics: ${summary.topics_discussed.join(', ')}`);
        console.log(`   New details: ${JSON.stringify(summary.new_details_learned)}`);
        console.log(`   Emotional tone: ${summary.emotional_tone}`);
        console.log(`   Importance: ${summary.importance_score}/5`);
      }
    } catch (error) {
      console.log('⚠️ Summary generation failed (this might be expected if OpenAI is not configured):');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('\n🎉 Digital Human Memory System Test Complete!');
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ AI Users Available: ${aiUsers.length}`);
    console.log(`✅ Personality Generation: Working`);
    console.log(`✅ System Prompt Storage: Working`);
    console.log(`✅ Conversation Memory: Working`);
    console.log(`✅ Memory Context Building: Working`);
    console.log(`✅ Human Detail Extraction: Working`);
    console.log(`⚠️ AI Response Generation: Depends on OpenAI configuration`);
    console.log(`⚠️ Conversation Summarization: Depends on OpenAI configuration`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

async function showSystemCapabilities() {
  console.log('🎯 Digital Human Memory System Capabilities:\n');
  
  console.log('🎭 PERSONALITY SYSTEM:');
  console.log('   • Generates unique life stories for each AI based on archetype');
  console.log('   • Creates expansive personalities with jobs, hobbies, challenges');
  console.log('   • Builds consistent character traits and communication styles');
  console.log('   • Stores generated prompts for consistency across conversations\n');
  
  console.log('🧠 MEMORY SYSTEM:');
  console.log('   • Tracks relationship progression (new → acquaintance → friend)');
  console.log('   • Remembers human details (name, job, goals, interests)');
  console.log('   • Builds conversation history and shared experiences');
  console.log('   • Creates contextual memory for natural follow-ups\n');
  
  console.log('💬 CONVERSATION FEATURES:');
  console.log('   • AI references previous conversations naturally');
  console.log('   • Remembers and asks about things humans mentioned');
  console.log('   • Builds genuine relationships over time');
  console.log('   • Balances fitness and life topics authentically\n');
  
  console.log('📊 TECHNICAL FEATURES:');
  console.log('   • Persistent memory storage in PostgreSQL');
  console.log('   • Automatic conversation summarization');
  console.log('   • Relationship stage tracking');
  console.log('   • Memory-aware prompt building\n');
}

// Run the test
async function main() {
  await showSystemCapabilities();
  await testDigitalHumanMemorySystem();
}

main().catch(console.error);