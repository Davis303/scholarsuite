import { NextRequest, NextResponse } from "next/server";
import { applyRevisions, buildDocx, buildPdf } from "@/lib/writing/export";
import { loadExtraction, loadWritingDoc } from "@/lib/writing/docStore";
import {
  auditLog,
  createServiceClient,
  requireUser,
  storagePath,
} from "@/lib/writing/supabase";
import type { RevisionStatus } from "@/lib/writing/types";

export const runtime = "nodejs";
export const maxDuration = 180;

const KINDS = new Set(["docx", "pdf"]);

/**
 * GET /api/writing/[id]/export?kind=docx|pdf
 * Applies accepted/edited revisions to the extracted document, rebuilds the
 * file, uploads it to the private `exports` bucket, and returns a short-lived
 * signed URL.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  const kind = new URL(req.url).searchParams.get("kind") ?? "docx";
  if (!KINDS.has(kind)) {
    return NextResponse.json(
      { error: "Choose docx or pdf for the export." },
      { status: 400 }
    );
  }

  const doc = await loadWritingDoc(supabase, params.id);
  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const extracted = await loadExtraction(doc.storage_path);
  if (!extracted) {
    return NextResponse.json(
      { error: "Analyze the document before exporting it." },
      { status: 409 }
    );
  }

  const { data: revisions } = await supabase
    .from("writing_revisions")
    .select("id, scope, section_ref, original_text, revised_text, status")
    .eq("writing_doc_id", params.id);

  const { sections, changes } = applyRevisions(
    extracted,
    (revisions ?? []).map((r) => ({
      id: r.id as string,
      scope: r.scope as string,
      sectionRef: (r.section_ref as string) ?? "",
      original_text: r.original_text as string,
      revised_text: r.revised_text as string,
      status: r.status as RevisionStatus,
    }))
  );

  const title = doc.name.replace(/\.[^.]+$/, "");
  const buffer =
    kind === "docx"
      ? await buildDocx({ ...extracted, sections }, title)
      : await buildPdf({ ...extracted, sections }, title);

  const exportId = crypto.randomUUID();
  const ext = kind === "docx" ? "docx" : "pdf";
  const path = storagePath(user.id, exportId, `${title}-improved.${ext}`);

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const { error: uploadError } = await service.storage
    .from("exports")
    .upload(path, buffer, {
      contentType:
        kind === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf",
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json(
      { error: "The export could not be saved. Try again." },
      { status: 500 }
    );
  }

  const { data: signed, error: signError } = await service.storage
    .from("exports")
    .createSignedUrl(path, 3600);
  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "The download link could not be created. Try again." },
      { status: 500 }
    );
  }

  await auditLog(supabase, user.id, "writing.export", "writing_doc", params.id, {
    kind,
    appliedChanges: changes.length,
    storage_path: path,
  });

  return NextResponse.json({
    url: signed.signedUrl,
    filename: `${title}-improved.${ext}`,
    appliedChanges: changes.length,
  });
}
