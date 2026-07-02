import { NextRequest, NextResponse } from "next/server";
import { authCookieName, authCookieOptions, createSessionToken } from "@/lib/auth";
import { createPortalUser, createProject } from "@/lib/portalStore";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  try {
    const user = await createPortalUser({
      email: body.email,
      username: body.username,
      name: body.name,
      password: body.password,
      role: "client"
    });
    await createProject({
      clientUserId: user.id,
      companyName: body.companyName || user.name || "Client project",
      websiteUrl: body.websiteUrl,
      gmbUrl: body.gmbUrl,
      status: "Client onboarding",
      progress: 5,
      notes: "Client self-registered and submitted initial website/GMB details."
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
