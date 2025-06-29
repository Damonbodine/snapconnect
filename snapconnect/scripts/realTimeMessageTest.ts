/**
 * Real-time Message Positioning Test
 * Add this to your app and run it to verify the fix is working
 */

import { messageService } from '../src/services/messageService';
import { useAuthStore } from '../src/stores/authStore';

export const runRealTimeMessageTest = async () => {
  console.log('🧪 Starting Real-Time Message Positioning Test');
  console.log('============================================');

  try {
    // Get current user info
    const authState = useAuthStore.getState();
    const currentUser = authState.user;
    
    if (!currentUser?.id) {
      console.error('❌ TEST FAILED: No authenticated user found');
      console.log('Fix: Make sure you are logged in');
      return;
    }

    console.log('✅ Current user ID:', currentUser.id);

    // Test with a friend ID (you'll need to replace this)
    const testFriendId = 'test-friend-id'; // Replace with actual friend/AI user ID
    
    console.log('\n📡 Testing message retrieval...');
    
    // Fetch messages using the fixed function
    const messages = await messageService.getMessagesBetweenFriends(testFriendId, 10);
    
    console.log(`✅ Retrieved ${messages.length} messages`);
    
    if (messages.length === 0) {
      console.log('ℹ️  No messages found. Try with a different friend ID or send some messages first.');
      return;
    }

    // Analyze each message
    console.log('\n🔍 Analyzing message positioning...');
    
    let aiMessages = 0;
    let userMessages = 0;
    let friendMessages = 0;
    let positioningIssues = 0;

    messages.forEach((message, index) => {
      const isOwn = message.sender_id === currentUser.id;
      const expectedPosition = getExpectedPosition(message, currentUser.id);
      const actualPosition = isOwn ? 'RIGHT' : 'LEFT';
      const isCorrect = actualPosition === expectedPosition;

      // Count message types
      if (message.is_ai_sender) {
        aiMessages++;
      } else if (message.sender_id === currentUser.id) {
        userMessages++;
      } else {
        friendMessages++;
      }

      // Log detailed analysis
      console.log(`\nMessage ${index + 1}:`);
      console.log(`  Content: "${message.content?.substring(0, 30)}..."`);
      console.log(`  Sender ID: ${message.sender_id || 'null (AI)'}`);
      console.log(`  Receiver ID: ${message.receiver_id}`);
      console.log(`  Is AI: ${message.is_ai_sender}`);
      console.log(`  Positioning: ${isOwn ? 'isOwn=true' : 'isOwn=false'} → ${actualPosition}`);
      console.log(`  Expected: ${expectedPosition}`);
      console.log(`  Status: ${isCorrect ? '✅ CORRECT' : '❌ WRONG'}`);

      if (!isCorrect) {
        positioningIssues++;
        console.log(`    🚨 ISSUE: Message will appear on wrong side!`);
      }

      // Check for data integrity issues
      if (message.is_ai_sender && message.sender_id !== null) {
        console.log(`    ⚠️  WARNING: AI message has non-null sender_id`);
        positioningIssues++;
      }

      if (!message.is_ai_sender && message.sender_id === null) {
        console.log(`    ⚠️  WARNING: Human message has null sender_id`);
        positioningIssues++;
      }
    });

    // Summary
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('=======================');
    console.log(`Total messages: ${messages.length}`);
    console.log(`AI messages: ${aiMessages}`);
    console.log(`Your messages: ${userMessages}`);
    console.log(`Friend messages: ${friendMessages}`);
    console.log(`Positioning issues: ${positioningIssues}`);

    if (positioningIssues === 0) {
      console.log('\n🎉 SUCCESS! All messages will position correctly!');
      console.log('✅ The migration fix is working properly');
    } else {
      console.log('\n❌ ISSUES FOUND - Messages may still appear on wrong side');
      console.log('🔧 Next steps:');
      console.log('1. Check if migration was applied correctly');
      console.log('2. Verify the database function is returning correct data');
      console.log('3. Check for auth issues (user.id availability)');
    }

    return {
      success: positioningIssues === 0,
      totalMessages: messages.length,
      issues: positioningIssues,
      breakdown: { aiMessages, userMessages, friendMessages }
    };

  } catch (error: any) {
    console.error('❌ TEST FAILED:', error.message);
    console.log('🔧 Possible issues:');
    console.log('1. Network connectivity');
    console.log('2. Authentication problems');
    console.log('3. Invalid friend ID');
    console.log('4. Database function errors');
    return null;
  }
};

// Helper function to determine expected position
function getExpectedPosition(message: any, currentUserId: string): 'LEFT' | 'RIGHT' {
  if (message.is_ai_sender) {
    return 'LEFT';  // AI messages should always be on left
  }
  
  if (message.sender_id === currentUserId) {
    return 'RIGHT'; // Your messages should be on right
  }
  
  return 'LEFT';    // Friend messages should be on left
}

// Quick test function you can call from console
export const quickPositionTest = async (friendId: string) => {
  console.log(`🚀 Quick test with friend ID: ${friendId}`);
  return await runRealTimeMessageTest();
};

export default runRealTimeMessageTest;