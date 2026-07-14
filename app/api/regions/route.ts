import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createRegion, listEnabledRegions } from "@/lib/regionStore";

export async function GET() {
  return NextResponse.json({ regions: await listEnabledRegions() });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const region = await createRegion({
      name: typeof body.name === "string" ? body.name : "",
      country: typeof body.country === "string" ? body.country : "",
      timezone: typeof body.timezone === "string" ? body.timezone : ""
    });
    return NextResponse.json({ region, regions: await listEnabledRegions() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Region could not be created." }, { status: 400 });
  }
}
