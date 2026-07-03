import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushConfigured, pushPublicKey } from "@/lib/pushNotifications";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subscriptionCount = await prisma.pushSubscription.count({ where: { userId: user.id, enabled: true } });
  return NextResponse.json({
    configured: pushConfigured(),
    publicKey: pushPublicKey(),
    subscriptionCount
  });
}
