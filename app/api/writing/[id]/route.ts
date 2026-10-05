import { NextResponse } from "next/server";
import { listParagraphs } from "@/lib/writing/chunk";
import { createServiceClient, requireUser } from "@/lib/writing/supabase";
import type { ExtractedDocument } from "@/lib/writing/types";

export const runtime = "nodejs";

function extractedPath(storagePath: string): string {
  return storagePath.replace(/-[^-]*$/, "-extracted.json");
}

/**
 * GET /api/writing/[id], full editor payload: the writing doc, extracted
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

/**
 * PATCH /api/writing/[id], save edits the user made to the document text
 * in the editor. Only the extracted text copy is updated (the sections the
 * editor shows and the export is built from). The originally uploaded file
 * in storage is never touched.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { data: doc } = await supabase
    .from("writing_docs")
    .select("id, storage_path")
    .eq("id", params.id)
    .single();
  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  let body: { sections?: unknown };
  try {
    body = (await req.json()) as { sections?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!Array.isArray(body.sections) || body.sections.length === 0) {
    return NextResponse.json(
      { error: "Sections are required." },
      { status: 400 }
    );
  }

  const sections: ExtractedDocument["sections"] = [];
  let totalChars = 0;
  for (const raw of body.sections as Array<Record<string, unknown>>) {
    const heading = typeof raw?.heading === "string" ? raw.heading : "";
    const rawParas = Array.isArray(raw?.paragraphs) ? raw.paragraphs : [];
    const paragraphs = rawParas
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const pageNumber =
      typeof raw?.pageNumber === "number" && raw.pageNumber > 0
        ? Math.floor(raw.pageNumber)
        : 1;
    totalChars += heading.length + paragraphs.join("").length;
    if (totalChars > 2_000_000) {
      return NextResponse.json(
        { error: "The document text is too large to save." },
        { status: 400 }
      );
    }
    sections.push({ heading, paragraphs, pageNumber });
  }

  const service = createServiceClient();
  const path = extractedPath(doc.storage_path as string);

  let pageCount = sections.reduce((m, s) => Math.max(m, s.pageNumber), 1);
  let warnings: string[] = [];
  try {
    const { data } = await service.storage.from("documents").download(path);
    if (data) {
      const prev = JSON.parse(await data.text()) as ExtractedDocument;
      pageCount = prev.pageCount ?? pageCount;
      warnings = prev.warnings ?? [];
    }
  } catch {
    // No previous extraction, defaults above apply.
  }

  const extracted: ExtractedDocument = { sections, pageCount, warnings };
  const { error: saveError } = await service.storage
    .from("documents")
    .upload(path, JSON.stringify(extracted), {
      contentType: "application/json",
      upsert: true,
    });
  if (saveError) {
    return NextResponse.json(
      { error: "The edits could not be saved." },
      { status: 500 }
    );
  }

  await supabase
    .from("writing_docs")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", params.id);

  return NextResponse.json({ ok: true, sections });
}
