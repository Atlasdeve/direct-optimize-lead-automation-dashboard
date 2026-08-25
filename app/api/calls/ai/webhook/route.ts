import { NextRequest, NextResponse } from "next/server";
import { createAppNotification } from "@/lib/appNotifications";
import { updateCallLog } from "@/lib/callStore";
import { prisma } from "@/lib/prisma";
import { normalizeE164, validE164 } from "@/lib/telnyxCalling";

function decodeClientState(value?: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as { callLogId?: string; leadId?: string };
  } catch {
    return null;
  }
}

function statusFromEvent(eventType?: string, hangupCause?: string) {
  const type = (eventType || "").toLowerCase();
  const cause = (hangupCause || "").toLowerCase();
  if (type.includes("answered")) return "in-progress";
  if (type.includes("initiated")) return "requesting";
  if (type.includes("ringing")) return "ringing";
  if (type.includes("hangup")) {
    if (cause.includes("busy")) return "busy";
    if (cause.includes("no_answer") || cause.includes("timeout")) return "no-answer";
    return "completed";
  }
  return null;
}

async function transferInboundCall(data: Record<string, any>, eventType?: string) {
  const type = (eventType || "").toLowerCase();
  const direction = String(data?.direction || "").toLowerCase();
  const callControlId = typeof data?.call_control_id === "string" ? data.call_control_id : "";
  const forwardTo = normalizeE164(process.env.TELNYX_INBOUND_FORWARD_NUMBER || "");
  const from = normalizeE164(data?.to || process.env.TELNYX_PHONE_NUMBER || "");
  if (type !== "call.initiated" || direction !== "incoming" || !callControlId) return false;
  if (!process.env.TELNYX_API_KEY || !validE164(forwardTo) || !validE164(from)) return false;

  const response = await fetch(`https://api.telnyx.com/v2/calls/${encodeURIComponent(callControlId)}/actions/transfer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      to: forwardTo,
      from,
      timeout_secs: 30
    })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    console.error("Telnyx inbound transfer failed", payload?.errors?.[0]?.detail || payload?.message || response.status);
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const data = body?.data?.payload ?? body?.data ?? body;
  const eventType = body?.data?.event_type || data?.event_type;
  await transferInboundCall(data, eventType).catch((error) => {
    console.error("Telnyx inbound transfer error", error instanceof Error ? error.message : error);
  });
  const state = decodeClientState(data?.client_state);
  const callLogId = state?.callLogId;
  if (!callLogId) return NextResponse.json({ ok: true });

  const status = statusFromEvent(eventType, data?.hangup_cause);
  if (!status) return NextResponse.json({ ok: true });

  const call = await updateCallLog(callLogId, { status }).catch(() => null);
  if (call && ["completed", "busy", "no-answer", "failed"].includes(status)) {
    const full = await prisma.callLog.findUnique({
      where: { id: callLogId },
      include: { lead: { select: { id: true, companyName: true } } }
    });
    if (full?.lead) {
      await createAppNotification({
        type: "ai_call_finished",
        title: "AI call finished",
        message: `${full.lead.companyName}: ${status.replace("-", " ")}.`,
        actionUrl: `/leads/${full.lead.id}`,
        leadId: full.lead.id
      }).catch(() => undefined);
    }
  }
  return NextResponse.json({ ok: true });
}
