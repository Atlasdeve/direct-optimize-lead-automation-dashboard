import { NextRequest, NextResponse } from "next/server";
import { createOpportunity, listOpportunities } from "@/lib/dbStore";

export async function GET() {
  return NextResponse.json({ opportunities: await listOpportunities() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.leadId !== "string") {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }
  return NextResponse.json({ opportunity: await createOpportunity(body) });
}
