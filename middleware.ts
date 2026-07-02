import { NextRequest, NextResponse } from "next/server";

const authCookieName = "direct_optimize_session";

const publicPrefixes = [
  "/login",
  "/client-register",
  "/api/auth",
  "/api/client/register",
  "/api/email/open",
  "/api/email/click",
  "/_next",
  "/favicon.ico"
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(authCookieName)?.value);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"]
};
