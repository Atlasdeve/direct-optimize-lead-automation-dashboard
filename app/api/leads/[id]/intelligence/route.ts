import { NextResponse } from "next/server";
import { getLatestLeadIntelligence, runLeadIntelligenceAudit } from "@/lib/dbStore";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ audit: await getLatestLeadIntelligence(id) });
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ audit: await runLeadIntelligenceAudit(id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lead intelligence audit failed" },
      { status: 400 }
    );
  }
}
