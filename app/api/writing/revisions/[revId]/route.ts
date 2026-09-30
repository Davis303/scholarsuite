import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auditLog, requireUser } from "@/lib/writing/supabase";

export const runtime = "nodejs";

const patchSchema = z.object({
  action: z.enum(["accept", "reject", "edit"]),
  text: z.string().min(1).max(20000).optional(),
});

/**
 * PATCH /api/writing/revisions/[revId]
 * Body: { action: 'accept'|'reject'|'edit', text? }
 * 'edit' requires text and stores the manual edit with status 'edited'.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { revId: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "The request was invalid." },
      { status: 400 }
    );
  }

  const { data: revision } = await supabase
    .from("writing_revisions")
    .select("id, writing_doc_id, revised_text")
    .eq("id", params.revId)
    .single();

  if (!revision) {
    return NextResponse.json({ error: "Revision not found." }, { status: 404 });
  }

  let status: string;
  let revisedText: string | undefined;
  if (body.action === "accept") {
    status = "accepted";
  } else if (body.action === "reject") {
    status = "rejected";
  } else {
    if (!body.text || body.text.trim().length === 0) {
      return NextResponse.json(
        { error: "Provide the edited text." },
        { status: 400 }
      );
    }
    status = "edited";
    revisedText = body.text.trim();
  }

  const update: Record<string, unknown> = { status };
  if (revisedText !== undefined) update.revised_text = revisedText;

  const { data: updated, error } = await supabase
    .from("writing_revisions")
    .update(update)
    .eq("id", params.revId)
    .select("id, scope, section_ref, original_text, revised_text, status")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: "The decision could not be saved." },
      { status: 500 }
    );
  }

  await auditLog(
    supabase,
    user.id,
    `writing_revision.${body.action}`,
    "writing_revision",
    params.revId,
    { writing_doc_id: revision.writing_doc_id }
  );

  return NextResponse.json({ revision: updated });
}
