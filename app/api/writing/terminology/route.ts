import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/writing/supabase";

export const runtime = "nodejs";

const createSchema = z.object({
  term: z.string().min(1).max(200),
  note: z.string().max(1000).optional().default(""),
});

/**
 * GET /api/writing/terminology — list the user's terminology rules.
 * POST /api/writing/terminology — add a rule { term, note? }.
 * Rules are respected by improve/proofread prompts.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("terminology_rules")
    .select("id, term, note, created_at")
    .order("term", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Could not load terminology rules." },
      { status: 500 }
    );
  }
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Provide a term to add." },
      { status: 400 }
    );
  }

  const term = body.term.trim();
  const { data, error } = await supabase
    .from("terminology_rules")
    .insert({ user_id: user.id, term, note: body.note?.trim() || null })
    .select("id, term, note, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This term is already in your terminology rules." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "The rule could not be saved." },
      { status: 500 }
    );
  }

  return NextResponse.json({ rule: data }, { status: 201 });
}
