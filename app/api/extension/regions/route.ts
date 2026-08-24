import { NextResponse } from "next/server";
import { listEnabledRegions } from "@/lib/regionStore";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
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

export async function GET() {
  const regions = await listEnabledRegions();
  return json({
    regions: regions.map((region) => ({
      name: region.name,
      country: region.country
    }))
  });
}
