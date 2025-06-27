/**
 * Bot Automation Scheduler
 * Automatically runs bot operations throughout the day
 * 
 * Schedule:
 * - 7:00 AM: Generate morning posts
 * - 12:00 PM: Midday social engagement
 * - 2:00 PM: Afternoon posts
 * - 5:00 PM: Evening social engagement
 * - 7:00 PM: Build friendships
 * - 9:00 PM: Night posts + final engagement
 */

import * as dotenv from 'dotenv';
dotenv.config();

import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration
const TIMEZONE = 'America/New_York'; // Adjust to your timezone
const LOG_PREFIX = '🤖 [BOT-SCHEDULER]';

// Logging utility
function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const timestamp = new Date().toLocaleString();
  const emoji = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[type];
  
  console.log(`${emoji} ${LOG_PREFIX} [${timestamp}] ${message}`);
}

// Execute bot script with error handling
async function runBotScript(scriptName: string, description: string): Promise<boolean> {
  try {
    log(`Starting: ${description}`, 'info');
    
    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(`npm run ${scriptName}`, {
      cwd: process.cwd(),
      timeout: 600000 // 10 minute timeout
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (stderr && !stderr.includes('Warning')) {
      log(`Script ${scriptName} completed with warnings: ${stderr}`, 'warning');
    }
    
    log(`✨ Completed: ${description} (${duration}s)`, 'success');
    
    // Log key metrics if available
    if (stdout.includes('posts generated') || stdout.includes('interactions')) {
      const lines = stdout.split('\n').filter(line => 
        line.includes('generated') || 
        line.includes('interactions') || 
        line.includes('friend requests')
      );
      lines.forEach(line => log(`📊 ${line.trim()}`, 'info'));
    }
    
    return true;
  } catch (error: any) {
    log(`❌ Failed: ${description} - ${error.message}`, 'error');
    
    // Log additional error details
    if (error.stdout) log(`STDOUT: ${error.stdout}`, 'error');
    if (error.stderr) log(`STDERR: ${error.stderr}`, 'error');
    
    return false;
  }
}

// Daily health check
async function runHealthCheck(): Promise<void> {
  log('🏥 Running daily health check...', 'info');
  
  try {
    const success = await runBotScript('bot:stats', 'System Health Check');
    if (success) {
      log('🟢 System health check passed', 'success');
    } else {
      log('🔴 System health check failed - manual intervention may be needed', 'error');
    }
  } catch (error) {
    log('🔴 Health check error - system may need attention', 'error');
  }
}

// Combined operations for efficiency
async function runMorningRoutine(): Promise<void> {
  log('🌅 Starting morning routine...', 'info');
  
  await runHealthCheck();
  await runBotScript('bot:army-human', 'Morning Post Generation');
  
  log('🌅 Morning routine completed!', 'success');
}

async function runMiddayEngagement(): Promise<void> {
  log('☀️ Starting midday engagement...', 'info');
  
  await runBotScript('bot:social', 'Midday Social Interactions');
  
  log('☀️ Midday engagement completed!', 'success');
}

async function runAfternoonRoutine(): Promise<void> {
  log('🌤️ Starting afternoon routine...', 'info');
  
  await runBotScript('bot:army-human', 'Afternoon Post Generation');
  
  log('🌤️ Afternoon routine completed!', 'success');
}

async function runEveningEngagement(): Promise<void> {
  log('🌆 Starting evening engagement...', 'info');
  
  await runBotScript('bot:social', 'Evening Social Interactions');
  
  log('🌆 Evening engagement completed!', 'success');
}

async function runNightRoutine(): Promise<void> {
  log('🌙 Starting night routine...', 'info');
  
  // Build friendships first
  await runBotScript('bot:friends', 'Friendship Building');
  
  // Then generate final posts of the day
  await runBotScript('bot:army-human', 'Night Post Generation');
  
  // Final social engagement
  await runBotScript('bot:social', 'Final Social Interactions');
  
  log('🌙 Night routine completed!', 'success');
}

// Error recovery
async function handleScriptFailure(scriptName: string, description: string): Promise<void> {
  log(`🔄 Attempting recovery for failed script: ${scriptName}`, 'warning');
  
  // Wait 5 minutes and try again
  await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
  
  const retrySuccess = await runBotScript(scriptName, `RETRY: ${description}`);
  if (retrySuccess) {
    log(`🎉 Recovery successful for: ${scriptName}`, 'success');
  } else {
    log(`💀 Recovery failed for: ${scriptName} - manual intervention required`, 'error');
  }
}

// Schedule setup
function setupSchedule(): void {
  log('🚀 Setting up bot automation schedule...', 'info');
  
  // 7:00 AM - Morning routine (posts + health check)
  cron.schedule('0 7 * * *', runMorningRoutine, {
    scheduled: true,
    timezone: TIMEZONE
  });
  
  // 12:00 PM - Midday social engagement
  cron.schedule('0 12 * * *', runMiddayEngagement, {
    scheduled: true,
    timezone: TIMEZONE
  });
  
  // 2:00 PM - Afternoon posts
  cron.schedule('0 14 * * *', runAfternoonRoutine, {
    scheduled: true,
    timezone: TIMEZONE
  });
  
  // 5:00 PM - Evening social engagement
  cron.schedule('0 17 * * *', runEveningEngagement, {
    scheduled: true,
    timezone: TIMEZONE
  });
  
  // 7:00 PM - Night routine (friendships + posts + engagement)
  cron.schedule('0 19 * * *', runNightRoutine, {
    scheduled: true,
    timezone: TIMEZONE
  });
  
  // 3:00 AM - Daily health check (during low activity)
  cron.schedule('0 3 * * *', runHealthCheck, {
    scheduled: true,
    timezone: TIMEZONE
  });
  
  log('📅 Schedule configured:', 'success');
  log('   🌅 7:00 AM  - Morning posts + health check', 'info');
  log('   ☀️ 12:00 PM - Midday social engagement', 'info');
  log('   🌤️ 2:00 PM  - Afternoon posts', 'info');
  log('   🌆 5:00 PM  - Evening social engagement', 'info');
  log('   🌙 7:00 PM  - Night routine (friends + posts + social)', 'info');
  log('   🏥 3:00 AM  - Daily health check', 'info');
}

// Graceful shutdown
function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    log(`🛑 Received ${signal}, shutting down gracefully...`, 'warning');
    process.exit(0);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Manual triggers (for testing)
export async function triggerMorningRoutine(): Promise<void> {
  log('🧪 Manual trigger: Morning routine', 'info');
  await runMorningRoutine();
}

export async function triggerSocialEngagement(): Promise<void> {
  log('🧪 Manual trigger: Social engagement', 'info');
  await runMiddayEngagement();
}

export async function triggerFriendshipBuilding(): Promise<void> {
  log('🧪 Manual trigger: Friendship building', 'info');
  await runBotScript('bot:friends', 'Manual Friendship Building');
}

export async function triggerHealthCheck(): Promise<void> {
  log('🧪 Manual trigger: Health check', 'info');
  await runHealthCheck();
}

// Main execution
async function main(): Promise<void> {
  try {
    log('🤖 SnapConnect Bot Scheduler Starting...', 'success');
    log(`📍 Timezone: ${TIMEZONE}`, 'info');
    log(`📂 Working directory: ${process.cwd()}`, 'info');
    
    // Setup
    setupGracefulShutdown();
    setupSchedule();
    
    // Initial health check
    await runHealthCheck();
    
    log('🟢 Bot scheduler is now running! Use Ctrl+C to stop.', 'success');
    log('📊 Monitor logs to see automated bot activities.', 'info');
    
    // Keep the process alive
    setInterval(() => {
      // Heartbeat every hour
      const now = new Date();
      if (now.getMinutes() === 0) {
        log(`💓 Scheduler heartbeat - ${now.toLocaleString()}`, 'info');
      }
    }, 60 * 1000);
    
  } catch (error: any) {
    log(`💀 Scheduler startup failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'morning':
      triggerMorningRoutine();
      break;
    case 'social':
      triggerSocialEngagement();
      break;
    case 'friends':
      triggerFriendshipBuilding();
      break;
    case 'health':
      triggerHealthCheck();
      break;
    case 'start':
    default:
      main();
      break;
  }
}