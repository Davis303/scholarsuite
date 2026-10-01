"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";

/**
 * ScholarSuite is free and needs no account. When a visitor arrives without
 * a session, this component starts a free anonymous session for them and
 * then refreshes the page so the app loads with their workspace ready.
 */
export function EnsureSession() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          const { error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
        }
        if (!cancelled) router.refresh();
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fafafa] px-4">
      {failed ? (
        <>
          <p className="max-w-sm text-center text-sm text-slate-600">
            We could not start your free session. Please check your connection
            and try again.
          </p>
          <Button type="button" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </>
      ) : (
        <>
          <Spinner />
          <p className="text-sm text-slate-500">Starting your free workspace…</p>
        </>
      )}
    </div>
  );
}
