import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { callOutcomes, getCallLog, updateCallLog } from "@/lib/callStore";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || !["admin", "employee"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await getCallLog(id))) return NextResponse.json({ error: "Call log not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const outcome = body.outcome === null || (typeof body.outcome === "string" && callOutcomes.includes(body.outcome as (typeof callOutcomes)[number]))
    ? body.outcome
    : undefined;
  const followUpAt = body.followUpAt === null
    ? null
    : typeof body.followUpAt === "string" && !Number.isNaN(new Date(body.followUpAt).getTime())
      ? new Date(body.followUpAt)
      : undefined;
  const call = await updateCallLog(id, {
    providerCallSid: typeof body.providerCallSid === "string" ? body.providerCallSid : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
    outcome,
    notes: body.notes === null ? null : typeof body.notes === "string" ? body.notes.trim().slice(0, 4000) : undefined,
    durationSeconds: typeof body.durationSeconds === "number" ? Math.max(0, Math.min(86400, body.durationSeconds)) : undefined,
    followUpAt
  });
  return NextResponse.json({ call });
}
