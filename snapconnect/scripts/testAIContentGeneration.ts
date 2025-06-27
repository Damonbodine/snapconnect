/**
 * Test AI Content Generation Script
 * Tests the complete content generation pipeline with specific user IDs
 * 
 * Usage: npx tsx scripts/testAIContentGeneration.ts
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { openaiService } from '../src/services/openaiService';
import { contentGenerationService } from '../src/services/contentGenerationService';
import { AI_ARCHETYPES } from '../src/types/aiPersonality';

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

/**
 * Get sample AI users for testing (one from each archetype)
 */
async function getSampleAIUsers() {
  try {
    console.log('🔍 Finding sample AI users for testing...\n');
    
    const sampleUsers: any[] = [];
    
    // Get one user from each archetype for comprehensive testing
    for (const archetype of AI_ARCHETYPES) {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, username, full_name, personality_traits')
        .eq('is_mock_user', true)
        .limit(1);
        
      if (error) {
        console.error(`❌ Failed to get users for ${archetype.name}:`, error);
        continue;
      }
      
      // Find users matching this archetype by username pattern
      const archetypeUser = users?.find(user => {
        const username = user.username.toLowerCase();
        switch (archetype.id) {
          case 'fitness_newbie':
            return username.includes('newbie') || username.includes('beginner') || username.includes('starting');
          case 'strength_warrior':
            return username.includes('iron') || username.includes('strength') || username.includes('barbell') || username.includes('lift');
          case 'cardio_queen':
            return username.includes('run') || username.includes('cardio') || username.includes('endurance') || username.includes('heart');
          case 'zen_master':
            return username.includes('zen') || username.includes('mindful') || username.includes('yoga') || username.includes('balance');
          case 'outdoor_adventurer':
            return username.includes('trail') || username.includes('outdoor') || username.includes('nature') || username.includes('peak');
          default:
            return false;
        }
      });
      
      if (archetypeUser) {
        sampleUsers.push({
          ...archetypeUser,
          archetype: archetype.id,
          archetypeName: archetype.name
        });
        console.log(`✅ Found ${archetype.name}: @${archetypeUser.username} (${archetypeUser.id})`);
      }
    }
    
    console.log(`\n📊 Selected ${sampleUsers.length} users for testing\n`);
    return sampleUsers;
  } catch (error) {
    console.error('❌ Failed to get sample users:', error);
    return [];
  }
}

/**
 * Test content generation for a specific user
 */
async function testContentGenerationForUser(user: any, contentType: string) {
  try {
    console.log(`🧪 Testing ${contentType} generation for @${user.username} (${user.archetypeName})...`);
    
    const startTime = Date.now();
    
    // Generate content (but don't create actual post)
    const content = await contentGenerationService.generateContentForUser({
      userId: user.id,
      contentType: contentType as any,
      forceGenerate: true // Skip scheduling checks for testing
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`   ✅ Generated in ${duration}ms`);
    console.log(`   📝 Caption: "${content.caption.substring(0, 100)}..."`);
    console.log(`   🎨 Image: ${content.imageBase64.length} characters (base64)`);
    console.log(`   🤖 Archetype: ${content.metadata.archetype}`);
    console.log(`   📅 Generated: ${content.metadata.generatedAt}`);
    console.log('');
    
    return {
      success: true,
      user: user.username,
      archetype: user.archetypeName,
      contentType,
      duration,
      captionLength: content.caption.length,
      imageSize: content.imageBase64.length
    };
  } catch (error) {
    console.error(`   ❌ Failed: ${error instanceof Error ? error.message : error}`);
    console.log('');
    
    return {
      success: false,
      user: user.username,
      archetype: user.archetypeName,
      contentType,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test OpenAI service directly
 */
async function testOpenAIService() {
  try {
    console.log('🔬 Testing OpenAI service directly...\n');
    
    // Test text generation
    console.log('📝 Testing text generation...');
    const textResult = await openaiService.generateTextContent({
      prompt: 'Share a motivational fitness post',
      personality: {
        fitness_level: 'intermediate',
        communication_style: 'motivational',
        content_tone: 'encouraging',
        emoji_usage: 'medium',
        hashtag_style: 'moderate'
      },
      archetype: AI_ARCHETYPES[0], // Use first archetype
      contentType: 'motivation'
    });
    
    console.log(`   ✅ Text generated: "${textResult.substring(0, 100)}..."`);
    console.log('');
    
    // Test image generation
    console.log('🎨 Testing image generation...');
    const imageResult = await openaiService.generateImage({
      prompt: textResult,
      archetype: AI_ARCHETYPES[0],
      workoutType: 'strength'
    });
    
    console.log(`   ✅ Image generated: ${imageResult.length} characters (base64)`);
    console.log('');
    
    return true;
  } catch (error) {
    console.error('❌ OpenAI service test failed:', error);
    return false;
  }
}

/**
 * Run comprehensive tests
 */
async function runTests() {
  console.log('🧪 AI Content Generation Test Suite\n');
  
  // Check environment
  if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY === 'your_openai_api_key_here') {
    console.error('❌ OpenAI API key not configured');
    console.log('💡 Please set EXPO_PUBLIC_OPENAI_API_KEY in your .env file');
    return;
  }
  
  console.log('✅ Environment validated\n');
  
  // Test OpenAI service directly
  const openaiTestResult = await testOpenAIService();
  if (!openaiTestResult) {
    console.error('❌ OpenAI service test failed, aborting further tests');
    return;
  }
  
  // Get sample users
  const sampleUsers = await getSampleAIUsers();
  if (sampleUsers.length === 0) {
    console.error('❌ No sample users found for testing');
    return;
  }
  
  // Test different content types
  const contentTypes = ['workout_post', 'motivation', 'progress_update'];
  const testResults: any[] = [];
  
  console.log('🚀 Running content generation tests...\n');
  
  for (const contentType of contentTypes) {
    console.log(`📋 Testing ${contentType} content type:`);
    
    for (const user of sampleUsers.slice(0, 2)) { // Test with first 2 users to save API calls
      const result = await testContentGenerationForUser(user, contentType);
      testResults.push(result);
      
      // Small delay between tests to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log('📊 Test Results Summary:');
  const successful = testResults.filter(r => r.success);
  const failed = testResults.filter(r => !r.success);
  
  console.log(`   Total Tests: ${testResults.length}`);
  console.log(`   Successful: ${successful.length}`);
  console.log(`   Failed: ${failed.length}`);
  console.log('');
  
  if (successful.length > 0) {
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
    const avgCaptionLength = successful.reduce((sum, r) => sum + r.captionLength, 0) / successful.length;
    
    console.log('📈 Performance Metrics:');
    console.log(`   Average Generation Time: ${Math.round(avgDuration)}ms`);
    console.log(`   Average Caption Length: ${Math.round(avgCaptionLength)} characters`);
    console.log('');
  }
  
  if (failed.length > 0) {
    console.log('❌ Failed Tests:');
    failed.forEach(result => {
      console.log(`   @${result.user} (${result.archetype}) - ${result.contentType}: ${result.error}`);
    });
    console.log('');
  }
  
  console.log('🎉 Test suite complete!');
  
  if (successful.length > 0) {
    console.log('\n🚀 Next Steps:');
    console.log('   1. Run the migration: npx tsx scripts/applyMigration.ts 011_add_posting_automation.sql');
    console.log('   2. Test daily posting: npx tsx scripts/runDailyBotArmy.ts --stats');
    console.log('   3. Create test posts: npx tsx scripts/runDailyBotArmy.ts --users "user_id_1,user_id_2"');
  }
}

// Execute if run directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export { runTests };