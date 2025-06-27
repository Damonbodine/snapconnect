/**
 * Bulk AI User Creation Script
 * Creates 100 diverse AI users with unique personalities for SnapConnect
 * 
 * Usage: npx tsx scripts/createBulkAIUsers.ts
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { personalityService } from '../src/services/personalityService';
import { AI_ARCHETYPES } from '../src/types/aiPersonality';

// Supabase configuration
const supabaseUrl = 'https://lubfyjzdfgpoocsswrkz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('💡 Get it from: https://supabase.com/dashboard/project/lubfyjzdfgpoocsswrkz/settings/api');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface AIUserCreationData {
  username: string;
  email: string;
  password: string;
  full_name: string;
  avatar_url: string;
  fitness_level: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  dietary_preferences: string[];
  workout_frequency: number;
  personality_traits: any;
  ai_response_style: any;
  posting_schedule: any;
  conversation_context: any;
  archetype_id: string;
}

interface CreationResult {
  success: boolean;
  user_id?: string;
  username?: string;
  error?: string;
  archetype_id?: string;
}

/**
 * Generate secure random password for AI users
 */
function generateSecurePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Check if username already exists in database
 */
async function usernameExists(username: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('username')
    .eq('username', username)
    .single();
    
  return !error && !!data;
}

/**
 * Generate unique username for AI user
 */
async function generateUniqueUsername(baseUsername: string, maxAttempts: number = 10): Promise<string> {
  let username = baseUsername;
  let attempt = 0;
  
  while (await usernameExists(username) && attempt < maxAttempts) {
    const suffix = Math.floor(Math.random() * 1000);
    username = `${baseUsername}_${suffix}`;
    attempt++;
  }
  
  if (attempt >= maxAttempts) {
    throw new Error(`Could not generate unique username for ${baseUsername}`);
  }
  
  return username;
}

/**
 * Generate sample post for AI user based on archetype
 */
function generateSamplePost(userData: AIUserCreationData) {
  const samplePosts = {
    fitness_newbie: [
      {
        content: "Just finished my first week at the gym! 🎉 Still learning but feeling stronger already. Any tips for a beginner? #GymNewbie #FitnessJourney",
        workout_type: "strength",
        image_keywords: "gym,beginner,fitness,workout"
      },
      {
        content: "Attempted my first 20-minute walk today! 🚶‍♀️ Baby steps but I'm proud of starting somewhere. Consistency is key! #StartingSomewhere #WalkingForHealth", 
        workout_type: "cardio",
        image_keywords: "walking,fitness,beginner,outdoor"
      }
    ],
    strength_warrior: [
      {
        content: "Morning lifting session CRUSHED! 💪 Hit a new PR on deadlifts today. There's nothing like the feeling of iron moving iron! #DeadliftPR #StrengthTraining #IronLife",
        workout_type: "strength", 
        image_keywords: "weightlifting,gym,deadlift,strength"
      },
      {
        content: "Leg day complete! 🔥 Squats, lunges, and Bulgarian split squats. My legs are questioning our friendship right now but gains don't come from comfort zones! #LegDay #SquatLife",
        workout_type: "strength",
        image_keywords: "squat,leg,workout,gym"
      }
    ],
    cardio_queen: [
      {
        content: "5 miles down and feeling AMAZING! 🏃‍♀️ There's something magical about hitting your stride and just flowing. Runner's high is real! #RunningLife #CardioQueen #MorningRun",
        workout_type: "cardio",
        image_keywords: "running,cardio,outdoor,fitness"
      },
      {
        content: "HIIT class was intense today! 🔥 30 minutes of pure sweat and determination. My heart rate is still coming down but I feel so alive! #HIITWorkout #CardioLife",
        workout_type: "cardio", 
        image_keywords: "hiit,cardio,fitness,gym"
      }
    ],
    zen_master: [
      {
        content: "Sunrise yoga flow complete ✨ There's something magical about moving with your breath as the world wakes up. 60 minutes of pure bliss and mindful movement. Namaste 🧘‍♀️ #YogaLife #SunriseFlow #Mindfulness",
        workout_type: "flexibility",
        image_keywords: "yoga,sunrise,meditation,peaceful"
      },
      {
        content: "Finding balance in today's practice 🌅 Sometimes the most powerful thing we can do is slow down and breathe. Grateful for this moment of peace. #YogaPractice #Mindfulness #Balance",
        workout_type: "flexibility",
        image_keywords: "yoga,meditation,balance,zen"
      }
    ],
    outdoor_adventurer: [
      {
        content: "Trail run through the mountains this morning! 🏔️ 8 miles of pure nature therapy. Fresh air, challenging terrain, and incredible views. This is why I love outdoor fitness! #TrailRunning #MountainLife #NatureTherapy",
        workout_type: "outdoor",
        image_keywords: "trail,running,mountain,outdoor"
      },
      {
        content: "Rock climbing session at the local crag! 🧗‍♀️ Conquered a route that's been intimidating me for weeks. Nature is the best gym! #RockClimbing #OutdoorFitness #ClimbingLife",
        workout_type: "outdoor",
        image_keywords: "rock,climbing,outdoor,adventure"
      }
    ]
  };

  const archetypePosts = samplePosts[userData.archetype_id as keyof typeof samplePosts] || samplePosts.fitness_newbie;
  const selectedPost = archetypePosts[Math.floor(Math.random() * archetypePosts.length)];
  
  // Generate Unsplash URL for the workout image
  const imageUrl = `https://images.unsplash.com/800x800/?${selectedPost.image_keywords}&fit=crop&sig=${Math.floor(Math.random() * 1000)}`;
  
  return {
    content: selectedPost.content,
    media_url: imageUrl,
    workout_type: selectedPost.workout_type
  };
}

