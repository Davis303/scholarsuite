"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";

interface SignInEvent {
  id: string;
  created_at: string;
  meta: { user_agent?: string } | null;
}

function describeDevice(userAgent: string | undefined): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent.toLowerCase();
  let os = "Unknown OS";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os")) os = "macOS";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("linux")) os = "Linux";
  let browser = "Unknown browser";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari";
  else if (ua.includes("firefox/")) browser = "Firefox";
  return `${browser} on ${os}`;
}

export function SessionsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<SignInEvent[]>([]);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [confirmGlobal, setConfirmGlobal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/sign-in");
          return;
        }
        setLastSignIn(user.last_sign_in_at ?? null);
        const { data } = await supabase
          .from("audit_logs")
          .select("id, created_at, meta")
          .eq("action", "sign_in")
          .order("created_at", { ascending: false })
          .limit(10);
        setEvents((data ?? []) as SignInEvent[]);
      } catch {
        toast("We couldn't load your session history.", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router, toast]);

  const signOutThisDevice = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.localStorage.removeItem("scholarsuite.remember");
      window.sessionStorage.removeItem("scholarsuite.ephemeral");
      router.push("/sign-in");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  const signOutEverywhere = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      window.localStorage.removeItem("scholarsuite.remember");
      window.sessionStorage.removeItem("scholarsuite.ephemeral");
      toast("Signed out of all devices.", "success");
      setConfirmGlobal(false);
      router.push("/sign-in");
      router.refresh();
    } catch {
      toast("We couldn't sign you out everywhere. Please try again.", "error");
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">This device</h2>
              <Badge tone="green">Current session</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {describeDevice(typeof window !== "undefined" ? window.navigator.userAgent : undefined)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Last sign-in: {lastSignIn ? formatDate(lastSignIn) : "—"}
            </p>
          </div>
          <Button variant="secondary" loading={signingOut} onClick={signOutThisDevice}>
            Sign out this device
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900">Recent sign-in activity</h2>
        <p className="mt-1 text-sm text-slate-600">
          The last few times this account was signed in. If you don&apos;t recognize an entry,
          sign out of all devices below.
        </p>
        {events.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No sign-in history yet"
              description="Sign-in activity will appear here as you use your account."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {describeDevice(event.meta?.user_agent)}
                  </p>
                  <p className="text-xs text-slate-500" title={event.meta?.user_agent}>
                    {formatDate(event.created_at)}
                  </p>
                </div>
                <span className="text-xs text-slate-500">{formatRelativeTime(event.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="border-red-200 p-6">
        <h2 className="text-base font-semibold text-slate-900">Sign out of all devices</h2>
        <p className="mt-1 text-sm text-slate-600">
          Immediately end every session for this account on all devices, including this one.
        </p>
        <Button variant="destructive" className="mt-4" onClick={() => setConfirmGlobal(true)}>
          Sign out everywhere
        </Button>
      </Card>

      <Modal
        open={confirmGlobal}
        onClose={() => setConfirmGlobal(false)}
        title="Sign out of all devices?"
        actions={
          <Button variant="destructive" loading={signingOut} onClick={signOutEverywhere}>
            Sign out everywhere
          </Button>
        }
      >
        <p>
          This will end your session on every device where you&apos;re signed in, including this
          one. You&apos;ll need to sign in again everywhere.
        </p>
      </Modal>
    </div>
  );
}
