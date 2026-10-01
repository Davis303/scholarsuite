import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/writing/supabase";

export const runtime = "nodejs";

/**
 * GET /api/writing/[id]/issues?runId=, list issues for a proofread run.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const runId = new URL(req.url).searchParams.get("runId");

  let query = supabase
    .from("proofread_issues")
    .select(
      "id, run_id, category, severity, page_number, original_text, explanation, suggestion, confidence, status, created_at"
    )
    .eq("writing_doc_id", params.id)
    .order("created_at", { ascending: true });

  if (runId) query = query.eq("run_id", runId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Could not load proofread issues." },
      { status: 500 }
    );
  }
  return NextResponse.json({ issues: data ?? [] });
}
