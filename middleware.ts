import { NextRequest, NextResponse } from "next/server";

const authCookieName = "direct_optimize_session";

const publicPaths = new Set([
  "/login",
  "/client-register",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/client/register",
  "/favicon.ico"
]);

const publicPrefixes = ["/api/email/open", "/api/email/click", "/_next"];
const crossOriginApiKeyPaths = new Set([
  "/api/extension/leads"
]);

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function requestOrigin(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0] || request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0] || request.headers.get("host");
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const unsafeMethod = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (unsafeMethod) {
    const origin = request.headers.get("origin");
    if (origin && origin !== requestOrigin(request) && !crossOriginApiKeyPaths.has(pathname)) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    const maxBytes = pathname === "/api/portal/uploads" ? 6 * 1024 * 1024 : 1024 * 1024;
    if (contentLength > maxBytes) return NextResponse.json({ error: "Request payload is too large." }, { status: 413 });
  }

  if (publicPaths.has(pathname) || crossOriginApiKeyPaths.has(pathname) || publicPrefixes.some((prefix) => matchesPrefix(pathname, prefix))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(authCookieName)?.value;
  const session = token ? await readSession(token) : null;
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role === "client") {
    const allowed = pathname.startsWith("/client-portal") || pathname.startsWith("/client-profile") || pathname.startsWith("/api/portal") || pathname.startsWith("/api/auth") || pathname.startsWith("/api/notifications") || pathname.startsWith("/api/push");
    if (!allowed) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Client accounts cannot access this resource." }, { status: 403 });
      return NextResponse.redirect(new URL("/client-portal", request.url));
    }
  }

  if (session.role === "employee") {
    const allowedPage = matchesPrefix(pathname, "/employee-portal") || matchesPrefix(pathname, "/projects");
    const allowedApi = matchesPrefix(pathname, "/api/portal") || matchesPrefix(pathname, "/api/auth") || matchesPrefix(pathname, "/api/calls") || matchesPrefix(pathname, "/api/notifications") || matchesPrefix(pathname, "/api/push");
    if (!allowedPage && !allowedApi) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Employee accounts cannot access this resource." }, { status: 403 });
      return NextResponse.redirect(new URL("/employee-portal", request.url));
    }
  }

  return NextResponse.next();
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function readSession(token: string) {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(process.env.NEXTAUTH_SECRET || ""),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(body))) as { role?: string; exp?: number };
    return payload.role && ["admin", "employee", "client"].includes(payload.role) && payload.exp && payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"]
};
