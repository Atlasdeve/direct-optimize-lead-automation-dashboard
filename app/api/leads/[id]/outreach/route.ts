import { NextRequest, NextResponse } from "next/server";
import { approveLeadForOutreach, blockLeadFromOutreach, getDbLead, getLatestGmbAudit, getLatestLeadIntelligence, runGmbAudit, runLeadIntelligenceAudit } from "@/lib/dbStore";
import { buildPersonalizedEmail } from "@/lib/providers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getDbLead(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const [websiteAudit, gmbAudit] = await Promise.all([
    getLatestLeadIntelligence(id).then((audit) => audit ?? runLeadIntelligenceAudit(id)),
    getLatestGmbAudit(id).then((audit) => audit ?? runGmbAudit(id))
  ]);
  return NextResponse.json({
    preview: buildPersonalizedEmail(lead, "local SEO and website conversion", { website: websiteAudit, gmb: gmbAudit }),
    lead
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (action === "approve") {
    return NextResponse.json({ lead: await approveLeadForOutreach(id) });
  }

  if (action === "block") {
    return NextResponse.json({ lead: await blockLeadFromOutreach(id) });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
