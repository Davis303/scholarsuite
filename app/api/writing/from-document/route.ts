import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auditLog, requireUser } from "@/lib/writing/supabase";

export const runtime = "nodejs";

const bodySchema = z.object({ documentId: z.string().uuid() });

/**
 * POST /api/writing/from-document, bridge from the shared document library
 * (and from similarity reviews): create a writing_docs row reusing the SAME
 * storage path as a documents row. No file re-upload.
 * Body: { documentId } (documents table id) → { writingDocId }.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "The request was invalid." },
      { status: 400 }
    );
  }

  const { data: source } = await supabase
    .from("documents")
    .select("id, name, mime_type, size_bytes, storage_path")
    .eq("id", body.documentId)
    .single();

  if (!source) {
    return NextResponse.json(
      { error: "The shared document was not found." },
      { status: 404 }
    );
  }

  const { data: created, error } = await supabase
    .from("writing_docs")
    .insert({
      user_id: user.id,
      name: source.name as string,
      mime_type: source.mime_type as string | null,
      size_bytes: source.size_bytes as number | null,
      storage_path: source.storage_path as string,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json(
      { error: "The document could not be opened in the Writing Assistant." },
      { status: 500 }
    );
  }

  await auditLog(
    supabase,
    user.id,
    "writing.from_document",
    "writing_doc",
    created.id as string,
    { source_document_id: body.documentId }
  );

  return NextResponse.json({ writingDocId: created.id }, { status: 201 });
}
