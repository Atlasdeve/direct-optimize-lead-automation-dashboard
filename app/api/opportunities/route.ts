import { NextRequest, NextResponse } from "next/server";
import { createOpportunity, listOpportunities } from "@/lib/dbStore";
import { currentUser } from "@/lib/auth";
import { isOperationsRole } from "@/lib/roles";

export async function GET() {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ opportunities: await listOpportunities(user.organizationId) });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.leadId !== "string") {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }
  try {
    return NextResponse.json({ opportunity: await createOpportunity({ ...body, organizationId: user.organizationId }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Opportunity could not be created." }, { status: 400 });
  }
}
