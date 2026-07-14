import { NextRequest, NextResponse } from "next/server";
import { authCookieName, authCookieOptions, createSessionToken } from "@/lib/auth";
import { registerClientPortal } from "@/lib/portalStore";
import { getSavedRegion } from "@/lib/regionStore";
import { checkRateLimit, requestFingerprint } from "@/lib/security";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(requestFingerprint(request, "client-register"), 5, 60 * 60 * 1000);
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many registration attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } });
  const body = await request.json().catch(() => ({}));
  try {
    const region = typeof body.region === "string" ? await getSavedRegion(body.region) : null;
    if (!region) throw new Error("Select a valid region.");
    const { user } = await registerClientPortal({
      email: body.email,
      username: body.username,
      name: body.name,
      phone: body.phone,
      password: body.password,
      companyName: body.companyName,
      region: region.name,
      country: region.country,
      timezone: region.timezone,
      websiteUrl: body.websiteUrl,
      gmbUrl: body.gmbUrl
    });
    const response = NextResponse.json({ user });
    response.cookies.set(authCookieName, createSessionToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }), authCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Client account could not be created." }, { status: 400 });
  }
}
