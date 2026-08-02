import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isOperationsRole } from "@/lib/roles";
import { generateLeadCallPitch, getLatestLeadCallPitch } from "@/lib/callPitch";
import { getDbLead, getLatestGmbAudit, getLatestLeadIntelligence, runGmbAudit, runLeadIntelligenceAudit } from "@/lib/dbStore";

async function authorized() {
  const user = await currentUser();
  return Boolean(user && isOperationsRole(user.role));
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ pitch: await getLatestLeadCallPitch(id) });
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const lead = await getDbLead(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  try {
    const [websiteAudit, gmbAudit] = await Promise.all([
      getLatestLeadIntelligence(id).then((audit) => audit ?? runLeadIntelligenceAudit(id)),
      getLatestGmbAudit(id).then((audit) => audit ?? runGmbAudit(id))
    ]);
    return NextResponse.json({
      pitch: await generateLeadCallPitch(lead, websiteAudit, gmbAudit, { force: true })
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Call pitch could not be generated."
    }, { status: 400 });
  }
}
