import { NextRequest, NextResponse } from "next/server";
import { recordEmailOpen } from "@/lib/dbStore";

const trackingPixel = Buffer.from(
  "R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64"
);

function requestMeta(request: NextRequest) {
  return {
    userAgent: request.headers.get("user-agent"),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip")
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params;
  await recordEmailOpen(logId, requestMeta(request));
  return new NextResponse(trackingPixel, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}
