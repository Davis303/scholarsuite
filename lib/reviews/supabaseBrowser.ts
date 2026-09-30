/**
 * Reviews-module adapter over the shared browser Supabase client.
 * Delegates to lib/supabase/client so there is one client implementation.
 */
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!cached) cached = createClient();
  return cached;
}
