import { NextRequest, NextResponse } from "next/server";
import { recordEmailClick } from "@/lib/dbStore";

function requestMeta(request: NextRequest) {
  return {
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip")
  };
}

function safeRedirectUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function trackedDestination(value: string, tracking: Awaited<ReturnType<typeof recordEmailClick>>, linkLabel: string | null) {
  const url = new URL(value);
  const source = url.searchParams.get("utm_source") || "direct_optimize_email";
  const medium = url.searchParams.get("utm_medium") || "email";
  const campaign = url.searchParams.get("utm_campaign") || tracking.campaign || "lead_outreach";
  const content = url.searchParams.get("utm_content") || tracking.utmContent || tracking.logId;
  const term = url.searchParams.get("utm_term") || linkLabel || "link";
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("utm_content", content);
  url.searchParams.set("utm_term", term);
  return url.toString();
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params;
  const destination = safeRedirectUrl(request.nextUrl.searchParams.get("url"));
  if (!destination) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  const linkLabel = request.nextUrl.searchParams.get("link");
  const tracking = await recordEmailClick(logId, destination, requestMeta(request), linkLabel);
  return NextResponse.redirect(trackedDestination(destination, tracking, linkLabel));
}
