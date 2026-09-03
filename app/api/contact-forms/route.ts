import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listContactFormQueue, markContactFormAction } from "@/lib/dbStore";
import { isOperationsRole } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperationsRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const organizationId = user.organizationId;
  const region = request.nextUrl.searchParams.get("region") ?? undefined;
  return NextResponse.json({ contacts: await listContactFormQueue(region, organizationId) });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperationsRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const organizationId = user.organizationId;
  const body = await request.json().catch(() => ({}));
  const contactId = typeof body.contactId === "string" ? body.contactId : "";
  const action = body.action;
  const message = typeof body.message === "string" ? body.message : undefined;

  if (!contactId || !["opened", "submitted", "skipped"].includes(action)) {
    return NextResponse.json({ error: "contactId and valid action are required" }, { status: 400 });
  }

  return NextResponse.json({ contact: await markContactFormAction(contactId, action, message, organizationId) });
}
