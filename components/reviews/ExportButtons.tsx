'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function triggerDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Prominent export actions for the review workspace.
 * DOCX: highlighted in-place copy (DOCX originals) or rebuilt review copy.
 * PDF: re-flowed review copy, always honestly labeled.
 */
export function ExportButtons({
  reviewId,
  originalKind,
}: {
  reviewId: string;
  originalKind: 'docx' | 'pdf';
}) {
  const [busy, setBusy] = useState<'docx' | 'pdf' | null>(null);
  const { toast } = useToast();

  const runExport = async (kind: 'docx' | 'pdf') => {
    setBusy(kind);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      const data = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.url) {
        throw new Error(data?.error ?? 'The export could not be created.');
      }
      triggerDownload(data.url);
      toast('Your highlighted copy is downloading.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'The export could not be created.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="primary"
        loading={busy === 'docx'}
        onClick={() => runExport('docx')}
        title={
          originalKind === 'docx'
            ? 'Download a DOCX copy with matched passages highlighted'
            : 'Download a DOCX review copy rebuilt from extracted text'
        }
      >
        Export highlighted DOCX
      </Button>
      <div className="flex flex-col">
        <Button
          variant="secondary"
          loading={busy === 'pdf'}
          onClick={() => runExport('pdf')}
        >
          Export PDF review copy
        </Button>
        <span className="mt-1 max-w-[220px] text-[11px] leading-tight text-slate-500">
          Review copy: layout may differ from the original.
        </span>
      </div>
    </div>
  );
}
