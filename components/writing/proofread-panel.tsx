"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import type {
  ParaRef,
  ProofreadIssue,
  ProofreadRun,
  Scope,
  Section,
} from "@/components/writing/editor-types";

const CATEGORY_LABELS: Record<string, string> = {
  grammar: "Grammar",
  academic_style: "Academic Style",
  clarity: "Clarity",
  citations: "Citations",
  consistency: "Consistency",
  verify: "Items to Verify",
};

const SUMMARY_BUCKETS = [
  "grammar",
  "academic_style",
  "clarity",
  "citations",
  "consistency",
  "verify",
] as const;

const SEVERITY: Record<
  ProofreadIssue["severity"],
  { label: string; tone: "neutral" | "amber" | "red"; icon: string }
> = {
  minor: { label: "Minor", tone: "neutral", icon: "○" },
  needs_review: { label: "Needs Review", tone: "amber", icon: "◐" },
  important: { label: "Important", tone: "red", icon: "●" },
};

const ISSUE_STATUS_LABELS: Record<ProofreadIssue["status"], string> = {
  open: "Open",
  accepted: "Accepted",
  rejected: "Rejected",
  ignored: "Ignored",
};

const SCOPE_LABELS: Record<Scope, string> = {
  selection: "Selected text",
  paragraph: "Paragraph",
  section: "Section",
  document: "Entire document",
};

