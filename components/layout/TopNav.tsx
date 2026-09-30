"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";

export interface TopNavProps {
  userEmail: string | null;
  isGuest: boolean;
}

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/documents": "Documents",
  "/settings": "Settings",
  "/settings/sessions": "Active sessions",
  "/settings/privacy": "Privacy & data",
  "/privacy": "Privacy",
  "/reviews": "My Reviews",
  "/reviews/new": "New Review",
  "/writing": "Writing Assistant",
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Dashboard";
  const last = segments[segments.length - 1].replace(/-/g, " ");
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export function TopNav({ userEmail, isGuest }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    router.push(`/documents?search=${encodeURIComponent(query.trim())}`);
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.localStorage.removeItem("scholarsuite.remember");
    window.sessionStorage.removeItem("scholarsuite.ephemeral");
    router.push("/sign-in");
    router.refresh();
  };

  const initial = (isGuest ? "G" : (userEmail ?? "?").charAt(0).toUpperCase()) || "?";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-slate-900">
          {titleFor(pathname)}
        </h1>
        <form onSubmit={submitSearch} role="search" className="hidden md:block">
          <label htmlFor="topnav-search" className="sr-only">
            Search documents
          </label>
          <div className="relative">
            <input
              id="topnav-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documents…"
              className="w-56 rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 lg:w-72"
            />
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z" />
            </svg>
          </div>
        </form>
        <Dropdown
          label="Notifications"
          trigger={
            <span className="relative inline-flex">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75v-.7V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
            </span>
          }
        >
          <div className="px-4 py-3">
            <p className="text-sm font-medium text-slate-900">Notifications</p>
            <p className="mt-1 text-sm text-slate-500">You are all caught up.</p>
          </div>
        </Dropdown>
        <Dropdown
          label="Account menu"
          trigger={
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white"
            >
              {initial}
            </span>
          }
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-slate-900">
              {isGuest ? "Guest session" : userEmail}
            </p>
            {isGuest ? (
              <p className="text-xs text-slate-500">Temporary account</p>
            ) : null}
          </div>
          <Link
            href="/settings"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
            role="menuitem"
          >
            Account settings
          </Link>
          <Link
            href="/privacy"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
            role="menuitem"
          >
            Privacy
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
          >
            Sign out
          </button>
        </Dropdown>
      </div>
    </header>
  );
}
