/**
 * Simplified Bot Army Script
 * Bypasses service layer issues and runs posting directly
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY!
});

interface PostResult {
  success: boolean;
  username: string;
  postId?: string;
  error?: string;
}

async function generateContentForUser(user: any): Promise<{caption: string, imageBase64: string}> {
  // Generate text content
  const systemPrompt = `You are a ${user.archetype} fitness enthusiast posting on social media.
Write a short, authentic fitness post (2-3 sentences) about your workout or fitness journey.
Include 1-2 relevant emojis and keep it under 120 characters.
Be enthusiastic but authentic to a ${user.archetype} personality.`;

  const textCompletion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Share something about your fitness journey today' }
    ],
    max_tokens: 80,
    temperature: 0.8
  });

  const caption = textCompletion.choices[0]?.message?.content?.trim() || 'Just finished an amazing workout! 💪';

  // Generate image using GPT-Image-1
  const imagePrompt = `High-quality fitness photograph showing a ${user.archetype.replace('_', ' ')} in a gym environment. Professional photography, realistic style, good composition, appropriate for social media fitness content.`;

  const imageResponse = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: imagePrompt,
    size: '1024x1024',
    quality: 'low'
  });

  const imageBase64 = imageResponse.data[0].b64_json!;
  return { caption, imageBase64 };
}

async function createPostForUser(user: any): Promise<PostResult> {
  try {
    console.log(`📝 Creating post for @${user.username} (${user.archetype})`);

    // Generate content
    const { caption, imageBase64 } = await generateContentForUser(user);

    // Upload image
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const timestamp = Date.now();
    const filename = `ai-generated/${user.id}/daily-${timestamp}.png`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('posts-media')
      .upload(filename, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('posts-media')
      .getPublicUrl(filename);

    const mediaUrl = publicUrlData.publicUrl;

    // Create post
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 24);

    const { data: postData, error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        content: caption,
        media_url: mediaUrl,
        media_type: 'photo',
        workout_type: 'general',
        expires_at: expiryTime.toISOString(),
      })
      .select('id')
      .single();

    if (postError) {
      throw new Error(`Database insert failed: ${postError.message}`);
    }

    console.log(`✅ @${user.username}: "${caption.substring(0, 50)}..."`);
    
    return {
      success: true,
      username: user.username,
      postId: postData.id
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`❌ @${user.username}: ${errorMessage}`);
    
    return {
      success: false,
      username: user.username,
      error: errorMessage
    };
  }
}

async function main() {
  try {
    console.log('🤖 Starting Simplified Bot Army Daily Posting...\n');

    // Get users ready for posting (bypass daily filter for testing)
    const { data: readyUsers, error } = await supabase
      .from('users')
      .select('id, username, full_name, personality_traits')
      .eq('is_mock_user', true)
      .limit(10);

    if (error) {
      throw new Error(`Failed to get ready users: ${error.message}`);
    }

    if (!readyUsers || readyUsers.length === 0) {
      console.log('📭 No users ready for posting at this time');
      return;
    }

    // Add archetype field for users
    const usersWithArchetype = readyUsers.map(user => ({
      ...user,
      archetype: user.personality_traits?.archetype || 'fitness_newbie'
    }));

    console.log(`👥 Found ${usersWithArchetype.length} users ready to post\n`);

    // Limit to first 5 users for initial test
    const usersToProcess = usersWithArchetype.slice(0, 5);
    console.log(`🎯 Processing first ${usersToProcess.length} users for testing...\n`);

    const results: PostResult[] = [];

    // Process users sequentially to avoid rate limiting
    for (let i = 0; i < usersToProcess.length; i++) {
      const user = usersToProcess[i];
      console.log(`[${i + 1}/${usersToProcess.length}] Processing @${user.username}...`);
      
      try {
        const result = await createPostForUser(user);
        results.push(result);
        
        // Small delay between posts
        if (i < usersToProcess.length - 1) {
          console.log('⏱️ Waiting 3 seconds...\n');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error) {
        results.push({
          success: false,
          username: user.username,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('\n📊 RESULTS SUMMARY:');
    console.log(`✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);

    if (successful.length > 0) {
      console.log('\n✅ Successful Posts:');
      successful.forEach(result => {
        console.log(`   @${result.username} (${result.postId})`);
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed Posts:');
      failed.forEach(result => {
        console.log(`   @${result.username}: ${result.error}`);
      });
    }

    console.log('\n🎉 Bot army run completed!');

  } catch (error) {
    console.error('❌ Bot army run failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}

export { main as runSimpleBotArmy };