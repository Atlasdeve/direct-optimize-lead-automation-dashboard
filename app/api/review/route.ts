import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listReviewQueue, type ReviewQueueKey } from "@/lib/dbStore";
import { isOperationsRole } from "@/lib/roles";

const queues = new Set(["needs_review", "approved", "do_not_contact", "contacted", "replied", "contact_forms"]);

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperationsRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const organizationId = user.organizationId;
  const queueParam = request.nextUrl.searchParams.get("queue") ?? "needs_review";
  const queue = queues.has(queueParam) ? (queueParam as ReviewQueueKey) : "needs_review";
  const region = request.nextUrl.searchParams.get("region") ?? undefined;
  return NextResponse.json({ queue, leads: await listReviewQueue(queue, region, organizationId) });
}
