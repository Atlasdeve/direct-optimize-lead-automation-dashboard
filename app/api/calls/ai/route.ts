import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { aiAppointmentCallingConfigured, aiCallMaxDurationSeconds, aiCallStreamUrl } from "@/lib/aiAppointmentCall";
import { currentUser } from "@/lib/auth";
import { createAppNotification } from "@/lib/appNotifications";
import { createCallLog, updateCallLog } from "@/lib/callStore";
import { getDbLead } from "@/lib/dbStore";
import { normalizeE164, validE164 } from "@/lib/telnyxCalling";

function connectionId() {
  return process.env.TELNYX_CALL_CONTROL_CONNECTION_ID || "";
}

function callbackUrl(request: NextRequest) {
  const base = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "";
  if (!base.startsWith("https://")) return undefined;
  return new URL("/api/calls/ai/webhook", base).toString();
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user || !["admin", "employee"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  if (!leadId) return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  const lead = await getDbLead(leadId);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  if (lead.do_not_contact || lead.unsubscribed) {
    return NextResponse.json({ error: "This lead is marked as do-not-contact." }, { status: 400 });
  }

  const phone = normalizeE164(lead.phone ?? "");
  if (!validE164(phone)) return NextResponse.json({ error: "Lead does not have a valid E.164 phone number." }, { status: 400 });
  const fromNumber = normalizeE164(process.env.TELNYX_PHONE_NUMBER || "");
  if (!validE164(fromNumber)) {
    return NextResponse.json({ error: "TELNYX_PHONE_NUMBER must be a valid E.164 number, for example +17278004968." }, { status: 503 });
  }
  if (!aiAppointmentCallingConfigured(request.headers.get("origin"))) {
    return NextResponse.json({
      error: "AI calling is not configured. Add OPENAI_API_KEY, TELNYX_CALL_CONTROL_CONNECTION_ID, TELNYX_PHONE_NUMBER, APP_PUBLIC_URL, and AI_CALL_STREAM_SECRET. TELNYX_CALL_CONTROL_CONNECTION_ID must be a Call Control App ID, not the SIP/WebRTC connection ID."
    }, { status: 503 });
  }

  const call = await createCallLog({
    leadId,
    userId: user.id,
    contactName: lead.decision_maker_name || lead.manager_name || lead.owner_name || undefined,
    companyName: lead.company_name,
    provider: "ai-telnyx",
    phone,
    status: "queued",
    notes: "AI appointment setter call queued. The AI is limited to audit permission, contact preference, and meeting request."
  });
  if (!call) return NextResponse.json({ error: "Unable to create AI call log." }, { status: 500 });

  try {
    const streamUrl = aiCallStreamUrl(call.id, request.headers.get("origin"));
    const response = await fetch("https://api.telnyx.com/v2/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        connection_id: connectionId(),
        to: phone,
        from: fromNumber,
        timeout_secs: 30,
        client_state: Buffer.from(JSON.stringify({ callLogId: call.id, leadId })).toString("base64"),
        webhook_url: callbackUrl(request),
        stream_url: streamUrl,
        stream_track: "inbound_track",
        stream_codec: "PCMU",
        stream_bidirectional_mode: "rtp",
        stream_bidirectional_codec: "PCMU",
        stream_bidirectional_target_legs: "self",
        stream_bidirectional_sampling_rate: 8000,
        send_silence_when_idle: true,
        command_id: crypto.randomUUID()
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.errors?.[0]?.detail || payload?.message || `Telnyx AI call request failed with HTTP ${response.status}`;
      await updateCallLog(call.id, { status: "failed", notes: `AI appointment call failed before dialing: ${message}` });
      return NextResponse.json({ error: message }, { status: 502 });
    }
    const callControlId = payload?.data?.call_control_id || payload?.data?.call_leg_id || payload?.data?.id;
    const updated = await updateCallLog(call.id, {
      providerCallSid: typeof callControlId === "string" ? callControlId : undefined,
      status: "requesting",
      notes: `AI appointment setter call started. Max duration: ${aiCallMaxDurationSeconds()} seconds.`
    });
    await createAppNotification({
      type: "ai_call_started",
      title: "AI call started",
      message: `${lead.company_name} is being called by the AI appointment setter.`,
      actionUrl: `/leads/${leadId}`,
      leadId
    }).catch(() => undefined);
    return NextResponse.json({ call: updated }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start AI call.";
    await updateCallLog(call.id, { status: "failed", notes: `AI appointment call failed before dialing: ${message}` }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
