import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getAdultLeadAutomationOverview, updateAdultLeadAutomationSettings } from "@/lib/adultLeadAutomation";
import { isOperationsRole } from "@/lib/roles";

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  localHour: z.number().int().min(0).max(23).optional(),
  maxResults: z.number().int().min(1).max(10).optional()
}).strict().refine((value) => Object.keys(value).length > 0, "No changes were provided.");

async function requireAdmin() {
  const user = await currentUser();
  return user && isOperationsRole(user.role) ? user : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await getAdultLeadAutomationOverview());
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid automation settings." }, { status: 400 });
  }
  await updateAdultLeadAutomationSettings(parsed.data);
  return NextResponse.json(await getAdultLeadAutomationOverview());
}
