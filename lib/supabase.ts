// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient(
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}
