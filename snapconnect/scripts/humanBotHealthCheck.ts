/**
 * Human-Bot Health Check Script
 * Monitors system health and reports status
 * 
 * Usage: npx tsx scripts/humanBotHealthCheck.ts
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

interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: any;
}

class HealthChecker {
  private results: HealthCheckResult[] = [];

  // Check environment variables
  async checkEnvironment(): Promise<void> {
    const requiredVars = [
      'EXPO_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'EXPO_PUBLIC_OPENAI_API_KEY'
    ];

    let allPresent = true;
    const missing = [];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        allPresent = false;
        missing.push(varName);
      }
    }

    this.results.push({
      component: 'Environment Variables',
      status: allPresent ? 'healthy' : 'error',
      message: allPresent 
        ? 'All required environment variables are present'
        : `Missing required variables: ${missing.join(', ')}`,
      details: { required: requiredVars, missing }
    });
  }

  // Check Supabase connection and database
  async checkSupabase(): Promise<void> {
    try {
      // Test basic connection
      const { data: healthCheck, error: connectionError } = await supabase
        .from('users')
        .select('count', { count: 'exact', head: true })
        .limit(1);

      if (connectionError) {
        this.results.push({
          component: 'Supabase Connection',
          status: 'error',
          message: `Database connection failed: ${connectionError.message}`,
          details: connectionError
        });
        return;
      }

      // Check bot users exist
      const { data: bots, error: botsError } = await supabase
        .from('users')
        .select('id, username, personality_traits')
        .eq('is_mock_user', true)
        .limit(5);

      if (botsError) {
        this.results.push({
          component: 'Bot Users',
          status: 'error',
          message: `Failed to query bot users: ${botsError.message}`,
          details: botsError
        });
        return;
      }

      const botCount = bots?.length || 0;
      
      this.results.push({
        component: 'Supabase Connection',
        status: 'healthy',
        message: 'Database connection successful',
        details: { connection: 'OK' }
      });

      this.results.push({
        component: 'Bot Users',
        status: botCount > 0 ? 'healthy' : 'warning',
        message: `Found ${botCount} bot users`,
        details: { 
          count: botCount,
          sample: bots?.slice(0, 3).map(b => ({
            username: b.username,
            hasPersonality: !!b.personality_traits
          }))
        }
      });

      // Check human users
      const { data: humans, error: humansError } = await supabase
        .from('users')
        .select('id, username, email')
        .eq('is_mock_user', false)
        .limit(5);

      const humanCount = humans?.length || 0;
      
      this.results.push({
        component: 'Human Users',
        status: humanCount > 0 ? 'healthy' : 'warning',
        message: `Found ${humanCount} human users`,
        details: { 
          count: humanCount,
          sample: humans?.slice(0, 3).map(h => ({
            username: h.username,
            email: h.email
          }))
        }
      });

      // Check recent posts
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: recentPosts, error: postsError } = await supabase
        .from('posts')
        .select('id, user_id, created_at, users!inner(is_mock_user)')
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!postsError && recentPosts) {
        const humanPosts = recentPosts.filter(p => !p.users.is_mock_user);
        const botPosts = recentPosts.filter(p => p.users.is_mock_user);

        this.results.push({
          component: 'Recent Posts',
          status: recentPosts.length > 0 ? 'healthy' : 'warning',
          message: `Found ${recentPosts.length} posts in last 24h`,
          details: {
            total: recentPosts.length,
            human: humanPosts.length,
            bot: botPosts.length
          }
        });
      }

    } catch (error) {
      this.results.push({
        component: 'Supabase Connection',
        status: 'error',
        message: `Database connection failed: ${error}`,
        details: error
      });
    }
  }

  // Check OpenAI connection
  async checkOpenAI(): Promise<void> {
    try {
      // Test basic API connection with a simple completion
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: 'Reply with exactly: "API test successful"' }
        ],
        max_tokens: 10,
        temperature: 0
      });

      const response = completion.choices[0]?.message?.content?.trim();
      
      if (response && response.includes('API test successful')) {
        this.results.push({
          component: 'OpenAI API',
          status: 'healthy',
          message: 'API connection and response working correctly',
          details: { 
            model: 'gpt-4o',
            response: response
          }
        });
      } else {
        this.results.push({
          component: 'OpenAI API',
          status: 'warning',
          message: 'API responding but unexpected response format',
          details: { 
            expected: 'API test successful',
            received: response
          }
        });
      }

    } catch (error) {
      this.results.push({
        component: 'OpenAI API',
        status: 'error',
        message: `API connection failed: ${error}`,
        details: error
      });
    }
  }

  // Check system performance metrics
  async checkPerformanceMetrics(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check comments posted today by bots
      const { count: botCommentsToday } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('users.is_mock_user', true)
        .gte('created_at', today.toISOString());

      // Check human posts that got bot comments today
      const { data: humanPostsWithBotComments } = await supabase
        .from('comments')
        .select('post_id, posts!inner(user_id, users!inner(is_mock_user))')
        .eq('users.is_mock_user', true)
        .eq('posts.users.is_mock_user', false)
        .gte('created_at', today.toISOString());

      const uniqueHumanPosts = new Set(
        humanPostsWithBotComments?.map(c => c.post_id) || []
      ).size;

      this.results.push({
        component: 'Performance Metrics',
        status: 'healthy',
        message: 'Daily activity metrics collected',
        details: {
          botCommentsToday: botCommentsToday || 0,
          humanPostsEngaged: uniqueHumanPosts,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      this.results.push({
        component: 'Performance Metrics',
        status: 'warning',
        message: `Could not collect metrics: ${error}`,
        details: error
      });
    }
  }

  // Check rate limits and system load
  async checkRateLimits(): Promise<void> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Check API calls in last hour (approximate based on comments)
      const { count: recentComments } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('users.is_mock_user', true)
        .gte('created_at', oneHourAgo.toISOString());

      // Estimate API calls (1 per comment generation + 1 per image analysis)
      const estimatedAPICalls = (recentComments || 0) * 2;
      const rateLimit = 1000; // Approximate OpenAI rate limit per hour
      const usage = (estimatedAPICalls / rateLimit) * 100;

      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      let message = `API usage: ${usage.toFixed(1)}% of estimated rate limit`;

      if (usage > 80) {
        status = 'error';
        message = `High API usage: ${usage.toFixed(1)}% - approaching rate limits`;
      } else if (usage > 60) {
        status = 'warning';
        message = `Moderate API usage: ${usage.toFixed(1)}% - monitor closely`;
      }

      this.results.push({
        component: 'Rate Limits',
        status,
        message,
        details: {
          commentsLastHour: recentComments || 0,
          estimatedAPICalls,
          usagePercentage: usage,
          rateLimit
        }
      });

    } catch (error) {
      this.results.push({
        component: 'Rate Limits',
        status: 'warning',
        message: `Could not check rate limits: ${error}`,
        details: error
      });
    }
  }

  // Run all health checks
  async runAllChecks(): Promise<HealthCheckResult[]> {
    console.log('🏥 Running health checks...\n');

    const checks = [
      { name: 'Environment Variables', fn: () => this.checkEnvironment() },
      { name: 'Supabase Database', fn: () => this.checkSupabase() },
      { name: 'OpenAI API', fn: () => this.checkOpenAI() },
      { name: 'Performance Metrics', fn: () => this.checkPerformanceMetrics() },
      { name: 'Rate Limits', fn: () => this.checkRateLimits() },
    ];

    for (const check of checks) {
      try {
        console.log(`🔍 Checking ${check.name}...`);
        await check.fn();
      } catch (error) {
        this.results.push({
          component: check.name,
          status: 'error',
          message: `Health check failed: ${error}`,
          details: error
        });
      }
    }

    return this.results;
  }

  // Display results
  displayResults(): void {
    console.log('\n📊 Health Check Results');
    console.log('========================\n');

    const statusEmoji = {
      healthy: '✅',
      warning: '⚠️',
      error: '❌'
    };

    let hasErrors = false;
    let hasWarnings = false;

    this.results.forEach(result => {
      const emoji = statusEmoji[result.status];
      console.log(`${emoji} ${result.component}: ${result.message}`);
      
      if (result.details && Object.keys(result.details).length > 0) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2).split('\n').join('\n   ')}`);
      }
      
      if (result.status === 'error') hasErrors = true;
      if (result.status === 'warning') hasWarnings = true;
      
      console.log('');
    });

    // Overall status
    const overallStatus = hasErrors ? 'ERROR' : hasWarnings ? 'WARNING' : 'HEALTHY';
    const overallEmoji = hasErrors ? '❌' : hasWarnings ? '⚠️' : '✅';
    
    console.log(`${overallEmoji} Overall System Status: ${overallStatus}\n`);

    if (hasErrors) {
      console.log('🔧 Action Required: Address the errors above before deploying.');
    } else if (hasWarnings) {
      console.log('👀 Monitor: Some components have warnings - monitor closely.');
    } else {
      console.log('🚀 System Ready: All checks passed - ready for deployment!');
    }
  }
}

// Main execution
async function main() {
  const checker = new HealthChecker();
  
  try {
    await checker.runAllChecks();
    checker.displayResults();
    
    // Exit with appropriate code
    const hasErrors = checker.results.some(r => r.status === 'error');
    process.exit(hasErrors ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

main();