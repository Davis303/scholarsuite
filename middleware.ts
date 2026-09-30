import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/reviews",
  "/writing",
  "/documents",
  "/settings",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request: NextRequest) {
  // If the database isn't configured or reachable, treat every request as
  // signed out instead of crashing: public pages still render, protected
  // pages redirect to sign-in.
  let response = NextResponse.next({ request });
  let user = null;
  try {
    const result = await updateSession(request);
    response = result.response;
    user = result.user;
  } catch {
    // no-op: fall through as signed out
  }
  const { pathname } = request.nextUrl;

  if (isProtected(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
