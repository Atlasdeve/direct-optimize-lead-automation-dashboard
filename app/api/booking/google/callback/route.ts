import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { completeGoogleCalendarConnection, googleCalendarStateCookieName, verifyGoogleCalendarOAuthState } from "@/lib/googleCalendar";
import { isOperationsRole } from "@/lib/roles";

function redirect(request: NextRequest, status: string) {
  const url = new URL("/booking", request.url);
  url.searchParams.set("calendar", status);
  return url;
}

function responseWithClearedState(request: NextRequest, status: string) {
  const response = NextResponse.redirect(redirect(request, status));
  response.cookies.set(googleCalendarStateCookieName(), "", { maxAge: 0, path: "/api/booking/google" });
  return response;
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  const receivedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(googleCalendarStateCookieName())?.value;
  const state = receivedState && receivedState === expectedState ? verifyGoogleCalendarOAuthState(receivedState) : null;
  if (!user || !isOperationsRole(user.role) || !user.organizationId || !state || state.userId !== user.id || state.organizationId !== user.organizationId) {
    return responseWithClearedState(request, "invalid_state");
  }
  if (request.nextUrl.searchParams.get("error")) return responseWithClearedState(request, "declined");
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return responseWithClearedState(request, "failed");
  try {
    await completeGoogleCalendarConnection({ organizationId: user.organizationId, code });
    return responseWithClearedState(request, "connected");
  } catch {
    return responseWithClearedState(request, "failed");
  }
}
