import { NextRequest, NextResponse } from "next/server";
import { BookingAvailabilityError, createPublicBooking } from "@/lib/booking";
import { checkRateLimit, requestFingerprint } from "@/lib/security";

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const rateLimit = checkRateLimit(requestFingerprint(request, `public-booking:${slug}`), 8, 60 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many booking attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const booking = await createPublicBooking(slug, body);
    return NextResponse.json(booking, { status: 201, headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const status = error instanceof BookingAvailabilityError && error.code === "not_found" ? 404 : error instanceof BookingAvailabilityError && error.code === "slot_unavailable" ? 409 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Booking could not be created." }, { status });
  }
}
