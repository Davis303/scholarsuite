'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

export interface AddedPassage {
  id: string;
  pageNumber: number | null;
  passageText: string;
  paragraphText: string | null;
  sourceLabel: string | null;
  sourceDetail: string | null;
  similarityPct: number | null;
  verified: boolean;
}

/**
 * Manual "add passage" fallback, used when the similarity report format
 * cannot be parsed automatically, or when the reviewer spots another match.
 */
export function AddPassageModal({
  open,
  onClose,
  reviewId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  reviewId: string;
  onAdded: (passage: AddedPassage, form: { passageText: string; sourceLabel: string; sourceDetail: string; similarityPct: string }) => void;
}) {
  const [passageText, setPassageText] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [sourceDetail, setSourceDetail] = useState('');
  const [similarityPct, setSimilarityPct] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const reset = () => {
    setPassageText('');
    setSourceLabel('');
    setSourceDetail('');
    setSimilarityPct('');
    setPageNumber('');
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (passageText.trim().length < 20) {
      setError('Please paste at least 20 characters of the matched passage.');
      return;
    }
    const pct = similarityPct.trim() === '' ? null : Number(similarityPct);
    if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
      setError('Similarity % must be a number between 0 and 100.');
      return;
    }
    const pg = pageNumber.trim() === '' ? null : Number(pageNumber);
    if (pg !== null && (!Number.isInteger(pg) || pg < 1)) {
      setError('Page number must be a positive whole number.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/passages/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passageText: passageText.trim(),
          sourceLabel: sourceLabel.trim() || null,
          sourceDetail: sourceDetail.trim() || null,
          similarityPct: pct,
          pageNumber: pg,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        passageId?: string;
        pageNumber?: number;
        verified?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.passageId) {
        throw new Error(data?.error ?? 'The passage could not be added.');
      }
      const added: AddedPassage = {
        id: data.passageId,
        pageNumber: data.pageNumber ?? pg ?? null,
        passageText: passageText.trim(),
        paragraphText: null,
        sourceLabel: sourceLabel.trim() || null,
        sourceDetail: sourceDetail.trim() || null,
        similarityPct: pct,
        verified: data.verified ?? false,
      };
      onAdded(added, {
        passageText: passageText.trim(),
        sourceLabel: sourceLabel.trim(),
        sourceDetail: sourceDetail.trim(),
        similarityPct: similarityPct.trim(),
      });
      reset();
      onClose();
      toast(
        data.verified
          ? 'Passage added and located in the document.'
          : 'Passage added. Please verify its location in the document.',
        data.verified ? 'success' : 'info',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The passage could not be added.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add matched passage manually"
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            Add passage
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Textarea
          label="Matched passage text"
          hint="Copy the passage exactly as it appears in the similarity report."
          rows={5}
          value={passageText}
          onChange={(e) => setPassageText(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Source (optional)"
            placeholder="e.g. example-journal.com"
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
          />
          <Input
            label="Similarity % (optional)"
            placeholder="e.g. 12"
            inputMode="decimal"
            value={similarityPct}
            onChange={(e) => setSimilarityPct(e.target.value)}
          />
        </div>
        <Input
          label="Source detail (optional)"
          placeholder="Any extra detail from the report"
          value={sourceDetail}
          onChange={(e) => setSourceDetail(e.target.value)}
        />
        <Input
          label="Page number (optional)"
          hint="Leave blank to locate it in the document automatically."
          placeholder="e.g. 4"
          inputMode="numeric"
          value={pageNumber}
          onChange={(e) => setPageNumber(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
