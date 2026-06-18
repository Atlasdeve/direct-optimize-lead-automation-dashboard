import { NextResponse } from "next/server";
import { getLatestGmbAudit, runGmbAudit } from "@/lib/dbStore";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ audit: await getLatestGmbAudit(id) });
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ audit: await runGmbAudit(id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GMB audit failed" },
      { status: 400 }
    );
  }
}
