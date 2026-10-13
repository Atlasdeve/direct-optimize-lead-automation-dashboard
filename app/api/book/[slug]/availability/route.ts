import { NextRequest, NextResponse } from "next/server";
import { BookingAvailabilityError, getPublicBookingAvailability } from "@/lib/booking";

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const date = request.nextUrl.searchParams.get("date") || "";
  try {
    const { profile, slots } = await getPublicBookingAvailability(slug, date);
    return NextResponse.json({
      timezone: profile.settings.timezone,
      slots
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const status = error instanceof BookingAvailabilityError && error.code === "not_found" ? 404 : error instanceof BookingAvailabilityError && error.code === "calendar_unavailable" ? 503 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Availability could not be loaded." }, { status });
  }
}
