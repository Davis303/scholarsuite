"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAppName } from "@/content/site";
import type { JSX } from "react";

export interface SidebarProps {
  open: boolean;
  onClose: () => void;
  userEmail: string | null;
  isGuest: boolean;
  onUpgrade: () => void;
}

const appName = getAppName();

function icon(path: string): JSX.Element {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: JSX.Element;
  isActive: (pathname: string) => boolean;
}

const MAIN_NAV: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: icon(
      "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
    ),
    isActive: (p) => p === "/dashboard",
  },
  {
    key: "documents",
    label: "Documents",
    href: "/documents",
    icon: icon(
      "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z"
    ),
    isActive: (p) => p === "/documents" || p.startsWith("/documents/"),
  },
];

/**
 * AI Tools, the product's tool list. Deep Proofread lives inside the
 * Writing Assistant module (its own tab in the document editor), so both
 * entries open the writing module; the active pill reflects which view
 * the user is in. No other tools exist, nothing detector-related
 * may ever be added here.
 */
const TOOL_NAV: NavItem[] = [
  {
    key: "writing",
    label: "Writing Assistant",
    href: "/writing",
    icon: icon(
      "M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487z"
    ),
    isActive: (p) => p === "/writing",
  },
  {
    key: "proofread",
    label: "Deep Proofread",
    href: "/writing",
    icon: icon(
      "M9 12.75L11.25 15 15 9.75M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"
    ),
    isActive: (p) => p.startsWith("/writing/"),
  },
  {
    key: "reviews",
    label: "Similarity Review",
    href: "/reviews",
    icon: icon("M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"),
    isActive: (p) => p.startsWith("/reviews"),
  },
];

function NavLink({ item, pathname, onClose }: { item: NavItem; pathname: string; onClose: () => void }) {
  const active = item.isActive(pathname);
  return (
    <Link
      key={item.key}
      href={item.href}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 ${
        active
          ? "bg-accent-100 text-accent-900 [&>svg]:text-accent-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

export function Sidebar({ open, onClose, userEmail, isGuest, onUpgrade }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.localStorage.removeItem("scholarsuite.remember");
    window.sessionStorage.removeItem("scholarsuite.ephemeral");
    router.push("/sign-in");
    router.refresh();
  };

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-5">
        <img src="/logo.svg" alt="" className="h-9 w-9" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
            {appName}
          </p>
          <p className="truncate text-xs text-slate-500">AI Writing Assistant</p>
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto px-3">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.key} item={item} pathname={pathname} onClose={onClose} />
        ))}
        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          AI Tools
        </p>
        {TOOL_NAV.map((item) => (
          <NavLink key={item.key} item={item} pathname={pathname} onClose={onClose} />
        ))}
        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Help
        </p>
        <NavLink
          item={{
            key: "manual",
            label: "User Manual",
            href: "/manual",
            icon: icon(
              "M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
            ),
            isActive: (p) => p === "/manual" || p.startsWith("/manual/"),
          }}
          pathname={pathname}
          onClose={onClose}
        />
      </nav>

      <div className="px-3 pb-3 pt-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Free Plan</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Free plan · no credit card required
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-3 w-full rounded-full bg-gradient-to-r from-accent-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
          >
            Upgrade Plan
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 py-3">
        <p className="truncate px-1 text-xs text-slate-500" title={userEmail ?? undefined}>
          {isGuest ? "Guest session" : userEmail}
        </p>
        <button
          type="button"
          onClick={signOut}
          className="mt-1.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 bg-white transition-transform lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Sidebar"
      >
        {nav}
      </aside>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200 bg-white lg:block" aria-label="Sidebar">
        {nav}
      </aside>
    </>
  );
}
