/**
 * Server helpers shared by writing API routes: loading the persisted
 * extraction JSON and the stored style profile for a writing doc.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase";
import type { ExtractedDocument, StyleProfile } from "./types";

export function extractedPath(storagePath: string): string {
  return storagePath.replace(/-[^-]*$/, "-extracted.json");
}

export async function loadExtraction(
  storagePathValue: string
): Promise<ExtractedDocument | null> {
  try {
    const service = createServiceClient();
    const { data } = await service.storage
      .from("documents")
      .download(extractedPath(storagePathValue));
    if (!data) return null;
    return JSON.parse(await data.text()) as ExtractedDocument;
  } catch {
    return null;
  }
}

export interface WritingDocRow {
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  status: string;
  style_profile: { profile?: StyleProfile; displayRows?: unknown } | null;
}

export async function loadWritingDoc(
  supabase: SupabaseClient,
  id: string
): Promise<WritingDocRow | null> {
  const { data } = await supabase
    .from("writing_docs")
    .select(
      "id, name, mime_type, size_bytes, storage_path, status, style_profile"
    )
    .eq("id", id)
    .single();
  return (data as WritingDocRow | null) ?? null;
}

export async function loadTerminology(
  supabase: SupabaseClient,
  userId: string
): Promise<{ term: string; note: string | null }[]> {
  const { data } = await supabase
    .from("terminology_rules")
    .select("term, note")
    .eq("user_id", userId)
    .order("term", { ascending: true });
  return (data ?? []) as { term: string; note: string | null }[];
}

export function terminologyBlock(
  rules: { term: string; note: string | null }[]
): string {
  if (rules.length === 0) return "";
  const lines = rules.map((r) =>
    r.note ? `- "${r.term}": ${r.note}` : `- "${r.term}"`
  );
  return `AUTHOR TERMINOLOGY RULES (always respect these):\n${lines.join("\n")}`;
}
