/**
 * Human-Bot Social Engagement Script
 * AI bots engage with all human content (Photos + Discover)
 * 
 * Usage: npx tsx scripts/humanBotSocialEngagement.ts [--user=email] [--dry-run]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { humanBotInteractionService } from '../src/services/humanBotInteractionService';

interface SocialOptions {
  userEmail?: string;
  dryRun: boolean;
}

// Parse command line arguments
function parseArgs(): SocialOptions {
  const args = process.argv.slice(2);
  const options: SocialOptions = {
    dryRun: false,
  };

  args.forEach(arg => {
    if (arg.startsWith('--user=')) {
      options.userEmail = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  });

  return options;
}

// Add delay between operations
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function
async function runSocialEngagement() {
  const startTime = Date.now();
  const options = parseArgs();
  
  console.log('👥 Human-Bot Social Engagement System');
  console.log('=====================================');
  console.log(`📧 Target user: ${options.userEmail || 'All users'}`);
  console.log(`🏃 Mode: ${options.dryRun ? 'DRY RUN' : 'REAL COMMENTS'}`);
  console.log('');

  try {
    let totalPostsProcessed = 0;
    let totalCommentsPosted = 0;
    const allErrors: string[] = [];

    // Process Photos content
    console.log('📸 Processing Photos content...');
    const photosResult = await humanBotInteractionService.processHumanPosts(
      'photos',
      options.userEmail,
      options.dryRun
    );

    totalPostsProcessed += photosResult.posts_processed;
    totalCommentsPosted += photosResult.comments_posted;
    allErrors.push(...photosResult.errors);

    console.log(`   📝 Photos posts processed: ${photosResult.posts_processed}`);
    console.log(`   💬 Photos comments posted: ${photosResult.comments_posted}`);

    // Add delay between content types
    if (photosResult.posts_processed > 0) {
      console.log('   ⏱️  Waiting 30 seconds before Discover content...');
      await delay(30000); // 30 second delay
    }

    // Process Discover content
    console.log('🎬 Processing Discover content...');
    const discoverResult = await humanBotInteractionService.processHumanPosts(
      'discover',
      options.userEmail,
      options.dryRun
    );

    totalPostsProcessed += discoverResult.posts_processed;
    totalCommentsPosted += discoverResult.comments_posted;
    allErrors.push(...discoverResult.errors);

    console.log(`   📝 Discover posts processed: ${discoverResult.posts_processed}`);
    console.log(`   💬 Discover comments posted: ${discoverResult.comments_posted}`);

    // Display combined results
    console.log('');
    console.log('📊 Combined Social Engagement Results');
    console.log('=====================================');
    console.log(`📝 Total posts processed: ${totalPostsProcessed}`);
    console.log(`💬 Total comments posted: ${totalCommentsPosted}`);
    console.log(`⏱️  Total duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
    console.log(`✅ Overall success: ${photosResult.success && discoverResult.success ? 'Yes' : 'No'}`);

    // Breakdown by content type
    console.log('');
    console.log('📊 Breakdown by Content Type:');
    console.log(`   📸 Photos: ${photosResult.posts_processed} posts, ${photosResult.comments_posted} comments`);
    console.log(`   🎬 Discover: ${discoverResult.posts_processed} posts, ${discoverResult.comments_posted} comments`);

    if (allErrors.length > 0) {
      console.log('');
      console.log('❌ Errors encountered:');
      allErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    console.log('');
    if (options.dryRun) {
      console.log('🎯 Dry run completed - no real comments posted');
      console.log('💡 To run with real comments, remove the --dry-run flag');
    } else {
      console.log(`✅ Social engagement completed - posted ${totalCommentsPosted} total comments`);
      if (totalCommentsPosted > 0) {
        console.log('🎉 Human users should now see AI bot comments on their posts!');
      }
    }

    // Recommendations
    if (totalPostsProcessed === 0) {
      console.log('');
      console.log('💡 No posts were processed. This could mean:');
      console.log('   • No recent human posts meet quality thresholds (2+ likes)');
      console.log('   • All eligible posts already have maximum bot comments (2)');
      console.log('   • Target user has no recent posts');
      console.log('   • Posts are too new (wait 10+ minutes) or too old (24+ hours)');
    }

  } catch (error) {
    console.error('❌ Social engagement failed:', error);
    process.exit(1);
  }
}

// Run the script
runSocialEngagement();