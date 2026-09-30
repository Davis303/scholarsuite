"use client";

import { useCallback, useEffect, useState } from "react";
import { ChangesModal } from "@/components/writing/changes-modal";
import type { DetailPayload } from "@/components/writing/editor-types";
import { ImprovePanel } from "@/components/writing/improve-panel";
import { ProofreadPanel } from "@/components/writing/proofread-panel";
import { StyleProfilePanel } from "@/components/writing/style-profile";
import { ProgressSteps } from "@/components/writing/progress-steps";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  analyzing: "Analyzing",
  processing: "Processing",
  review_ready: "Review Ready",
  completed: "Completed",
  error: "Error",
};

const STATUS_TONES: Record<string, "neutral" | "brand" | "amber" | "red" | "green"> = {
  uploaded: "neutral",
  analyzing: "brand",
  processing: "brand",
  review_ready: "green",
  completed: "green",
  error: "red",
};

const ANALYZE_STEPS = [
  "Analyzing document",
  "Building writing style profile",
  "Saving results",
  "Complete",
];

const STAGE_INDEX: Record<string, number> = {
  downloading: 0,
  extracting: 0,
  profiling: 1,
  saving: 2,
};

function EditorInner({ docId }: { docId: string }) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<"improve" | "proofread">("improve");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [changesOpen, setChangesOpen] = useState(false);
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/writing/${docId}`);
      const data = (await res.json()) as DetailPayload & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load the document.");
      setDetail(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load the document.");
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    load();
  }, [load]);

  const runAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeStep(0);
    try {
      const res = await fetch(`/api/writing/documents/${docId}/analyze`, {
        method: "POST",
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Analysis failed.");
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("The response could not be read.");
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim()) as {
            type: string;
            stage?: string;
            error?: string;
          };
          if (payload.type === "stage" && payload.stage) {
            setAnalyzeStep(STAGE_INDEX[payload.stage] ?? 0);
          } else if (payload.type === "done") {
            setAnalyzeStep(3);
          } else if (payload.type === "error") {
            throw new Error(payload.error ?? "Analysis failed.");
          }
        }
      }
      toast("Analysis complete. Your style profile is ready.", "success");
      await load();
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Analysis failed. Try again.",
        "error"
      );
    } finally {
      setAnalyzing(false);
    }
  }, [docId, load, toast]);

  const handleExport = useCallback(
    async (kind: "docx" | "pdf") => {
      setExporting(kind);
      try {
        const res = await fetch(`/api/writing/${docId}/export?kind=${kind}`);
        const data = (await res.json()) as {
          url?: string;
          filename?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Export failed.");
        const a = document.createElement("a");
        a.href = data.url as string;
        a.download = data.filename ?? `document.${kind}`;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast("Your download has started.", "success");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Export failed.", "error");
      } finally {
        setExporting(null);
      }
    },
    [docId, toast]
  );

  const handleSendToReview = useCallback(async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/writing/${docId}/send-to-review`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        documentId?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not prepare the review.");
      window.location.href = `/reviews/new?documentId=${data.documentId}`;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not prepare the review.", "error");
      setSending(false);
    }
  }, [docId, toast]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (loadError || !detail) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <EmptyState
          title="Could not load this document"
          description={loadError ?? "The document was not found."}
          action={
            <Button variant="secondary" onClick={load}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const doc = detail.document;
  const needsAnalysis =
    detail.styleProfileRows.length === 0 &&
    (doc.status === "uploaded" || doc.status === "error");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{doc.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONES[doc.status] ?? "neutral"}>
              {STATUS_LABELS[doc.status] ?? doc.status}
            </Badge>
            {detail.pageCount !== null && (
              <span className="text-xs text-slate-500">
                {detail.pageCount} page{detail.pageCount === 1 ? "" : "s"} ·{" "}
                {detail.sections.length} section
                {detail.sections.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {detail.warnings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {detail.warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-700">
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setChangesOpen(true)}>
            View Changes
          </Button>
          <Button
            variant="secondary"
            loading={exporting === "docx"}
            disabled={needsAnalysis}
            title={needsAnalysis ? "Analyze the document first" : "Download as Word"}
            onClick={() => handleExport("docx")}
          >
            Download DOCX
          </Button>
          <Button
            variant="secondary"
            loading={exporting === "pdf"}
            disabled={needsAnalysis}
            title={needsAnalysis ? "Analyze the document first" : "Download as PDF"}
            onClick={() => handleExport("pdf")}
          >
            Download PDF
          </Button>
          <Button variant="tertiary" loading={sending} onClick={handleSendToReview}>
            Send to similarity review
          </Button>
        </div>
      </div>

      {needsAnalysis ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Analyze your document
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Analysis extracts your document&apos;s text and structure and builds
            a writing style profile from your own writing · computed locally,
            no AI needed. Improvements and proofreading are then matched to
            your style.
          </p>
          {analyzing ? (
            <div className="mt-4 max-w-md">
              <ProgressSteps steps={ANALYZE_STEPS} current={analyzeStep} />
            </div>
          ) : (
            <div className="mt-4">
              <Button onClick={runAnalyze}>Analyze document</Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          <StyleProfilePanel rows={detail.styleProfileRows} />

          <div
            role="tablist"
            aria-label="Writing tools"
            className="flex gap-1 border-b border-slate-200"
          >
            {(
              [
                { key: "improve", label: "Improve" },
                { key: "proofread", label: "Deep Proofread" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                  tab === t.key
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {tab === "improve" ? (
              <ImprovePanel
                docId={docId}
                sections={detail.sections}
                paragraphs={detail.paragraphs}
                llmConfigured={detail.llmConfigured}
                revisions={detail.revisions}
                onChanged={load}
              />
            ) : (
              <ProofreadPanel
                docId={docId}
                sections={detail.sections}
                paragraphs={detail.paragraphs}
                llmConfigured={detail.llmConfigured}
                runs={detail.proofreadRuns}
                onChanged={load}
              />
            )}
          </div>
        </div>
      )}

      <ChangesModal
        docId={docId}
        open={changesOpen}
        onClose={() => setChangesOpen(false)}
      />
    </div>
  );
}

export default function WritingEditorPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <ToastProvider>
      <EditorInner docId={params.id} />
    </ToastProvider>
  );
}
