/**
 * Test Single AI Post Creation
 * Creates one test post to verify the full pipeline works
 * 
 * Usage: npx tsx scripts/testSinglePost.ts [user_id]
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

interface AIUser {
  id: string;
  username: string;
  full_name: string;
  personality_traits: any;
  archetype: string;
}

async function generateTestContent(user: AIUser): Promise<{caption: string, imageBase64: string}> {
  console.log(`🤖 Generating content for @${user.username} (${user.archetype})`);
  
  // Generate text content
  const systemPrompt = `You are a ${user.archetype} fitness enthusiast posting on social media. 
Your personality: enthusiastic beginner who's excited about fitness.
Write a short, authentic workout post (2-3 sentences) about a workout you just completed.
Include 1-2 relevant emojis and keep it under 100 characters.`;

  const textCompletion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Share what workout you just completed today' }
    ],
    max_tokens: 80,
    temperature: 0.8
  });

  const caption = textCompletion.choices[0]?.message?.content?.trim() || 'Just finished an amazing workout! 💪';
  
  console.log(`📝 Generated caption: "${caption}"`);

  // Generate image using GPT-Image-1 with proper parameters
  const imagePrompt = `High-quality fitness photograph showing a beginner-friendly gym environment with encouraging atmosphere and good lighting. Person doing basic workout exercises like bodyweight movements or light weights. Professional photography, realistic style, good composition, appropriate for social media fitness content.`;

  const imageResponse = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: imagePrompt,
    size: '1024x1024', // Square format
    quality: 'low' // Low quality for cost optimization and faster generation
    // Note: GPT-Image-1 always returns base64, no response_format needed
    // Note: n=1 is default and only supported value for GPT-Image-1
  });

  const imageBase64 = imageResponse.data[0].b64_json!;
  console.log(`🎨 Generated image (${imageBase64.length} chars base64)`);

  return { caption, imageBase64 };
}

async function uploadImageToStorage(imageBase64: string, userId: string): Promise<string> {
  console.log('📤 Uploading image to Supabase storage...');
  
  // Convert base64 to buffer
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  
  // Generate unique filename
  const timestamp = Date.now();
  const filename = `ai-generated/${userId}/test-post-${timestamp}.png`;

  // Upload to Supabase storage
  const { data, error } = await supabase.storage
    .from('posts-media')
    .upload(filename, imageBuffer, {
      contentType: 'image/png',
      cacheControl: '3600',
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from('posts-media')
    .getPublicUrl(filename);

  console.log(`✅ Image uploaded: ${publicUrlData.publicUrl}`);
  return publicUrlData.publicUrl;
}

async function createPostInDatabase(userId: string, caption: string, mediaUrl: string): Promise<string> {
  console.log('💾 Creating post in database...');
  
  // Set expiry to 24 hours from now
  const expiryTime = new Date();
  expiryTime.setHours(expiryTime.getHours() + 24);

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content: caption,
      media_url: mediaUrl,
      media_type: 'photo',
      workout_type: 'general',
      expires_at: expiryTime.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Database insert failed: ${error.message}`);
  }

  console.log(`✅ Post created with ID: ${data.id}`);
  return data.id;
}

async function createTestPost(targetUserId?: string) {
  try {
    console.log('🚀 Creating test AI post...\n');

    // Get a user to post for
    let user: AIUser;
    
    if (targetUserId) {
      console.log(`🎯 Using specified user: ${targetUserId}`);
      const { data, error } = await supabase
        .from('users')
        .select('id, username, full_name, personality_traits')
        .eq('id', targetUserId)
        .eq('is_mock_user', true)
        .single();
        
      if (error || !data) {
        throw new Error(`User ${targetUserId} not found or not an AI user`);
      }
      
      user = {
        ...data,
        archetype: data.personality_traits?.archetype || 'fitness_newbie'
      };
    } else {
      console.log('🎲 Selecting random ready user...');
      const { data: readyUsers, error } = await supabase
        .rpc('get_ai_users_ready_for_posting')
        .limit(1);
        
      if (error || !readyUsers || readyUsers.length === 0) {
        throw new Error('No users ready for posting found');
      }
      
      user = {
        id: readyUsers[0].id,
        username: readyUsers[0].username,
        full_name: readyUsers[0].full_name,
        personality_traits: readyUsers[0].personality_traits,
        archetype: readyUsers[0].archetype
      };
    }

    console.log(`👤 Selected user: @${user.username} (${user.archetype})\n`);

    // Generate content
    const { caption, imageBase64 } = await generateTestContent(user);
    console.log();

    // Upload image
    const mediaUrl = await uploadImageToStorage(imageBase64, user.id);
    console.log();

    // Create post
    const postId = await createPostInDatabase(user.id, caption, mediaUrl);
    console.log();

    console.log('🎉 SUCCESS! Test post created successfully!');
    console.log(`📱 Post ID: ${postId}`);
    console.log(`👤 User: @${user.username}`);
    console.log(`📝 Caption: "${caption}"`);
    console.log(`🖼️ Media: ${mediaUrl}`);

  } catch (error) {
    console.error('❌ Test post creation failed:', error);
    process.exit(1);
  }
}

async function main() {
  const targetUserId = process.argv[2];
  await createTestPost(targetUserId);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}

export { createTestPost };