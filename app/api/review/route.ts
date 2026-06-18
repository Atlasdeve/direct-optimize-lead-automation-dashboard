import { NextRequest, NextResponse } from "next/server";
import { listReviewQueue, type ReviewQueueKey } from "@/lib/dbStore";

const queues = new Set(["needs_review", "approved", "do_not_contact", "contacted", "replied", "contact_forms"]);

export async function GET(request: NextRequest) {
  const queueParam = request.nextUrl.searchParams.get("queue") ?? "needs_review";
  const queue = queues.has(queueParam) ? (queueParam as ReviewQueueKey) : "needs_review";
  const region = request.nextUrl.searchParams.get("region") ?? undefined;
  return NextResponse.json({ queue, leads: await listReviewQueue(queue, region) });
}
