import { NextResponse } from "next/server";
import { buildChangeList } from "@/lib/writing/export";
import { requireUser } from "@/lib/writing/supabase";
import type { RevisionStatus } from "@/lib/writing/types";

export const runtime = "nodejs";

/**
 * GET /api/writing/[id]/changes — "View Changes": every revision with
 * original → revised text and its current status.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { data: doc } = await supabase
    .from("writing_docs")
    .select("id")
    .eq("id", params.id)
    .single();
  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const { data: revisions, error } = await supabase
    .from("writing_revisions")
    .select("id, scope, section_ref, original_text, revised_text, status, created_at")
    .eq("writing_doc_id", params.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Could not load the change list." },
      { status: 500 }
    );
  }

  const changes = buildChangeList(
    (revisions ?? []).map((r) => ({
      id: r.id as string,
      scope: r.scope as string,
      sectionRef: (r.section_ref as string) ?? "",
      original_text: r.original_text as string,
      revised_text: r.revised_text as string,
      status: r.status as RevisionStatus,
    }))
  );

  return NextResponse.json({ changes });
}
