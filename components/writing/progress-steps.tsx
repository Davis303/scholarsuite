/**
 * ProgressSteps · local writing-module component (not part of the shell's
 * components/ui kit). Renders a vertical list of real processing stages.
 */

"use client";

import { Spinner } from "@/components/ui/Spinner";

export function ProgressSteps({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="space-y-2" aria-label="Processing progress">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? "bg-green-100 text-green-700"
                  : active
                    ? "bg-accent-100 text-accent-700"
                    : "bg-slate-100 text-slate-400"
              }`}
              aria-hidden="true"
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={
                active
                  ? "font-medium text-slate-900"
                  : done
                    ? "text-slate-600"
                    : "text-slate-400"
              }
              aria-current={active ? "step" : undefined}
            >
              {step}
              {active && (
                <span className="ml-2 inline-block align-middle">
                  <Spinner />
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
