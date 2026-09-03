import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isOperationsRole } from "@/lib/roles";
import { generateLeadCallPitch, getLatestLeadCallPitch } from "@/lib/callPitch";
import { getDbLead, getLatestGmbAudit, getLatestLeadIntelligence, runGmbAudit, runLeadIntelligenceAudit } from "@/lib/dbStore";
import { getOrganizationApiConfig } from "@/lib/organizationSettings";

async function authorized() {
  const user = await currentUser();
  return user && isOperationsRole(user.role) ? user : null;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authorized();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const organizationId = user.organizationId;
  const { id } = await params;
  const lead = await getDbLead(id, organizationId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ pitch: await getLatestLeadCallPitch(id) });
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authorized();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const organizationId = user.organizationId;
  const { id } = await params;
  const lead = await getDbLead(id, organizationId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  try {
    const [websiteAudit, gmbAudit] = await Promise.all([
      getLatestLeadIntelligence(id).then((audit) => audit ?? runLeadIntelligenceAudit(id, organizationId)),
      getLatestGmbAudit(id).then((audit) => audit ?? runGmbAudit(id, organizationId))
    ]);
    const settings = user.role === "super_admin" ? null : await getOrganizationApiConfig(organizationId);
    return NextResponse.json({
      pitch: await generateLeadCallPitch(lead, websiteAudit, gmbAudit, {
        force: true,
        brandName: user.organization?.companyName,
        openaiApiKey: settings?.openaiApiKey
      })
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Call pitch could not be generated."
    }, { status: 400 });
  }
}
