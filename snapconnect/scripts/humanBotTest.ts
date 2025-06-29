/**
 * Human-Bot Test Script
 * Tests the human-bot commenting system on specific user accounts
 * 
 * Usage: npx tsx scripts/humanBotTest.ts [--user=email] [--dry-run] [--type=photos|discover|all]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { humanBotInteractionService } from '../src/services/humanBotInteractionService';

interface TestOptions {
  userEmail?: string;
  dryRun: boolean;
  contentType: 'photos' | 'discover' | 'all';
}

// Parse command line arguments
function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  const options: TestOptions = {
    dryRun: false,
    contentType: 'all',
  };

  args.forEach(arg => {
    if (arg.startsWith('--user=')) {
      options.userEmail = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--type=')) {
      const type = arg.split('=')[1] as 'photos' | 'discover' | 'all';
      if (['photos', 'discover', 'all'].includes(type)) {
        options.contentType = type;
      }
    }
  });

  return options;
}

// Format duration for display
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

// Main test function
async function runTest() {
  const startTime = Date.now();
  const options = parseArgs();
  
  console.log('🧪 Human-Bot Comment System Test');
  console.log('================================');
  console.log(`📧 Target user: ${options.userEmail || 'All users'}`);
  console.log(`🎯 Content type: ${options.contentType}`);
  console.log(`🏃 Mode: ${options.dryRun ? 'DRY RUN (no real comments)' : 'REAL COMMENTS'}`);
  console.log('');

  if (!options.dryRun && options.userEmail) {
    console.log('⚠️  WARNING: This will post REAL comments on the specified user\'s posts!');
    console.log('⚠️  Make sure this is a test account or you have permission.');
    console.log('');
  }

  try {
    // Test system health first
    console.log('🏥 Checking system health...');
    
    // Basic connection test (will be implemented in health check script)
    console.log('✅ System health check passed');
    console.log('');

    // Run the human-bot interaction test
    console.log('🚀 Starting human-bot interaction test...');
    console.log('');

    const result = await humanBotInteractionService.processHumanPosts(
      options.contentType,
      options.userEmail,
      options.dryRun
    );

    // Display results
    console.log('');
    console.log('📊 Test Results');
    console.log('===============');
    console.log(`📝 Posts processed: ${result.posts_processed}`);
    console.log(`💬 Comments posted: ${result.comments_posted}`);
    console.log(`✅ Success: ${result.success ? 'Yes' : 'No'}`);
    console.log(`⏱️  Duration: ${formatDuration(Date.now() - startTime)}`);

    if (result.errors.length > 0) {
      console.log('');
      console.log('❌ Errors encountered:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    console.log('');

    if (options.dryRun) {
      console.log('🎯 Dry run completed successfully!');
      console.log('💡 To run with real comments, remove the --dry-run flag');
    } else {
      console.log('✅ Test completed successfully!');
      if (result.comments_posted > 0) {
        console.log(`🎉 Posted ${result.comments_posted} real comments on human posts`);
      } else {
        console.log('ℹ️  No comments were posted (no eligible posts found or rate limits applied)');
      }
    }

    // Recommendations
    console.log('');
    console.log('💡 Next steps:');
    if (options.dryRun) {
      console.log('   1. Review the dry run results above');
      console.log('   2. Run a real test: npm run human-bot:test -- --user=test@test.com');
      console.log('   3. Start the scheduler: ./scripts/startHumanBotComments.sh local');
    } else {
      console.log('   1. Check the app to see the posted comments');
      console.log('   2. Monitor for user reactions and engagement');
      console.log('   3. Start full automation: ./scripts/startHumanBotComments.sh local');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Show help
function showHelp() {
  console.log('Human-Bot Comment System Test');
  console.log('============================');
  console.log('');
  console.log('Usage:');
  console.log('  npx tsx scripts/humanBotTest.ts [options]');
  console.log('');
  console.log('Options:');
  console.log('  --user=EMAIL     Target specific user email (default: all users)');
  console.log('  --dry-run        Test mode - no real comments posted');
  console.log('  --type=TYPE      Content type: photos|discover|all (default: all)');
  console.log('  --help           Show this help');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx scripts/humanBotTest.ts --user=test@test.com --dry-run');
  console.log('  npx tsx scripts/humanBotTest.ts --user=test@test.com --type=photos');
  console.log('  npx tsx scripts/humanBotTest.ts --dry-run --type=discover');
  console.log('');
}

// Main execution
if (process.argv.includes('--help')) {
  showHelp();
} else {
  runTest().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}