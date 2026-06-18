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

export async function GET(request: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params;
  const destination = safeRedirectUrl(request.nextUrl.searchParams.get("url"));
  if (!destination) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  await recordEmailClick(logId, destination, requestMeta(request));
  return NextResponse.redirect(destination);
}
