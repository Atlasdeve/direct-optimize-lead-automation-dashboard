import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createRegion, listEnabledRegions } from "@/lib/regionStore";
import { isOperationsRole } from "@/lib/roles";

export async function GET() {
  const user = await currentUser().catch(() => null);
  return NextResponse.json({ regions: await listEnabledRegions(user?.organizationId) });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user || !isOperationsRole(user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const region = await createRegion({
      name: typeof body.name === "string" ? body.name : "",
      country: typeof body.country === "string" ? body.country : "",
      timezone: typeof body.timezone === "string" ? body.timezone : "",
      organizationId: user.organizationId
    });
    return NextResponse.json({ region, regions: await listEnabledRegions(user.organizationId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Region could not be created." }, { status: 400 });
  }
}
