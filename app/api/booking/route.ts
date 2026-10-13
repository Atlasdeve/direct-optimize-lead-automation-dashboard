import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getBookingWorkspace, saveBookingSettings } from "@/lib/booking";
import { isOperationsRole } from "@/lib/roles";

export async function GET() {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role) || !user.organizationId) return NextResponse.json({ error: "Booking management requires an operations account." }, { status: 403 });
  try {
    const workspace = await getBookingWorkspace(user.organizationId);
    return NextResponse.json(workspace, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Booking workspace could not be loaded." }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role) || !user.organizationId) return NextResponse.json({ error: "Booking management requires an operations account." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  try {
    const settings = await saveBookingSettings(user.organizationId, body);
    return NextResponse.json({ settings, message: "Booking settings saved." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Booking settings could not be saved." }, { status: 400 });
  }
}
