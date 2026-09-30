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

const TABS = [
  { key: "improve", label: "Improve" },
  { key: "proofread", label: "Deep Proofread" },
  { key: "style", label: "Style Profile" },
] as const;

type AssistantTab = (typeof TABS)[number]["key"];

function ToolbarIcon({ path }: { path: string }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function EditorInner({ docId }: { docId: string }) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<AssistantTab>("improve");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [changesOpen, setChangesOpen] = useState(false);
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
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
      <div className="mx-auto max-w-[1440px] space-y-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_370px]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (loadError || !detail) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
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
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      {/* Header: document title + Draft subtitle */}
      <div className="mb-4">
        <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">
          {doc.name}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">Draft</p>
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

      {/* Compact editor toolbar */}
      <div className="ss-toolbar mb-5" role="toolbar" aria-label="Document actions">
        <button
          type="button"
          className="ss-toolbar-btn"
          onClick={() => setChangesOpen(true)}
        >
          <ToolbarIcon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          View Changes
        </button>
        <span className="ss-toolbar-divider" aria-hidden="true" />
        <div className="relative shrink-0">
          <button
            type="button"
            className="ss-toolbar-btn"
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            disabled={needsAnalysis}
            title={needsAnalysis ? "Analyze the document first" : "Export the document"}
            onClick={() => setExportOpen((v) => !v)}
          >
            <ToolbarIcon path="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            {exporting ? "Exporting…" : "Export"}
            <svg className="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {exportOpen && !needsAnalysis ? (
            <>
              <div
                aria-hidden="true"
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setExportOpen(false)}
              />
              <div
                role="menu"
                aria-label="Export format"
                className="absolute left-0 z-30 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-600"
                onClick={() => {
                  setExportOpen(false);
                  handleExport("docx");
                }}
              >
                Download DOCX
                <span className="block text-xs text-slate-500">Word document</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-600"
                onClick={() => {
                  setExportOpen(false);
                  handleExport("pdf");
                }}
              >
                Download PDF
                <span className="block text-xs text-slate-500">PDF document</span>
              </button>
              </div>
            </>
          ) : null}
        </div>
        <span className="ss-toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          className="ss-toolbar-btn"
          disabled={sending}
          onClick={handleSendToReview}
        >
          <ToolbarIcon path="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          {sending ? "Preparing…" : "Send to similarity review"}
        </button>
      </div>

      {needsAnalysis ? (
        <article aria-label="Document" className="ss-doc-page mx-auto max-w-3xl p-8 sm:p-10">
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
        </article>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_370px]">
          {/* Center: document page */}
          <article aria-label="Document" className="ss-doc-page min-w-0 p-8 sm:p-12">
            {detail.sections.length === 0 ? (
              <p className="text-sm text-slate-500">
                No readable text was extracted from this document.
              </p>
            ) : (
              detail.sections.map((section, i) => (
                <section
                  key={i}
                  aria-label={section.heading || `Section ${i + 1}`}
                  className="mb-8 last:mb-0"
                >
                  {section.heading ? (
                    <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">
                      {section.heading}
                    </h2>
                  ) : null}
                  {section.paragraphs.map((para, j) => (
                    <p
                      key={j}
                      className="mb-4 text-[15px] leading-7 text-slate-800 last:mb-0"
                    >
                      {para}
                    </p>
                  ))}
                </section>
              ))
            )}
          </article>

          {/* Right: assistant panel */}
          <aside className="min-w-0" aria-label="Assistant panel">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card lg:sticky lg:top-20">
              <div className="border-b border-slate-200 px-4 pt-4">
                <h2 className="text-sm font-semibold text-slate-900">Assistant</h2>
                <div role="tablist" aria-label="Assistant tools" className="mt-1 flex gap-5">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.key}
                      onClick={() => setTab(t.key)}
                      className={`-mb-px border-b-2 px-0.5 pb-2 pt-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 ${
                        tab === t.key
                          ? "border-accent-600 text-slate-900"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div
                role="tabpanel"
                className="max-h-[calc(100vh-13rem)] overflow-y-auto p-4"
              >
                {tab === "improve" ? (
                  <ImprovePanel
                    docId={docId}
                    sections={detail.sections}
                    paragraphs={detail.paragraphs}
                    llmConfigured={detail.llmConfigured}
                    revisions={detail.revisions}
                    onChanged={load}
                  />
                ) : tab === "proofread" ? (
                  <ProofreadPanel
                    docId={docId}
                    sections={detail.sections}
                    paragraphs={detail.paragraphs}
                    llmConfigured={detail.llmConfigured}
                    runs={detail.proofreadRuns}
                    onChanged={load}
                  />
                ) : (
                  <StyleProfilePanel rows={detail.styleProfileRows} />
                )}
              </div>
            </div>
          </aside>
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
