import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// ScholarSuite is free and needs no account. These legacy authentication
// routes no longer exist; keep redirects so old links and bookmarks land
// in the app instead of a 404.
const LEGACY_AUTH_PATHS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/auth/verify",
];

export async function middleware(request: NextRequest) {
  // If the database isn't configured or reachable, keep rendering instead
  // of crashing; the app shows a friendly error where data is needed.
  let response = NextResponse.next({ request });
  try {
    const result = await updateSession(request);
    response = result.response;
  } catch {
    // no-op: fall through
  }
  const { pathname } = request.nextUrl;

  if (
    LEGACY_AUTH_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    )
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
