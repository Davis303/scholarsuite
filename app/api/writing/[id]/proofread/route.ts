import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chunkAroundTarget, chunkDocument } from "@/lib/writing/chunk";
import {
  loadExtraction,
  loadTerminology,
  loadWritingDoc,
  terminologyBlock,
} from "@/lib/writing/docStore";
import { chatCompletion, LlmNotConfigured } from "@/lib/writing/llm";
import {
  buildProofreadSystemPrompt,
  buildProofreadUserPrompt,
  normalizeProofreadCategory,
} from "@/lib/writing/prompts";
import { auditLog, requireUser } from "@/lib/writing/supabase";
import type {
  EditChunk,
  ImproveScope,
  ProofreadIssueInput,
  StyleProfile,
} from "@/lib/writing/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const proofreadSchema = z.object({
  scope: z.enum(["selection", "paragraph", "section", "document"]),
  targetText: z.string().min(1).max(20000).optional(),
  context: z
    .object({
      sectionRef: z.string().optional(),
      sectionHeading: z.string().optional(),
      paragraph: z.string().optional(),
      prevSentence: z.string().optional(),
      nextSentence: z.string().optional(),
      surrounding: z.array(z.string()).optional(),
      pageNumber: z.number().int().optional(),
    })
    .optional(),
});

const issueSchema = z.object({
  category: z.string().min(1).max(60),
  severity: z.enum(["minor", "needs_review", "important"]),
  pageNumber: z.number().int().min(1).max(10000).optional().default(1),
  originalText: z.string().min(1).max(5000),
  explanation: z.string().min(1).max(5000),
  suggestion: z.string().min(1).max(5000),
  confidence: z.string().min(1).max(20),
});

const proofreadResponseSchema = z.object({
  issues: z.array(issueSchema).max(200),
});

