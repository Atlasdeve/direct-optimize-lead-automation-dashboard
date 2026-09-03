import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { approveLeadForOutreach, blockLeadFromOutreach, getDbLead, getLatestGmbAudit, getLatestLeadIntelligence, runGmbAudit, runLeadIntelligenceAudit } from "@/lib/dbStore";
import { buildPersonalizedEmail } from "@/lib/providers";
import { isOperationsRole } from "@/lib/roles";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperationsRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const organizationId = user.organizationId;
  const { id } = await params;
  const lead = await getDbLead(id, organizationId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const [websiteAudit, gmbAudit] = await Promise.all([
    getLatestLeadIntelligence(id).then((audit) => audit ?? runLeadIntelligenceAudit(id, organizationId)),
    getLatestGmbAudit(id).then((audit) => audit ?? runGmbAudit(id, organizationId))
  ]);
  return NextResponse.json({
    preview: buildPersonalizedEmail(lead, "local SEO and website conversion", { website: websiteAudit, gmb: gmbAudit }),
    lead
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperationsRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const organizationId = user.organizationId;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (action === "approve") {
    return NextResponse.json({ lead: await approveLeadForOutreach(id, organizationId) });
  }

  if (action === "block") {
    return NextResponse.json({ lead: await blockLeadFromOutreach(id, organizationId) });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
