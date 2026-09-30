"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";

export interface TopNavProps {
  userEmail: string | null;
  isGuest: boolean;
  onUpgrade: () => void;
}

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/documents": "Documents",
  "/manual": "User Manual",
  "/settings": "Settings",
  "/settings/sessions": "Active sessions",
  "/settings/privacy": "Privacy & data",
  "/privacy": "Privacy",
  "/reviews": "My Reviews",
  "/reviews/new": "New Review",
  "/writing": "Writing Assistant",
};

/** Honest one-line descriptors for the current section (never statistics). */
const SUBTITLES: Record<string, string> = {
  "/dashboard": "Workspace overview",
  "/documents": "Shared document library",
  "/manual": "How to use ScholarSuite",
  "/settings": "Account & preferences",
  "/settings/sessions": "Devices & sessions",
  "/settings/privacy": "Data retention & deletion",
  "/privacy": "How your data is handled",
  "/reviews": "Similarity review workspace",
  "/reviews/new": "Upload a document & its similarity report",
  "/writing": "Style-aware editing & deep proofreading",
};

function titleFor(pathname: string): string {
  // Document-level views show their module title instead of a raw id.
  if (pathname.startsWith("/writing/")) return "Writing Assistant";
  if (pathname.startsWith("/reviews/")) return "Review Workspace";
  if (TITLES[pathname]) return TITLES[pathname];
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Dashboard";
  const last = segments[segments.length - 1].replace(/-/g, " ");
  return last.charAt(0).toUpperCase() + last.slice(1);
}

function subtitleFor(pathname: string): string {
  if (pathname.startsWith("/writing/")) return "Draft";
  if (pathname.startsWith("/reviews/")) return "Similarity review";
  return SUBTITLES[pathname] ?? "";
}

function IconButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
    >
      {children}
    </Link>
  );
}

export function TopNav({ userEmail, isGuest, onUpgrade }: TopNavProps) {
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
  const subtitle = subtitleFor(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold text-slate-900">
            {titleFor(pathname)}
          </h1>
          {subtitle ? (
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>

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
              className="w-48 rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 lg:w-64"
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

        <button
          type="button"
          onClick={onUpgrade}
          className="hidden rounded-full bg-gradient-to-r from-accent-500 to-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 sm:inline-flex"
        >
          Upgrade Plan
        </button>

        <IconButton href="/settings" label="Settings">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          </svg>
        </IconButton>

        <IconButton href="/manual" label="User Manual">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </IconButton>

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
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-500 text-sm font-semibold text-white"
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
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-600"
            role="menuitem"
          >
            Account settings
          </Link>
          <Link
            href="/privacy"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-600"
            role="menuitem"
          >
            Privacy
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-600"
          >
            Sign out
          </button>
        </Dropdown>
      </div>
    </header>
  );
}
