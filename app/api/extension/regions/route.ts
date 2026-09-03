import { NextResponse } from "next/server";
import { listEnabledRegions } from "@/lib/regionStore";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth";
import { isOperationsRole } from "@/lib/roles";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type"
};

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...corsHeaders, ...(init?.headers ?? {}) }
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  let organizationId: string | null | undefined;
  if (bearer && bearer === process.env.LEAD_CAPTURE_API_KEY) organizationId = "org_direct_optimize";
  if (bearer && !organizationId) {
    const tenant = await prisma.organizationApiSetting.findFirst({ where: { leadCaptureApiKey: bearer }, select: { organizationId: true } });
    organizationId = tenant?.organizationId;
  }
  if (!organizationId) {
    const user = await currentUser().catch(() => null);
    if (!user || !isOperationsRole(user.role)) return json({ error: "Unauthorized" }, { status: 401 });
    organizationId = user.organizationId;
  }
  const regions = await listEnabledRegions(organizationId);
  return json({
    regions: regions.map((region) => ({
      name: region.name,
      label: region.label || region.name,
      country: region.country
    }))
  });
}
