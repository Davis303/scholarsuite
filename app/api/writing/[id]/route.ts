import { NextResponse } from "next/server";
import { listParagraphs } from "@/lib/writing/chunk";
import { createServiceClient, requireUser } from "@/lib/writing/supabase";
import type { ExtractedDocument } from "@/lib/writing/types";

export const runtime = "nodejs";

function extractedPath(storagePath: string): string {
  return storagePath.replace(/-[^-]*$/, "-extracted.json");
}

/**
 * GET /api/writing/[id] — full editor payload: the writing doc, extracted
 * sections (when analyzed), style profile display rows, paragraph list,
 * revisions, and proofread run summaries.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  const { data: doc } = await supabase
    .from("writing_docs")
    .select(
      "id, name, mime_type, size_bytes, storage_path, status, style_profile, created_at, updated_at"
    )
    .eq("id", params.id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  let sections: ExtractedDocument["sections"] = [];
  let pageCount: number | null = null;
  let warnings: string[] = [];
  try {
    const service = createServiceClient();
    const { data } = await service.storage
      .from("documents")
      .download(extractedPath(doc.storage_path as string));
    if (data) {
      const extracted = JSON.parse(
        await data.text()
      ) as ExtractedDocument;
      sections = extracted.sections ?? [];
      pageCount = extracted.pageCount ?? null;
      warnings = extracted.warnings ?? [];
    }
  } catch {
    // Extraction may not exist yet (doc not analyzed).
  }

  const [{ data: revisions }, { data: runs }] = await Promise.all([
    supabase
      .from("writing_revisions")
      .select("id, scope, section_ref, original_text, revised_text, status, created_at")
      .eq("writing_doc_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("proofread_runs")
      .select("id, scope, status, summary, created_at")
      .eq("writing_doc_id", params.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const styleProfile = (doc.style_profile ?? null) as {
    profile?: unknown;
    displayRows?: { label: string; value: string }[];
  } | null;

  return NextResponse.json({
    document: {
      id: doc.id,
      name: doc.name,
      mimeType: doc.mime_type,
      sizeBytes: doc.size_bytes,
      status: doc.status,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    },
    pageCount,
    warnings,
    sections,
    paragraphs: listParagraphs({ sections, pageCount: pageCount ?? 0, warnings }),
    styleProfile: styleProfile?.profile ?? null,
    styleProfileRows: styleProfile?.displayRows ?? [],
    revisions: revisions ?? [],
    proofreadRuns: runs ?? [],
    llmConfigured: Boolean(process.env.LLM_API_KEY),
  });
}
