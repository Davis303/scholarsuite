"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileUploader } from "@/components/ui/FileUploader";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";

interface WritingDocRow {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  hasProfile: boolean;
  pages: number | null;
  sectionsProcessed: number;
  editsMade: number;
  createdAt: string;
  updatedAt: string;
}

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

function formatDocDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "·" : formatDate(d);
}

function WritingHomeInner() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<WritingDocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WritingDocRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/writing/documents?${params.toString()}`);
      const data = (await res.json()) as {
        documents?: WritingDocRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not load documents.");
      setDocs(data.documents ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load documents.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/writing/documents", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as {
          document?: { id: string };
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Upload failed.");
        toast("Document uploaded. Opening the editor…", "success");
        window.location.href = `/writing/${data.document?.id}`;
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Upload failed. Try again.",
          "error"
        );
      } finally {
        setUploading(false);
      }
    },
    [toast]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/writing/documents/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      toast("Document deleted.", "success");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed.", "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, load, toast]);

  const handleExport = useCallback(
    async (doc: WritingDocRow, kind: "docx" | "pdf") => {
      setExportingId(`${doc.id}-${kind}`);
      try {
        const res = await fetch(`/api/writing/${doc.id}/export?kind=${kind}`);
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
        toast(
          e instanceof Error ? e.message : "Export failed. Try again.",
          "error"
        );
      } finally {
        setExportingId(null);
      }
    },
    [toast]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Writing Assistant</h1>
          <p className="mt-1 text-sm text-slate-600">
            Improve your own academic writing with style-aware editing and deep
            proofreading. Your documents stay private to you.
          </p>
        </div>
      </div>

      <Card className="mb-6 p-5">
        {uploading ? (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            Uploading your document…
          </div>
        ) : (
          <FileUploader
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            maxMB={25}
            onFiles={handleUpload}
            label="Upload a document"
          />
        )}
      </Card>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-xs">
          <Input
            label="Search documents"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="uploaded">Uploaded</option>
            <option value="analyzing">Analyzing</option>
            <option value="processing">Processing</option>
            <option value="review_ready">Review Ready</option>
            <option value="completed">Completed</option>
            <option value="error">Error</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : loadError ? (
        <EmptyState
          title="Could not load your documents"
          description={loadError}
          action={
            <Button variant="secondary" onClick={load}>
              Try again
            </Button>
          }
        />
      ) : docs.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Upload a PDF or Word document to build its writing style profile and start improving it."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-card">
          <table className="ss-table w-full text-left text-sm">
            <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Status</th>
              <th scope="col">Pages</th>
              <th scope="col">Sections Processed</th>
              <th scope="col">Edits Made</th>
              <th scope="col">Date</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td>
                  <Link
                    href={`/writing/${doc.id}`}
                    className="font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded"
                  >
                    {doc.name}
                  </Link>
                </td>
                <td>
                  <Badge tone={STATUS_TONES[doc.status] ?? "neutral"}>
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </Badge>
                </td>
                <td>{doc.pages ?? "·"}</td>
                <td>{doc.sectionsProcessed}</td>
                <td>{doc.editsMade}</td>
                <td className="whitespace-nowrap">{formatDocDate(doc.updatedAt)}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="tertiary"
                      size="sm"
                      loading={exportingId === `${doc.id}-docx`}
                      disabled={!doc.hasProfile}
                      title={
                        doc.hasProfile
                          ? "Download as Word document"
                          : "Analyze the document first"
                      }
                      onClick={() => handleExport(doc, "docx")}
                    >
                      DOCX
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      loading={exportingId === `${doc.id}-pdf`}
                      disabled={!doc.hasProfile}
                      title={
                        doc.hasProfile
                          ? "Download as PDF"
                          : "Analyze the document first"
                      }
                      onClick={() => handleExport(doc, "pdf")}
                    >
                      PDF
                    </Button>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => setDeleteTarget(doc)}
                      aria-label={`Delete ${doc.name}`}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete document"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleting}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Delete <strong>{deleteTarget?.name}</strong>? This removes the
          document, its revisions, and its proofreading results permanently.
        </p>
      </Modal>
    </div>
  );
}

export default function WritingHomePage() {
  return (
    <ToastProvider>
      <WritingHomeInner />
    </ToastProvider>
  );
}
