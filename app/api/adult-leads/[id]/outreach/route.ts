import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentSession } from "@/lib/auth";
import { approveAdultLeadForOutreach, cancelAdultLeadOutreachApproval } from "@/lib/adultLeadStore";
import { isOperationsRole } from "@/lib/roles";

const schema = z.object({
  action: z.enum(["approve", "cancel"])
}).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!isOperationsRole(session?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Select a valid outreach action." }, { status: 400 });
  }

  try {
    const { id } = await params;
    const lead = parsed.data.action === "approve"
      ? await approveAdultLeadForOutreach(id)
      : await cancelAdultLeadOutreachApproval(id);
    return NextResponse.json({ lead });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Outreach approval could not be updated."
    }, { status: 400 });
  }
}
