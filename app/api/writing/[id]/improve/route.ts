import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { chunkAroundTarget, chunkDocument } from "@/lib/writing/chunk";
import {
  loadExtraction,
  loadTerminology,
  loadWritingDoc,
  terminologyBlock,
} from "@/lib/writing/docStore";
import { chatCompletion, LlmNotConfigured, LLM_MISSING_MESSAGE } from "@/lib/writing/llm";
import {
  buildImproveSystemPrompt,
  buildImproveUserPrompt,
} from "@/lib/writing/prompts";
import { generateWithQualityRetry } from "@/lib/writing/quality";
import { auditLog, requireUser } from "@/lib/writing/supabase";
import type {
  EditChunk,
  ImproveScope,
  StyleProfile,
} from "@/lib/writing/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const improveSchema = z.object({
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

function llmMissingResponse() {
  return NextResponse.json({ error: LLM_MISSING_MESSAGE }, { status: 503 });
}

interface CreatedRevision {
  id: string;
  scope: string;
  sectionRef: string;
  originalText: string;
  revisedText: string;
  status: string;
  qualityFailures: string[];
}

async function processChunks(
  supabase: SupabaseClient,
  userId: string,
  docId: string,
  scope: ImproveScope,
  chunks: EditChunk[],
  systemPrompt: string,
  onProgress?: (index: number, total: number, chunk: EditChunk) => void
): Promise<CreatedRevision[]> {
  const created: CreatedRevision[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    if (onProgress) onProgress(i, chunks.length, chunk);
    const userPrompt = buildImproveUserPrompt(chunk);
    const result = await generateWithQualityRetry(async () => {
      return chatCompletion(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { temperature: 0.3, maxTokens: 4000 }
      );
    }, chunk.target);

    const { data, error } = await supabase
      .from("writing_revisions")
      .insert({
        user_id: userId,
        writing_doc_id: docId,
        scope,
        section_ref: chunk.sectionRef,
        original_text: chunk.target,
        revised_text: result.revisedText,
        status: "suggested",
      })
      .select("id, scope, section_ref, original_text, revised_text, status")
      .single();

    if (error || !data) {
      throw new Error("A revision could not be saved.");
    }
    created.push({
      id: data.id as string,
      scope: data.scope as string,
      sectionRef: (data.section_ref as string) ?? "",
      originalText: data.original_text as string,
      revisedText: data.revised_text as string,
      status: data.status as string,
      qualityFailures: result.quality.pass ? [] : result.quality.failures,
    });
  }
  return created;
}

function sseEvent(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * POST /api/writing/[id]/improve, improve text at a chosen scope.
 * Body: { scope: 'selection'|'paragraph'|'section'|'document', targetText?, context? }
 *
 * Each generated revision passes the rule-based quality check (up to 2
 * retries), then is stored as a 'suggested' writing_revisions row.
 *
 * Response: JSON { revisions } for selection/paragraph/section scopes.
 * For 'document' scope the document is processed section by section and the
 * route streams Server-Sent Events: progress events
 * { type:'progress', index, total, sectionHeading } followed by a final
 * { type:'done', revisions } (or { type:'error', ... } with partial results).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  if (!process.env.LLM_API_KEY) return llmMissingResponse();

  let body: z.infer<typeof improveSchema>;
  try {
    body = improveSchema.parse(await req.json());
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
          "Analyze the document first so a writing style profile exists before improving text.",
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
        { error: "Select or provide the text to improve." },
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
      { error: "There is no text to improve in this scope." },
      { status: 400 }
    );
  }

  const terminology = await loadTerminology(supabase, user.id);
  const termBlock = terminologyBlock(terminology);
  const systemPrompt =
    buildImproveSystemPrompt(profile) + (termBlock ? `\n\n${termBlock}` : "");

  await supabase
    .from("writing_docs")
    .update({ status: "processing" })
    .eq("id", params.id);

  const finish = async () => {
    await supabase
      .from("writing_docs")
      .update({ status: "completed" })
      .eq("id", params.id);
    await auditLog(supabase, user.id, "writing.improve", "writing_doc", params.id, {
      scope,
      chunks: chunks.length,
    });
  };

  // Document scope: stream real per-section progress events.
  if (scope === "document") {
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) =>
          controller.enqueue(new TextEncoder().encode(sseEvent(payload)));
        try {
          const created = await processChunks(
            supabase,
            user.id,
            params.id,
            scope,
            chunks,
            systemPrompt,
            (index, total, chunk) =>
              send({
                type: "progress",
                index: index + 1,
                total,
                sectionHeading: chunk.sectionHeading,
              })
          );
          await finish();
          send({ type: "done", revisions: created });
        } catch (e) {
          const message =
            e instanceof Error
              ? e.message
              : "Improving the document failed. Try again.";
          send({ type: "error", error: message, revisions: [] });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  try {
    const created = await processChunks(
      supabase,
      user.id,
      params.id,
      scope,
      chunks,
      systemPrompt
    );
    await finish();
    return NextResponse.json({ revisions: created });
  } catch (e) {
    if (e instanceof LlmNotConfigured) return llmMissingResponse();
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Improving the text failed. Try again.",
      },
      { status: 500 }
    );
  }
}
