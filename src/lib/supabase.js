/**
 * supabase.js — Supabase Client Initialization
 *
 * Uses @supabase/supabase-js v2.
 * Reads URL and anon key from Vite env vars.
 * Falls back gracefully if not configured (persistence disabled).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create client only if both are provided
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })
  : null;

export const isSupabaseConfigured = () => !!supabase;
