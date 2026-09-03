import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { discoverEmailsForLeads } from "@/lib/dbStore";
import { isOperationsRole } from "@/lib/roles";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperationsRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const organizationId = user.organizationId;
  const body = await request.json().catch(() => ({}));
  const region = typeof body.region === "string" ? body.region : undefined;
  const limit = typeof body.limit === "number" ? body.limit : 10;
  const result = await discoverEmailsForLeads({ region, limit, organizationId });
  return NextResponse.json(result);
}
