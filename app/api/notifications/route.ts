import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listDbNotifications } from "@/lib/dbStore";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestedTake = Number(request.nextUrl.searchParams.get("take") || 20);
  const take = Number.isFinite(requestedTake) ? requestedTake : 20;
  return NextResponse.json({ notifications: await listDbNotifications(user, { take }) });
}

export async function PATCH(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = user.role === "admin" ? { recipientUserId: null } : { recipientUserId: user.id };
  const body = await request.json().catch(() => ({}));
  if (body.all === true) {
    await prisma.notification.updateMany({ where: { ...scope, read: false }, data: { read: true } });
  } else if (typeof body.id === "string") {
    await prisma.notification.updateMany({ where: { ...scope, id: body.id }, data: { read: true } });
  } else {
    return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
