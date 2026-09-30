import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auditLog, requireUser } from "@/lib/writing/supabase";

export const runtime = "nodejs";

const patchSchema = z.object({
  action: z.enum(["accept", "reject", "edit", "ignore"]),
  text: z.string().min(1).max(20000).optional(),
});

const STATUS_FOR_ACTION: Record<string, string> = {
  accept: "accepted",
  reject: "rejected",
  edit: "accepted", // an edited suggestion is treated as accepted-with-edits
  ignore: "ignored",
};

/**
 * PATCH /api/writing/issues/[issueId]
 * Body: { action: 'accept'|'reject'|'edit'|'ignore', text? }
 * Corrections are NEVER auto-applied; this records the user's decision.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { issueId: string } }
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

  const { data: issue } = await supabase
    .from("proofread_issues")
    .select("id, run_id, writing_doc_id")
    .eq("id", params.issueId)
    .single();

  if (!issue) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  if (body.action === "edit" && (!body.text || body.text.trim().length === 0)) {
    return NextResponse.json(
      { error: "Provide the edited suggestion." },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {
    status: STATUS_FOR_ACTION[body.action],
  };
  if (body.action === "edit") update.suggestion = (body.text as string).trim();

  const { data: updated, error } = await supabase
    .from("proofread_issues")
    .update(update)
    .eq("id", params.issueId)
    .select(
      "id, category, severity, page_number, original_text, explanation, suggestion, confidence, status"
    )
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
    `proofread_issue.${body.action}`,
    "proofread_issue",
    params.issueId,
    { writing_doc_id: issue.writing_doc_id }
  );

  return NextResponse.json({ issue: updated });
}
