/**
 * Bot Group Joiner Script
 * Makes AI bots join groups to populate them with members
 * 
 * Usage: npx tsx scripts/botGroupJoiner.ts [--dry-run] [--group=id] [--bots=number]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { DIVERSE_AI_PERSONALITIES } from '../src/types/aiPersonality';

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface Group {
  id: string;
  name: string;
  description: string;
  category: string;
  member_count: number;
  last_activity: string;
}

interface Bot {
  id: string;
  username: string;
  personality_traits: any;
}

interface JoinOptions {
  dryRun: boolean;
  targetGroupId?: string;
  targetBotCount: number;
}

// Parse command line arguments
function parseArgs(): JoinOptions {
  const args = process.argv.slice(2);
  const options: JoinOptions = {
    dryRun: false,
    targetBotCount: 15,
  };

  args.forEach(arg => {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--group=')) {
      options.targetGroupId = arg.split('=')[1];
    } else if (arg.startsWith('--bots=')) {
      options.targetBotCount = parseInt(arg.split('=')[1]) || 15;
    }
  });

  return options;
}

// Get all available groups
async function getAllGroups(): Promise<Group[]> {
  try {
    const { data: groups, error } = await supabase
      .rpc('get_groups_with_member_count');

    if (error) {
      console.error('Failed to fetch groups:', error);
      return [];
    }

    return groups || [];
  } catch (error) {
    console.error('Error fetching groups:', error);
    return [];
  }
}

// Get available bots
async function getAvailableBots(): Promise<Bot[]> {
  try {
    const { data: bots, error } = await supabase
      .from('users')
      .select('id, username, personality_traits')
      .eq('is_mock_user', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch bots:', error);
      return [];
    }

    return bots || [];
  } catch (error) {
    console.error('Error fetching bots:', error);
    return [];
  }
}

// Get bots already in a group
async function getBotsInGroup(groupId: string): Promise<string[]> {
  try {
    const { data: memberships, error } = await supabase
      .from('group_memberships')
      .select('user_id, users!inner(is_mock_user)')
      .eq('group_id', groupId)
      .eq('users.is_mock_user', true);

    if (error) {
      console.error('Failed to fetch group memberships:', error);
      return [];
    }

    return memberships?.map(m => m.user_id) || [];
  } catch (error) {
    console.error('Error fetching group memberships:', error);
    return [];
  }
}

// Check if bot is compatible with group category
function isBotCompatibleWithGroup(bot: Bot, group: Group): boolean {
  const archetype = bot.personality_traits?.archetype_id;
  const personality = DIVERSE_AI_PERSONALITIES.find(p => p.id === archetype);
  
  if (!personality) return true; // Default to compatible if unknown

  // Map group categories to compatible personality types
  const compatibilityMap: Record<string, string[]> = {
    'workout': ['marcus_developer', 'aisha_lawyer', 'tyler_chef'],
    'running': ['sofia_nurse', 'tyler_chef', 'aisha_lawyer'],
    'yoga': ['emma_teacher', 'sofia_nurse'],
    'cycling': ['tyler_chef', 'aisha_lawyer'],
    'swimming': ['sofia_nurse', 'tyler_chef'],
    'sports': ['tyler_chef', 'aisha_lawyer'],
    'hiking': ['tyler_chef', 'sofia_nurse'],
    'dance': ['emma_teacher', 'tyler_chef'],
    'martial_arts': ['aisha_lawyer', 'marcus_developer'],
    'nutrition': ['sofia_nurse', 'tyler_chef'],
    'general': ['emma_teacher', 'marcus_developer', 'sofia_nurse', 'tyler_chef', 'aisha_lawyer'],
  };

  const compatibleTypes = compatibilityMap[group.category] || compatibilityMap['general'];
  return compatibleTypes.includes(archetype);
}

// Join bot to group
async function joinBotToGroup(botId: string, groupId: string, dryRun: boolean): Promise<boolean> {
  if (dryRun) {
    return true;
  }

  try {
    const { error } = await supabase
      .from('group_memberships')
      .insert({
        group_id: groupId,
        user_id: botId,
      });

    if (error) {
      // Ignore unique constraint violations (already joined)
      if (error.code === '23505') {
        return true;
      }
      console.error('Failed to join bot to group:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error joining bot to group:', error);
    return false;
  }
}

// Select best bots for a group
function selectBotsForGroup(
  availableBots: Bot[], 
  group: Group, 
  existingBotIds: string[], 
  targetCount: number
): Bot[] {
  // Filter out bots already in the group
  const eligibleBots = availableBots.filter(bot => !existingBotIds.includes(bot.id));
  
  // Prioritize compatible bots
  const compatibleBots = eligibleBots.filter(bot => isBotCompatibleWithGroup(bot, group));
  const otherBots = eligibleBots.filter(bot => !isBotCompatibleWithGroup(bot, group));
  
  // Select compatible bots first, then others if needed
  const selectedBots = [...compatibleBots, ...otherBots].slice(0, targetCount);
  
  return selectedBots;
}

// Process a single group
async function processGroup(group: Group, bots: Bot[], targetBotCount: number, dryRun: boolean) {
  console.log(`\n📍 Processing group: ${group.name} (${group.category})`);
  console.log(`   Current members: ${group.member_count}`);
  
  // Get bots already in this group
  const existingBotIds = await getBotsInGroup(group.id);
  const existingBotCount = existingBotIds.length;
  
  console.log(`   Current bots: ${existingBotCount}`);
  
  // Calculate how many more bots we need
  const botsNeeded = Math.max(0, targetBotCount - existingBotCount);
  
  if (botsNeeded === 0) {
    console.log(`   ✅ Group already has ${existingBotCount} bots (target: ${targetBotCount})`);
    return { joined: 0, errors: 0 };
  }
  
  console.log(`   🎯 Need ${botsNeeded} more bots to reach target of ${targetBotCount}`);
  
  // Select appropriate bots
  const selectedBots = selectBotsForGroup(bots, group, existingBotIds, botsNeeded);
  
  if (selectedBots.length === 0) {
    console.log(`   ⚠️ No available bots to join this group`);
    return { joined: 0, errors: 0 };
  }
  
  console.log(`   🤖 Selected ${selectedBots.length} bots to join:`);
  selectedBots.slice(0, 5).forEach(bot => {
    const archetype = bot.personality_traits?.archetype_id || 'unknown';
    console.log(`      - ${bot.username} (${archetype})`);
  });
  
  if (selectedBots.length > 5) {
    console.log(`      ... and ${selectedBots.length - 5} more`);
  }
  
  // Join bots to group
  let joinedCount = 0;
  let errorCount = 0;
  
  for (const bot of selectedBots) {
    const success = await joinBotToGroup(bot.id, group.id, dryRun);
    
    if (success) {
      joinedCount++;
      if (!dryRun) {
        console.log(`   ✅ ${bot.username} joined ${group.name}`);
      }
    } else {
      errorCount++;
      console.log(`   ❌ Failed to join ${bot.username} to ${group.name}`);
    }
    
    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return { joined: joinedCount, errors: errorCount };
}

// Main function
async function main() {
  const options = parseArgs();
  
  console.log('🤖 Bot Group Joiner');
  console.log('===================');
  console.log(`🎯 Target bots per group: ${options.targetBotCount}`);
  console.log(`🏃 Mode: ${options.dryRun ? 'DRY RUN' : 'REAL JOINS'}`);
  
  if (options.targetGroupId) {
    console.log(`📍 Target group: ${options.targetGroupId}`);
  }
  
  console.log('');
  
  try {
    // Get groups and bots
    console.log('📊 Fetching groups and bots...');
    
    const [groups, bots] = await Promise.all([
      getAllGroups(),
      getAvailableBots()
    ]);
    
    console.log(`Found ${groups.length} groups and ${bots.length} bots`);
    
    if (groups.length === 0) {
      console.log('❌ No groups found. Make sure the groups migration has been applied.');
      return;
    }
    
    if (bots.length === 0) {
      console.log('❌ No bots found. Make sure AI users exist in the system.');
      return;
    }
    
    // Filter groups if specific group requested
    const targetGroups = options.targetGroupId 
      ? groups.filter(g => g.id === options.targetGroupId)
      : groups;
    
    if (targetGroups.length === 0) {
      console.log(`❌ Target group ${options.targetGroupId} not found.`);
      return;
    }
    
    // Process each group
    let totalJoined = 0;
    let totalErrors = 0;
    
    for (const group of targetGroups) {
      const result = await processGroup(group, bots, options.targetBotCount, options.dryRun);
      totalJoined += result.joined;
      totalErrors += result.errors;
    }
    
    // Summary
    console.log('\n📊 Summary');
    console.log('==========');
    console.log(`✅ Groups processed: ${targetGroups.length}`);
    console.log(`🤖 Total bot joins: ${totalJoined}`);
    console.log(`❌ Total errors: ${totalErrors}`);
    
    if (options.dryRun) {
      console.log('\n🎯 Dry run completed - no actual joins performed');
      console.log('💡 Remove --dry-run flag to perform real joins');
    } else {
      console.log('\n🎉 Bot group joining completed!');
      console.log('🔍 Check your groups - they should now have AI members');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});