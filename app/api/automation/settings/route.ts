import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isOperationsRole } from "@/lib/roles";
import { getLeadDiscoveryAutomationEnabled, saveLeadDiscoveryAutomationEnabled } from "@/lib/leadDiscoveryAutomation";

export async function GET() {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ enabled: await getLeadDiscoveryAutomationEnabled(user.organizationId) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "enabled must be true or false." }, { status: 400 });
  const enabled = await saveLeadDiscoveryAutomationEnabled(body.enabled, user.organizationId);
  return NextResponse.json({ enabled });
}
