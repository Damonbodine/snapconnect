/**
 * Debug Discover Feed Script
 * Test what posts are being returned by the database vs what's shown in the UI
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

async function debugDiscoverFeed() {
  console.log('🔍 Debugging discover feed...\n');
  
  try {
    // Get your user ID (assuming you're the latest real user)
    const { data: realUsers, error: realUsersError } = await supabase
      .from('users')
      .select('id, username, is_mock_user')
      .eq('is_mock_user', false)
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (realUsersError || !realUsers || realUsers.length === 0) {
      console.error('❌ Could not find real user:', realUsersError);
      return;
    }
    
    const testUserId = realUsers[0].id;
    console.log(`👤 Testing with user: @${realUsers[0].username} (${testUserId})`);
    
    // Test the database function directly
    console.log('\n🗄️  Testing get_unviewed_posts function directly...');
    const { data: dbPosts, error: dbError } = await supabase
      .rpc('get_unviewed_posts', {
        p_user_id: testUserId,
        p_limit: 20,
        p_offset: 0
      });
      
    if (dbError) {
      console.error('❌ Database function error:', dbError);
      return;
    }
    
    console.log(`📊 Database returned ${dbPosts.length} posts`);
    
    // Analyze the posts
    const aiPosts = dbPosts.filter((post: any) => post.username?.includes('_') || post.username?.includes('newbie') || post.username?.includes('strength'));
    const realPosts = dbPosts.filter((post: any) => !aiPosts.includes(post));
    
    console.log(`🤖 AI posts in results: ${aiPosts.length}`);
    console.log(`👤 Real user posts in results: ${realPosts.length}`);
    
    if (aiPosts.length > 0) {
      console.log('\n🎭 Sample AI posts:');
      aiPosts.slice(0, 3).forEach((post: any, index: number) => {
        console.log(`   ${index + 1}. @${post.username}: "${post.content.substring(0, 50)}..."`);
      });
    }
    
    if (realPosts.length > 0) {
      console.log('\n👤 Sample real posts:');
      realPosts.slice(0, 3).forEach((post: any, index: number) => {
        console.log(`   ${index + 1}. @${post.username}: "${post.content.substring(0, 50)}..."`);
      });
    }
    
    // Check AI users directly
    console.log('\n🤖 Checking AI users directly...');
    const { data: aiUsers, error: aiUsersError } = await supabase
      .from('users')
      .select('id, username, is_mock_user')
      .eq('is_mock_user', true)
      .limit(5);
      
    if (aiUsersError) {
      console.error('❌ Error fetching AI users:', aiUsersError);
      return;
    }
    
    console.log(`👥 Found ${aiUsers.length} AI users in database`);
    
    // Check AI posts directly
    const { data: directAIPosts, error: aiPostsError } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        created_at,
        users!inner(username, is_mock_user)
      `)
      .eq('users.is_mock_user', true)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (aiPostsError) {
      console.error('❌ Error fetching AI posts directly:', aiPostsError);
      return;
    }
    
    console.log(`📝 Found ${directAIPosts.length} AI posts directly`);
    
    if (directAIPosts.length > 0) {
      console.log('\n📋 Recent AI posts (direct query):');
      directAIPosts.forEach((post: any, index: number) => {
        console.log(`   ${index + 1}. @${post.users.username}: "${post.content.substring(0, 50)}..."`);
      });
    }
    
    // Check if there are any post_views for your user
    const { data: viewRecords, error: viewError } = await supabase
      .from('post_views')
      .select('post_id')
      .eq('user_id', testUserId);
      
    if (!viewError) {
      console.log(`\n👁️  User has viewed ${viewRecords.length} posts total`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

debugDiscoverFeed().catch(console.error);