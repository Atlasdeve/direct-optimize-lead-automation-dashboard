import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getDbLead, getLatestGmbAudit, runGmbAudit } from "@/lib/dbStore";
import { isOperationsRole } from "@/lib/roles";

async function requestOrganizationId() {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role)) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { organizationId: user.organizationId };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requestOrganizationId();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const lead = await getDbLead(id, auth.organizationId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ audit: await getLatestGmbAudit(id) });
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requestOrganizationId();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    return NextResponse.json({ audit: await runGmbAudit(id, auth.organizationId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GMB audit failed" },
      { status: 400 }
    );
  }
}
