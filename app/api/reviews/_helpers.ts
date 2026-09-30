import { NextResponse } from 'next/server';
import {
  getServiceSupabase,
  requireUser,
  type AuthedContext,
} from '@/lib/reviews/supabaseServer';
import type { DocumentRow, ReviewRow } from '@/lib/reviews/types';

export type { AuthedContext };

export function unauthorized() {
  return NextResponse.json(
    { error: 'Please sign in to continue.' },
    { status: 401 },
  );
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = 'Review not found.') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = 'Something went wrong. Please try again.') {
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function authed(): Promise<AuthedContext | NextResponse> {
  const ctx = await requireUser();
  if (!ctx) return unauthorized();
  return ctx;
}

/** Fetch a review that belongs to the current user (RLS + explicit check). */
export async function getOwnedReview(
  auth: AuthedContext,
  id: string,
): Promise<ReviewRow | null> {
  const { data, error } = await auth.supabase
    .from('reviews')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single();
  if (error || !data) return null;
  return data as ReviewRow;
}

export async function getOwnedDocument(
  auth: AuthedContext,
  id: string,
): Promise<DocumentRow | null> {
  const { data, error } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single();
  if (error || !data) return null;
  return data as DocumentRow;
}

export async function writeAudit(
  auth: AuthedContext,
  action: string,
  entityType: string,
  entityId: string | null,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    await auth.supabase.from('audit_logs').insert({
      user_id: auth.user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      meta,
    });
  } catch {
    // Audit logging must never break the request.
  }
}

/** Download a private storage object via the service client. */
export async function downloadStorage(
  bucket: string,
  path: string,
): Promise<Buffer> {
  const svc = getServiceSupabase();
  const { data, error } = await svc.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error('The file could not be downloaded from storage.');
  }
  return Buffer.from(await data.arrayBuffer());
}

export function storageObjectPath(userId: string, filename: string): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${userId}/${uuid}-${filename}`;
}
