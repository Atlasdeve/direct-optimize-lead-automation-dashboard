import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listDbLeads } from "@/lib/dbStore";

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const region = request.nextUrl.searchParams.get("region") ?? undefined;
  return NextResponse.json({ leads: await listDbLeads(region, user.organizationId) });
}
