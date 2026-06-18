import { NextRequest, NextResponse } from "next/server";
import { archiveDuplicateLead, duplicateLeadSignals } from "@/lib/dbStore";

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") ?? undefined;
  return NextResponse.json({ duplicates: await duplicateLeadSignals(region) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  if (!leadId) return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  return NextResponse.json({ lead: await archiveDuplicateLead(leadId) });
}
