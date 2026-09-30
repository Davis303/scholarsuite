"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Status = "verifying" | "verified" | "invalid";

/**
 * Handles the email verification link sent at sign-up.
 * Route: /auth/verify (matches the NEXT_PUBLIC_APP_URL/auth/verify redirect
 * used in the sign-up email). The Supabase browser client detects the
 * confirmation tokens in the URL automatically.
 */
export default function VerifyPage() {
  const [status, setStatus] = useState<Status>("verifying");

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=") || hash.includes("error_code=")) {
      setStatus("invalid");
      return;
    }
    const supabase = createClient();
    const timeout = window.setTimeout(() => {
      supabase.auth.getSession().then(({ data }) => {
        setStatus(data.session ? "verified" : "invalid");
      });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <Card className="p-6 text-center sm:p-8">
      {status === "verifying" ? (
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Verifying your email…</h1>
          <p className="mt-2 text-sm text-slate-600">This should only take a moment.</p>
        </div>
      ) : null}

      {status === "verified" ? (
        <div>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Email verified</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your account is active. Welcome aboard.
          </p>
          <Link href="/dashboard" className="mt-6 inline-block">
            <Button size="lg">Continue to your dashboard</Button>
          </Link>
        </div>
      ) : null}

      {status === "invalid" ? (
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Verification link expired</h1>
          <p className="mt-2 text-sm text-slate-600">
            This verification link is invalid or has expired. Sign in to request a new one,
            or create your account again.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/sign-in">
              <Button variant="secondary">Sign in</Button>
            </Link>
            <Link href="/sign-up">
              <Button>Sign up</Button>
            </Link>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
