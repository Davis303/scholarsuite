/**
 * Reviews-module adapter over the shared Supabase server clients.
 *
 * Previously a local duplicate implementation; now delegates to
 * lib/supabase/server so there is exactly one session/cookie handling
 * implementation in the repo. The function names are kept stable so the
 * reviews module's call sites don't change.
 */
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface AuthedContext {
  supabase: SupabaseClient;
  user: User;
}

/** User-scoped client for Route Handlers / Server Components (RLS applies). */
export function getServerSupabase(): SupabaseClient {
  return createServerClient();
}

/** Service-role client (server only). Bypasses RLS, storage use only. */
export function getServiceSupabase(): SupabaseClient {
  return createServiceClient();
}

/** Returns the authenticated user context, or null when not signed in. */
export async function requireUser(): Promise<AuthedContext | null> {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}
