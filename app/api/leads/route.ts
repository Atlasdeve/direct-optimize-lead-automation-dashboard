import { NextRequest, NextResponse } from "next/server";
import { listDbLeads } from "@/lib/dbStore";

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") ?? undefined;
  return NextResponse.json({ leads: await listDbLeads(region) });
}
