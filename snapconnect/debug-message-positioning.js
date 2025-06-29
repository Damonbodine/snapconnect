/**
 * Debug Message Positioning Issue
 */

console.log('🔍 Message Positioning Debug');
console.log('============================');

console.log('\n❌ CURRENT ISSUE:');
console.log('Both messages appearing on LEFT side in chat');
console.log('- AI message should be LEFT ✅');
console.log('- User message should be RIGHT ❌');

console.log('\n🔍 CHECK CONSOLE LOGS:');
console.log('Look for "🔍 Message Positioning Debug" entries');
console.log('Compare sender_id with current_user_id');

console.log('\n🚨 POSSIBLE CAUSES:');
console.log('1. user.id is null/undefined (auth issue)');
console.log('2. sender_id is null for user messages');
console.log('3. sender_id format mismatch');

console.log('\n📱 ACTION: Check debug logs in your app console now!');