/**
 * Update AI User Usernames
 * Updates existing AI users with more realistic, diverse usernames
 * 
 * Usage: npx tsx scripts/updateAIUsernames.ts [--dry-run]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Realistic username pools for different archetypes
const REALISTIC_USERNAMES = {
  // Mix of first/last names, social media style names, and fitness-themed but natural usernames
  fitness_newbie: [
    // First/Last name style
    'maya.rodriguez', 'alex.chen', 'jordan.smith', 'taylor.johnson', 'casey.williams',
    'jamie.davis', 'riley.brown', 'morgan.jones', 'avery.garcia', 'dakota.miller',
    
    // Natural social media style  
    'getting_stronger23', 'fitness_journey_starts', 'newbie_gains', 'learning_to_lift',
    'first_time_gym_goer', 'starting_fresh2024', 'gym_anxiety_conquerer', 'baby_steps_fitness',
    
    // Mix with numbers/years
    'sarah_starts_now', 'mike_moving_more', 'fitness_newbie_jess', 'beginner_mindset',
    'fresh_start_kelly', 'gym_rookie_sam', 'learning_everyday', 'progress_not_perfection'
  ],
  
  strength_warrior: [
    // First/Last name style
    'victor.santos', 'marcus.thompson', 'diana.kostova', 'kai.nakamura', 'zoe.petrov',
    'erik.larsson', 'luna.rossini', 'dante.silva', 'nova.cross', 'axel.stone',
    
    // Strength-focused but natural
    'deadlift_davis', 'iron_will_93', 'compound_movements', 'progressive_overload',
    'barbell_brigade', 'strength_first', 'heavy_metal_lifting', 'powerhouse_training',
    
    // Mix with personality
    'marcus_moves_weight', 'diana_deadlifts', 'strength_seeker_kai', 'iron_enthusiast',
    'compound_lover', 'progressive_gains', 'heavy_lifter_life', 'strength_journey'
  ],
  
  cardio_queen: [
    // First/Last name style
    'elena.runner', 'carlos.vega', 'mia.sprint', 'lucas.pace', 'zara.miles',
    'finn.stride', 'ruby.dash', 'diego.tempo', 'sage.cardio', 'leo.endurance',
    
    // Cardio-focused but natural
    'morning_miles', 'runner_high', 'cardio_enthusiast', 'endurance_athlete',
    'heart_rate_zone', 'mile_by_mile', 'running_therapy', 'cardio_queen_bee',
    
    // Natural social style
    'elena_runs_wild', 'carlos_cardio_king', 'mia_marathon_prep', 'lucas_loves_hiit',
    'zara_zone_training', 'finn_5k_chaser', 'ruby_runner_life', 'diego_daily_runs'
  ],
  
  zen_master: [
    // First/Last name style
    'amara.zen', 'kai.balance', 'lotus.martinez', 'sage.williams', 'river.om',
    'indie.flow', 'zen.parker', 'bodhi.peace', 'maya.mindful', 'atlas.breath',
    
    // Mindful/yoga themed but natural
    'mindful_movement', 'yoga_everyday', 'breath_and_balance', 'inner_strength',
    'meditation_in_motion', 'peaceful_practice', 'mind_body_soul', 'zen_lifestyle',
    
    // Natural spiritual style
    'amara_aligns', 'kai_finds_balance', 'lotus_flows_daily', 'sage_seeks_peace',
    'river_meditation', 'indie_inner_peace', 'zen_journey_daily', 'bodhi_breathes'
  ],
  
  outdoor_adventurer: [
    // First/Last name style
    'sierra.wilde', 'forest.trekker', 'stone.climber', 'river.hikes', 'peak.chaser',
    'trail.blazer', 'summit.seeker', 'canyon.explorer', 'ridge.runner', 'wild.wanderer',
    
    // Adventure-focused but natural
    'trail_therapy', 'mountain_therapy', 'outdoor_obsessed', 'nature_athlete',
    'adventure_seeker', 'wild_workouts', 'outdoor_living', 'peak_performance',
    
    // Natural adventure style
    'sierra_climbs_high', 'forest_trail_lover', 'stone_summit_seeker', 'river_runs_trails',
    'peak_adventure_life', 'trail_blazing_daily', 'summit_or_nothing', 'canyon_explorer_co'
  ]
};

// Additional realistic names that work across archetypes
const GENERAL_REALISTIC_NAMES = [
  // International mix of first/last names
  'kim.nakamoto', 'jose.hernandez', 'ling.zhou', 'omar.hassan', 'nina.petrov',
  'raj.patel', 'sofia.costa', 'ahmed.ali', 'yuki.tanaka', 'carla.santos',
  
  // Natural social media style usernames
  'daily_movement', 'fitness_journey23', 'healthy_habits', 'active_lifestyle',
  'workout_warrior', 'fitness_first', 'strength_seeker', 'wellness_wanderer',
  'gym_time_daily', 'move_more_feel_better', 'fitness_motivation', 'health_journey'
];

function getRandomUsername(archetype: string): string {
  const archetypePool = REALISTIC_USERNAMES[archetype as keyof typeof REALISTIC_USERNAMES];
  const allOptions = [...archetypePool, ...GENERAL_REALISTIC_NAMES];
  
  return allOptions[Math.floor(Math.random() * allOptions.length)];
}

async function generateUniqueUsername(baseArchetype: string, maxAttempts: number = 50): Promise<string> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    let candidate = getRandomUsername(baseArchetype);
    
    // Add variation if needed
    if (attempts > 10) {
      const variations = [
        () => candidate,
        () => `${candidate}${Math.floor(Math.random() * 99) + 1}`,
        () => `${candidate}_${Math.floor(Math.random() * 99) + 1}`,
        () => `${candidate}${Math.floor(Math.random() * 9) + 1}`,
        () => `${candidate}_fit`,
        () => `${candidate}_active`,
        () => `${candidate}_daily`,
        () => `${candidate}2024`,
        () => `${candidate}_23`,
        () => `${candidate}_official`
      ];
      
      const variation = variations[Math.floor(Math.random() * variations.length)];
      candidate = variation();
    }
    
    // Check if username exists
    const { data } = await supabase
      .from('users')
      .select('username')
      .eq('username', candidate)
      .single();
    
    if (!data) {
      return candidate; // Username is available
    }
    
    attempts++;
  }
  
  throw new Error(`Could not generate unique username for archetype ${baseArchetype} after ${maxAttempts} attempts`);
}

async function updateUserUsername(user: any, newUsername: string, dryRun: boolean = false): Promise<boolean> {
  try {
    if (dryRun) {
      console.log(`[DRY-RUN] Would update: @${user.username} → @${newUsername} (${user.personality_traits?.archetype || 'unknown'})`);
      return true;
    }
    
    console.log(`🔄 Updating: @${user.username} → @${newUsername} (${user.personality_traits?.archetype || 'unknown'})`);
    
    // Update username in users table
    const { error: updateError } = await supabase
      .from('users')
      .update({ username: newUsername })
      .eq('id', user.id);
    
    if (updateError) {
      console.log(`❌ Failed to update @${user.username}: ${updateError.message}`);
      return false;
    }
    
    console.log(`✅ Updated @${user.username} → @${newUsername}`);
    return true;
    
  } catch (error) {
    console.log(`❌ Error updating @${user.username}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    console.log(`🤖 ${dryRun ? 'DRY-RUN: ' : ''}Updating AI User Usernames to be more realistic...\n`);
    
    // Get all AI users
    const { data: aiUsers, error } = await supabase
      .from('users')
      .select('id, username, full_name, personality_traits')
      .eq('is_mock_user', true);
    
    if (error) {
      throw new Error(`Failed to fetch AI users: ${error.message}`);
    }
    
    if (!aiUsers || aiUsers.length === 0) {
      console.log('📭 No AI users found');
      return;
    }
    
    console.log(`👥 Found ${aiUsers.length} AI users to update\n`);
    
    if (dryRun) {
      console.log('📋 DRY-RUN PREVIEW - Current vs New usernames:');
    }
    
    const results: { success: boolean; oldUsername: string; newUsername?: string; error?: string }[] = [];
    
    // Process users one by one
    for (let i = 0; i < aiUsers.length; i++) {
      const user = aiUsers[i];
      const archetype = user.personality_traits?.archetype || 'fitness_newbie';
      
      try {
        const newUsername = await generateUniqueUsername(archetype);
        const success = await updateUserUsername(user, newUsername, dryRun);
        
        results.push({
          success,
          oldUsername: user.username,
          newUsername: success ? newUsername : undefined,
          error: success ? undefined : 'Update failed'
        });
        
        // Small delay to avoid overwhelming the API
        if (!dryRun && i < aiUsers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.log(`❌ Failed to process @${user.username}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.push({
          success: false,
          oldUsername: user.username,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`\n📊 ${dryRun ? 'DRY-RUN ' : ''}SUMMARY:`);
    console.log(`✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    
    if (failed.length > 0) {
      console.log('\n❌ Failed Updates:');
      failed.forEach(result => {
        console.log(`   @${result.oldUsername}: ${result.error}`);
      });
    }
    
    if (dryRun) {
      console.log('\n✅ Dry-run completed. Use without --dry-run to perform actual updates.');
      console.log('💡 Command: npx tsx scripts/updateAIUsernames.ts');
    } else {
      console.log('\n🎉 Username updates completed!');
      console.log('📱 Your AI users now have more realistic, diverse usernames');
      
      // Show some examples
      console.log('\n🔤 Sample new usernames:');
      successful.slice(0, 10).forEach(result => {
        console.log(`   @${result.newUsername}`);
      });
      if (successful.length > 10) {
        console.log(`   ... and ${successful.length - 10} more!`);
      }
    }
    
  } catch (error) {
    console.error('❌ Username update failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}

export { main as updateAIUsernames };