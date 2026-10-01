import { NextResponse } from "next/server";
import {
  auditLog,
  createServiceClient,
  requireUser,
} from "@/lib/writing/supabase";

export const runtime = "nodejs";

/**
 * DELETE /api/writing/documents/[id], delete a writing document, its
 * revisions, proofread data, and stored files.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  const { data: doc } = await supabase
    .from("writing_docs")
    .select("id, name, storage_path")
    .eq("id", params.id)
    .single();

  if (!doc) {
    return NextResponse.json(
      { error: "Document not found." },
      { status: 404 }
    );
  }

  // Remove stored files (best effort; DB cascade handles rows).
  try {
    const service = createServiceClient();
    const paths = [doc.storage_path as string];
    const extractedPath = (doc.storage_path as string).replace(
      /-[^-]*$/,
      "-extracted.json"
    );
    paths.push(extractedPath);
    await service.storage.from("documents").remove(paths);
  } catch {
    // Storage cleanup is best-effort.
  }

  const { error } = await supabase
    .from("writing_docs")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json(
      { error: "The document could not be deleted." },
      { status: 500 }
    );
  }

  await auditLog(supabase, user.id, "writing_document.delete", "writing_doc", params.id, {
    name: doc.name,
  });

  return NextResponse.json({ ok: true });
}
