import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { RtcTokenBuilder, RtcRole } from 'npm:agora-token@2.0.5';

interface TokenRequest {
  channelName: string;
  uid: number;
  role: 'host' | 'audience';
  userId: string;
}

interface TokenResponse {
  token: string;
  uid: number;
  channelName: string;
  expiresAt: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get Agora credentials from environment
    const AGORA_APP_ID = Deno.env.get('AGORA_APP_ID');
    const AGORA_APP_CERTIFICATE = Deno.env.get('AGORA_APP_CERTIFICATE');

    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
      console.error('Missing Agora credentials in environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client with service role for user verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get user from JWT token
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const body: TokenRequest = await req.json();
    const { channelName, uid, role, userId } = body;

    // Validate request body
    if (!channelName || !uid || !role || !userId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: channelName, uid, role, userId' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify that the requesting user matches the userId in the request
    if (user.id !== userId) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate role
    if (!['host', 'audience'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be "host" or "audience"' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For host role, verify user has permission to create/manage the stream
    if (role === 'host') {
      // Check if user is the creator of this stream (if it exists)
      const { data: streamData, error: streamError } = await supabase
        .from('live_streams')
        .select('host_id')
        .eq('agora_channel_name', channelName)
        .single();

      if (streamError && streamError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Database error:', streamError);
        return new Response(
          JSON.stringify({ error: 'Database error' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // If stream exists, verify user is the host
      if (streamData && streamData.host_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Not authorized to host this stream' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Convert role to Agora role
    const agoraRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    // Token expires in 24 hours (86400 seconds)
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + 86400;

    // Generate Agora token
    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uid,
      agoraRole,
      expirationTimeInSeconds,
      expirationTimeInSeconds
    );

    // Log token generation for debugging (remove in production)
    console.log(`Generated token for user ${user.id}, channel ${channelName}, role ${role}`);

    // If this is a host creating a new stream, log it
    if (role === 'host') {
      // This could be extended to automatically create stream record if needed
      console.log(`Host ${user.id} generated token for channel ${channelName}`);
    }

    const response: TokenResponse = {
      token,
      uid,
      channelName,
      expiresAt: expirationTimeInSeconds
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error generating Agora token:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/* 
 * Edge Function Usage:
 * 
 * POST /functions/v1/generate-agora-token
 * Headers:
 *   Authorization: Bearer <supabase_jwt_token>
 *   Content-Type: application/json
 * 
 * Body:
 * {
 *   "channelName": "stream_123",
 *   "uid": 12345,
 *   "role": "host" | "audience",
 *   "userId": "user_uuid_here"
 * }
 * 
 * Response:
 * {
 *   "token": "agora_token_string",
 *   "uid": 12345,
 *   "channelName": "stream_123",
 *   "expiresAt": 1640995200
 * }
 * 
 * Environment Variables Required:
 * - AGORA_APP_ID: Your Agora App ID
 * - AGORA_APP_CERTIFICATE: Your Agora App Certificate
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 */