import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentSession } from "@/lib/auth";
import { deleteAdultLead, updateAdultLead } from "@/lib/adultLeadStore";

const updateSchema = z.object({
  reviewStatus: z.enum(["Unverified", "Reviewed", "Rejected"]).optional(),
  notes: z.string().max(2000).nullable().optional()
});

async function requireAdmin() {
  const session = await currentSession();
  return session?.role === "admin";
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid update." }, { status: 400 });
  }
  try {
    const { id } = await params;
    return NextResponse.json({ lead: await updateAdultLead(id, parsed.data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lead could not be updated." }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await params;
    await deleteAdultLead(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lead could not be deleted." }, { status: 400 });
  }
}
