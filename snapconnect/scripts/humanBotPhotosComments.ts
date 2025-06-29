/**
 * Human-Bot Photos Comments Script
 * AI bots comment on human Photos content specifically
 * 
 * Usage: npx tsx scripts/humanBotPhotosComments.ts [--user=email] [--dry-run]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { humanBotInteractionService } from '../src/services/humanBotInteractionService';

interface PhotosOptions {
  userEmail?: string;
  dryRun: boolean;
}

// Parse command line arguments
function parseArgs(): PhotosOptions {
  const args = process.argv.slice(2);
  const options: PhotosOptions = {
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

// Main function
async function runPhotosComments() {
  const startTime = Date.now();
  const options = parseArgs();
  
  console.log('📸 Human-Bot Photos Comment System');
  console.log('==================================');
  console.log(`📧 Target user: ${options.userEmail || 'All users'}`);
  console.log(`🏃 Mode: ${options.dryRun ? 'DRY RUN' : 'REAL COMMENTS'}`);
  console.log('');

  try {
    console.log('🔍 Processing human Photos posts...');
    
    const result = await humanBotInteractionService.processHumanPosts(
      'photos',
      options.userEmail,
      options.dryRun
    );

    // Display results
    console.log('');
    console.log('📊 Photos Comment Results');
    console.log('=========================');
    console.log(`📝 Posts processed: ${result.posts_processed}`);
    console.log(`💬 Comments posted: ${result.comments_posted}`);
    console.log(`⏱️  Duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
    console.log(`✅ Success: ${result.success ? 'Yes' : 'No'}`);

    if (result.errors.length > 0) {
      console.log('');
      console.log('❌ Errors:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    console.log('');
    if (options.dryRun) {
      console.log('🎯 Dry run completed - no real comments posted');
    } else {
      console.log(`✅ Posted ${result.comments_posted} comments on Photos posts`);
    }

  } catch (error) {
    console.error('❌ Photos commenting failed:', error);
    process.exit(1);
  }
}

// Run the script
runPhotosComments();