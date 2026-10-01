/**
 * Central site content: brand name, navigation, and footer links.
 *
 * Edit copy here (no component or logic changes needed).
 * (Kept separate so marketing copy can be managed or migrated independently,
 * e.g. into a CMS such as WordPress later.)
 */

/** Product name; override with the NEXT_PUBLIC_APP_NAME env var. */
export function getAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME ?? "ScholarSuite";
}

export interface NavLink {
  /** Stable key used to attach icons or active-state logic in components. */
  key: string;
  label: string;
  href: string;
}

/** Primary dashboard navigation, in display order. */
export const primaryNav: NavLink[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "writing", label: "Writing Assistant", href: "/writing" },
  { key: "new-review", label: "New Review", href: "/reviews/new" },
  { key: "reviews", label: "My Reviews", href: "/reviews" },
  { key: "documents", label: "Documents", href: "/documents" },
  { key: "settings", label: "Settings", href: "/settings" },
];

/** Public footer links on the landing page. */
export const footerNav: NavLink[] = [
  { key: "privacy", label: "Privacy", href: "/privacy" },
  { key: "manual", label: "User Manual", href: "/manual" },
  { key: "start", label: "Start free", href: "/dashboard" },
];
