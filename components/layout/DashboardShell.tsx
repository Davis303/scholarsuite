"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export interface DashboardShellProps {
  children: ReactNode;
  userEmail: string | null;
  isGuest: boolean;
}

export function DashboardShell({ children, userEmail, isGuest }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Honor "Keep me signed in" being unchecked: such sessions are ephemeral and
  // must not survive a new tab or a browser restart. The sign-in page stores
  // "scholarsuite.remember" = "0" in localStorage and a "scholarsuite.ephemeral"
  // marker in sessionStorage (cleared when the tab/window closes). If this tab
  // lacks the marker, the session was meant to be temporary — sign out.
  useEffect(() => {
    const remember = window.localStorage.getItem("scholarsuite.remember");
    const ephemeral = window.sessionStorage.getItem("scholarsuite.ephemeral");
    if (remember === "0" && !ephemeral) {
      createClient()
        .auth.signOut()
        .finally(() => {
          window.location.href = "/sign-in";
        });
    }
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userEmail={userEmail}
        isGuest={isGuest}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="fixed bottom-4 left-4 z-40 rounded-full bg-brand-600 p-3 text-white shadow-lg hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>
        <TopNav userEmail={userEmail} isGuest={isGuest} />
        {isGuest ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 sm:px-6">
            <p className="text-sm text-amber-900">
              <span className="font-medium">You&apos;re browsing as a guest — work is temporary</span>{" "}
              and may be removed automatically.{" "}
              <Link
                href="/settings"
                className="font-medium text-brand-700 underline hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                Create a free account to keep your work
              </Link>
              .
            </p>
          </div>
        ) : null}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
