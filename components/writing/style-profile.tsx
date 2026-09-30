"use client";

/**
 * Document Style Profile panel: detected values computed locally from the
 * author's own document. Never based on any detector or score.
 */
export function StyleProfilePanel({
  rows,
}: {
  rows: { label: string; value: string }[];
}) {
  if (rows.length === 0) {
    return (
      <section aria-label="Document style profile">
        <h2 className="text-sm font-semibold text-slate-900">
          Document Style Profile
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          No style profile yet. Analyze the document to build one.
        </p>
      </section>
    );
  }
  return (
    <section aria-label="Document style profile">
      <h2 className="text-sm font-semibold text-slate-900">
        Document Style Profile
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Detected automatically from your document. Improvements are matched to
        this style.
      </p>
      <dl className="mt-3 divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-1 gap-0.5 py-2">
            <dt className="text-[13px] font-medium text-slate-700">{row.label}</dt>
            <dd className="text-[13px] text-slate-600">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
