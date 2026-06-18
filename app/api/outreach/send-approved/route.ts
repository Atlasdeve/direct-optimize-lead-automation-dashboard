import { NextRequest, NextResponse } from "next/server";
import { sendApprovedEmails } from "@/lib/dbStore";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const region = typeof body.region === "string" ? body.region : undefined;
  const limit = typeof body.limit === "number" ? body.limit : 25;
  return NextResponse.json(await sendApprovedEmails({ region, limit }));
}