/**
 * Create dietary preferences based on archetype
 */
function generateDietaryPreferences(archetypeId: string): string[] {
  const preferences = {
    fitness_newbie: ['no_restrictions'],
    strength_warrior: ['high_protein', 'no_restrictions'],
    cardio_queen: ['mediterranean', 'no_restrictions'],
    zen_master: ['vegetarian', 'gluten_free'],
    outdoor_adventurer: ['paleo', 'no_restrictions']
  };
  
  const base = preferences[archetypeId as keyof typeof preferences] || ['no_restrictions'];
  
  // Sometimes add additional preferences
  if (Math.random() > 0.7) {
    const additional = ['organic', 'local', 'whole_foods', 'low_sugar'];
    const randomAdditional = additional[Math.floor(Math.random() * additional.length)];
    return [...base, randomAdditional];
  }
  
  return base;
}

/**
 * Generate AI user data based on archetype
 */
async function generateAIUserData(archetypeId: string, variationSeed: number): Promise<AIUserCreationData> {
  const archetype = AI_ARCHETYPES.find(a => a.id === archetypeId);
  if (!archetype) {
    throw new Error(`Archetype ${archetypeId} not found`);
  }

  // Generate personality and other data
  const personalityData = personalityService.generatePersonalityFromArchetype(archetype, variationSeed);
  const baseUsername = personalityService.generateUsername(archetype, variationSeed);
  const uniqueUsername = await generateUniqueUsername(baseUsername);
  const fullName = personalityService.generateFullName(archetype, variationSeed);
  const avatarUrl = personalityService.generateAvatarUrl(archetype, variationSeed);

  return {
    username: uniqueUsername,
    email: `${uniqueUsername}@snapconnect.ai`,
    password: generateSecurePassword(),
    full_name: fullName,
    avatar_url: avatarUrl,
    fitness_level: personalityData.personality_traits.fitness_level!,
    goals: personalityData.personality_traits.primary_goals!,
    dietary_preferences: generateDietaryPreferences(archetypeId),
    workout_frequency: personalityData.personality_traits.workout_frequency!,
    personality_traits: personalityData.personality_traits,
    ai_response_style: personalityData.ai_response_style,
    posting_schedule: personalityData.posting_schedule,
    conversation_context: personalityData.conversation_context,
    archetype_id: archetypeId
  };
}

/**
 * Create a single AI user
 */
