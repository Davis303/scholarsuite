"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type Status = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The reset link carries recovery tokens in the URL hash; the Supabase
  // browser client picks them up automatically and establishes a session.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=")) {
      setStatus("invalid");
      return;
    }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "ready" : "invalid");
    });
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords don't match. Please try again.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
    } catch {
      setError("We couldn't update your password. The link may have expired — request a new one below.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-slate-900">Choose a new password</h1>

      {status === "checking" ? (
        <p className="mt-4 text-sm text-slate-600">Verifying your reset link…</p>
      ) : null}

      {status === "invalid" ? (
        <div>
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            This reset link is invalid or has expired. Please request a new one.
          </p>
          <div className="mt-6 text-center">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-accent-700 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              Request a new reset link
            </Link>
          </div>
        </div>
      ) : null}

      {status === "ready" && !done ? (
        <div>
          {error ? (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              hint="At least 8 characters."
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Update password
            </Button>
          </form>
        </div>
      ) : null}

      {status === "ready" && done ? (
        <div>
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <div className="mt-6 text-center">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-accent-700 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
