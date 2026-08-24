import { NextRequest, NextResponse } from "next/server";
import { createAppNotification } from "@/lib/appNotifications";
import { updateCallLog } from "@/lib/callStore";
import { prisma } from "@/lib/prisma";

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

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const data = body?.data?.payload ?? body?.data ?? body;
  const state = decodeClientState(data?.client_state);
  const callLogId = state?.callLogId;
  if (!callLogId) return NextResponse.json({ ok: true });

  const status = statusFromEvent(body?.data?.event_type || data?.event_type, data?.hangup_cause);
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

