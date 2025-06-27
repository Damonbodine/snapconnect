/**
 * Fix AI Post Images Script
 * Updates AI posts with proper Unsplash URLs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  'https://lubfyjzdfgpoocsswrkz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Proper Unsplash photo IDs for fitness content
const fitnessPhotos = [
  'photo-1571019613454-1cb2f99b2d8b', // gym
  'photo-1506629905607-45b6b7e84a15', // workout
  'photo-1434682772747-f16d3ea162c3', // running
  'photo-1544367567-0f2fcb009e0b', // yoga
  'photo-1571019613540-996f6b21b7ac', // strength
  'photo-1540324155974-7dc4e01f9c3e', // cardio
  'photo-1508215885820-4585e56135c8', // outdoor
  'photo-1573384665317-663b2b9bb48b'  // fitness
];

async function fixAIPostImages() {
  console.log('🔧 Fixing AI post media URLs...\n');
  
  try {
    const { data: aiPosts, error } = await supabase
      .from('posts')
      .select(`
        id,
        users!inner(username, is_mock_user)
      `)
      .eq('users.is_mock_user', true);
    
    if (error) {
      console.error('❌ Error fetching AI posts:', error);
      return;
    }
    
    console.log(`📊 Found ${aiPosts.length} AI posts to fix`);
    
    let fixedCount = 0;
    
    for (const post of aiPosts) {
      const randomPhoto = fitnessPhotos[Math.floor(Math.random() * fitnessPhotos.length)];
      const correctUrl = `https://images.unsplash.com/${randomPhoto}?w=800&h=800&fit=crop&crop=center`;
      
      const { error: updateError } = await supabase
        .from('posts')
        .update({ media_url: correctUrl })
        .eq('id', post.id);
        
      if (updateError) {
        console.error(`❌ Failed to fix @${post.users.username}:`, updateError.message);
      } else {
        console.log(`✅ Fixed @${post.users.username}`);
        fixedCount++;
      }
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n🎉 Fixed ${fixedCount}/${aiPosts.length} AI post media URLs!`);
    console.log('📱 Now refresh your discover feed to see the AI posts with images!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

fixAIPostImages().catch(console.error);