"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { ChangeItem } from "@/lib/writing/types";

const STATUS_TONES: Record<string, "neutral" | "brand" | "amber" | "red" | "green"> = {
  suggested: "amber",
  accepted: "green",
  rejected: "neutral",
  edited: "brand",
};

const STATUS_LABELS: Record<string, string> = {
  suggested: "Suggested",
  accepted: "Accepted",
  rejected: "Rejected",
  edited: "Edited",
};

/**
 * "View Changes" modal: Original → Improved for every revision, with status.
 */
export function ChangesModal({
  docId,
  open,
  onClose,
}: {
  docId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/writing/${docId}/changes`);
      const data = (await res.json()) as {
        changes?: ChangeItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not load changes.");
      setChanges(data.changes ?? []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load changes.", "error");
    } finally {
      setLoading(false);
    }
  }, [docId, toast]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <Modal open={open} onClose={onClose} title="View Changes">
      {loading ? (
        <p className="text-sm text-slate-600">Loading changes…</p>
      ) : changes.length === 0 ? (
        <EmptyState
          title="No changes yet"
          description="Accepted or edited suggestions will appear here as an Original → Improved list."
        />
      ) : (
        <ol className="space-y-4">
          {changes.map((c, i) => (
            <li
              key={c.id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  {i + 1}
                </span>
                <Badge tone={STATUS_TONES[c.status] ?? "neutral"}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </Badge>
                <span className="text-xs text-slate-500">{c.scope}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Original
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-600">
                    {c.original}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Improved
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-900">
                    {c.revised}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
