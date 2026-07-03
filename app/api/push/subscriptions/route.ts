import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function validEndpoint(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const endpoint = validEndpoint(body.endpoint);
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !auth || p256dh.length > 512 || auth.length > 256) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId: user.id,
      p256dh,
      auth,
      enabled: true,
      platform: typeof body.platform === "string" ? body.platform.slice(0, 40) : undefined,
      userAgent: request.headers.get("user-agent")?.slice(0, 500)
    },
    create: {
      userId: user.id,
      endpoint,
      p256dh,
      auth,
      platform: typeof body.platform === "string" ? body.platform.slice(0, 40) : undefined,
      userAgent: request.headers.get("user-agent")?.slice(0, 500)
    }
  });
  return NextResponse.json({ subscribed: true });
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const endpoint = validEndpoint(body.endpoint);
  if (!endpoint) return NextResponse.json({ error: "Subscription endpoint is required." }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint } });
  return NextResponse.json({ subscribed: false });
}
