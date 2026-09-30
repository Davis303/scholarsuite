import { NextResponse } from "next/server";
import { auditLog, requireUser } from "@/lib/writing/supabase";

export const runtime = "nodejs";

/**
 * POST /api/writing/[id]/send-to-review — bridge to the similarity review
 * workspace: ensure a `documents` row (kind='original') exists for this
 * writing file, reusing the same storage path (no re-upload), then return
 * { documentId } so the UI can route to /reviews/new?documentId=.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  const { data: writingDoc } = await supabase
    .from("writing_docs")
    .select("id, name, mime_type, size_bytes, storage_path")
    .eq("id", params.id)
    .single();

  if (!writingDoc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const storagePathValue = writingDoc.storage_path as string;

  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("storage_path", storagePathValue)
    .eq("kind", "original")
    .limit(1)
    .maybeSingle();

  let documentId: string;
  if (existing) {
    documentId = existing.id as string;
  } else {
    const { data: created, error } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        kind: "original",
        name: writingDoc.name as string,
        mime_type: writingDoc.mime_type as string | null,
        size_bytes: writingDoc.size_bytes as number | null,
        storage_path: storagePathValue,
        status: "uploaded",
      })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json(
        { error: "The document could not be prepared for review." },
        { status: 500 }
      );
    }
    documentId = created.id as string;
  }

  await auditLog(supabase, user.id, "writing.send_to_review", "document", documentId, {
    writing_doc_id: params.id,
  });

  return NextResponse.json({ documentId });
}
