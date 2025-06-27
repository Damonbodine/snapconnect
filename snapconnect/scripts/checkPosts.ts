/**
 * Check Posts Script
 * Quick script to check how many posts exist and which are from AI users
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

async function checkPosts() {
  console.log('🔍 Checking posts in database...\n');
  
  try {
    // Get total post count
    const { data: allPosts, error: allPostsError } = await supabase
      .from('posts')
      .select('id, user_id, content, created_at', { count: 'exact' });
      
    if (allPostsError) {
      console.error('❌ Error fetching posts:', allPostsError);
      return;
    }
    
    console.log(`📊 Total posts in database: ${allPosts.length}`);
    
    // Get AI user posts
    const { data: aiUserPosts, error: aiPostsError } = await supabase
      .from('posts')
      .select(`
        id, 
        content, 
        created_at,
        users!inner (
          username,
          is_mock_user,
          full_name
        )
      `)
      .eq('users.is_mock_user', true);
      
    if (aiPostsError) {
      console.error('❌ Error fetching AI posts:', aiPostsError);
      return;
    }
    
    console.log(`🤖 AI user posts: ${aiUserPosts.length}`);
    
    if (aiUserPosts.length > 0) {
      console.log('\n📝 Recent AI posts:');
      aiUserPosts.slice(0, 5).forEach((post: any) => {
        console.log(`   @${post.users.username}: "${post.content.substring(0, 50)}..."`);
      });
    }
    
    // Get AI users count
    const { data: aiUsers, error: aiUsersError } = await supabase
      .from('users')
      .select('id, username, full_name', { count: 'exact' })
      .eq('is_mock_user', true);
      
    if (aiUsersError) {
      console.error('❌ Error fetching AI users:', aiUsersError);
      return;
    }
    
    console.log(`\n👥 AI users created: ${aiUsers.length}`);
    
    if (aiUsers.length > 0) {
      console.log('\n🎭 Sample AI users:');
      aiUsers.slice(0, 5).forEach((user: any) => {
        console.log(`   @${user.username} (${user.full_name})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkPosts().catch(console.error);