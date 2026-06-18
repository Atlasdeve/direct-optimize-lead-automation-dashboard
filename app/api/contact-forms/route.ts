import { NextRequest, NextResponse } from "next/server";
import { listContactFormQueue, markContactFormAction } from "@/lib/dbStore";

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") ?? undefined;
  return NextResponse.json({ contacts: await listContactFormQueue(region) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const contactId = typeof body.contactId === "string" ? body.contactId : "";
  const action = body.action;
  const message = typeof body.message === "string" ? body.message : undefined;

  if (!contactId || !["opened", "submitted", "skipped"].includes(action)) {
    return NextResponse.json({ error: "contactId and valid action are required" }, { status: 400 });
  }

  return NextResponse.json({ contact: await markContactFormAction(contactId, action, message) });
}
