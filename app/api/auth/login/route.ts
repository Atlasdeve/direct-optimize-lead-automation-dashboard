import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { authCookieName, authCookieOptions, createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!identifier || !password) {
    return NextResponse.json({ error: "Enter username/email and password." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: identifier },
        { email: identifier }
      ]
    }
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
  }

  const response = NextResponse.json({ user: { username: user.username, email: user.email, role: user.role } });
  response.cookies.set(authCookieName, createSessionToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  }), authCookieOptions());
  return response;
}
