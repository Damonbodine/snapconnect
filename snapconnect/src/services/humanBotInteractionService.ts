/**
 * Human-Bot Interaction Service
 * Handles automatic AI bot commenting on human Photos/Discover content
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { DIVERSE_AI_PERSONALITIES } from '../types/aiPersonality';

// Load environment variables
dotenv.config();

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

// OpenAI configuration
const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
if (!openaiApiKey) {
  throw new Error('Missing required OpenAI API key');
}

const openai = new OpenAI({
  apiKey: openaiApiKey
});

// Quality thresholds for engagement (aggressive testing mode)
const ENGAGEMENT_THRESHOLDS = {
  MIN_LIKES: 0,           // No minimum likes required
  MIN_TOTAL_ENGAGEMENT: 0, // No minimum engagement required
  MAX_COMMENTS_PER_POST: 15, // Allow up to 15 bot comments per post (was 3)
  MIN_POST_AGE_MINUTES: 0,  // Comment immediately (was 1)
  MAX_POST_AGE_HOURS: 72,   // Comment on posts up to 72 hours old
};

// Rate limiting (aggressive testing mode)
const RATE_LIMITS = {
  COMMENTS_PER_USER_PER_DAY: 20,   // Max comments per human user per day per bot (was 10)
  MIN_DELAY_BETWEEN_COMMENTS: 0.1, // 6 seconds minimum between comments on same post (was 1 minute)
  MAX_DELAY_BEFORE_COMMENT: 2,     // 2 minutes maximum delay before commenting (was 10)
  COMMENT_PROBABILITY: 1.0,        // 100% chance to comment on eligible posts (was 80%)
};

export interface HumanPost {
  id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: 'photo' | 'video';
  created_at: string;
  users: {
    username: string;
    email?: string;
    is_mock_user: boolean;
    personality_traits?: any;
  };
  like_count?: number;
  comment_count?: number;
  existing_comments?: Array<{
    content: string;
    users: { username: string; is_mock_user: boolean };
  }>;
}

export interface BotEngagementResult {
  success: boolean;
  comments_posted: number;
  posts_processed: number;
  errors: string[];
}

class HumanBotInteractionService {
  private static instance: HumanBotInteractionService;

  public static getInstance(): HumanBotInteractionService {
    if (!HumanBotInteractionService.instance) {
      HumanBotInteractionService.instance = new HumanBotInteractionService();
    }
    return HumanBotInteractionService.instance;
  }

  /**
   * Get human posts eligible for bot commenting
   */
  async getEligibleHumanPosts(
    contentType: 'photos' | 'discover' | 'all' = 'all',
    targetUserEmail?: string
  ): Promise<HumanPost[]> {
    try {
      const cutoffTime = new Date(
        Date.now() - ENGAGEMENT_THRESHOLDS.MAX_POST_AGE_HOURS * 60 * 60 * 1000
      ).toISOString();

      const minPostTime = new Date(
        Date.now() - ENGAGEMENT_THRESHOLDS.MIN_POST_AGE_MINUTES * 60 * 1000
      ).toISOString();

      let query = supabase
        .from('posts')
        .select(`
          id,
          user_id,
          content,
          media_url,
          media_type,
          created_at,
          users!inner(username, email, is_mock_user, personality_traits)
        `)
        .eq('users.is_mock_user', false) // Only human users
        .gte('created_at', cutoffTime)   // Not too old
        .lte('created_at', minPostTime)  // Not too new
        .order('created_at', { ascending: false })
        .limit(50);

      // Filter by content type if specified
      if (contentType === 'photos') {
        query = query.eq('media_type', 'photo');
      } else if (contentType === 'discover') {
        query = query.eq('media_type', 'video');
      }

      // Filter by specific user if testing
      if (targetUserEmail) {
        query = query.eq('users.email', targetUserEmail);
      }

      const { data: posts, error } = await query;

      if (error) {
        console.error('Failed to fetch human posts:', error);
        return [];
      }

      if (!posts || posts.length === 0) {
        return [];
      }

      // Get engagement counts and filter by quality thresholds
      const eligiblePosts: HumanPost[] = [];

      for (const post of posts) {
        const engagement = await this.getPostEngagement(post.id);
        const botCommentCount = await this.getBotCommentCount(post.id);

        // Check quality thresholds (now very permissive for testing)
        const meetsQualityThreshold = 
          engagement.like_count >= ENGAGEMENT_THRESHOLDS.MIN_LIKES ||
          (engagement.like_count + engagement.comment_count) >= ENGAGEMENT_THRESHOLDS.MIN_TOTAL_ENGAGEMENT ||
          true; // Always true for testing - comment on all posts

        const hasSpaceForComments = botCommentCount < ENGAGEMENT_THRESHOLDS.MAX_COMMENTS_PER_POST;

        if (meetsQualityThreshold && hasSpaceForComments) {
          eligiblePosts.push({
            ...post,
            like_count: engagement.like_count,
            comment_count: engagement.comment_count,
            existing_comments: engagement.existing_comments,
          });
        }
      }

      console.log(`Found ${eligiblePosts.length} eligible human posts for bot engagement`);
      return eligiblePosts;

    } catch (error) {
      console.error('Error getting eligible human posts:', error);
      return [];
    }
  }

  /**
   * Get post engagement statistics
   */
  private async getPostEngagement(postId: string) {
    try {
      // Get like count
      const { count: likeCount } = await supabase
        .from('user_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId)
        .eq('interaction_type', 'like');

      // Get comments with user info
      const { data: comments } = await supabase
        .from('comments')
        .select(`
          content,
          users!inner(username, is_mock_user)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        like_count: likeCount || 0,
        comment_count: comments?.length || 0,
        existing_comments: comments || [],
      };
    } catch (error) {
      console.error('Error getting post engagement:', error);
      return { like_count: 0, comment_count: 0, existing_comments: [] };
    }
  }

  /**
   * Get count of bot comments on a post
   */
  private async getBotCommentCount(postId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId)
        .eq('users.is_mock_user', true);

      return count || 0;
    } catch (error) {
      console.error('Error getting bot comment count:', error);
      return 0;
    }
  }

  /**
   * Select appropriate bots to comment on a post
   */
  async selectBotsForPost(post: HumanPost): Promise<any[]> {
    try {
      // Get available AI users (increased limit for testing)
      const { data: bots } = await supabase
        .from('users')
        .select('id, username, personality_traits, ai_response_style')
        .eq('is_mock_user', true)
        .limit(50); // Increased from 20 to 50

      if (!bots || bots.length === 0) {
        return [];
      }

      // Check rate limits for each bot
      const eligibleBots = [];
      
      for (const bot of bots) {
        const canComment = await this.checkBotRateLimit(bot.id, post.user_id);
        if (canComment) {
          eligibleBots.push(bot);
        }
      }

      // Aggressive testing mode - select 10+ bots for heavy engagement
      const targetComments = 10; // Target 10 comments per post
      const maxComments = Math.min(15, eligibleBots.length); // Up to 15 or all available bots
      
      const numComments = Math.random() < RATE_LIMITS.COMMENT_PROBABILITY 
        ? Math.min(targetComments + Math.floor(Math.random() * 6), maxComments) // 10-15 comments
        : 0; // No comments

      if (numComments === 0 || eligibleBots.length === 0) {
        return [];
      }

      // Shuffle and select many bots for heavy engagement
      const shuffled = eligibleBots.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, numComments);
      
      console.log(`Selected ${selected.length} bots for aggressive commenting on post by ${post.users.username}`);
      return selected;

    } catch (error) {
      console.error('Error selecting bots for post:', error);
      return [];
    }
  }

  /**
   * Check if bot can comment based on rate limits
   */
  private async checkBotRateLimit(botId: string, humanUserId: string): Promise<boolean> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check daily limit per human user
      const { count } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', botId)
        .eq('posts.user_id', humanUserId)
        .gte('created_at', today.toISOString());

      return (count || 0) < RATE_LIMITS.COMMENTS_PER_USER_PER_DAY;
    } catch (error) {
      console.error('Error checking bot rate limit:', error);
      return false;
    }
  }

  /**
   * Generate contextual comment for a human post
   */
  async generateHumanPostComment(
    bot: any,
    post: HumanPost
  ): Promise<string> {
    try {
      // Get bot's personality archetype (with fallback)
      const archetypeId = bot.personality_traits?.archetype_id;
      let archetype = DIVERSE_AI_PERSONALITIES.find(p => p.id === archetypeId);
      
      // Fallback to random archetype if not found
      if (!archetype) {
        console.log(`Warning: Bot ${bot.username} has unknown archetype ${archetypeId}, using random archetype`);
        archetype = DIVERSE_AI_PERSONALITIES[Math.floor(Math.random() * DIVERSE_AI_PERSONALITIES.length)];
      }

      // Analyze image if present
      let imageAnalysis = '';
      if (post.media_url && post.media_type === 'photo') {
        imageAnalysis = await this.analyzePostImage(post.media_url);
      }

      // Build context-aware prompt
      let contextPrompt = `You are ${bot.username}, a ${archetype.name.toLowerCase()} who uses the SnapConnect fitness app.

Your personality: ${archetype.description}
Your communication style: ${archetype.base_personality.communication_style}
Your content tone: ${archetype.base_personality.content_tone}

You're commenting on a post by ${post.users.username}.

POST DETAILS:
Caption: "${post.content}"`;

      if (imageAnalysis) {
        contextPrompt += `\nImage: ${imageAnalysis}`;
      }

      if (post.existing_comments && post.existing_comments.length > 0) {
        const otherComments = post.existing_comments
          .filter(c => !c.users.is_mock_user) // Show human comments
          .slice(0, 2)
          .map(c => `- ${c.users.username}: ${c.content}`)
          .join('\n');
        
        if (otherComments) {
          contextPrompt += `\n\nEXISTING COMMENTS:\n${otherComments}`;
        }
      }

      contextPrompt += `\n\nWrite a brief, authentic comment (1-2 sentences max, under 80 characters) that:
1. Matches your personality as ${archetype.name.toLowerCase()}
2. Feels genuine and encouraging
3. ${imageAnalysis ? 'References what you see in the image naturally' : 'Responds to the caption meaningfully'}
4. ${post.existing_comments?.length ? 'Adds something new to the conversation' : 'Starts a supportive conversation'}
5. Uses casual, friendly fitness community language
6. Shows authentic interest in their fitness journey

Be supportive, brief, and personality-consistent.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: contextPrompt },
        ],
        max_tokens: 100,
        temperature: 0.8,
      });

      const comment = completion.choices[0]?.message?.content?.trim() || '';
      
      // Clean up the comment
      return this.cleanComment(comment);

    } catch (error) {
      console.error('Error generating human post comment:', error);
      // Fallback to simple encouraging comment
      return this.getFallbackComment(bot, post);
    }
  }

  /**
   * Analyze post image using OpenAI Vision
   */
  private async analyzePostImage(imageUrl: string): Promise<string> {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Briefly describe this fitness/workout image in 1-2 sentences. Focus on the exercise, location, equipment, or fitness activity shown.'
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 100,
      });

      return completion.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('Error analyzing post image:', error);
      return '';
    }
  }

  /**
   * Clean and validate comment
   */
  private cleanComment(comment: string): string {
    // Remove quotes if present
    let cleaned = comment.replace(/^["']|["']$/g, '');
    
    // Ensure reasonable length
    if (cleaned.length > 120) {
      cleaned = cleaned.substring(0, 117) + '...';
    }
    
    // Remove any potential problematic content
    cleaned = cleaned.replace(/\b(bot|AI|artificial|automated)\b/gi, '');
    
    return cleaned.trim();
  }

  /**
   * Get fallback comment if generation fails
   */
  private getFallbackComment(bot: any, post: HumanPost): string {
    const encouragingComments = [
      "Great work! 💪",
      "Keep it up! 🔥",
      "Love the dedication! 🙌",
      "Inspiring! 👏",
      "Awesome effort! ✨",
      "Looking strong! 💯",
      "Keep crushing it! 🚀",
    ];
    
    return encouragingComments[Math.floor(Math.random() * encouragingComments.length)];
  }

  /**
   * Post comment on human post
   */
  async postComment(
    postId: string,
    botId: string,
    comment: string,
    dryRun: boolean = false
  ): Promise<boolean> {
    if (dryRun) {
      console.log(`[DRY RUN] Would post comment: "${comment}" on post ${postId} by bot ${botId}`);
      return true;
    }

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: botId,
          content: comment,
        });

      if (error) {
        console.error('Failed to post comment:', error);
        return false;
      }

      console.log(`✅ Posted comment on post ${postId}: "${comment}"`);
      return true;
    } catch (error) {
      console.error('Error posting comment:', error);
      return false;
    }
  }

  /**
   * Process human posts and generate bot comments
   */
  async processHumanPosts(
    contentType: 'photos' | 'discover' | 'all' = 'all',
    targetUserEmail?: string,
    dryRun: boolean = false
  ): Promise<BotEngagementResult> {
    const result: BotEngagementResult = {
      success: true,
      comments_posted: 0,
      posts_processed: 0,
      errors: [],
    };

    try {
      // Get eligible posts
      const posts = await this.getEligibleHumanPosts(contentType, targetUserEmail);
      
      if (posts.length === 0) {
        console.log('No eligible human posts found for bot engagement');
        return result;
      }

      console.log(`Processing ${posts.length} eligible human posts...`);

      // Process each post
      for (const post of posts) {
        try {
          result.posts_processed++;

          // Select bots for this post
          const selectedBots = await this.selectBotsForPost(post);
          
          if (selectedBots.length === 0) {
            console.log(`No bots selected for post ${post.id} by ${post.users.username}`);
            continue;
          }

          // Generate comments with delays
          for (let i = 0; i < selectedBots.length; i++) {
            const bot = selectedBots[i];
            
            // Add short delay between comments for testing (6-30 seconds)
            if (i > 0) {
              const delay = (6 + Math.random() * 24) * 1000; // 6-30 seconds
              if (!dryRun) {
                console.log(`Waiting ${Math.round(delay / 1000)} seconds before next comment...`);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }

            // Generate comment
            const comment = await this.generateHumanPostComment(bot, post);
            
            // Post comment
            const success = await this.postComment(post.id, bot.id, comment, dryRun);
            
            if (success) {
              result.comments_posted++;
              console.log(`${dryRun ? '[DRY RUN] ' : ''}Comment posted by ${bot.username} on ${post.users.username}'s post: "${comment}"`);
            } else {
              result.errors.push(`Failed to post comment by ${bot.username} on post ${post.id}`);
            }
          }

        } catch (error) {
          const errorMsg = `Error processing post ${post.id}: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

    } catch (error) {
      const errorMsg = `Error in processHumanPosts: ${error}`;
      console.error(errorMsg);
      result.success = false;
      result.errors.push(errorMsg);
    }

    return result;
  }
}

export const humanBotInteractionService = HumanBotInteractionService.getInstance();
export default humanBotInteractionService;