'use client';

import { Badge } from './ui';
import type { PassageStatus } from '@/lib/reviews/types';

type ReviewStatus = 'processing' | 'ready' | 'review_required' | 'completed' | 'failed';

const reviewStatusMeta: Record<ReviewStatus, { label: string; tone: 'amber' | 'green' | 'red' | 'brand' | 'neutral'; icon: string }> = {
  processing: { label: 'Processing', tone: 'amber', icon: '◌' },
  ready: { label: 'Ready', tone: 'green', icon: '●' },
  review_required: { label: 'Review required', tone: 'red', icon: '!' },
  completed: { label: 'Completed', tone: 'brand', icon: '✓' },
  failed: { label: 'Failed', tone: 'red', icon: '✕' },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const meta = reviewStatusMeta[status] ?? { label: status, tone: 'neutral' as const, icon: '•' };
  return (
    <Badge tone={meta.tone}>
      <span aria-hidden="true">{meta.icon}</span> {meta.label}
    </Badge>
  );
}

const passageStatusMeta: Record<PassageStatus, { label: string; tone: 'amber' | 'green' | 'red' | 'brand' | 'neutral'; icon: string }> = {
  needs_review: { label: 'Needs review', tone: 'amber', icon: '!' },
  properly_cited: { label: 'Properly cited', tone: 'green', icon: '✓' },
  direct_quote: { label: 'Direct quote', tone: 'brand', icon: '❝' },
  common_knowledge: { label: 'Common knowledge', tone: 'neutral', icon: '○' },
  citation_check: { label: 'Citation check', tone: 'amber', icon: '?' },
  source_verification: { label: 'Source verification', tone: 'amber', icon: '?' },
};

export function PassageStatusBadge({ status }: { status: PassageStatus }) {
  const meta = passageStatusMeta[status] ?? { label: status, tone: 'neutral' as const, icon: '•' };
  return (
    <Badge tone={meta.tone}>
      <span aria-hidden="true">{meta.icon}</span> {meta.label}
    </Badge>
  );
}

export const PASSAGE_STATUS_OPTIONS: Array<{ value: PassageStatus; label: string }> = [
  { value: 'needs_review', label: 'Needs review' },
  { value: 'properly_cited', label: 'Properly cited' },
  { value: 'direct_quote', label: 'Direct quote' },
  { value: 'common_knowledge', label: 'Common knowledge' },
  { value: 'citation_check', label: 'Citation check' },
  { value: 'source_verification', label: 'Source verification' },
];
