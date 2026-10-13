import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { disconnectGoogleCalendar } from "@/lib/googleCalendar";
import { isOperationsRole } from "@/lib/roles";

export async function DELETE() {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role) || !user.organizationId) {
    return NextResponse.json({ error: "Booking management requires an operations account." }, { status: 403 });
  }
  await disconnectGoogleCalendar(user.organizationId);
  return NextResponse.json({ ok: true, message: "Google Calendar disconnected." });
}
