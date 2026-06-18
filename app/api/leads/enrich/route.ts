import { NextRequest, NextResponse } from "next/server";
import { enrichLeadsForDetails } from "@/lib/dbStore";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const region = typeof body.region === "string" ? body.region : undefined;
  const limit = typeof body.limit === "number" ? body.limit : 10;
  const result = await enrichLeadsForDetails({ region, limit });
  return NextResponse.json(result);
}
