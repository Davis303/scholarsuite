import { cookies } from "next/headers";
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Server-side Supabase client for Route Handlers and Server Components.
 * Reads the session from cookies. Every route must still verify the user with
 * `supabase.auth.getUser()` and never trust client-supplied user ids.
 */
export function createServerClient() {
  const cookieStore = cookies();
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component where setting cookies is not
            // allowed; the middleware refresh keeps the session alive.
          }
        },
      },
    }
  );
}

/**
 * Service-role client. SERVER ONLY, never import into client components.
 * Bypasses RLS; use only for privileged operations (cleanup jobs, admin APIs).
 */
export function createServiceClient() {
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No cookie session for the service client.
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
