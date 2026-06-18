import { NextResponse } from "next/server";
import { getLeadChecklist, updateLeadChecklist } from "@/lib/dbStore";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ checklist: await getLeadChecklist(id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({ checklist: await updateLeadChecklist(id, body) });
}
