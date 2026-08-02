import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isOperationsRole } from "@/lib/roles";
import { reactivateNotRespondedLead } from "@/lib/notRespondedLeads";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    return NextResponse.json({ lead: await reactivateNotRespondedLead(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lead could not be reactivated.";
    return NextResponse.json({ error: message }, { status: message === "Lead not found." ? 404 : 400 });
  }
}
