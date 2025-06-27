/**
 * Server-side Supabase client for Node.js environments
 * Used by bot automation scripts and server-side operations
 */

import { createClient } from '@supabase/supabase-js';

let supabaseServerClient: any = null;

// Initialize server-side client lazily to ensure environment variables are loaded
function getSupabaseServer() {
  if (!supabaseServerClient) {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required server-side Supabase configuration. Please check EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    // Create server-side client with service role key
    supabaseServerClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('✅ Server-side Supabase client initialized');
  }
  return supabaseServerClient;
}

// Export a getter function instead of the client directly
export { getSupabaseServer as supabaseServer };