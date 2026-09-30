"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import type {
  ParaRef,
  Revision,
  Scope,
  Section,
} from "@/components/writing/editor-types";

interface CreatedRevision {
  id: string;
  scope: string;
  sectionRef: string;
  originalText: string;
  revisedText: string;
  status: string;
  qualityFailures: string[];
}

function toRevision(r: CreatedRevision): Revision {
  return {
    id: r.id,
    scope: r.scope,
    section_ref: r.sectionRef,
    original_text: r.originalText,
    revised_text: r.revisedText,
    status: r.status as Revision["status"],
    created_at: new Date().toISOString(),
  };
}

const SCOPE_LABELS: Record<Scope, string> = {
  selection: "Selected text",
  paragraph: "Paragraph",
  section: "Section",
  document: "Entire document",
};

export function ImprovePanel({
  docId,
  sections,
  paragraphs,
  llmConfigured,
  revisions,
  onChanged,
}: {
  docId: string;
  sections: Section[];
  paragraphs: ParaRef[];
  llmConfigured: boolean;
  revisions: Revision[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [scope, setScope] = useState<Scope>("paragraph");
  const [selectionText, setSelectionText] = useState("");
  const [paraRef, setParaRef] = useState("");
  const [sectionIdx, setSectionIdx] = useState("0");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{
    index: number;
    total: number;
    heading: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const suggested = useMemo(
    () => revisions.filter((r) => r.status === "suggested"),
    [revisions]
  );

  const resolveTarget = useCallback((): {
    targetText: string;
    context: Record<string, unknown>;
  } | null => {
    if (scope === "selection") {
      const t = selectionText.trim();
      if (!t) {
        toast("Paste or type the passage you want to improve.", "info");
        return null;
      }
      return { targetText: t, context: {} };
    }
    if (scope === "paragraph") {
      const p = paragraphs.find((x) => x.ref === paraRef);
      if (!p) {
        toast("Choose a paragraph first.", "info");
        return null;
      }
      return {
        targetText: p.text,
        context: {
          sectionRef: p.ref.split(":")[0],
          sectionHeading: p.sectionHeading,
          paragraph: p.text,
          pageNumber: p.pageNumber,
        },
      };
    }
    if (scope === "section") {
      const s = sections[Number(sectionIdx)];
      if (!s) {
        toast("Choose a section first.", "info");
        return null;
      }
      return {
        targetText: s.paragraphs.join("\n\n"),
        context: {
          sectionRef: `section-${sectionIdx}`,
          sectionHeading: s.heading,
          pageNumber: s.pageNumber,
        },
      };
    }
    return { targetText: "", context: {} };
  }, [scope, selectionText, paragraphs, paraRef, sections, sectionIdx, toast]);

  const readSse = useCallback(
    async (res: Response): Promise<CreatedRevision[]> => {
      const reader = res.body?.getReader();
      if (!reader) throw new Error("The response could not be read.");
      const decoder = new TextDecoder();
      let buffer = "";
      let revisions: CreatedRevision[] = [];
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
            index?: number;
            total?: number;
            sectionHeading?: string;
            revisions?: CreatedRevision[];
            error?: string;
          };
          if (payload.type === "progress") {
            setProgress({
              index: payload.index ?? 0,
              total: payload.total ?? 0,
              heading: payload.sectionHeading ?? "",
            });
          } else if (payload.type === "done") {
            revisions = payload.revisions ?? [];
          } else if (payload.type === "error") {
            throw new Error(payload.error ?? "Improving the document failed.");
          }
        }
      }
      return revisions;
    },
    []
  );

  const runImprove = useCallback(async () => {
    if (!llmConfigured) {
      toast(
        "AI features need an API key. Add LLM_API_KEY to your environment to enable improving.",
        "error"
      );
      return;
    }
    const resolved = resolveTarget();
    if (!resolved && scope !== "document") return;
    setRunning(true);
    setProgress(null);
    try {
      const res = await fetch(`/api/writing/${docId}/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          targetText: scope === "document" ? undefined : resolved?.targetText,
          context: scope === "document" ? undefined : resolved?.context,
        }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream")) {
        const created = await readSse(res);
        toast(
          `Processed ${created.length} section${created.length === 1 ? "" : "s"}. Review each suggestion below.`,
          "success"
        );
      } else {
        const data = (await res.json()) as {
          revisions?: CreatedRevision[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Improving failed.");
        toast(
          "Improvement ready. Review it below before accepting.",
          "success"
        );
      }
      onChanged();
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Improving failed. Try again.",
        "error"
      );
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [docId, scope, resolveTarget, readSse, onChanged, toast, llmConfigured]);

  const decide = useCallback(
    async (rev: Revision, action: "accept" | "reject" | "edit", text?: string) => {
      setBusyId(rev.id);
      try {
        const res = await fetch(`/api/writing/revisions/${rev.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, text }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not save.");
        toast(
          action === "accept"
            ? "Suggestion accepted."
            : action === "reject"
              ? "Kept the original."
              : "Your edit was saved.",
          "success"
        );
        setEditingId(null);
        onChanged();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not save.", "error");
      } finally {
        setBusyId(null);
      }
    },
    [onChanged, toast]
  );

  const regenerate = useCallback(
    async (rev: Revision) => {
      setBusyId(rev.id);
      try {
        const res = await fetch(`/api/writing/${docId}/improve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: "selection",
            targetText: rev.original_text,
            context: { sectionRef: rev.section_ref },
          }),
        });
        const data = (await res.json()) as {
          revisions?: CreatedRevision[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Regeneration failed.");
        // Supersede the old suggestion so the list stays tidy.
        await fetch(`/api/writing/revisions/${rev.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reject" }),
        });
        toast("A new suggestion was generated.", "success");
        onChanged();
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Regeneration failed.",
          "error"
        );
      } finally {
        setBusyId(null);
      }
    },
    [docId, onChanged, toast]
  );

  return (
    <div className="space-y-5">
      {!llmConfigured && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            <strong>AI features need an API key.</strong> Add{" "}
            <code className="rounded bg-amber-100 px-1">LLM_API_KEY</code> to your
            environment to enable improving and proofreading. Your document,
            style profile, and all other features keep working.
          </p>
        </Card>
      )}

      <section aria-label="Improvement controls">
        <h2 className="text-sm font-semibold text-slate-900">
          What should I improve?
        </h2>
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Improvement scope"
        >
          {(Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scope === s}
              onClick={() => setScope(s)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 ${
                scope === s
                  ? "border-accent-600 bg-accent-50 text-accent-700"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {SCOPE_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {scope === "selection" && (
            <Textarea
              label="Selected text"
              hint="Paste the passage you highlighted, or type it here."
              rows={6}
              value={selectionText}
              onChange={(e) => setSelectionText(e.target.value)}
              placeholder="Paste the passage to improve…"
            />
          )}
          {scope === "paragraph" && (
            <Select
              label="Paragraph"
              value={paraRef}
              onChange={(e) => setParaRef(e.target.value)}
              hint={
                paragraphs.length === 0
                  ? "No paragraphs available. Analyze the document first."
                  : `${paragraphs.length} paragraphs in this document.`
              }
            >
              <option value="">Choose a paragraph…</option>
              {paragraphs.map((p) => (
                <option key={p.ref} value={p.ref}>
                  {p.sectionHeading
                    ? `${p.sectionHeading} · `
                    : ""}{" "}
                  p.{p.pageNumber}: {p.text.slice(0, 80)}
                  {p.text.length > 80 ? "…" : ""}
                </option>
              ))}
            </Select>
          )}
          {scope === "section" && (
            <Select
              label="Section"
              value={sectionIdx}
              onChange={(e) => setSectionIdx(e.target.value)}
              hint={
                sections.length === 0
                  ? "No sections available. Analyze the document first."
                  : `${sections.length} sections in this document.`
              }
            >
              {sections.map((s, i) => (
                <option key={i} value={String(i)}>
                  {s.heading || `Section ${i + 1}`} ({s.paragraphs.length}{" "}
                  paragraph{s.paragraphs.length === 1 ? "" : "s"})
                </option>
              ))}
            </Select>
          )}
          {scope === "document" && (
            <p className="text-sm text-slate-600">
              The entire document will be processed section by section, keeping
              headings, structure, and citations intact. You will see real
              progress for each section.
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={runImprove}
            loading={running}
            disabled={!llmConfigured || sections.length === 0}
          >
            {scope === "document" ? "Improve entire document" : "Improve"}
          </Button>
          {progress && (
            <p className="text-sm text-slate-600" role="status">
              Processing Section {progress.index} of {progress.total}
              {progress.heading ? `: ${progress.heading}` : ""}…
            </p>
          )}
        </div>
      </section>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Suggestions{" "}
          <span className="font-normal text-slate-500">
            ({suggested.length} awaiting your decision)
          </span>
        </h2>
        {suggested.length === 0 ? (
          <EmptyState
            title="No pending suggestions"
            description="Run an improvement above. Each suggestion waits for your decision: accept it, regenerate it, edit it yourself, or keep the original."
          />
        ) : (
          <div className="space-y-4">
            {suggested.map((rev) => (
              <Card key={rev.id} className="overflow-hidden">
                <div className="border-b border-slate-200 px-4 py-2.5">
                  <Badge tone="brand">
                    {SCOPE_LABELS[rev.scope as Scope] ?? rev.scope}
                  </Badge>
                </div>
                <div className="grid gap-0">
                  <div className="border-b border-slate-200 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Original
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {rev.original_text}
                    </p>
                  </div>
                  <div className="bg-accent-50/40 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Improved version
                    </p>
                    {editingId === rev.id ? (
                      <Textarea
                        rows={6}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        aria-label="Edit the improved text"
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-slate-900">
                        {rev.revised_text}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-2.5">
                  {editingId === rev.id ? (
                    <>
                      <Button
                        size="sm"
                        loading={busyId === rev.id}
                        onClick={() => decide(rev, "edit", editText)}
                      >
                        Save edit
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        loading={busyId === rev.id}
                        onClick={() => decide(rev, "accept")}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === rev.id}
                        onClick={() => regenerate(rev)}
                      >
                        Regenerate
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(rev.id);
                          setEditText(rev.revised_text);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="tertiary"
                        loading={busyId === rev.id}
                        onClick={() => decide(rev, "reject")}
                      >
                        Keep Original
                      </Button>
                    </>
                  )}
                  {busyId === rev.id && <Spinner />}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
