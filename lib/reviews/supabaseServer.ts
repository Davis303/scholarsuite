import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL.');
  return url;
}

function supabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  return key;
}

function serviceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Supabase service key is not configured.');
  return key;
}

/**
 * User-scoped Supabase client for Route Handlers / Server Components.
 * Reads the session from cookies; RLS policies apply.
 */
export function getServerSupabase(): SupabaseClient {
  const cookieStore = cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: ((cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll may throw in Server Components where headers are read-only;
          // the middleware refreshes the session cookie instead.
        }
      }) satisfies SetAllCookies,
    },
  });
}

/** Service-role client (server only). Bypasses RLS — use for Storage only. */
export function getServiceSupabase(): SupabaseClient {
  return createClient(supabaseUrl(), serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface AuthedContext {
  supabase: SupabaseClient;
  user: User;
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
