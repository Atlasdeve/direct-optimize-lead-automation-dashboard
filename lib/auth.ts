import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const authCookieName = "direct_optimize_session";
const standardSessionSeconds = 12 * 60 * 60;
const rememberedSessionSeconds = 30 * 24 * 60 * 60;

type SessionPayload = {
  userId: string;
  username: string | null;
  email: string;
  role: string;
  exp: number;
};

function secret() {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value || value.length < 32) throw new Error("NEXTAUTH_SECRET must contain at least 32 characters.");
  return value;
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">, remember = false) {
  const maxAge = remember ? rememberedSessionSeconds : standardSessionSeconds;
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Date.now() + maxAge * 1000
  })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    const expected = Buffer.from(sign(body));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId || !["admin", "employee", "client"].includes(payload.role) || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function currentSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(authCookieName)?.value);
}

export async function currentUser() {
  const session = await currentSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, username: true, name: true, phone: true, role: true }
  });
}

export function authCookieOptions(remember = false) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? rememberedSessionSeconds : standardSessionSeconds
  };
}
