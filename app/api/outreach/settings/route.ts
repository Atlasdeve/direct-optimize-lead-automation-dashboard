import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getOutreachAutomationSettings, saveOutreachAutomationSettings } from "@/lib/dbStore";

export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ settings: await getOutreachAutomationSettings() });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const settings = await saveOutreachAutomationSettings({
    firstFollowUpDays: body.firstFollowUpDays,
    finalFollowUpDays: body.finalFollowUpDays,
    batchSize: body.batchSize
  });
  return NextResponse.json({ settings });
}
