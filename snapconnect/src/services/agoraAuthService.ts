import { supabase } from './supabase';

export interface AgoraTokenRequest {
  channelName: string;
  role: 'host' | 'audience';
  userId: string;
}

export interface AgoraTokenResponse {
  token: string;
  uid: number;
  channelName: string;
  expiresAt: number;
}

export interface AgoraCredentials {
  token: string;
  uid: number;
  channelName: string;
  appId: string;
}

export class AgoraAuthService {
  private readonly AGORA_APP_ID: string;

  constructor() {
    // Get Agora App ID from environment variables (safe initialization)
    const appId = process.env.EXPO_PUBLIC_AGORA_APP_ID;
    if (!appId || appId === 'your_agora_app_id_here') {
      console.warn('⚠️ EXPO_PUBLIC_AGORA_APP_ID not configured - live streaming disabled');
      this.AGORA_APP_ID = 'demo_mode';
      return;
    }
    this.AGORA_APP_ID = appId;
  }

  /**
   * Check if Agora is properly configured
   */
  isConfigured(): boolean {
    return this.AGORA_APP_ID !== 'demo_mode';
  }

  /**
   * Generate Agora token for live streaming
   * Integrates with existing SnapConnect auth system
   */
  async generateToken(params: AgoraTokenRequest): Promise<AgoraCredentials> {
    try {
      // Check if Agora is configured
      if (!this.isConfigured()) {
        throw new Error('Live streaming is not configured. Please contact support.');
      }

      // Get current user session from Supabase with detailed logging
      console.log('🔍 Attempting to get current session...');
      const { data: { session, user }, error: authError } = await supabase.auth.getSession();
      
      console.log('📊 Session check results:');
      console.log('  - Auth error:', authError);
      console.log('  - Session exists:', !!session);
      console.log('  - User exists:', !!user);
      console.log('  - User ID:', user?.id);
      console.log('  - Session access_token exists:', !!session?.access_token);
      
      // If session exists but user is missing, try getUser() instead
      let finalUser = user;
      if (session && !user) {
        console.log('🔍 Session exists but no user found, trying getUser()...');
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        console.log('📊 GetUser results:');
        console.log('  - User error:', userError);
        console.log('  - User exists:', !!userData?.user);
        console.log('  - User ID:', userData?.user?.id);
        
        if (!userError && userData?.user) {
          finalUser = userData.user;
          console.log('✅ Retrieved user via getUser()');
        }
      }
      
      if (authError) {
        console.error('❌ Auth error:', authError);
        throw new Error(`Authentication error: ${authError.message}`);
      }
      
      if (!session) {
        console.error('❌ No session found - trying to refresh session...');
        
        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          console.error('❌ Session refresh failed:', refreshError);
          throw new Error('No active session found. Please sign in again.');
        }
        
        console.log('✅ Session refreshed successfully');
        // Use the refreshed session
        return this.generateToken({
          ...params,
          // Retry with refreshed session
        });
      }
      
      if (!finalUser) {
        console.error('❌ No user found in session or via getUser()');
        throw new Error('No user found in session. Please sign in again.');
      }
      
      console.log('✅ Valid session found for user:', finalUser.id);

      // Validate that the requesting user matches the userId parameter
      if (finalUser.id !== params.userId) {
        throw new Error('User ID mismatch - cannot generate token for another user');
      }

      // Generate UID from user ID for consistency
      const uid = this.generateUID(finalUser.id);

      // Call Supabase Edge Function to generate token
      const { data, error } = await supabase.functions.invoke('generate-agora-token', {
        body: {
          channelName: params.channelName,
          uid,
          role: params.role,
          userId: params.userId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('❌ Agora token generation failed:', error);
        throw new Error(`Failed to generate streaming token: ${error.message}`);
      }

      if (!data || !data.token) {
        throw new Error('Invalid response from token generation service');
      }

      const tokenResponse = data as AgoraTokenResponse;

      // Log successful token generation (remove in production)
      console.log(`✅ Generated Agora token for user ${finalUser.id}, channel ${params.channelName}, role ${params.role}`);

      return {
        token: tokenResponse.token,
        uid: tokenResponse.uid,
        channelName: tokenResponse.channelName,
        appId: this.AGORA_APP_ID,
      };

    } catch (error) {
      console.error('❌ AgoraAuthService error:', error);
      throw error;
    }
  }

  /**
   * Generate host token for creating a new live stream
   */
  async generateHostToken(channelName: string, userId: string): Promise<AgoraCredentials> {
    return this.generateToken({
      channelName,
      role: 'host',
      userId,
    });
  }

  /**
   * Generate viewer token for joining an existing live stream
   */
  async generateViewerToken(channelName: string, userId: string): Promise<AgoraCredentials> {
    return this.generateToken({
      channelName,
      role: 'audience',
      userId,
    });
  }

  /**
   * Generate a consistent UID from user UUID
   * Following the same pattern as described in the integration strategy
   */
  private generateUID(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Ensure positive number and within Agora's UID range (1 to 2^32-1)
    const uid = Math.abs(hash) || 1;
    return uid > 2147483647 ? uid % 2147483647 : uid;
  }

  /**
   * Validate if current user can host a specific channel
   * Used for additional security checks
   */
  async canUserHostChannel(channelName: string, userId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.id !== userId) {
        return false;
      }

      // Check if there's an existing stream with this channel name
      const { data: existingStream, error } = await supabase
        .from('live_streams')
        .select('host_id')
        .eq('agora_channel_name', channelName)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error checking stream permissions:', error);
        return false;
      }

      // If no existing stream, user can host
      if (!existingStream) {
        return true;
      }

      // If stream exists, only the original host can get host tokens
      return existingStream.host_id === userId;

    } catch (error) {
      console.error('Error validating host permissions:', error);
      return false;
    }
  }

  /**
   * Get Agora App ID for client-side initialization
   */
  getAppId(): string {
    return this.AGORA_APP_ID;
  }

  /**
   * Generate a unique channel name for new streams
   * Format: stream_<timestamp>_<user_hash>
   */
  generateChannelName(userId: string): string {
    const timestamp = Date.now();
    const userHash = this.generateUID(userId).toString(36);
    return `stream_${timestamp}_${userHash}`;
  }

  /**
   * Check if a token is about to expire (within 5 minutes)
   */
  isTokenExpiring(expiresAt: number): boolean {
    const currentTime = Math.floor(Date.now() / 1000);
    const fiveMinutes = 5 * 60; // 5 minutes in seconds
    return (expiresAt - currentTime) <= fiveMinutes;
  }
}

// Create singleton instance
export const agoraAuthService = new AgoraAuthService();