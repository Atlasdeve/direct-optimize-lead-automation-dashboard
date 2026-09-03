import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getLeadChecklist, updateLeadChecklist } from "@/lib/dbStore";
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
  return NextResponse.json({ checklist: await getLeadChecklist(id, auth.organizationId) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requestOrganizationId();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({ checklist: await updateLeadChecklist(id, body, auth.organizationId) });
}
