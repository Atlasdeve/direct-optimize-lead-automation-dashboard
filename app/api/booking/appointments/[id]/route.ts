import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { cancelBookingAppointment } from "@/lib/booking";
import { isOperationsRole } from "@/lib/roles";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role) || !user.organizationId) {
    return NextResponse.json({ error: "Booking management requires an operations account." }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  if (body.action !== "cancel") return NextResponse.json({ error: "Choose a valid booking action." }, { status: 400 });
  try {
    const result = await cancelBookingAppointment(user.organizationId, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Booking could not be cancelled." }, { status: 400 });
  }
}
