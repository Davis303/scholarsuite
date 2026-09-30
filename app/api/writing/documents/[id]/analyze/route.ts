import { NextResponse } from "next/server";
import { extractDocument } from "@/lib/writing/extract";
import { computeStyleProfile } from "@/lib/writing/styleProfile";
import {
  auditLog,
  createServiceClient,
  requireUser,
} from "@/lib/writing/supabase";
import type { ExtractedDocument } from "@/lib/writing/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function extractedPath(storagePath: string): string {
  return storagePath.replace(/-[^-]*$/, "-extracted.json");
}

function sseEvent(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * POST /api/writing/documents/[id]/analyze — extract text + structure,
 * compute the local style profile, store both, mark the doc 'review_ready'.
 * Fully local: works without an LLM key.
 *
 * Streams Server-Sent Events with real processing stages:
 *   { type:'stage', stage:'downloading'|'extracting'|'profiling'|'saving', message }
 * then { type:'done', ...payload } or { type:'error', error }.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  const { data: doc } = await supabase
    .from("writing_docs")
    .select("id, name, mime_type, storage_path, status")
    .eq("id", params.id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  await supabase
    .from("writing_docs")
    .update({ status: "analyzing" })
    .eq("id", params.id);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(new TextEncoder().encode(sseEvent(payload)));
      try {
        let service: ReturnType<typeof createServiceClient>;
        try {
          service = createServiceClient();
        } catch (e) {
          throw new Error((e as Error).message);
        }

        send({ type: "stage", stage: "downloading", message: "Downloading document" });
        const { data: fileData, error: downloadError } = await service.storage
          .from("documents")
          .download(doc.storage_path as string);
        if (downloadError || !fileData) {
          throw new Error("The stored file could not be downloaded.");
        }
        const buffer = Buffer.from(await fileData.arrayBuffer());

        send({ type: "stage", stage: "extracting", message: "Analyzing document" });
        const extracted: ExtractedDocument = await extractDocument(
          buffer,
          (doc.mime_type as string) ?? ""
        );

        send({
          type: "stage",
          stage: "profiling",
          message: "Building writing style profile",
        });
        const { profile, displayRows } = computeStyleProfile(extracted);

        send({ type: "stage", stage: "saving", message: "Saving results" });
        const { error: saveError } = await service.storage
          .from("documents")
          .upload(
            extractedPath(doc.storage_path as string),
            JSON.stringify(extracted),
            { contentType: "application/json", upsert: true }
          );
        if (saveError) throw new Error("The extracted text could not be saved.");

        const { error: updateError } = await supabase
          .from("writing_docs")
          .update({
            status: "review_ready",
            style_profile: {
              profile,
              displayRows,
              pageCount: extracted.pageCount,
              sectionCount: extracted.sections.length,
            },
          })
          .eq("id", params.id);
        if (updateError) throw new Error("The analysis results could not be saved.");

        await auditLog(
          supabase,
          user.id,
          "writing_document.analyze",
          "writing_doc",
          params.id,
          { pages: extracted.pageCount, sections: extracted.sections.length }
        );

        send({
          type: "done",
          status: "review_ready",
          pageCount: extracted.pageCount,
          sectionCount: extracted.sections.length,
          warnings: extracted.warnings,
          profile,
          displayRows,
        });
      } catch (e) {
        await supabase
          .from("writing_docs")
          .update({ status: "error" })
          .eq("id", params.id);
        send({
          type: "error",
          error:
            e instanceof Error ? e.message : "Analysis failed. Try again.",
        });
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
