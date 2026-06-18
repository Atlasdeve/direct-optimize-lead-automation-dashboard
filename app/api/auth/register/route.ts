import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { authCookieName, authCookieOptions, createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = normalizeUsername(body.username);
  const email = normalizeEmail(body.email);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json({ error: "Username must be 3-32 characters and use letters, numbers, dots, dashes, or underscores." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { id: true }
  });
  if (existing) {
    return NextResponse.json({ error: "A user with that username or email already exists." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      username,
      email,
      name: name || username,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin"
    },
    select: { id: true, username: true, email: true, role: true }
  });

  const response = NextResponse.json({ user: { username: user.username, email: user.email, role: user.role } });
  response.cookies.set(authCookieName, createSessionToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  }), authCookieOptions());
  return response;
}
