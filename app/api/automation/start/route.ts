import { NextRequest, NextResponse } from "next/server";
import { enqueueAutomation } from "@/lib/queue";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const region = typeof body.region === "string" ? body.region : "Canada";
  const city = typeof body.city === "string" ? body.city : undefined;
  const categories = Array.isArray(body.categories) ? body.categories.filter((item: unknown): item is string => typeof item === "string") : undefined;
  const maxResults = typeof body.maxResults === "number" ? body.maxResults : undefined;
  const result = await enqueueAutomation(region, { city, categories, maxResults });
  return NextResponse.json(result);
}
