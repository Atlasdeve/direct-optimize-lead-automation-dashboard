import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { archiveDuplicateLead, duplicateLeadSignals } from "@/lib/dbStore";
import { isOperationsRole } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperationsRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const organizationId = user.organizationId;
  const region = request.nextUrl.searchParams.get("region") ?? undefined;
  return NextResponse.json({ duplicates: await duplicateLeadSignals(region, organizationId) });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperationsRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const organizationId = user.organizationId;
  const body = await request.json().catch(() => ({}));
  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  if (!leadId) return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  return NextResponse.json({ lead: await archiveDuplicateLead(leadId, organizationId) });
}
