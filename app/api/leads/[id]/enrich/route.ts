import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { enrichLeadForDetails, getDbLead } from "@/lib/dbStore";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const lead = await getDbLead(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const result = await enrichLeadForDetails(lead);
  return NextResponse.json(result);
}
