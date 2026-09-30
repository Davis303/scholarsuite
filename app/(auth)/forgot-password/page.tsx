"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${appUrl}/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch {
      setError("We couldn't send a reset link. Please check the email address and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
      {sent ? (
        <div>
          <p className="mt-2 text-sm text-slate-600">
            If an account exists for <span className="font-medium text-slate-900">{email.trim()}</span>,
            we&apos;ve sent a password reset link to it. The link expires after a limited time.
          </p>
          <div className="mt-6 text-center">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <p className="mt-1 text-sm text-slate-600">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
          {error ? (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Send reset link
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600">
            <Link
              href="/sign-in"
              className="font-medium text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      )}
    </Card>
  );
}
