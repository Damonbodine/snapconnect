/**
 * Fix AI Post Expiry Script
 * Sets proper expiry times for AI posts so they show in discover feed
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  'https://lubfyjzdfgpoocsswrkz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixAIPostExpiry() {
  console.log('🔧 Setting expiry times for AI posts...\n');
  
  try {
    // First, get AI posts with null expiry
    const { data: aiPosts, error } = await supabase
      .from('posts')
      .select(`
        id,
        users!inner(username, is_mock_user)
      `)
      .eq('users.is_mock_user', true)
      .is('expires_at', null);
    
    if (error) {
      console.error('❌ Error fetching AI posts:', error);
      return;
    }
    
    console.log(`📊 Found ${aiPosts.length} AI posts with null expiry`);
    
    // Set expiry to 24 hours from now (same as normal posts)
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 24);
    
    let fixedCount = 0;
    
    for (const post of aiPosts) {
      const { error: updateError } = await supabase
        .from('posts')
        .update({ expires_at: expiryTime.toISOString() })
        .eq('id', post.id);
      
      if (updateError) {
        console.error(`❌ Failed to fix @${post.users.username}:`, updateError.message);
      } else {
        fixedCount++;
        console.log(`✅ Fixed @${post.users.username}`);
      }
    }
    
    console.log(`\n🎉 Updated ${fixedCount}/${aiPosts.length} AI posts with expiry: ${expiryTime.toISOString()}`);
    console.log('📱 Now refresh your discover feed to see AI posts!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

fixAIPostExpiry().catch(console.error);