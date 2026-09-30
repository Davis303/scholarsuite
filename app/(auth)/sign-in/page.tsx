"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";

function friendlyError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "The email or password you entered is incorrect. Please try again.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please verify your email address before signing in. Check your inbox for the verification link.";
  }
  if (lower.includes("too many") || lower.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return "We couldn't sign you in. Please check your details and try again.";
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // "Keep me signed in": checked → persistent long-lived session (Supabase
  // default, stored in the browser). Unchecked → ephemeral session: we record
  // the choice in localStorage/sessionStorage and the dashboard signs the user
  // out when the tab is closed or a new tab is opened (see DashboardShell).
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordSignIn = async (userId: string) => {
    try {
      const supabase = createClient();
      await supabase.from("audit_logs").insert({
        user_id: userId,
        action: "sign_in",
        entity_type: "session",
        meta: { user_agent: window.navigator.userAgent },
      });
    } catch {
      // Audit logging is best-effort; never block sign-in.
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      window.localStorage.setItem("scholarsuite.remember", remember ? "1" : "0");
      if (remember) {
        window.sessionStorage.removeItem("scholarsuite.ephemeral");
      } else {
        window.sessionStorage.setItem("scholarsuite.ephemeral", "1");
      }
      if (data.user) await recordSignIn(data.user.id);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  };

  const continueAsGuest = async () => {
    setGuestLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: guestError } = await supabase.auth.signInAnonymously();
      if (guestError) throw guestError;
      window.localStorage.removeItem("scholarsuite.remember");
      window.sessionStorage.removeItem("scholarsuite.ephemeral");
      if (data.user) await recordSignIn(data.user.id);
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("We couldn't start a guest session. Please try again later.");
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-slate-900">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-600">Sign in to your account to continue.</p>

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
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            />
            Keep me signed in
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Sign in
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        size="lg"
        loading={guestLoading}
        onClick={continueAsGuest}
      >
        Continue as guest
      </Button>
      <p className="mt-2 text-center text-xs text-slate-500">
        Guest work is temporary and may be removed automatically.
      </p>

      <p className="mt-6 text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          Sign up
        </Link>
      </p>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <Card className="flex items-center justify-center p-12">
          <Spinner />
        </Card>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