export function ProofreadPanel({
  docId,
  sections,
  paragraphs,
  llmConfigured,
  runs,
  onChanged,
}: {
  docId: string;
  sections: Section[];
  paragraphs: ParaRef[];
  llmConfigured: boolean;
  runs: ProofreadRun[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [scope, setScope] = useState<Scope>("section");
  const [selectionText, setSelectionText] = useState("");

  // Text selected in the document pane can be sent straight here.
  useEffect(() => {
    const apply = (t: string) => {
      if (t && t.trim().length >= 3) {
        setSelectionText(t);
        setScope("selection");
      }
    };
    try {
      const stored = window.sessionStorage.getItem(`scholardesk:selection:${docId}`);
      if (stored) apply(stored);
    } catch {
      /* session storage unavailable */
    }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string; docId?: string }>).detail;
      if (detail?.docId === docId && detail.text) apply(detail.text);
    };
    window.addEventListener("scholardesk:use-selection", handler);
    return () => window.removeEventListener("scholardesk:use-selection", handler);
  }, [docId]);
  const [paraRef, setParaRef] = useState("");
  const [sectionIdx, setSectionIdx] = useState("0");
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string>("");
  const [issues, setIssues] = useState<ProofreadIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [termModal, setTermModal] = useState<ProofreadIssue | null>(null);
  const [termValue, setTermValue] = useState("");
  const [termNote, setTermNote] = useState("");
  const [termSaving, setTermSaving] = useState(false);

  const selectedRun = useMemo(
    () => runs.find((r) => r.id === runId) ?? runs[0] ?? null,
    [runs, runId]
  );

  const loadIssues = useCallback(
    async (id: string) => {
      setIssuesLoading(true);
      try {
        const res = await fetch(
          `/api/writing/${docId}/issues?runId=${encodeURIComponent(id)}`
        );
        const data = (await res.json()) as {
          issues?: ProofreadIssue[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Could not load issues.");
        setIssues(data.issues ?? []);
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Could not load issues.",
          "error"
        );
      } finally {
        setIssuesLoading(false);
      }
    },
    [docId, toast]
  );

  useEffect(() => {
    if (selectedRun) {
      setRunId(selectedRun.id);
      loadIssues(selectedRun.id);
    } else {
      setIssues([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs.length]);

  const resolveTarget = useCallback((): {
    targetText: string;
    context: Record<string, unknown>;
  } | null => {
    if (scope === "selection") {
      const t = selectionText.trim();
      if (!t) {
        toast("Paste or type the passage you want to proofread.", "info");
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

  const runProofread = useCallback(async () => {
    if (!llmConfigured) {
      toast(
        "AI features need an API key. Add LLM_API_KEY to your environment to enable Deep Proofread.",
        "error"
      );
      return;
    }
    const resolved = resolveTarget();
    if (!resolved && scope !== "document") return;
    setRunning(true);
    try {
      const res = await fetch(`/api/writing/${docId}/proofread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          targetText: scope === "document" ? undefined : resolved?.targetText,
          context: scope === "document" ? undefined : resolved?.context,
        }),
      });
      const data = (await res.json()) as {
        run?: ProofreadRun;
        issues?: ProofreadIssue[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Proofreading failed.");
      toast("Proofread complete. Review each issue below.", "success");
      onChanged();
      if (data.run) {
        setRunId(data.run.id);
        setIssues(data.issues ?? []);
      }
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Proofreading failed. Try again.",
        "error"
      );
    } finally {
      setRunning(false);
    }
  }, [docId, scope, resolveTarget, onChanged, toast, llmConfigured]);

  const decide = useCallback(
    async (
      issue: ProofreadIssue,
      action: "accept" | "reject" | "edit" | "ignore",
      text?: string
    ) => {
      setBusyId(issue.id);
      try {
        const res = await fetch(`/api/writing/issues/${issue.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, text }),
        });
        const data = (await res.json()) as {
          issue?: ProofreadIssue;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Could not save.");
        setIssues((prev) =>
          prev.map((i) => (i.id === issue.id ? (data.issue as ProofreadIssue) : i))
        );
        setEditingId(null);
        toast("Decision saved.", "success");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not save.", "error");
      } finally {
        setBusyId(null);
      }
    },
    [toast]
  );

  const addTerminology = useCallback(async () => {
    if (!termModal) return;
    const term = termValue.trim();
    if (!term) {
      toast("Enter the term to add.", "info");
      return;
    }
    setTermSaving(true);
    try {
      const res = await fetch("/api/writing/terminology", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, note: termNote.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      toast(`"${term}" added to your terminology rules.`, "success");
      setTermModal(null);
      setTermValue("");
      setTermNote("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    } finally {
      setTermSaving(false);
    }
  }, [termModal, termValue, termNote, toast]);

  const summary = useMemo(() => {
    if (!selectedRun?.summary) return null;
    return selectedRun.summary;
  }, [selectedRun]);

  const finalStats = useMemo(() => {
    const accepted = issues.filter((i) => i.status === "accepted").length;
    const rejected = issues.filter((i) => i.status === "rejected").length;
    const open = issues.filter((i) => i.status === "open").length;
    const citationsToVerify = issues.filter(
      (i) => i.category === "citations" && i.status === "open"
    ).length;
    const consistencyToVerify = issues.filter(
      (i) => i.category === "consistency" && i.status === "open"
    ).length;
    return { accepted, rejected, open, citationsToVerify, consistencyToVerify };
  }, [issues]);

  const decided = issues.some((i) => i.status !== "open");

  return (
    <div className="space-y-5">
      {!llmConfigured && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            <strong>AI features need an API key.</strong> Add{" "}
            <code className="rounded bg-amber-100 px-1">LLM_API_KEY</code> to your
            environment to enable Deep Proofread. Your document, style profile,
            and all other features keep working.
          </p>
        </Card>
      )}

      <section aria-label="Proofread controls">
        <h2 className="text-sm font-semibold text-slate-900">Deep Proofread</h2>
        <p className="mt-1 text-sm text-slate-600">
          A final-quality review of your own text. Issues are listed for your
          decision · nothing is changed automatically.
        </p>
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Proofread scope"
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
              rows={6}
              value={selectionText}
              onChange={(e) => setSelectionText(e.target.value)}
              placeholder="Paste the passage to proofread…"
            />
          )}
          {scope === "paragraph" && (
            <Select
              label="Paragraph"
              value={paraRef}
              onChange={(e) => setParaRef(e.target.value)}
            >
              <option value="">Choose a paragraph…</option>
              {paragraphs.map((p) => (
                <option key={p.ref} value={p.ref}>
                  {p.sectionHeading ? `${p.sectionHeading} · ` : ""} p.
                  {p.pageNumber}: {p.text.slice(0, 80)}
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
            >
              {sections.map((s, i) => (
                <option key={i} value={String(i)}>
                  {s.heading || `Section ${i + 1}`}
                </option>
              ))}
            </Select>
          )}
          {scope === "document" && (
            <p className="text-sm text-slate-600">
              The entire document is reviewed section by section with your
              style profile and terminology in context. This can take a while
              for long documents.
            </p>
          )}
        </div>

        <div className="mt-4">
          <Button
            onClick={runProofread}
            loading={running}
            disabled={!llmConfigured || sections.length === 0}
          >
            {scope === "document" ? "Proofread entire document" : "Run proofread"}
          </Button>
        </div>
      </section>

      {runs.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="w-full max-w-md">
            <Select
              label="Proofread run"
              value={selectedRun?.id ?? ""}
              onChange={(e) => {
                setRunId(e.target.value);
                loadIssues(e.target.value);
              }}
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {new Date(r.created_at).toLocaleString()} ·{" "}
                  {SCOPE_LABELS[r.scope as Scope] ?? r.scope} (
                  {r.summary?.total ?? 0} issues)
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {selectedRun && summary && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Proofread Complete
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs font-medium text-slate-500">Issues Found</dt>
              <dd className="text-2xl font-bold text-slate-900">
                {summary.total}
              </dd>
            </div>
            {SUMMARY_BUCKETS.map((bucket) => (
              <div key={bucket} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs font-medium text-slate-500">
                  {CATEGORY_LABELS[bucket]}
                </dt>
                <dd className="text-2xl font-bold text-slate-900">
                  {summary.counts[bucket] ?? 0}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {decided && issues.length > 0 && (
        <Card className="border-green-200 bg-green-50 p-4">
          <h2 className="text-sm font-semibold text-green-900">
            Review summary
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-green-900">
            <li>Corrections accepted: {finalStats.accepted}</li>
            <li>Suggestions rejected: {finalStats.rejected}</li>
            <li>Still requiring review: {finalStats.open}</li>
            <li>Citation items to verify: {finalStats.citationsToVerify}</li>
            <li>Consistency items to verify: {finalStats.consistencyToVerify}</li>
          </ul>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Issues{" "}
          <span className="font-normal text-slate-500">
            ({issues.filter((i) => i.status === "open").length} open)
          </span>
        </h2>
        {issuesLoading ? (
          <p className="text-sm text-slate-600">Loading issues…</p>
        ) : issues.length === 0 ? (
          <EmptyState
            title={selectedRun ? "No issues found" : "No proofread runs yet"}
            description={
              selectedRun
                ? "The proofreader found nothing to flag in this run."
                : "Run Deep Proofread above to get a list of possible issues, each awaiting your decision."
            }
          />
        ) : (
          <div className="space-y-4">
            {issues.map((issue) => {
              const sev = SEVERITY[issue.severity];
              return (
                <Card key={issue.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">
                      {CATEGORY_LABELS[issue.category] ?? issue.category}
                    </Badge>
                    <Badge tone={sev.tone}>
                      <span aria-hidden="true">{sev.icon}</span> {sev.label}
                    </Badge>
                    <Badge tone="neutral">
                      Page {issue.page_number}
                    </Badge>
                    <Badge
                      tone={
                        issue.status === "open"
                          ? "amber"
                          : issue.status === "accepted"
                            ? "green"
                            : "neutral"
                      }
                    >
                      {ISSUE_STATUS_LABELS[issue.status]}
                    </Badge>
                    <span className="ml-auto text-xs text-slate-500">
                      Confidence: {issue.confidence}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-4">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Original
                      </p>
                      <p className="rounded-lg bg-yellow-200/40 p-3 text-sm text-slate-800">
                        {issue.original_text}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Suggestion
                      </p>
                      {editingId === issue.id ? (
                        <Textarea
                          rows={4}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          aria-label="Edit the suggestion"
                        />
                      ) : (
                        <p className="rounded-lg bg-accent-50 p-3 text-sm text-slate-900">
                          {issue.suggestion}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-600">
                    <strong className="font-medium text-slate-700">
                      Why this was flagged:{" "}
                    </strong>
                    {issue.explanation}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {editingId === issue.id ? (
                      <>
                        <Button
                          size="sm"
                          loading={busyId === issue.id}
                          onClick={() => decide(issue, "edit", editText)}
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
                          loading={busyId === issue.id}
                          onClick={() => decide(issue, "accept")}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busyId === issue.id}
                          onClick={() => decide(issue, "reject")}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingId(issue.id);
                            setEditText(issue.suggestion);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="tertiary"
                          loading={busyId === issue.id}
                          onClick={() => decide(issue, "ignore")}
                        >
                          Ignore
                        </Button>
                        <Button
                          size="sm"
                          variant="tertiary"
                          onClick={() => {
                            setTermModal(issue);
                            setTermValue(issue.original_text.slice(0, 80));
                            setTermNote("");
                          }}
                        >
                          Add to terminology rules
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={termModal !== null}
        onClose={() => setTermModal(null)}
        title="Add to terminology rules"
        actions={
          <>
            <Button variant="secondary" onClick={() => setTermModal(null)}>
              Cancel
            </Button>
            <Button loading={termSaving} onClick={addTerminology}>
              Add rule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Term"
            value={termValue}
            onChange={(e) => setTermValue(e.target.value)}
            placeholder="e.g. quasi-experimental design"
          />
          <Input
            label="Note (optional)"
            value={termNote}
            onChange={(e) => setTermNote(e.target.value)}
            placeholder="How this term should be used"
          />
          <p className="text-xs text-slate-500">
            Terminology rules are respected by future improvements and
            proofreading runs.
          </p>
        </div>
      </Modal>
    </div>
  );
}
