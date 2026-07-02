import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { callOutcomes, createCallLog, listLeadCallLogs, listStandaloneCallLogs } from "@/lib/callStore";
import { getDbLead } from "@/lib/dbStore";
import { integratedCallingAllowed, normalizeE164, telnyxCallingConfigured, validE164 } from "@/lib/telnyxCalling";

function parseFollowUp(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const leadId = request.nextUrl.searchParams.get("leadId");
  if (request.nextUrl.searchParams.get("standalone") === "1") {
    return NextResponse.json({
      calls: await listStandaloneCallLogs(),
      callingProvider: "telnyx",
      providerConfigured: telnyxCallingConfigured(),
      outcomes: callOutcomes
    });
  }
  if (!leadId) return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  const lead = await getDbLead(leadId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({
    calls: await listLeadCallLogs(leadId),
    callingProvider: "telnyx",
    providerConfigured: telnyxCallingConfigured(),
    browserCallingAllowed: integratedCallingAllowed(lead.region),
    callablePhone: normalizeE164(lead.phone ?? ""),
    outcomes: callOutcomes
  });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user || !["admin", "employee"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  const provider = body.provider === "telnyx" ? "telnyx" : "manual";
  const lead = leadId ? await getDbLead(leadId) : null;
  if (leadId && !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const phone = normalizeE164(typeof body.phone === "string" ? body.phone : lead?.phone ?? "");
  if (!validE164(phone)) return NextResponse.json({ error: "A valid E.164 phone number is required." }, { status: 400 });

  if (provider === "telnyx") {
    if (lead && !integratedCallingAllowed(lead.region)) {
      return NextResponse.json({ error: "Integrated calling is limited to USA, Canada, and UK leads." }, { status: 400 });
    }
    if (!telnyxCallingConfigured()) {
      return NextResponse.json({ error: "Telnyx calling is not configured yet." }, { status: 503 });
    }
  }

  const outcome = typeof body.outcome === "string" && callOutcomes.includes(body.outcome as (typeof callOutcomes)[number]) ? body.outcome : undefined;
  const call = await createCallLog({
    leadId: leadId || null,
    userId: user.id,
    contactName: typeof body.contactName === "string" ? body.contactName.trim().slice(0, 160) : undefined,
    companyName: typeof body.companyName === "string" ? body.companyName.trim().slice(0, 160) : undefined,
    provider,
    phone,
    outcome,
    notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 4000) : undefined,
    durationSeconds: provider === "manual" ? Math.max(0, Math.min(86400, Number(body.durationSeconds) || 0)) : 0,
    followUpAt: parseFollowUp(body.followUpAt)
  });
  return NextResponse.json({ call }, { status: 201 });
}
