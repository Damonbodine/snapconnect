/**
 * Full Bot Army Production Script
 * Creates posts for all 70 AI users with proper batching and error handling
 * 
 * Usage: 
 *   npx tsx scripts/runFullBotArmy.ts
 *   npx tsx scripts/runFullBotArmy.ts --dry-run (preview only)
 *   npx tsx scripts/runFullBotArmy.ts --batch-size 10
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

interface CommandLineArgs {
  dryRun?: boolean;
  batchSize?: number;
  limit?: number;
  help?: boolean;
}

interface PostResult {
  success: boolean;
  username: string;
  userId: string;
  archetype: string;
  postId?: string;
  error?: string;
  caption?: string;
}

const CONTENT_TYPES = ['workout_post', 'progress_update', 'motivation', 'education', 'social'] as const;
type ContentType = typeof CONTENT_TYPES[number];

function parseArgs(): CommandLineArgs {
  const args: CommandLineArgs = {};
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    switch (arg) {
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--batch-size':
        args.batchSize = parseInt(process.argv[++i]) || 5;
        break;
      case '--limit':
        args.limit = parseInt(process.argv[++i]) || 70;
        break;
      case '--help':
        args.help = true;
        break;
    }
  }
  
  return args;
}

function showHelp() {
  console.log(`
🤖 Full Bot Army Production Script

Usage:
  npx tsx scripts/runFullBotArmy.ts [options]

Options:
  --dry-run           Preview users and content types without creating posts
  --batch-size <n>    Process users in batches of N (default: 5)
  --limit <n>         Limit to first N users (default: 70)
  --help              Show this help message

Examples:
  npx tsx scripts/runFullBotArmy.ts                    # Process all 70 users
  npx tsx scripts/runFullBotArmy.ts --dry-run          # Preview without posting
  npx tsx scripts/runFullBotArmy.ts --batch-size 3     # Smaller batches for safety
  npx tsx scripts/runFullBotArmy.ts --limit 10         # Test with 10 users only
`);
}

function selectContentType(username: string, archetype: string): ContentType {
  // Vary content type based on username hash and day
  const dayOfWeek = new Date().getDay();
  const usernameHash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Create some variation based on archetype
  const archetypeWeights = {
    fitness_newbie: [3, 2, 3, 1, 1], // More workout_post and motivation
    strength_warrior: [4, 2, 1, 2, 1], // Focus on workout_post and progress_update
    cardio_queen: [3, 3, 2, 1, 1], // Balanced workout and progress
    zen_master: [2, 1, 4, 2, 1], // More motivation content
    outdoor_adventurer: [3, 2, 2, 1, 2], // More social content
  };
  
  const weights = archetypeWeights[archetype as keyof typeof archetypeWeights] || archetypeWeights.fitness_newbie;
  
  // Add day-based variation
  const dayBonus = Math.floor((usernameHash + dayOfWeek) % 5);
  const selectedIndex = (dayBonus + Math.floor(usernameHash / 10)) % 5;
  
  return CONTENT_TYPES[selectedIndex];
}

async function generateContentForUser(user: any, contentType: ContentType): Promise<{caption: string, imageBase64: string}> {
  // Generate text content based on content type
  const contentPrompts = {
    workout_post: `Share details about a workout you just completed. Be specific about exercises, sets, or activity.`,
    progress_update: `Share a fitness milestone, personal record, or improvement you've noticed recently.`,
    motivation: `Share something motivational or inspiring about fitness. Encourage others or share insights.`,
    education: `Share a fitness tip, technique, or useful information that others might find helpful.`,
    social: `Ask a question or start a discussion about fitness. Engage with the community.`
  };

  const systemPrompt = `You are a ${user.archetype.replace('_', ' ')} fitness enthusiast posting on social media.

Your personality: ${user.archetype === 'fitness_newbie' ? 'enthusiastic beginner excited about fitness' : 
                   user.archetype === 'strength_warrior' ? 'serious about strength training and lifting heavy' :
                   user.archetype === 'cardio_queen' ? 'loves cardio and high-energy workouts' :
                   user.archetype === 'zen_master' ? 'focused on mindful movement and balance' :
                   'adventurous outdoor fitness enthusiast'}

Write a ${contentType.replace('_', ' ')} post that:
- ${contentPrompts[contentType]}
- Is 2-3 sentences maximum
- Includes 1-2 relevant emojis
- Stays under 120 characters
- Sounds authentic and natural
- Matches your archetype personality

Be genuine and enthusiastic but not over the top.`;

  const textCompletion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contentPrompts[contentType] }
    ],
    max_tokens: 100,
    temperature: 0.8
  });

  const caption = textCompletion.choices[0]?.message?.content?.trim() || 'Great workout today! 💪';

  // Generate image based on archetype and content type
  const archetypeImageStyles = {
    fitness_newbie: 'beginner-friendly gym environment, encouraging atmosphere, basic equipment',
    strength_warrior: 'serious gym setting with heavy weights, focused athlete, intense training',
    cardio_queen: 'energetic cardio setup, running or HIIT equipment, dynamic movement',
    zen_master: 'peaceful yoga or meditation space, calming atmosphere, mindful movement',
    outdoor_adventurer: 'outdoor fitness setting, nature background, adventure activities'
  };

  const style = archetypeImageStyles[user.archetype as keyof typeof archetypeImageStyles] || archetypeImageStyles.fitness_newbie;
  
  const imagePrompt = `High-quality fitness photograph showing ${style}. Professional photography, realistic style, good composition, appropriate for social media fitness content. The image should relate to: "${caption}".`;

  const imageResponse = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: imagePrompt,
    size: '1024x1024',
    quality: 'low'
  });

  const imageBase64 = imageResponse.data[0].b64_json!;
  return { caption, imageBase64 };
}

async function createPostForUser(user: any, contentType: ContentType, dryRun: boolean = false): Promise<PostResult> {
  try {
    console.log(`📝 ${dryRun ? '[DRY-RUN] ' : ''}Creating ${contentType} for @${user.username} (${user.archetype})`);

    if (dryRun) {
      // Just return mock data for dry run
      return {
        success: true,
        username: user.username,
        userId: user.id,
        archetype: user.archetype,
        postId: 'dry-run-id',
        caption: `Mock ${contentType} content for ${user.archetype}`
      };
    }

    // Generate content
    const { caption, imageBase64 } = await generateContentForUser(user, contentType);

    // Upload image
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const timestamp = Date.now();
    const filename = `ai-generated/${user.id}/${contentType}-${timestamp}.png`;

    const { error: uploadError } = await supabase.storage
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
        workout_type: contentType,
        expires_at: expiryTime.toISOString(),
      })
      .select('id')
      .single();

    if (postError) {
      throw new Error(`Database insert failed: ${postError.message}`);
    }

    console.log(`✅ @${user.username}: "${caption}"`);
    
    return {
      success: true,
      username: user.username,
      userId: user.id,
      archetype: user.archetype,
      postId: postData.id,
      caption
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`❌ @${user.username}: ${errorMessage}`);
    
    return {
      success: false,
      username: user.username,
      userId: user.id,
      archetype: user.archetype,
      error: errorMessage
    };
  }
}

async function main() {
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    return;
  }

  const batchSize = args.batchSize || 5;
  const limit = args.limit || 70;
  const dryRun = args.dryRun || false;

  try {
    console.log(`🤖 ${dryRun ? 'DRY-RUN: ' : ''}Starting Full Bot Army Posting...`);
    console.log(`📊 Batch Size: ${batchSize} | Limit: ${limit} | Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}\n`);

    // Get all AI users
    const { data: allUsers, error } = await supabase
      .from('users')
      .select('id, username, full_name, personality_traits')
      .eq('is_mock_user', true)
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get AI users: ${error.message}`);
    }

    if (!allUsers || allUsers.length === 0) {
      console.log('📭 No AI users found');
      return;
    }

    // Add archetype and content type for each user
    const usersWithDetails = allUsers.map(user => ({
      ...user,
      archetype: user.personality_traits?.archetype || 'fitness_newbie',
      contentType: selectContentType(user.username, user.personality_traits?.archetype || 'fitness_newbie')
    }));

    console.log(`👥 Found ${usersWithDetails.length} AI users\n`);

    if (dryRun) {
      console.log('📋 DRY-RUN PREVIEW:');
      usersWithDetails.forEach((user, index) => {
        console.log(`${index + 1}. @${user.username} (${user.archetype}) - ${user.contentType}`);
      });
      console.log('\n✅ Dry-run completed. Use without --dry-run to create actual posts.');
      return;
    }

    const results: PostResult[] = [];
    const totalBatches = Math.ceil(usersWithDetails.length / batchSize);

    // Process users in batches
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, usersWithDetails.length);
      const batch = usersWithDetails.slice(batchStart, batchEnd);

      console.log(`📦 BATCH ${batchIndex + 1}/${totalBatches} - Processing users ${batchStart + 1}-${batchEnd}:`);

      // Process batch sequentially to avoid overwhelming OpenAI API
      for (let i = 0; i < batch.length; i++) {
        const user = batch[i];
        const userIndex = batchStart + i + 1;
        
        console.log(`[${userIndex}/${usersWithDetails.length}] Processing @${user.username}...`);
        
        try {
          const result = await createPostForUser(user, user.contentType as ContentType, dryRun);
          results.push(result);
          
          // Small delay between posts to respect rate limits
          if (i < batch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          results.push({
            success: false,
            username: user.username,
            userId: user.id,
            archetype: user.archetype,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Longer delay between batches
      if (batchIndex < totalBatches - 1) {
        console.log(`⏱️ Batch ${batchIndex + 1} complete. Waiting 10 seconds before next batch...\n`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    // Final summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('\n🎉 FULL BOT ARMY COMPLETED!\n');
    console.log('📊 FINAL SUMMARY:');
    console.log(`✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    console.log(`📈 Success Rate: ${Math.round((successful.length / results.length) * 100)}%`);

    // Archetype breakdown
    const archetypeStats: Record<string, number> = {};
    successful.forEach(result => {
      archetypeStats[result.archetype] = (archetypeStats[result.archetype] || 0) + 1;
    });

    console.log('\n🎭 Posts by Archetype:');
    Object.entries(archetypeStats).forEach(([archetype, count]) => {
      console.log(`   ${archetype}: ${count} posts`);
    });

    if (failed.length > 0) {
      console.log('\n❌ Failed Posts:');
      failed.forEach(result => {
        console.log(`   @${result.username}: ${result.error}`);
      });
    }

    console.log(`\n🚀 ${successful.length} AI users have posted fresh content!`);

  } catch (error) {
    console.error('❌ Full bot army run failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}

export { main as runFullBotArmy };