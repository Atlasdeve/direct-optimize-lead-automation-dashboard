import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { authCookieName, currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requestFingerprint } from "@/lib/security";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = checkRateLimit(requestFingerprint(request, "change-password", user.id), 5, 30 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many password attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const body = await request.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 12) return NextResponse.json({ error: "New password must be at least 12 characters." }, { status: 400 });
  if (currentPassword === newPassword) return NextResponse.json({ error: "Choose a different password." }, { status: 400 });
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!account || !(await bcrypt.compare(currentPassword, account.passwordHash))) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(authCookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
