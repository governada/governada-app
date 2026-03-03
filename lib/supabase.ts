/**
 * Supabase Client Configuration
 * Provides regular client for reads and admin client for writes
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Regular Supabase client for reads
 * Uses anon key - safe for client-side and server-side
 * Read-only access via RLS policies
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required',
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Admin Supabase client for writes
 * Uses service role key - SERVER-ONLY, never expose to client
 * Full write access, bypasses RLS
 */
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!supabaseSecretKey) {
    throw new Error('Missing environment variable: SUPABASE_SECRET_KEY (server-only)');
  }

  return createSupabaseClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
