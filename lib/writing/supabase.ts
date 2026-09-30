/**
 * Writing-module server helpers.
 *
 * Supabase clients come from the shell's lib/supabase/server (per CONTRACTS.md).
 * This file adds module-specific helpers: the auth guard, audit logging, and
 * the storage path convention.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  createServerClient,
  createServiceClient,
} from "@/lib/supabase/server";

export { createServerClient, createServiceClient };

export interface AuthedUser {
  id: string;
  email?: string;
}

/**
 * Auth guard for API routes: returns the user or a 401 JSON response.
 * Never trusts client-supplied user ids.
 */
export async function requireUser(): Promise<
  { user: AuthedUser; supabase: SupabaseClient } | { response: NextResponse }
> {
  let supabase: SupabaseClient;
  try {
    supabase = createServerClient();
  } catch (e) {
    return {
      response: NextResponse.json(
        { error: (e as Error).message },
        { status: 500 }
      ),
    };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      response: NextResponse.json(
        { error: "You need to sign in to use the Writing Assistant." },
        { status: 401 }
      ),
    };
  }
  return { user: { id: user.id, email: user.email ?? undefined }, supabase };
}

/** Append an audit log entry. Never throws; audit must not break the request. */
export async function auditLog(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  meta: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      meta,
    });
  } catch {
    // Audit logging is best-effort.
  }
}

/** Storage object path convention: <user_id>/<uuid>-<sanitized-filename> */
export function storagePath(
  userId: string,
  id: string,
  filename: string
): string {
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${userId}/${id}-${sanitized || "document"}`;
}
