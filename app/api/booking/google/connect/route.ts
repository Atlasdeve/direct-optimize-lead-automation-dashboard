import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { buildGoogleCalendarAuthorizationUrl, createGoogleCalendarOAuthState, googleCalendarConfiguration, googleCalendarStateCookieName } from "@/lib/googleCalendar";
import { isOperationsRole } from "@/lib/roles";

function bookingRedirect(request: NextRequest, status: string) {
  const url = new URL("/booking", request.url);
  url.searchParams.set("calendar", status);
  return url;
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role) || !user.organizationId) {
    return NextResponse.redirect(bookingRedirect(request, "unauthorized"));
  }
  if (!googleCalendarConfiguration().configured) {
    return NextResponse.redirect(bookingRedirect(request, "configuration_required"));
  }

  try {
    const state = createGoogleCalendarOAuthState({ organizationId: user.organizationId, userId: user.id });
    const response = NextResponse.redirect(buildGoogleCalendarAuthorizationUrl(state));
    response.cookies.set(googleCalendarStateCookieName(), state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60,
      path: "/api/booking/google"
    });
    return response;
  } catch {
    return NextResponse.redirect(bookingRedirect(request, "configuration_required"));
  }
}
