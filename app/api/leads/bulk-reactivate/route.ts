import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { listNotRespondedLeads, reactivateNotRespondedLead } from "@/lib/notRespondedLeads";
import { isOperationsRole } from "@/lib/roles";

const requestSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(500).transform((ids) => [...new Set(ids)])
});

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Select between 1 and 500 leads to reactivate." }, { status: 400 });
  }

  const eligibleIds = new Set((await listNotRespondedLeads(user.organizationId)).map((lead) => lead.id));
  if (parsed.data.ids.some((id) => !eligibleIds.has(id))) {
    return NextResponse.json({ error: "Selection contains a lead that is no longer in Not Responded. Refresh and try again." }, { status: 400 });
  }

  const reactivatedIds: string[] = [];
  for (const id of parsed.data.ids) {
    try {
      await reactivateNotRespondedLead(id, user.organizationId);
      reactivatedIds.push(id);
    } catch {
      return NextResponse.json({
        reactivatedIds,
        reactivatedCount: reactivatedIds.length,
        error: "Some leads could not be reactivated. Refresh and retry the remaining selection."
      }, { status: 409 });
    }
  }

  return NextResponse.json({ reactivatedIds, reactivatedCount: reactivatedIds.length });
}