async function createAIUser(userData: AIUserCreationData): Promise<CreationResult> {
  try {
    console.log(`🔄 Creating AI user: ${userData.full_name} (@${userData.username})`);

    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true, // Skip email confirmation for AI users
      user_metadata: {
        full_name: userData.full_name,
        is_ai_user: true
      }
    });

    if (authError) {
      console.error(`❌ Auth error for ${userData.username}:`, authError);
      return { 
        success: false, 
        username: userData.username, 
        error: authError.message,
        archetype_id: userData.archetype_id 
      };
    }

    console.log(`✅ Auth user created: ${authData.user.id}`);

    // Step 2: Create profile in users table
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: userData.email,
        username: userData.username,
        full_name: userData.full_name,
        avatar_url: userData.avatar_url,
        fitness_level: userData.fitness_level,
        goals: userData.goals,
        dietary_preferences: userData.dietary_preferences,
        workout_frequency: userData.workout_frequency,
        is_mock_user: true,
        personality_traits: userData.personality_traits,
        ai_response_style: userData.ai_response_style,
        posting_schedule: userData.posting_schedule,
        conversation_context: userData.conversation_context
      });

    if (profileError) {
      console.error(`❌ Profile error for ${userData.username}:`, profileError);
      
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      
      return { 
        success: false, 
        username: userData.username, 
        error: profileError.message,
        archetype_id: userData.archetype_id 
      };
    }

    console.log(`✅ Profile created for @${userData.username}`);

    // Step 3: Create sample post for discover feed testing
    const samplePost = generateSamplePost(userData);
    const { error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: authData.user.id,
        content: samplePost.content,
        media_url: samplePost.media_url,
        media_type: 'photo',
        workout_type: samplePost.workout_type
      });

    if (postError) {
      console.warn(`⚠️  Could not create sample post for ${userData.username}:`, postError.message);
      // Don't fail user creation if post fails
    } else {
      console.log(`✅ Sample post created for @${userData.username}`);
    }

    console.log(`✅ AI user created successfully: @${userData.username} (${userData.archetype_id})`);
    return { 
      success: true, 
      user_id: authData.user.id, 
      username: userData.username,
      archetype_id: userData.archetype_id 
    };

  } catch (error) {
    console.error(`❌ Unexpected error for ${userData.username}:`, error);
    return { 
      success: false, 
      username: userData.username, 
      error: error instanceof Error ? error.message : 'Unknown error',
      archetype_id: userData.archetype_id 
    };
  }
}

/**
 * Create multiple AI users in batches
 */
async function createAIUsersBatch(userDataList: AIUserCreationData[], batchSize: number = 5): Promise<CreationResult[]> {
  const results: CreationResult[] = [];
  
  for (let i = 0; i < userDataList.length; i += batchSize) {
    const batch = userDataList.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(userDataList.length / batchSize)}`);
    
    // Process batch in parallel
    const batchPromises = batch.map(userData => createAIUser(userData));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults);
    
    // Small delay between batches to avoid overwhelming Supabase
    if (i + batchSize < userDataList.length) {
      console.log('⏱️  Waiting 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}

/**
 * Main function to create all AI users
 */
async function main() {
  console.log('🚀 Creating 100 AI users for SnapConnect...\n');
  
  try {
    // Get archetype distribution
    const distribution = personalityService.distributeArchetypes(100);
    console.log('👥 Archetype Distribution:');
    distribution.forEach(({ archetype, count }) => {
      console.log(`   ${archetype.name}: ${count} users`);
    });
    console.log('');

    // Generate all user data
    console.log('📝 Generating user personality data...');
    const allUserData: AIUserCreationData[] = [];
    
    for (const { archetype, count } of distribution) {
      for (let i = 0; i < count; i++) {
        const variationSeed = Date.now() + allUserData.length;
        const userData = await generateAIUserData(archetype.id, variationSeed);
        allUserData.push(userData);
      }
    }

    console.log(`✅ Generated data for ${allUserData.length} AI users\n`);

    // Create users in batches
    console.log('🔨 Creating AI users in Supabase...');
    const results = await createAIUsersBatch(allUserData, 5);

    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('\n📊 Creation Results:');
    console.log(`✅ Successfully created: ${successful.length}/${results.length} users`);
    
    if (failed.length > 0) {
      console.log(`❌ Failed to create: ${failed.length} users`);
      console.log('\n❌ Failed users:');
      failed.forEach(result => {
        console.log(`   @${result.username} (${result.archetype_id}): ${result.error}`);
      });
    }

    // Success by archetype
    console.log('\n📈 Success by archetype:');
    AI_ARCHETYPES.forEach(archetype => {
      const archetypeResults = results.filter(r => r.archetype_id === archetype.id);
      const archetypeSuccess = archetypeResults.filter(r => r.success);
      console.log(`   ${archetype.name}: ${archetypeSuccess.length}/${archetypeResults.length}`);
    });

    console.log('\n🎉 AI user creation complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run the app and check discover feed for AI users');
    console.log('   2. Test messaging AI users (they won\'t respond yet)');
    console.log('   3. Implement daily posting automation');
    console.log('   4. Add AI messaging and commenting capabilities');

    if (successful.length > 0) {
      console.log('\n🔗 Sample AI users created:');
      successful.slice(0, 5).forEach(result => {
        console.log(`   @${result.username} (${result.archetype_id})`);
      });
      if (successful.length > 5) {
        console.log(`   ... and ${successful.length - 5} more!`);
      }
    }

  } catch (error) {
    console.error('❌ Fatal error during AI user creation:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { createAIUser, generateAIUserData, main as createBulkAIUsers };