function llmMissingResponse() {
  return NextResponse.json(
    {
      error:
        "AI features need an API key. Add LLM_API_KEY (and optionally LLM_MODEL / LLM_BASE_URL) to your environment to enable Deep Proofread. Your document, style profile, and all other features keep working.",
    },
    { status: 503 }
  );
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

/**
 * POST /api/writing/[id]/proofread — Deep Proofread at a chosen scope.
 * Issues are NEVER auto-applied; they are stored as 'open' proofread_issues
 * for the user to accept, reject, edit, or ignore.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  if (!process.env.LLM_API_KEY) return llmMissingResponse();

  let body: z.infer<typeof proofreadSchema>;
  try {
    body = proofreadSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "The request was invalid. Check the scope and text, then try again." },
      { status: 400 }
    );
  }

  const doc = await loadWritingDoc(supabase, params.id);
  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const profile = (doc.style_profile?.profile ?? null) as StyleProfile | null;
  if (!profile) {
    return NextResponse.json(
      {
        error:
          "Analyze the document first so a writing style profile exists before proofreading.",
      },
      { status: 409 }
    );
  }

  const scope: ImproveScope = body.scope;
  const chunks: EditChunk[] = [];

  if (scope === "document") {
    const extracted = await loadExtraction(doc.storage_path);
    if (!extracted) {
      return NextResponse.json(
        { error: "The extracted text is missing. Re-run analysis first." },
        { status: 409 }
      );
    }
    chunks.push(...chunkDocument(extracted));
  } else {
    const targetText = (body.targetText ?? "").trim();
    if (!targetText) {
      return NextResponse.json(
        { error: "Select or provide the text to proofread." },
        { status: 400 }
      );
    }
    const extracted = await loadExtraction(doc.storage_path);
    if (extracted) {
      chunks.push(chunkAroundTarget(extracted, targetText, body.context?.sectionRef));
    } else {
      chunks.push({
        sectionHeading: body.context?.sectionHeading ?? "",
        prevSentence: body.context?.prevSentence ?? "",
        target: targetText,
        nextSentence: body.context?.nextSentence ?? "",
        paragraph: body.context?.paragraph ?? targetText,
        surrounding: body.context?.surrounding ?? [],
        pageNumber: body.context?.pageNumber ?? 1,
        sectionRef: body.context?.sectionRef ?? scope,
      });
    }
  }

  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "There is no text to proofread in this scope." },
      { status: 400 }
    );
  }

  const terminology = await loadTerminology(supabase, user.id);
  const termBlock = terminologyBlock(terminology);
  const systemPrompt =
    buildProofreadSystemPrompt(profile) + (termBlock ? `\n\n${termBlock}` : "");

  const allIssues: ProofreadIssueInput[] = [];

  try {
    for (const chunk of chunks) {
      const raw = await chatCompletion(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildProofreadUserPrompt(chunk) },
        ],
        { jsonMode: true, temperature: 0.2, maxTokens: 6000 }
      );
      let parsed: z.infer<typeof proofreadResponseSchema>;
      try {
        parsed = proofreadResponseSchema.parse(
          JSON.parse(extractJson(raw)) as unknown
        );
      } catch {
        // Skip chunks whose output is not valid JSON; do not invent issues.
        continue;
      }
      for (const issue of parsed.issues) {
        allIssues.push({
          category: normalizeProofreadCategory(issue.category),
          severity: issue.severity,
          pageNumber: issue.pageNumber ?? chunk.pageNumber ?? 1,
          originalText: issue.originalText,
          explanation: issue.explanation,
          suggestion: issue.suggestion,
          confidence: ["high", "medium", "low"].includes(
            issue.confidence.toLowerCase()
          )
            ? issue.confidence.toLowerCase()
            : "medium",
        });
      }
    }
  } catch (e) {
    if (e instanceof LlmNotConfigured) return llmMissingResponse();
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Proofreading failed. Try again.",
      },
      { status: 500 }
    );
  }

  const counts: Record<string, number> = {
    grammar: 0,
    academic_style: 0,
    clarity: 0,
    citations: 0,
    consistency: 0,
    verify: 0,
  };
  for (const issue of allIssues) {
    counts[issue.category] = (counts[issue.category] ?? 0) + 1;
  }

  const { data: run, error: runError } = await supabase
    .from("proofread_runs")
    .insert({
      user_id: user.id,
      writing_doc_id: params.id,
      scope,
      status: "complete",
      summary: { counts, total: allIssues.length, chunks: chunks.length },
    })
    .select("id, scope, status, summary, created_at")
    .single();

  if (runError || !run) {
    return NextResponse.json(
      { error: "The proofread results could not be saved." },
      { status: 500 }
    );
  }

  let issueRows: unknown[] = [];
  if (allIssues.length > 0) {
    const { data, error } = await supabase
      .from("proofread_issues")
      .insert(
        allIssues.map((issue) => ({
          user_id: user.id,
          run_id: run.id,
          writing_doc_id: params.id,
          category: issue.category,
          severity: issue.severity,
          page_number: issue.pageNumber,
          original_text: issue.originalText,
          explanation: issue.explanation,
          suggestion: issue.suggestion,
          confidence: issue.confidence,
          status: "open",
        }))
      )
      .select(
        "id, category, severity, page_number, original_text, explanation, suggestion, confidence, status"
      );
    if (error) {
      await supabase.from("proofread_runs").delete().eq("id", run.id);
      return NextResponse.json(
        { error: "The proofread results could not be saved." },
        { status: 500 }
      );
    }
    issueRows = data ?? [];
  }

  await auditLog(supabase, user.id, "writing.proofread", "writing_doc", params.id, {
    scope,
    issues: allIssues.length,
  });

  return NextResponse.json({
    run: {
      id: run.id,
      scope: run.scope,
      status: run.status,
      summary: run.summary,
      createdAt: run.created_at,
    },
    issues: issueRows,
  });
}
